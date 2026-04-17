// SE Validator presentation deck
// Zero-build static module. Loads sample reports from ../../results/ and
// renders them inside slide panels. No framework.

const TOTAL_SLIDES = 8;

// Slide 3: catalog bad vs good.
const SLIDE_3_REPORTS = {
  bad: {
    file: "agent-catalog-review-bad-content-update-report.md",
    label: "fixtures/catalog/bad-content-update-nested-variants.json"
  },
  good: {
    file: "agent-catalog-review-good-feed-report.md",
    label: "fixtures/catalog/good-feed.xml + good-feed-cat.xml"
  }
};

// Slide 4: frontend bad vs good.
const SLIDE_4_REPORTS = {
  bad: {
    file: "agent-ui-review-bad-report.md",
    label: "fixtures/frontend/autocomplete-bad.html"
  },
  good: {
    file: "agent-ui-review-good-report.md",
    label: "fixtures/frontend/autocomplete-datalayer-styled.html"
  }
};

// Slide 5: pull a real docs citation from the clean UI report.
const SLIDE_5_REPORT = {
  file: "agent-ui-review-good-report.md",
  // Prefer a citation whose title contains "collector" so the audience sees
  // a concrete, name-recognizable doc link.
  preferredSlug: "analytics/collector"
};

// Slide 7: browser-verified report.
const SLIDE_7_REPORT = {
  file: "agent-ui-review-browser-report.md"
};

const state = { current: 1 };

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("slide-total").textContent = String(TOTAL_SLIDES);
  renderDots();
  wireNav();
  wireKeyboard();
  handleHashOrDefault();
  window.addEventListener("hashchange", handleHashOrDefault);

  hydrateSlide3().catch((err) => console.error("Slide 3 hydration failed:", err));
  hydrateSlide4().catch((err) => console.error("Slide 4 hydration failed:", err));
  hydrateSlide5().catch((err) => console.error("Slide 5 hydration failed:", err));
  hydrateSlide7().catch((err) => console.error("Slide 7 hydration failed:", err));
});

// ---------- Navigation ----------

function handleHashOrDefault() {
  const fromHash = parseInt(window.location.hash.replace("#", ""), 10);
  const target = Number.isFinite(fromHash) && fromHash >= 1 && fromHash <= TOTAL_SLIDES ? fromHash : 1;
  goto(target, { pushHash: false });
}

function goto(n, { pushHash = true } = {}) {
  const clamped = Math.max(1, Math.min(TOTAL_SLIDES, n));
  state.current = clamped;

  document.querySelectorAll(".slide").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.slide) === clamped);
  });
  document.getElementById("slide-current").textContent = String(clamped);
  document.getElementById("prev-btn").disabled = clamped === 1;
  document.getElementById("next-btn").disabled = clamped === TOTAL_SLIDES;

  document.querySelectorAll(".dots button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.slide) === clamped);
  });

  if (pushHash) {
    const next = `#${clamped}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }
}

function wireNav() {
  document.getElementById("prev-btn").addEventListener("click", () => goto(state.current - 1));
  document.getElementById("next-btn").addEventListener("click", () => goto(state.current + 1));
}

function wireKeyboard() {
  document.addEventListener("keydown", (ev) => {
    if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
    if (ev.key === "ArrowRight" || ev.key === " " || ev.key === "PageDown") {
      ev.preventDefault();
      goto(state.current + 1);
    } else if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
      ev.preventDefault();
      goto(state.current - 1);
    } else if (ev.key === "Home") {
      ev.preventDefault();
      goto(1);
    } else if (ev.key === "End") {
      ev.preventDefault();
      goto(TOTAL_SLIDES);
    } else if (/^[1-9]$/.test(ev.key)) {
      const n = Number(ev.key);
      if (n >= 1 && n <= TOTAL_SLIDES) {
        ev.preventDefault();
        goto(n);
      }
    }
  });
}

function renderDots() {
  const ol = document.getElementById("slide-dots");
  ol.innerHTML = "";
  for (let i = 1; i <= TOTAL_SLIDES; i++) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.slide = String(i);
    btn.setAttribute("aria-label", `Go to slide ${i}`);
    btn.addEventListener("click", () => goto(i));
    li.appendChild(btn);
    ol.appendChild(li);
  }
}

// ---------- Slide 3: catalog bad vs good ----------

async function hydrateSlide3() {
  const [bad, good] = await Promise.all([
    loadReport(SLIDE_3_REPORTS.bad.file),
    loadReport(SLIDE_3_REPORTS.good.file)
  ]);
  fillCompareCol("bad", bad, SLIDE_3_REPORTS.bad, { withCaps: false });
  fillCompareCol("good", good, SLIDE_3_REPORTS.good, { withCaps: false });
}

// ---------- Slide 4: frontend bad vs good ----------

async function hydrateSlide4() {
  const [bad, good] = await Promise.all([
    loadReport(SLIDE_4_REPORTS.bad.file),
    loadReport(SLIDE_4_REPORTS.good.file)
  ]);
  fillCompareCol("ui-bad", bad, SLIDE_4_REPORTS.bad, { withCaps: true });
  fillCompareCol("ui-good", good, SLIDE_4_REPORTS.good, { withCaps: true });
}

function fillCompareCol(role, report, meta, { withCaps }) {
  document.getElementById(`${role}-source`).textContent = meta.label;

  const findingsEl = document.getElementById(`${role}-findings`);

  if (!report) {
    findingsEl.innerHTML =
      `<div class="slide-error">Could not load <code>results/${meta.file}</code>. ` +
      `Serve the repo root with <code>npx serve .</code> and visit ` +
      `<code>/tools/presentation/</code> so the browser can fetch sibling files.</div>`;
    return;
  }

  const score = report.score ?? "–";
  document.getElementById(`${role}-score`).textContent = `${score}/100`;
  document.getElementById(`${role}-p0`).textContent = String(report.summary.P0);
  document.getElementById(`${role}-p1`).textContent = String(report.summary.P1);
  document.getElementById(`${role}-p2`).textContent = String(report.summary.P2);

  const openLink = document.getElementById(`${role}-open`);
  openLink.href = `../../results/${meta.file}`;
  openLink.title = `Open ${meta.file} in a new tab`;

  if (withCaps) {
    renderCapabilities(document.getElementById(`${role}-caps`), report.capabilities);
  }

  findingsEl.innerHTML = "";
  if (report.findings.length === 0) {
    findingsEl.innerHTML = `<div class="empty-good">No findings. Score ${score}/100 · READY.</div>`;
    return;
  }

  const priorityRank = { P0: 0, P1: 1, P2: 2 };
  const top = [...report.findings]
    .sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9))
    .slice(0, 3);

  for (const f of top) findingsEl.appendChild(renderFinding(f));

  const remaining = report.findings.length - top.length;
  if (remaining > 0) {
    const note = document.createElement("p");
    note.className = "muted";
    note.style.fontSize = "0.82rem";
    note.style.margin = "0";
    note.textContent = `+ ${remaining} more finding${remaining === 1 ? "" : "s"} in the full report.`;
    findingsEl.appendChild(note);
  }
}

function renderCapabilities(container, capabilityLines) {
  if (!container) return;
  container.innerHTML = "";
  if (!capabilityLines || capabilityLines.length === 0) {
    container.innerHTML = `<span class="muted" style="font-size:0.78rem">No capabilities detected.</span>`;
    return;
  }
  // Each line looks like:
  //   "<path>: endpoints=autocomplete, top_items; analytics=Autocomplete view, click/select"
  // Concatenate endpoints + analytics across all input files.
  const groups = { endpoints: new Set(), analytics: new Set() };
  for (const line of capabilityLines) {
    const detail = line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
    for (const part of detail.split(";")) {
      const [label, items] = part.split("=");
      if (!label || !items) continue;
      const key = label.trim().toLowerCase();
      const values = items.split(",").map((s) => s.trim()).filter(Boolean);
      if (key === "endpoints") values.forEach((v) => groups.endpoints.add(v));
      else if (key === "analytics") values.forEach((v) => groups.analytics.add(v));
    }
  }

  const rows = [
    { label: "endpoints", values: [...groups.endpoints] },
    { label: "analytics", values: [...groups.analytics] }
  ];
  for (const row of rows) {
    if (row.values.length === 0) continue;
    const wrap = document.createElement("div");
    wrap.className = "caps-row";
    wrap.innerHTML =
      `<span class="cap-label">${row.label}</span>` +
      row.values.map((v) => `<span class="cap-chip">${escapeHtml(v)}</span>`).join(" ");
    container.appendChild(wrap);
  }
}

function renderFinding(f) {
  const article = document.createElement("article");
  article.className = `finding ${f.priority.toLowerCase()}`;

  const head = document.createElement("div");
  head.className = "finding-head";
  const badge = document.createElement("span");
  badge.className = `badge ${f.priority.toLowerCase()}`;
  badge.textContent = f.priority;
  const id = document.createElement("span");
  id.className = "finding-id";
  id.textContent = f.id || "FINDING";
  head.appendChild(badge);
  head.appendChild(id);
  article.appendChild(head);

  if (f.problem) {
    const p = document.createElement("p");
    p.className = "finding-problem";
    p.textContent = f.problem;
    article.appendChild(p);
  }
  if (f.fix) {
    const fix = document.createElement("p");
    fix.className = "finding-fix";
    fix.innerHTML = `<strong>Fix:</strong> ${escapeHtml(f.fix)}`;
    article.appendChild(fix);
  }
  if (f.evidence) {
    const ev = document.createElement("div");
    ev.className = "finding-evidence mono";
    ev.textContent = f.evidence;
    article.appendChild(ev);
  }
  return article;
}

// ---------- Slide 5: real docs citation ----------

async function hydrateSlide5() {
  const report = await loadReport(SLIDE_5_REPORT.file);
  if (!report) {
    document.getElementById("slide-5-citation-title").textContent =
      `Could not load ${SLIDE_5_REPORT.file}`;
    return;
  }

  const citations = report.docsConsulted || [];
  if (citations.length === 0) {
    document.getElementById("slide-5-citation-title").textContent =
      "No citations found in report.";
    return;
  }

  const preferred =
    citations.find((c) => c.slug && c.slug.includes(SLIDE_5_REPORT.preferredSlug)) ||
    citations[0];

  const titleEl = document.getElementById("slide-5-citation-title");
  const pathEl = document.getElementById("slide-5-citation-path");
  const reasonEl = document.getElementById("slide-5-citation-reason");
  const excerptEl = document.getElementById("slide-5-citation-excerpt");

  // Title as a hyperlink to docs.luigisbox.com when we have a slug.
  if (preferred.slug) {
    const absolute = `https://docs.luigisbox.com/${preferred.slug}`;
    titleEl.innerHTML =
      `<a href="${absolute}" target="_blank" rel="noopener">` +
      `${escapeHtml(preferred.title)}</a> ` +
      `<span class="muted" style="font-weight:400">· ${escapeHtml(preferred.slug)}</span>`;
  } else {
    titleEl.textContent = preferred.title;
  }

  // Strip the local docs-root prefix so the path stays readable on screen.
  const shortPath = preferred.path.replace(/^.*\/docs\//, "docs/");
  pathEl.textContent = shortPath;

  reasonEl.innerHTML = preferred.reason
    ? `<strong>Why:</strong> ${escapeHtml(preferred.reason)}`
    : "";

  if (preferred.excerpt) {
    excerptEl.textContent = `“${preferred.excerpt}”`;
  } else {
    excerptEl.remove();
  }
}

// ---------- Slide 7: browser verification ----------

async function hydrateSlide7() {
  const report = await loadReport(SLIDE_7_REPORT.file);
  const findingSlot = document.getElementById("browser-static-finding");
  const statsSlot = document.getElementById("browser-stats");

  if (!report) {
    findingSlot.innerHTML =
      `<div class="slide-error">Could not load <code>results/${SLIDE_7_REPORT.file}</code>.</div>`;
    return;
  }

  // Pick a finding that pairs naturally with the browser stats block — prefer
  // the analytics-missing P0, fall back to any P0, then any finding.
  const preferred =
    report.findings.find((f) => /ANALYTICS_MISSING/i.test(f.id)) ||
    report.findings.find((f) => f.priority === "P0") ||
    report.findings[0];

  if (preferred) {
    findingSlot.appendChild(renderFinding(preferred));
  } else {
    findingSlot.innerHTML =
      `<div class="muted">No findings in ${SLIDE_7_REPORT.file}.</div>`;
  }

  const stats = extractBrowserStats(report.rawBody || "");
  statsSlot.innerHTML = "";
  if (stats.length === 0) {
    statsSlot.innerHTML =
      `<li><span class="stat-key">No browser evidence captured</span></li>`;
    return;
  }
  for (const s of stats) {
    const li = document.createElement("li");
    const valClass = s.value === 0 ? "zero" : "nonzero";
    li.innerHTML =
      `<span class="stat-key">${escapeHtml(s.key)}</span>` +
      `<span class="stat-val ${valClass}">${escapeHtml(String(s.value))}</span>`;
    statsSlot.appendChild(li);
  }
}

function extractBrowserStats(rawBody) {
  // The report's Browser Evidence section emits lines like:
  //   - Autocomplete requests: 1
  //   - Analytics requests: 0
  //   - dataLayer events: 0
  // We pluck the "<key>: <n>" pairs after the section header.
  const lines = rawBody.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^##\s+Browser Evidence/i.test(l));
  if (startIdx === -1) return [];
  const stopIdx = lines.findIndex((l, i) => i > startIdx && /^##\s/.test(l));
  const slice = lines.slice(startIdx + 1, stopIdx === -1 ? lines.length : stopIdx);

  const stats = [];
  const seen = new Set();
  for (const raw of slice) {
    const m = raw.match(/^\s*-\s+([A-Za-z][A-Za-z ]+?):\s*(-?\d+)\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    // Skip the "Observed N ..." first-line summaries; they're noisy for a stat list.
    if (/^Observed/i.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    stats.push({ key, value: Number(m[2]) });
  }
  return stats;
}

// ---------- Report loading + lean parser ----------

async function loadReport(file) {
  const url = `../../results/${file}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseReport(text);
  } catch (err) {
    console.warn(`Report load failed for ${file}:`, err);
    return null;
  }
}

function parseReport(text) {
  const lines = text.split(/\r?\n/);
  const parsed = {
    title: "",
    score: null,
    summary: { P0: 0, P1: 0, P2: 0 },
    findings: [],
    capabilities: [],
    docsConsulted: [],
    rawBody: text
  };

  const titleLine = lines.find((l) => l.startsWith("# "));
  parsed.title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : "";

  const headerEnd = lines.findIndex((l) => /^##\s/.test(l));
  const header = headerEnd === -1 ? lines : lines.slice(0, headerEnd);
  for (const l of header) {
    const ms = l.match(/^Score:\s*(\d+)\/\d+/);
    if (ms) parsed.score = Number(ms[1]);
    const mf = l.match(/Findings:\s*P0=(\d+)\s*P1=(\d+)\s*P2=(\d+)/);
    if (mf) parsed.summary = { P0: +mf[1], P1: +mf[2], P2: +mf[3] };
  }

  const sections = splitSections(lines);

  const findingsSec = sections["Review Findings"];
  if (findingsSec) parsed.findings = parseFindings(findingsSec);

  const capsSec = sections["Detected Capabilities"];
  if (capsSec) parsed.capabilities = collectListItems(capsSec);

  const docsSec = sections["Docs Consulted"];
  if (docsSec) parsed.docsConsulted = parseDocsConsulted(docsSec);

  return parsed;
}

function splitSections(lines) {
  const out = {};
  let name = null;
  let buf = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (name) out[name] = buf;
      name = m[1];
      buf = [];
    } else if (name) {
      buf.push(line);
    }
  }
  if (name) out[name] = buf;
  return out;
}

function collectListItems(sectionLines) {
  const out = [];
  for (const l of sectionLines) {
    const m = l.match(/^-\s+(.+)$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function parseFindings(sectionLines) {
  const out = [];
  let cur = null;
  for (const raw of sectionLines) {
    const line = raw.replace(/\r$/, "");
    const head = line.match(/^###\s+(P[0-2])\s+(.+)$/);
    if (head) {
      if (cur) out.push(cur);
      cur = {
        priority: head[1],
        id: head[2].trim(),
        problem: "",
        fix: "",
        evidence: "",
        snippet: "",
        docs: ""
      };
      continue;
    }
    if (!cur) continue;
    const kv = line.match(/^([A-Za-z][A-Za-z ]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const value = kv[2];
    if (key === "problem") cur.problem = value;
    else if (key === "recommended fix") cur.fix = value;
    else if (key === "evidence") cur.evidence = value;
    else if (key === "snippet") cur.snippet = value.replace(/^`(.+)`$/, "$1");
    else if (key === "docs") cur.docs = value;
  }
  if (cur) out.push(cur);
  return out;
}

function parseDocsConsulted(sectionLines) {
  const out = [];
  let cur = null;
  for (const raw of sectionLines) {
    const line = raw.replace(/\r$/, "");
    const start = line.match(/^-\s+(.+)$/);
    if (start) {
      if (cur) out.push(cur);
      const header = start[1];
      const hm = header.match(/^(.+?)(?:\s+\(([^)]+)\))?:\s*(.+)$/);
      cur = {
        title: hm ? hm[1].trim() : header,
        slug: hm ? (hm[2] || "") : "",
        path: hm ? hm[3].trim() : "",
        reason: "",
        excerpt: ""
      };
      continue;
    }
    const kv = line.match(/^\s+([A-Za-z]+):\s*(.*)$/);
    if (kv && cur) {
      const key = kv[1].toLowerCase();
      if (key === "reason") cur.reason = kv[2];
      else if (key === "excerpt") cur.excerpt = kv[2];
    }
  }
  if (cur) out.push(cur);
  return out;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
