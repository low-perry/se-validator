// se-validator Report Viewer
// Pure static ES module - no build step, no frameworks.
// Parses Markdown reports and JSON reports (`--json` output) produced by
// `validate {catalog,analytics,service,frontend}` and `agent review-ui`.

const TABS = ["catalog", "ui", "findings", "docs", "structure", "raw"];

// Sample reports that ship with the repo. They live at ../../results/ relative
// to this page, so opening index.html via file:// picks them up automatically.
const SAMPLE_REPORTS = [
  {
    file: "agent-catalog-review-good-feed-report.md",
    label: "Catalog review: good feed (clean)",
    group: "catalog"
  },
  {
    file: "agent-catalog-review-content-update-report.md",
    label: "Catalog review: Content Update (clean)",
    group: "catalog"
  },
  {
    file: "agent-catalog-review-bad-content-update-report.md",
    label: "Catalog review: bad Content Update (P0/P1/P2)",
    group: "catalog"
  },
  {
    file: "agent-ui-review-good-report.md",
    label: "UI review: good autocomplete (clean)",
    group: "ui"
  },
  {
    file: "agent-ui-review-bad-report.md",
    label: "UI review: bad autocomplete (P0/P1/P2)",
    group: "ui"
  },
  {
    file: "agent-ui-review-browser-report.md",
    label: "UI review: browser capture",
    group: "ui"
  },
  {
    file: "good-json-catalog-report.md",
    label: "Validate: good JSON catalog",
    group: "validate"
  },
  {
    file: "bad-json-catalog-report.md",
    label: "Validate: bad JSON catalog",
    group: "validate"
  },
  {
    file: "good-autocomplete-frontend-report.md",
    label: "Validate: autocomplete frontend",
    group: "validate"
  },
  {
    file: "good-autocomplete-service-report.md",
    label: "Validate: autocomplete service",
    group: "validate"
  },
  {
    file: "good-analytics-events-api-report.md",
    label: "Validate: analytics events API",
    group: "validate"
  },
  {
    file: "good-datalayer-collector-report.md",
    label: "Validate: DataLayer collector",
    group: "validate"
  }
];

const state = {
  raw: "",
  parsed: null,
  activeTab: null
};

// ---------- Entry point ----------

document.addEventListener("DOMContentLoaded", () => {
  wireFileInput();
  wirePasteArea();
  wireClear();
  wireTabs();
  renderSampleButtons();
});

function wireFileInput() {
  const input = document.getElementById("file-input");
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      loadReport(text, file.name);
    } catch (err) {
      setStatus(`Failed to read file: ${err.message}`, true);
    }
  });
}

function wirePasteArea() {
  const btn = document.getElementById("paste-load-btn");
  const textarea = document.getElementById("paste-area");
  btn.addEventListener("click", () => {
    const value = textarea.value.trim();
    if (!value) {
      setStatus("Paste area is empty.", true);
      return;
    }
    loadReport(value, "pasted-report");
  });
}

function wireClear() {
  document.getElementById("clear-btn").addEventListener("click", () => {
    state.raw = "";
    state.parsed = null;
    state.activeTab = null;
    document.getElementById("file-input").value = "";
    document.getElementById("paste-area").value = "";
    document.getElementById("summary").classList.add("hidden");
    document.getElementById("tab-bar").classList.add("hidden");
    document.getElementById("panels").classList.add("hidden");
    setStatus("");
  });
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;
      activateTab(btn.dataset.tab);
    });
  });
}

async function renderSampleButtons() {
  const container = document.getElementById("sample-buttons");
  container.innerHTML = "";
  for (const sample of SAMPLE_REPORTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sample-btn";
    btn.textContent = sample.label;
    btn.dataset.file = sample.file;
    btn.addEventListener("click", () => loadSample(sample));
    container.appendChild(btn);
  }
}

async function loadSample(sample) {
  const url = `../../results/${sample.file}`;
  setStatus(`Loading ${sample.file}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    loadReport(text, sample.file);
  } catch (err) {
    setStatus(
      `Could not load ${sample.file} (${err.message}). Samples load only when the file exists at ${url}. Use the file picker or paste area instead.`,
      true
    );
  }
}

// ---------- Load pipeline ----------

function loadReport(text, sourceName) {
  state.raw = text;
  const parsed = parseReport(text, sourceName);
  state.parsed = parsed;

  renderSummary(parsed, sourceName);
  renderCatalogPanel(parsed);
  renderUiPanel(parsed);
  renderFindingsPanel(parsed);
  renderDocsPanel(parsed);
  renderStructurePanel(parsed);
  renderRawPanel(text);

  document.getElementById("summary").classList.remove("hidden");
  document.getElementById("tab-bar").classList.remove("hidden");
  document.getElementById("panels").classList.remove("hidden");

  updateTabAvailability(parsed);
  const firstAvailable = TABS.find((t) => !isTabDisabled(t));
  if (firstAvailable) activateTab(firstAvailable);

  setStatus(`Loaded ${sourceName}`);
}

function setStatus(message, isError = false) {
  const el = document.getElementById("loader-status");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
}

// ---------- Parsing ----------

function parseReport(text, sourceName) {
  const trimmed = text.trim();
  if (!trimmed) {
    return emptyParsed();
  }

  if (looksLikeJson(trimmed)) {
    try {
      const obj = JSON.parse(trimmed);
      return fromJsonReport(obj, sourceName);
    } catch (err) {
      // Fall through to Markdown parsing.
    }
  }

  return fromMarkdownReport(text, sourceName);
}

function emptyParsed() {
  return {
    kind: "unknown",
    title: "",
    service: "",
    generatedAt: "",
    score: null,
    summary: { P0: 0, P1: 0, P2: 0 },
    inputs: [],
    artifacts: [],
    capabilities: [],
    findings: [],
    docs: [],
    structures: [],
    nextActions: [],
    rawMarkdown: ""
  };
}

function looksLikeJson(text) {
  const first = text.trimStart()[0];
  return first === "{" || first === "[";
}

// Parse JSON produced by `--json`. Handles both `agent review-ui` and
// `agent review-catalog` shapes, plus simpler `validate` reports.
function fromJsonReport(obj, sourceName) {
  const parsed = emptyParsed();
  parsed.title = obj.title || sourceName;
  parsed.service = obj.service || "";
  parsed.generatedAt = obj.generatedAt || "";
  parsed.inputs = asArray(obj.inputs);
  parsed.rawMarkdown = "";

  const validation = obj.validation || obj;
  parsed.score = numberOrNull(validation.score);
  parsed.summary = validation.summary
    ? {
        P0: validation.summary.P0 ?? 0,
        P1: validation.summary.P1 ?? 0,
        P2: validation.summary.P2 ?? 0
      }
    : parsed.summary;

  parsed.artifacts = asArray(validation.artifacts);
  parsed.capabilities = asArray(validation.capabilities);
  parsed.findings = asArray(validation.findings).map(normalizeJsonFinding);
  parsed.docs = asArray(obj.docsHits).map(normalizeJsonDocsHit);
  parsed.structures = asArray(obj.structures).map(normalizeJsonStructure);
  parsed.nextActions = asArray(obj.nextActions);

  if (parsed.structures.length > 0 || /catalog/i.test(parsed.title) || obj.service === "catalog") {
    parsed.kind = "catalog";
  } else if (obj.service) {
    parsed.kind = "ui";
  } else {
    parsed.kind = "generic";
  }

  return parsed;
}

function normalizeJsonFinding(f) {
  return {
    priority: String(f.priority || f.severity || "P2").toUpperCase(),
    id: f.id || "",
    state: f.state || "",
    area: f.area || "",
    problem: f.problem || f.message || "",
    fix: f.recommendedFix || f.recommendation || f.fix || "",
    evidence: f.evidencePath || f.evidence || "",
    likelyCode: f.likelyCode || "",
    snippet: f.snippet || "",
    docs: asArray(f.docs).join(", "),
    confidence: typeof f.confidence === "number" ? f.confidence : null
  };
}

function normalizeJsonDocsHit(d) {
  return {
    title: d.title || d.path || "",
    path: d.path || "",
    line: d.line ?? "",
    slug: d.slug || "",
    heading: d.heading || "",
    reason: d.reason || "",
    matched: asArray(d.matchedTerms).join(", "),
    excerpt: d.excerpt || ""
  };
}

function normalizeJsonStructure(s) {
  return {
    path: s.path || "",
    sourceKind: s.sourceKind || "",
    role: s.role || "",
    rootKey: s.rootKey || "",
    confidence: typeof s.confidence === "number" ? s.confidence : null,
    recordCount: s.recordCount ?? null,
    objectCounts: s.objectCounts || {},
    requiredCoverage: s.requiredCoverage || {},
    fieldCoverage: asArray(s.fieldCoverage),
    categoryModel: asArray(s.categoryModel),
    contentUpdateModel: asArray(s.contentUpdateModel),
    variantModel: asArray(s.variantModel),
    pairingModel: asArray(s.pairingModel),
    examples: asArray(s.examples)
  };
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

function numberOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

// Parse the Markdown report format produced by the CLI formatters. This is a
// lightweight structural parser - it walks sections by `##` headings and
// findings by `### P<n> <ID>` subheadings.
function fromMarkdownReport(text, sourceName) {
  const parsed = emptyParsed();
  parsed.rawMarkdown = text;

  const lines = text.split(/\r?\n/);

  // Title (first H1 line).
  const titleLine = lines.find((l) => l.startsWith("# "));
  parsed.title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : sourceName;

  // Determine kind.
  if (/catalog review report/i.test(parsed.title)) {
    parsed.kind = "catalog";
  } else if (/ui review report/i.test(parsed.title)) {
    parsed.kind = "ui";
  } else if (/catalog validation report/i.test(parsed.title)) {
    parsed.kind = "catalog-validate";
  } else if (/autocomplete|frontend|service|analytics|collector/i.test(parsed.title)) {
    parsed.kind = "generic";
  } else {
    parsed.kind = "generic";
  }

  // Preamble key/value lines above the first ## heading.
  const preambleEnd = lines.findIndex((l) => /^##\s/.test(l));
  const preambleLines = preambleEnd === -1 ? lines : lines.slice(0, preambleEnd);
  for (const l of preambleLines) {
    const mService = l.match(/^Service:\s*(.+)$/);
    if (mService) parsed.service = mService[1].trim();

    const mGen = l.match(/^Generated:\s*(.+)$/);
    if (mGen) parsed.generatedAt = mGen[1].trim();

    const mScore = l.match(/^Score:\s*(\d+)\/\d+/);
    if (mScore) parsed.score = Number(mScore[1]);

    const mFind = l.match(/Findings:\s*P0=(\d+)\s*P1=(\d+)\s*P2=(\d+)/);
    if (mFind) {
      parsed.summary = { P0: +mFind[1], P1: +mFind[2], P2: +mFind[3] };
    }
  }

  // Sections.
  const sections = splitSections(lines);

  const inputsSec = sections["Inputs Reviewed"];
  if (inputsSec) parsed.inputs = collectListItems(inputsSec);

  const artifactsSec =
    sections["Detected Artifacts"] || sections["Detected Integration Shape"] || sections["Detected artifacts"];
  if (artifactsSec) parsed.artifacts = collectListItems(artifactsSec);

  const capsSec = sections["Detected Capabilities"];
  if (capsSec) parsed.capabilities = collectListItems(capsSec);

  const eventsSec = sections["Detected events"] || sections["Detected Events"];
  if (eventsSec) parsed.capabilities = parsed.capabilities.concat(collectListItems(eventsSec));

  const docsSec = sections["Docs Consulted"];
  if (docsSec) parsed.docs = parseDocsSection(docsSec);

  const structSec = sections["Inferred Catalog Structures"];
  if (structSec) parsed.structures = parseStructuresSection(structSec);

  const findingsSec = sections["Review Findings"];
  if (findingsSec) parsed.findings = parseFindingsSection(findingsSec);

  const nextSec = sections["Next Actions"];
  if (nextSec) parsed.nextActions = collectListItems(nextSec);

  return parsed;
}

// Break the body into sections keyed by their `## Heading` title.
function splitSections(lines) {
  const out = {};
  let current = null;
  let buf = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) out[current] = buf;
      current = m[1];
      buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current) out[current] = buf;
  return out;
}

function collectListItems(sectionLines) {
  const items = [];
  for (const l of sectionLines) {
    const m = l.match(/^-\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

// Docs Consulted is a list of entries separated by blank lines. Each entry
// starts with `- Title (slug): path:line` and has indented `  Reason:`,
// `  Section:`, `  Matched:`, `  Excerpt:` keys.
function parseDocsSection(lines) {
  const entries = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const startMatch = line.match(/^-\s+(.+)$/);
    if (startMatch) {
      if (current) entries.push(current);
      const header = startMatch[1];
      const headerMatch = header.match(/^(.+?)(?:\s+\(([^)]+)\))?:\s*(.+)$/);
      current = {
        title: headerMatch ? headerMatch[1].trim() : header,
        slug: headerMatch ? (headerMatch[2] || "") : "",
        path: headerMatch ? headerMatch[3].trim() : "",
        line: "",
        reason: "",
        heading: "",
        matched: "",
        excerpt: ""
      };
      // Extract trailing ":<line>" from path if present.
      const pm = current.path.match(/^(.+):(\d+)$/);
      if (pm) {
        current.path = pm[1];
        current.line = pm[2];
      }
      continue;
    }

    const kv = line.match(/^\s+([A-Za-z]+):\s*(.*)$/);
    if (kv && current) {
      const key = kv[1].toLowerCase();
      const value = kv[2];
      if (key === "reason") current.reason = value;
      else if (key === "section") current.heading = value;
      else if (key === "matched") current.matched = value;
      else if (key === "excerpt") current.excerpt = value;
    }
  }
  if (current) entries.push(current);
  return entries;
}

// Inferred Catalog Structures has `### <path>` subheadings followed by
// key-value lines and optional `- list items` under headings like
// "Object counts:", "Category model:", "Variant model:".
function parseStructuresSection(lines) {
  const items = [];
  let cur = null;
  let subList = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      if (cur) items.push(cur);
      cur = {
        path: h3[1].trim(),
        sourceKind: "",
        role: "",
        rootKey: "",
        confidence: null,
        recordCount: null,
        objectCounts: {},
        requiredCoverage: {},
        fieldCoverage: [],
        categoryModel: [],
        contentUpdateModel: [],
        variantModel: [],
        pairingModel: [],
        examples: []
      };
      subList = null;
      continue;
    }
    if (!cur) continue;

    const kv = line.match(/^([A-Z][A-Za-z ]+):\s*(.+)$/);
    if (kv) {
      const key = kv[1].trim();
      const val = kv[2].trim();
      switch (key) {
        case "Format":
          cur.sourceKind = val;
          break;
        case "Role":
          cur.role = val;
          break;
        case "Root":
          cur.rootKey = val;
          break;
        case "Records":
          cur.recordCount = Number(val);
          break;
        case "Object counts":
          cur.objectCounts = parseKeyedCounts(val);
          break;
        case "Required coverage":
          cur.requiredCoverage = parseRequiredCoverage(val);
          break;
        case "Common fields":
          cur.fieldCoverage = val.split(",").map((s) => s.trim()).filter(Boolean);
          break;
        case "Category model":
          subList = cur.categoryModel;
          break;
        case "Content Update model":
          subList = cur.contentUpdateModel;
          break;
        case "Variant model":
          subList = cur.variantModel;
          break;
        case "Pairing model":
          subList = cur.pairingModel;
          break;
        case "Examples":
          subList = cur.examples;
          break;
        default:
          break;
      }
      continue;
    }

    const li = line.match(/^-\s+(.+)$/);
    if (li && subList) {
      subList.push(li[1].trim());
    }
  }
  if (cur) items.push(cur);
  return items;
}

function parseKeyedCounts(str) {
  const out = {};
  for (const pair of str.split(",")) {
    const m = pair.trim().match(/^(.+)=(\d+)$/);
    if (m) out[m[1].trim()] = Number(m[2]);
  }
  return out;
}

function parseRequiredCoverage(str) {
  // Example: "identity 28/28 (100%), title 28/28 (100%), web_url 28/28 (100%)"
  const out = {};
  for (const part of str.split(/,\s*/)) {
    const m = part.match(/^(\w+)\s+(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// Findings: `### P0 ID_NAME` followed by indented key/value lines.
function parseFindingsSection(lines) {
  const out = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const head = line.match(/^###\s+(P[0-2])\s+(.+)$/);
    if (head) {
      if (cur) out.push(cur);
      cur = {
        priority: head[1],
        id: head[2].trim(),
        state: "",
        area: "",
        evidence: "",
        problem: "",
        fix: "",
        likelyCode: "",
        snippet: "",
        docs: "",
        confidence: null
      };
      continue;
    }
    if (!cur) continue;

    const kv = line.match(/^([A-Za-z][A-Za-z ]+):\s*(.*)$/);
    if (kv) {
      const key = kv[1].trim().toLowerCase();
      const value = kv[2];
      switch (key) {
        case "state": cur.state = value; break;
        case "area": cur.area = value; break;
        case "evidence": cur.evidence = value; break;
        case "problem": cur.problem = value; break;
        case "recommended fix": cur.fix = value; break;
        case "likely code": cur.likelyCode = value; break;
        case "snippet":
          cur.snippet = value.replace(/^`(.+)`$/, "$1");
          break;
        case "docs": cur.docs = value; break;
        case "confidence":
          cur.confidence = Number(value);
          break;
        default:
          break;
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- Rendering ----------

function renderSummary(parsed, sourceName) {
  setText("summary-name", sourceName);
  setText("summary-type", labelForKind(parsed.kind) + (parsed.service ? ` (${parsed.service})` : ""));
  setText("summary-score", parsed.score === null ? "-" : `${parsed.score}/100`);
  setText("summary-p0", String(parsed.summary.P0));
  setText("summary-p1", String(parsed.summary.P1));
  setText("summary-p2", String(parsed.summary.P2));
  setText("summary-generated", parsed.generatedAt || "-");
}

function labelForKind(kind) {
  switch (kind) {
    case "catalog": return "Catalog review";
    case "ui": return "UI review";
    case "catalog-validate": return "Catalog validation";
    case "generic": return "Validation report";
    default: return "Report";
  }
}

function renderCatalogPanel(parsed) {
  const el = document.getElementById("catalog-content");
  el.innerHTML = "";

  if (parsed.kind !== "catalog" && parsed.kind !== "catalog-validate") {
    el.innerHTML = emptyNotice("This is not a catalog review. Switch to the UI Review or Findings tab.");
    return;
  }

  const header = el.appendChild(document.createElement("section"));
  header.innerHTML = `<p class="muted">Title: <strong>${escapeHtml(parsed.title)}</strong></p>`;

  if (parsed.inputs.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Inputs reviewed</h3>` +
      `<ul>${parsed.inputs.map((i) => `<li><code>${escapeHtml(i)}</code></li>`).join("")}</ul>`;
  }

  if (parsed.artifacts.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Detected artifacts</h3>` +
      `<ul>${parsed.artifacts.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  }

  const topFindings = parsed.findings.slice(0, 5);
  if (topFindings.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Top findings (${parsed.findings.length} total)</h3>` +
      topFindings.map((f) => renderFindingCard(f)).join("");
  } else if (parsed.findings.length === 0) {
    el.appendChild(document.createElement("section")).innerHTML =
      `<p class="empty-state">No findings. Catalog evidence passes the current rule set.</p>`;
  }

  if (parsed.nextActions.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Next actions</h3>` +
      `<ul>${parsed.nextActions.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  }
}

function renderUiPanel(parsed) {
  const el = document.getElementById("ui-content");
  el.innerHTML = "";

  if (parsed.kind !== "ui") {
    el.innerHTML = emptyNotice("This is not a UI review. Switch to the Catalog Review or Findings tab.");
    return;
  }

  const header = el.appendChild(document.createElement("section"));
  header.innerHTML = `<p class="muted">Service: <strong>${escapeHtml(parsed.service || "autocomplete")}</strong></p>`;

  if (parsed.inputs.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Inputs reviewed</h3>` +
      `<ul>${parsed.inputs.map((i) => `<li><code>${escapeHtml(i)}</code></li>`).join("")}</ul>`;
  }

  if (parsed.artifacts.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Detected integration shape</h3>` +
      `<ul>${parsed.artifacts.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  }

  if (parsed.capabilities.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML = `<h3>Detected capabilities</h3>`;
    for (const cap of parsed.capabilities) {
      sec.appendChild(renderCapabilityCard(cap));
    }
  }

  const topFindings = parsed.findings.slice(0, 5);
  if (topFindings.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Top findings (${parsed.findings.length} total)</h3>` +
      topFindings.map((f) => renderFindingCard(f)).join("");
  } else if (parsed.findings.length === 0) {
    el.appendChild(document.createElement("section")).innerHTML =
      `<p class="empty-state">No findings. UI evidence passes the current deterministic rule set.</p>`;
  }

  if (parsed.nextActions.length) {
    const sec = el.appendChild(document.createElement("section"));
    sec.innerHTML =
      `<h3>Next actions</h3>` +
      `<ul>${parsed.nextActions.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  }
}

function renderCapabilityCard(capLine) {
  // Example: "fixtures/frontend/autocomplete-events-api-good.html: endpoints=autocomplete, top_items; analytics=Autocomplete view, click/select"
  const div = document.createElement("div");
  div.className = "cap-card";
  const [pathPart, detailPart] = splitOnce(capLine, ":");
  const path = (pathPart || "").trim();
  const detail = (detailPart || "").trim();

  const groups = detail.split(";").map((s) => s.trim()).filter(Boolean);
  const chipRows = groups.map((group) => {
    const [label, items] = splitOnce(group, "=");
    const values = (items || "").split(",").map((s) => s.trim()).filter(Boolean);
    const chipHtml = values.map((v) => `<span class="cap-chip">${escapeHtml(v)}</span>`).join(" ");
    return `<div class="cap-section"><span class="cap-label">${escapeHtml((label || "").trim())}</span>${chipHtml}</div>`;
  });

  div.innerHTML = `<div><code>${escapeHtml(path)}</code></div>${chipRows.join("")}`;
  return div;
}

function splitOnce(str, sep) {
  const idx = str.indexOf(sep);
  if (idx === -1) return [str, ""];
  return [str.slice(0, idx), str.slice(idx + sep.length)];
}

function renderFindingsPanel(parsed) {
  const el = document.getElementById("findings-content");
  el.innerHTML = "";

  if (parsed.findings.length === 0) {
    el.innerHTML = `<p class="empty-state">No findings in this report.</p>`;
    return;
  }

  const groups = { P0: [], P1: [], P2: [] };
  for (const f of parsed.findings) {
    const key = ["P0", "P1", "P2"].includes(f.priority) ? f.priority : "P2";
    groups[key].push(f);
  }

  for (const key of ["P0", "P1", "P2"]) {
    const list = groups[key];
    if (!list.length) continue;
    const section = document.createElement("section");
    section.className = "finding-group";
    section.innerHTML =
      `<h3><span class="badge ${key.toLowerCase()}">${key}</span> <span class="count">${list.length} finding${list.length === 1 ? "" : "s"}</span></h3>` +
      list.map((f) => renderFindingCard(f)).join("");
    el.appendChild(section);
  }
}

function renderFindingCard(f) {
  const rows = [];
  if (f.area) rows.push(row("Area", escapeHtml(f.area)));
  if (f.state) rows.push(row("State", escapeHtml(f.state)));
  if (f.problem) rows.push(row("Problem", escapeHtml(f.problem)));
  if (f.fix) rows.push(row("Recommended fix", escapeHtml(f.fix)));
  if (f.evidence) rows.push(row("Evidence", `<code>${escapeHtml(f.evidence)}</code>`));
  if (f.likelyCode) rows.push(row("Likely code", `<code>${escapeHtml(f.likelyCode)}</code>`));
  if (f.snippet) rows.push(row("Snippet", `<code class="finding-snippet">${escapeHtml(f.snippet)}</code>`));
  if (f.docs) rows.push(row("Docs", escapeHtml(f.docs)));
  if (f.confidence !== null && f.confidence !== undefined && f.confidence !== "") {
    rows.push(row("Confidence", escapeHtml(String(f.confidence))));
  }

  const priorityClass = (f.priority || "P2").toLowerCase();
  return (
    `<article class="finding-card ${priorityClass}">` +
    `<div class="finding-head">` +
    `<span class="badge ${priorityClass}">${escapeHtml(f.priority)}</span>` +
    `<span class="finding-title">${escapeHtml(f.id)}</span>` +
    `</div>` +
    rows.join("") +
    `</article>`
  );
}

function row(label, valueHtml) {
  return `<div class="finding-row"><span class="label">${escapeHtml(label)}</span> ${valueHtml}</div>`;
}

function renderDocsPanel(parsed) {
  const el = document.getElementById("docs-content");
  el.innerHTML = "";

  if (!parsed.docs.length) {
    el.innerHTML = `<p class="empty-state">No docs were recorded for this report.</p>`;
    return;
  }

  const list = document.createElement("ul");
  list.className = "docs-list";
  for (const d of parsed.docs) {
    const li = document.createElement("li");
    li.className = "docs-item";
    const pathText = d.path + (d.line ? `:${d.line}` : "");
    li.innerHTML =
      `<div class="docs-title">${escapeHtml(d.title || d.path)}</div>` +
      (d.slug ? `<div class="docs-meta">Slug: <code>${escapeHtml(d.slug)}</code></div>` : "") +
      (d.heading ? `<div class="docs-meta">Section: ${escapeHtml(d.heading)}</div>` : "") +
      (d.reason ? `<div class="docs-meta">Reason: ${escapeHtml(d.reason)}</div>` : "") +
      (d.matched ? `<div class="docs-meta">Matched: ${escapeHtml(d.matched)}</div>` : "") +
      (pathText ? `<div class="docs-meta"><code>${escapeHtml(pathText)}</code></div>` : "") +
      (d.excerpt ? `<div class="docs-excerpt">${escapeHtml(d.excerpt)}</div>` : "");
    list.appendChild(li);
  }
  el.appendChild(list);
}

function renderStructurePanel(parsed) {
  const el = document.getElementById("structure-content");
  el.innerHTML = "";

  if (!parsed.structures.length) {
    el.innerHTML = `<p class="empty-state">No structure summaries in this report. (Only catalog reviews emit structure summaries.)</p>`;
    return;
  }

  for (const s of parsed.structures) {
    const card = document.createElement("article");
    card.className = "struct-card";

    const counts = Object.entries(s.objectCounts || {})
      .map(([k, v]) => `${escapeHtml(k)}=${v}`)
      .join(", ");
    const coverage = Object.entries(s.requiredCoverage || {})
      .map(([k, v]) => `${escapeHtml(k)} ${escapeHtml(String(v))}`)
      .join(" · ");

    const listBlock = (title, arr) =>
      arr && arr.length
        ? `<dt>${escapeHtml(title)}</dt><dd><ul>${arr.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul></dd>`
        : "";

    card.innerHTML =
      `<h3><code>${escapeHtml(s.path)}</code></h3>` +
      `<dl>` +
      (s.sourceKind ? `<dt>Format</dt><dd>${escapeHtml(s.sourceKind)}</dd>` : "") +
      (s.role ? `<dt>Role</dt><dd>${escapeHtml(s.role)}</dd>` : "") +
      (s.rootKey ? `<dt>Root</dt><dd><code>${escapeHtml(s.rootKey)}</code></dd>` : "") +
      (s.recordCount !== null ? `<dt>Records</dt><dd>${s.recordCount}</dd>` : "") +
      (counts ? `<dt>Object counts</dt><dd>${counts}</dd>` : "") +
      (coverage ? `<dt>Required coverage</dt><dd>${coverage}</dd>` : "") +
      (s.fieldCoverage.length ? `<dt>Common fields</dt><dd>${s.fieldCoverage.map((f) => `<code>${escapeHtml(f)}</code>`).join(", ")}</dd>` : "") +
      listBlock("Category model", s.categoryModel) +
      listBlock("Content Update model", s.contentUpdateModel) +
      listBlock("Variant model", s.variantModel) +
      listBlock("Pairing model", s.pairingModel) +
      listBlock("Examples", s.examples) +
      `</dl>`;

    el.appendChild(card);
  }
}

function renderRawPanel(text) {
  const el = document.getElementById("raw-content");
  el.textContent = text;
}

// ---------- Tab state ----------

function updateTabAvailability(parsed) {
  const available = {
    catalog: parsed.kind === "catalog" || parsed.kind === "catalog-validate",
    ui: parsed.kind === "ui",
    findings: parsed.findings.length > 0,
    docs: parsed.docs.length > 0,
    structure: parsed.structures.length > 0,
    raw: true
  };
  document.querySelectorAll(".tab").forEach((btn) => {
    const key = btn.dataset.tab;
    btn.classList.toggle("disabled", !available[key]);
    btn.setAttribute("aria-disabled", String(!available[key]));
  });
}

function isTabDisabled(tab) {
  const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
  return !btn || btn.classList.contains("disabled");
}

function activateTab(tab) {
  if (isTabDisabled(tab)) return;
  state.activeTab = tab;
  for (const t of TABS) {
    const btn = document.querySelector(`.tab[data-tab="${t}"]`);
    const panel = document.getElementById(`panel-${t}`);
    if (!btn || !panel) continue;
    const selected = t === tab;
    btn.setAttribute("aria-selected", String(selected));
    panel.hidden = !selected;
  }
}

// ---------- Utilities ----------

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emptyNotice(text) {
  return `<p class="empty-state">${escapeHtml(text)}</p>`;
}
