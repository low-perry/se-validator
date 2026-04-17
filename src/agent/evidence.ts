import { readFile } from "node:fs/promises";
import type { ValidationFinding } from "../core/types.js";
import { parseFrontendArtifacts } from "../frontend/parse.js";
import type { FindingEvidence } from "./types.js";

/**
 * Structure-aware evidence matcher.
 *
 * Two entry points share a scoring core:
 *
 * - `locateFindingEvidence(paths, findings)` — HTML/JS/TS frontend evidence.
 *   Beyond regex scanning, it parses the raw source to find fetch() call
 *   blocks and upweights lines inside the fetch block that targets the
 *   endpoint mentioned in the finding. It also downweights lines inside
 *   HTML/JS comments so a `tracker_id` in a disabled-code comment no longer
 *   beats a real request parameter.
 *
 * - `locateCatalogEvidence(paths, findings)` — JSON/XML catalog evidence.
 *   The matcher walks the raw file and builds a per-line "scope" string such
 *   as `objects[1].nested[2]` (JSON) or `items[0]/item[3]/category[0]` (XML).
 *   Findings whose `evidencePath` hints at a specific path (e.g.
 *   `objects[1].nested[2].identity`) score much higher inside the correct
 *   block than outside. Combined with quoted-value matching from the
 *   finding message and field-name matching, this fixes two failure modes:
 *     1. the first-match regex picking the nearest `"nested":` line instead
 *        of the one inside the right objects[N];
 *     2. frontend matches inside comments beating real parameter sites.
 *
 * Output is deterministic: ties resolve by line number ascending.
 */

const FINDING_PATTERNS: Record<string, RegExp[]> = {
  FRONTEND_AUTOCOMPLETE_ENDPOINT_MISSING: [/autocomplete\/v2/i, /AUTOCOMPLETE_API_URL/, /getSuggestions/i],
  FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING: [/URLSearchParams/i, /autocomplete\/v2/i, /\bsearch\s*:/i, /\bq\s*:/i, /\btracker_id\s*:/i, /\btype\s*:/i, /\bhit_fields\s*:/i],
  FRONTEND_HIT_FIELDS_MISSING: [/URLSearchParams/i, /hit_fields/i, /autocomplete\/v2/i, /top_items/i],
  FRONTEND_DNS_PREFETCH_MISSING: [/<head\b/i, /dns-prefetch/i, /live\.luigisbox\.com/i],
  FRONTEND_AUTOCOMPLETE_DEBOUNCE_MISSING: [/addEventListener\s*\(\s*["']input/i, /getSuggestions/i, /debounce/i],
  FRONTEND_INPUT_LISTENER_MISSING: [/search-input/i, /addEventListener/i, /getSuggestions/i],
  FRONTEND_HITS_NOT_READ: [/response\.json/i, /\.hits\b/i, /\{\s*hits\s*\}/i],
  FRONTEND_HITS_NOT_RENDERED: [/renderResults/i, /hits\.forEach/i, /hits\.map/i],
  FRONTEND_RENDERED_IDENTITY_NOT_HIT_URL: [/dataset\.itemId/i, /data-item-id/i, /item\.url/i, /hit\.url/i],
  FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL: [/item_id/i, /resource_identifier/i, /hit\.url/i, /dataLayer\.push/i],
  FRONTEND_ANALYTICS_PATH_MISSING: [/dataLayer\.push/i, /api\.luigisbox\.com/i, /sendAnalytics/i],
  FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING: [/<head\b/i, /scripts\.luigisbox\.tech/i, /dataLayer\.push/i],
  FRONTEND_DATALAYER_COLLECTOR_SCRIPT_NOT_IN_HEAD: [/scripts\.luigisbox\.tech/i, /<head\b/i],
  FRONTEND_DATALAYER_COLLECTOR_SCRIPT_NOT_ASYNC: [/scripts\.luigisbox\.tech/i, /<script\b/i],
  FRONTEND_EXPECTED_DATALAYER_ANALYTICS_MISSING: [/dataLayer\.push/i, /sendAnalytics/i],
  FRONTEND_EXPECTED_EVENTS_API_ANALYTICS_MISSING: [/api\.luigisbox\.com/i, /fetch\s*\(/i, /axios\.post/i],
  FRONTEND_EVENTS_API_POST_MISSING: [/api\.luigisbox\.com/i, /fetch\s*\(/i, /axios\.post/i],
  FRONTEND_EVENTS_API_CLIENT_ID_MISSING: [/client_id/i, /CLIENT_ID/i, /sendAnalytics/i],
  FRONTEND_EVENTS_API_EVENT_ID_MISSING: [/crypto\.randomUUID/i, /\bid\s*:/i, /sendAnalytics/i],
  FRONTEND_AUTOCOMPLETE_VIEW_ANALYTICS_MISSING: [/Autocomplete/i, /view_item_list/i, /sendAutocompleteView/i],
  FRONTEND_AUTOCOMPLETE_QUERY_ANALYTICS_MISSING: [/search_term/i, /query\s*:/i, /string\s*:/i],
  FRONTEND_AUTOCOMPLETE_ITEMS_NOT_FROM_HITS: [/items\s*:/i, /hits\.map/i, /dataLayer\.push/i],
  FRONTEND_AUTOCOMPLETE_ITEM_POSITION_MISSING: [/position/i, /index\s*\+\s*1/i, /hits\.map/i],
  FRONTEND_AUTOCOMPLETE_NO_RESULTS_NOT_TRACKED: [/No results/i, /hits\.length/i, /items\s*:\s*\[\s*\]/i],
  FRONTEND_AUTOCOMPLETE_CLICK_ANALYTICS_MISSING: [/click/i, /select_item/i, /resource_identifier/i],
  FRONTEND_CLICK_DOES_NOT_USE_RENDERED_IDENTITY: [/dataset\.itemId/i, /getAttribute\s*\(\s*["']data-item-id/i, /click/i],
  FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED: [/top_items/i, /TOP_ITEMS_API_URL/i, /getTopItems/i],
  FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE: [/top_items/i, /TOP_ITEMS_API_URL/i, /getTopItems/i],
  FRONTEND_TOP_ITEMS_FOCUS_LISTENER_MISSING: [/addEventListener\s*\(\s*["']focus/i, /getTopItems/i],
  FRONTEND_TOP_ITEMS_RECOMMENDATION_ANALYTICS_MISSING: [/Recommendation/i, /sendTopItems/i, /trackTopItems/i],
  FRONTEND_TOP_ITEMS_AUTOCOMPLETE_POPUP_PLACEMENT_MISSING: [/autocomplete_popup/i, /RecommenderClientId/i, /Recommender/i],
  FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED: [/trending_queries/i, /TRENDING_QUERIES/i, /getTrending/i],
  FRONTEND_TRENDING_QUERIES_UNEXPECTED_BY_PROFILE: [/trending_queries/i, /TRENDING_QUERIES/i, /getTrending/i],
  FRONTEND_TRENDING_QUERY_TITLES_NOT_MAPPED: [/item\.title/i, /trending/i, /\.map/i],
  FRONTEND_TRENDING_QUERY_USE_NOT_CLEAR: [/placeholder/i, /Search Results/i, /trending/i]
};

// Endpoints that rules frequently talk about. Used to route finding message
// text (e.g. "Top Items") to a fetch-block target URL pattern.
const ENDPOINT_TARGETS: Array<{ test: (finding: ValidationFinding) => boolean; pattern: RegExp }> = [
  {
    test: (finding) => /top[_ ]items/i.test(`${finding.id} ${finding.title} ${finding.message}`),
    pattern: /top_items|TOP_ITEMS_API_URL/i
  },
  {
    test: (finding) => /trending[_ ]quer/i.test(`${finding.id} ${finding.title} ${finding.message}`),
    pattern: /trending_queries|TRENDING_QUERIES/i
  },
  {
    test: (finding) => /events[_ ]api|api\.luigisbox/i.test(`${finding.id} ${finding.title} ${finding.message}`),
    pattern: /api\.luigisbox\.com/i
  },
  {
    test: (finding) => /autocomplete/i.test(`${finding.id} ${finding.title} ${finding.message}`),
    pattern: /autocomplete\/v2|AUTOCOMPLETE_API_URL/i
  }
];

export async function locateFindingEvidence(paths: string[], findings: ValidationFinding[]): Promise<FindingEvidence[]> {
  const artifacts = await parseFrontendArtifacts(paths);
  const indexByPath = new Map<string, FrontendIndex>();
  for (const artifact of artifacts) {
    indexByPath.set(artifact.path, buildFrontendIndex(artifact.raw));
  }

  const evidence: FindingEvidence[] = [];

  for (const finding of findings) {
    const artifact = artifacts.find((candidate) => finding.evidencePath.startsWith(candidate.path)) ?? artifacts[0];
    if (!artifact) continue;
    const index = indexByPath.get(artifact.path);
    if (!index) continue;

    const located = locateFrontendLine(index, finding);
    if (!located) continue;

    evidence.push({
      findingId: finding.id,
      evidencePath: finding.evidencePath,
      path: artifact.path,
      line: located.line,
      snippet: located.snippet,
      reason: located.reason
    });
  }

  return evidence;
}

/**
 * Structure-aware matcher for catalog findings (JSON feeds, XML feeds, or
 * Content Update payloads). Reads files from disk and returns one
 * FindingEvidence per finding that has a locatable line.
 */
export async function locateCatalogEvidence(
  paths: string[],
  findings: ValidationFinding[]
): Promise<FindingEvidence[]> {
  const indexByPath = new Map<string, CatalogIndex>();

  for (const path of paths) {
    const raw = await readFile(path, "utf8").catch(() => "");
    indexByPath.set(path, buildCatalogIndex(path, raw));
  }

  const evidence: FindingEvidence[] = [];

  for (const finding of findings) {
    const path = findCatalogSourcePath(finding.evidencePath, paths);
    if (!path) continue;
    const index = indexByPath.get(path);
    if (!index) continue;

    const located = locateCatalogLine(index, finding);
    if (!located) continue;

    evidence.push({
      findingId: finding.id,
      evidencePath: finding.evidencePath,
      path,
      line: located.line,
      snippet: located.snippet,
      reason: located.reason
    });
  }

  return evidence;
}

// --------------------------------------------------------------------------
// Frontend matching
// --------------------------------------------------------------------------

interface FrontendIndex {
  raw: string;
  lines: string[];
  fetchBlocks: FetchBlock[];
  insideComment: boolean[];
}

interface FetchBlock {
  startLine: number;
  endLine: number;
  target: string;
}

function buildFrontendIndex(raw: string): FrontendIndex {
  const lines = raw.split(/\r?\n/);
  return {
    raw,
    lines,
    fetchBlocks: findFetchBlocks(raw),
    insideComment: markCommentLines(lines)
  };
}

function findFetchBlocks(raw: string): FetchBlock[] {
  const blocks: FetchBlock[] = [];
  const startRe = /\b(?:fetch|axios\.post|axios\.get)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = startRe.exec(raw)) !== null) {
    const openIndex = match.index + match[0].length - 1;
    const closeIndex = findMatchingParen(raw, openIndex);
    if (closeIndex < 0) continue;

    const startLine = offsetToLine(raw, openIndex);
    const endLine = offsetToLine(raw, closeIndex);
    blocks.push({ startLine, endLine, target: raw.slice(openIndex + 1, closeIndex) });
  }
  return blocks;
}

function findMatchingParen(raw: string, openIndex: number): number {
  let depth = 0;
  let inString: string | undefined;
  let inTemplate = false;
  let templateDepth = 0;
  for (let i = openIndex; i < raw.length; i += 1) {
    const ch = raw[i]!;
    const prev = raw[i - 1];
    if (inString) {
      if (ch === inString && prev !== "\\") inString = undefined;
      continue;
    }
    if (inTemplate) {
      if (ch === "`" && prev !== "\\" && templateDepth === 0) {
        inTemplate = false;
        continue;
      }
      if (ch === "$" && raw[i + 1] === "{") {
        templateDepth += 1;
        i += 1;
        continue;
      }
      if (ch === "}" && templateDepth > 0) {
        templateDepth -= 1;
        continue;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function offsetToLine(raw: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < raw.length; i += 1) {
    if (raw[i] === "\n") line += 1;
  }
  return line;
}

function markCommentLines(lines: string[]): boolean[] {
  const result: boolean[] = lines.map(() => false);
  let inHtmlComment = false;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const trimmed = line.trimStart();

    if (inHtmlComment) {
      result[i] = true;
      if (/-->/.test(line)) inHtmlComment = false;
      continue;
    }
    if (inBlockComment) {
      result[i] = true;
      if (/\*\//.test(line)) inBlockComment = false;
      continue;
    }

    if (/^<!--/.test(trimmed)) {
      result[i] = true;
      if (!/-->/.test(line)) inHtmlComment = true;
      continue;
    }

    if (/^\/\*/.test(trimmed)) {
      result[i] = true;
      if (!/\*\//.test(line)) inBlockComment = true;
      continue;
    }

    if (/^\/\//.test(trimmed) || /^\*\s/.test(trimmed)) {
      result[i] = true;
    }
  }

  return result;
}

function locateFrontendLine(
  index: FrontendIndex,
  finding: ValidationFinding
): { line: number; snippet: string; reason: string } | undefined {
  const { lines, fetchBlocks, insideComment } = index;
  const idPatterns = FINDING_PATTERNS[finding.id] ?? fallbackPatterns(finding);
  const hints = extractFrontendHints(finding);
  const endpointTargets = ENDPOINT_TARGETS.filter((entry) => entry.test(finding)).map((entry) => entry.pattern);

  interface Candidate {
    line: number;
    score: number;
    reasons: string[];
  }
  const candidates: Candidate[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const line = lines[lineIdx] ?? "";
    if (!line.trim()) continue;

    let score = 0;
    const reasons: string[] = [];

    // Base: finding-ID-specific regexes.
    for (const pattern of idPatterns) {
      if (!pattern.test(line)) continue;
      score += pattern.source.length;
      reasons.push(`pat:${truncate(pattern.source, 30)}`);
    }
    if (score === 0) continue;

    // Preserve previous bumps so winners on clean code stay the same.
    if (/fetch|axios|URLSearchParams|dataLayer|api\.luigisbox|live\.luigisbox/.test(line)) score += 20;
    if (/\bsearch\s*:/.test(line) || /\bq\s*:/.test(line)) score += 50;
    if (/<head\b/i.test(line)) score += 50;
    if (/dataset\.itemId|item_id|resource_identifier|items\s*:|hits\.map/.test(line)) score += 30;
    if (/TODO|console\.log/.test(line)) score -= 5;

    // Upweight exact quoted literals mentioned in the finding.
    for (const value of hints.quotedValues) {
      if (matchesDelimitedValue(line, value)) {
        score += 50;
        reasons.push(`value:${truncate(value, 30)}`);
      }
    }

    // Upweight explicit field-name mentions.
    for (const field of hints.fieldNames) {
      if (new RegExp(`\\b${escapeRegExp(field)}\\b`).test(line)) {
        score += 30;
        reasons.push(`field:${field}`);
      }
    }

    // Big boost if we are inside a fetch block whose call site targets the
    // relevant endpoint.
    if (endpointTargets.length > 0) {
      const block = fetchBlocks.find(
        (candidate) => lineIdx + 1 >= candidate.startLine && lineIdx + 1 <= candidate.endLine
      );
      if (block && endpointTargets.some((pattern) => pattern.test(block.target))) {
        score += 60;
        reasons.push("fetch:matched-endpoint");
      }
    }

    // Comments should not win the race.
    if (insideComment[lineIdx]) {
      score -= 40;
      reasons.push("comment:-40");
    }

    candidates.push({ line: lineIdx + 1, score, reasons });
  }

  if (candidates.length === 0) return undefined;

  candidates.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    return left.line - right.line;
  });

  const winner = candidates[0]!;
  return {
    line: winner.line,
    snippet: truncate((lines[winner.line - 1] ?? "").trim(), 180),
    reason: winner.reasons.join(", ")
  };
}

function extractFrontendHints(finding: ValidationFinding): { quotedValues: string[]; fieldNames: string[] } {
  const quotedValues: string[] = [];
  const fieldNames: string[] = [];
  const pool = `${finding.message} ${finding.title}`;

  for (const match of pool.matchAll(/"([^"\n]{2,80})"/g)) {
    const value = match[1]!;
    if (/^\s+$/.test(value)) continue;
    quotedValues.push(value);
  }

  for (const match of pool.matchAll(/`([A-Za-z_][A-Za-z0-9_]{1,40})`/g)) {
    fieldNames.push(match[1]!);
  }

  const keywordRe = /\b(tracker_id|hit_fields|client_id|event_id|item_id|resource_identifier|search_term|item_group_id|category_id|availability_rank|availability|web_url|identity|nested|objects|primary_category|primary|hierarchy|ancestors)\b/g;
  for (const match of pool.matchAll(keywordRe)) {
    fieldNames.push(match[1]!);
  }

  return { quotedValues, fieldNames };
}

function fallbackPatterns(finding: ValidationFinding): RegExp[] {
  const terms = [finding.title, finding.message, finding.remediation]
    .join(" ")
    .split(/[^A-Za-z0-9_.-]+/)
    .filter((term) => term.length >= 5)
    .slice(0, 8)
    .map((term) => new RegExp(escapeRegExp(term), "i"));

  return terms.length > 0 ? terms : [/.+/];
}

// --------------------------------------------------------------------------
// Catalog matching
// --------------------------------------------------------------------------

interface CatalogIndex {
  path: string;
  kind: "json" | "xml" | "unknown";
  lines: string[];
  lineScope: string[];
}

function findCatalogSourcePath(evidencePath: string, paths: string[]): string | undefined {
  for (const path of paths) {
    if (evidencePath.startsWith(path)) return path;
  }
  return paths[0];
}

function buildCatalogIndex(path: string, raw: string): CatalogIndex {
  const lines = raw.split(/\r?\n/);
  const kind = detectCatalogKind(path, raw);
  if (kind === "json") return { path, kind, lines, lineScope: buildJsonScope(lines) };
  if (kind === "xml") return { path, kind, lines, lineScope: buildXmlScope(lines) };
  return { path, kind, lines, lineScope: lines.map(() => "") };
}

function detectCatalogKind(path: string, raw: string): "json" | "xml" | "unknown" {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".xml")) return "xml";
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<")) return "xml";
  return "unknown";
}

/**
 * Per-line scope strings for a JSON document, e.g. "objects[1].nested[2]".
 * The scope reflects the path at the START of each line. Best-effort
 * character scan (no JSON reparser).
 */
function buildJsonScope(lines: string[]): string[] {
  interface Frame {
    kind: "object" | "array";
    key: string | undefined;
    arrayIndex: number;
  }
  const stack: Frame[] = [];
  const result: string[] = [];
  let inString = false;
  let stringStart = 0;
  let escapeNext = false;

  const scopePath = (): string => {
    const parts: string[] = [];
    for (const frame of stack) {
      if (frame.kind === "object") {
        if (frame.key) parts.push(parts.length === 0 ? frame.key : `.${frame.key}`);
      } else if (frame.kind === "array") {
        if (parts.length === 0) parts.push(`[${frame.arrayIndex}]`);
        else parts[parts.length - 1] = `${parts[parts.length - 1]}[${frame.arrayIndex}]`;
      }
    }
    return parts.join("");
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    result.push(scopePath());

    const line = lines[lineIdx] ?? "";
    let charIdx = 0;
    while (charIdx < line.length) {
      const ch = line[charIdx]!;

      if (inString) {
        if (escapeNext) {
          escapeNext = false;
          charIdx += 1;
          continue;
        }
        if (ch === "\\") {
          escapeNext = true;
          charIdx += 1;
          continue;
        }
        if (ch === '"') {
          const value = line.slice(stringStart, charIdx);
          inString = false;
          let lookAhead = charIdx + 1;
          while (lookAhead < line.length && /\s/.test(line[lookAhead]!)) lookAhead += 1;
          if (line[lookAhead] === ":") {
            const top = stack[stack.length - 1];
            if (top && top.kind === "object") top.key = value;
            charIdx = lookAhead + 1;
            continue;
          }
          charIdx += 1;
          continue;
        }
        charIdx += 1;
        continue;
      }

      if (ch === '"') {
        inString = true;
        stringStart = charIdx + 1;
        charIdx += 1;
        continue;
      }

      if (ch === "{") {
        stack.push({ kind: "object", key: undefined, arrayIndex: 0 });
        charIdx += 1;
        continue;
      }

      if (ch === "[") {
        stack.push({ kind: "array", key: undefined, arrayIndex: 0 });
        charIdx += 1;
        continue;
      }

      if (ch === "}" || ch === "]") {
        stack.pop();
        const parent = stack[stack.length - 1];
        if (parent && parent.kind === "object") parent.key = undefined;
        charIdx += 1;
        continue;
      }

      if (ch === ",") {
        const top = stack[stack.length - 1];
        if (top) {
          if (top.kind === "array") top.arrayIndex += 1;
          else top.key = undefined;
        }
        charIdx += 1;
        continue;
      }

      charIdx += 1;
    }
  }

  return result;
}

/**
 * Per-line scope strings for an XML document, e.g.
 * "items[0]/item[3]/category[0]". Sibling indices are tracked per parent so
 * the third `<item>` at depth 1 becomes `item[2]`. Self-closing and
 * single-line elements do not alter the scope.
 */
function buildXmlScope(lines: string[]): string[] {
  interface Frame {
    tag: string;
    siblingIndexByTag: Map<string, number>;
    myIndex: number;
  }
  const stack: Frame[] = [];
  const rootSiblings = new Map<string, number>();
  const result: string[] = [];

  const scopePath = (): string => {
    if (stack.length === 0) return "";
    return stack.map((frame) => `${frame.tag}[${frame.myIndex}]`).join("/");
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    result.push(scopePath());

    const line = lines[lineIdx] ?? "";
    if (/^\s*<\?/.test(line) || /^\s*<!--/.test(line)) continue;

    interface Event {
      index: number;
      kind: "open" | "close" | "selfclose";
      tag: string;
    }
    const events: Event[] = [];

    const openRe = /<([A-Za-z_][A-Za-z0-9:_.-]*)(?:\s[^>]*?)?(\/)?>/g;
    let match: RegExpExecArray | null;
    while ((match = openRe.exec(line)) !== null) {
      events.push({ index: match.index, kind: match[2] === "/" ? "selfclose" : "open", tag: match[1]! });
    }

    const closeRe = /<\/([A-Za-z_][A-Za-z0-9:_.-]*)\s*>/g;
    while ((match = closeRe.exec(line)) !== null) {
      events.push({ index: match.index, kind: "close", tag: match[1]! });
    }

    events.sort((left, right) => left.index - right.index);

    for (const event of events) {
      if (event.kind === "selfclose") continue;

      if (event.kind === "open") {
        const parent = stack[stack.length - 1];
        const siblingMap = parent ? parent.siblingIndexByTag : rootSiblings;
        const prev = siblingMap.get(event.tag) ?? -1;
        const myIndex = prev + 1;
        siblingMap.set(event.tag, myIndex);
        stack.push({ tag: event.tag, siblingIndexByTag: new Map<string, number>(), myIndex });
        continue;
      }

      for (let depth = stack.length - 1; depth >= 0; depth -= 1) {
        if (stack[depth]!.tag === event.tag) {
          stack.length = depth;
          break;
        }
      }
    }
  }

  return result;
}

interface CatalogHints {
  quotedValues: string[];
  fieldNames: string[];
  jsonScope: string | undefined;
  xmlScopeSuffixes: string[];
}

function extractCatalogHints(finding: ValidationFinding): CatalogHints {
  const quotedValues: string[] = [];
  const fieldNames: string[] = [];

  const pool = `${finding.message} ${finding.evidencePath}`;
  for (const match of pool.matchAll(/"([^"\n]{1,120})"/g)) {
    const value = match[1]!;
    if (!value.trim()) continue;
    if (/^[a-z]+(\s[a-z]+){2,}$/i.test(value)) continue;
    quotedValues.push(value);
  }

  const structuralPath = finding.evidencePath.includes(":")
    ? finding.evidencePath.split(":").slice(1).join(":")
    : finding.evidencePath;

  const lastField = structuralPath.match(/\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (lastField) fieldNames.push(lastField[1]!);

  for (const match of finding.message.matchAll(/`([A-Za-z_][A-Za-z0-9_]{1,40})`/g)) {
    fieldNames.push(match[1]!);
  }

  return {
    quotedValues,
    fieldNames,
    jsonScope: inferJsonScope(structuralPath),
    xmlScopeSuffixes: inferXmlScopeSuffixes(structuralPath)
  };
}

function inferJsonScope(structuralPath: string): string | undefined {
  const objectsMatch = structuralPath.match(/^(objects(?:\[\d+\](?:\.nested(?:\[\d+\])?)?)?)/);
  if (objectsMatch) return objectsMatch[1];
  return undefined;
}

function inferXmlScopeSuffixes(structuralPath: string): string[] {
  const feedMatch = structuralPath.match(/^([a-z-]+-feed)\[(\d+)\]/);
  if (!feedMatch) return [];
  const role = feedMatch[1]!;
  const index = Number.parseInt(feedMatch[2]!, 10);
  if (!Number.isFinite(index)) return [];

  const tagsByRole: Record<string, string[]> = {
    "product-feed": ["item", "product"],
    "category-feed": ["category"],
    "brand-feed": ["brand"],
    "article-feed": ["article"]
  };
  const tags = tagsByRole[role] ?? [];
  return tags.map((tag) => `${tag}[${index}]`);
}

function locateCatalogLine(
  index: CatalogIndex,
  finding: ValidationFinding
): { line: number; snippet: string; reason: string } | undefined {
  const { kind, lines, lineScope } = index;
  const hints = extractCatalogHints(finding);

  interface Candidate {
    line: number;
    score: number;
    reasons: string[];
  }
  const candidates: Candidate[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const line = lines[lineIdx] ?? "";
    if (!line.trim()) continue;
    const scope = lineScope[lineIdx] ?? "";
    let score = 0;
    const reasons: string[] = [];

    // Quoted literal value match (identities, paths, etc).
    // Require the value to be delimited by quotes, angle brackets, or word
    // boundaries so a quoted `"category"` doesn't match `"category-child"`.
    for (const value of hints.quotedValues) {
      if (matchesDelimitedValue(line, value)) {
        score += 40;
        reasons.push(`value:${truncate(value, 30)}`);
      }
    }

    // Field-name match in the appropriate syntax.
    for (const field of hints.fieldNames) {
      if (kind === "json" && new RegExp(`"${escapeRegExp(field)}"\\s*:`).test(line)) {
        score += 25;
        reasons.push(`field:${field}`);
        continue;
      }
      if (kind === "xml" && new RegExp(`<\\/?${escapeRegExp(field)}(\\s|>|\\/?>|$)`).test(line)) {
        score += 25;
        reasons.push(`field:${field}`);
      }
    }

    // Structural scope match — the big win.
    if (kind === "json" && hints.jsonScope) {
      if (scope === hints.jsonScope) {
        score += 80;
        reasons.push("scope:exact");
      } else if (scope.startsWith(`${hints.jsonScope}.`) || scope.startsWith(`${hints.jsonScope}[`)) {
        score += 55;
        reasons.push("scope:inside");
      }
    }

    if (kind === "xml" && hints.xmlScopeSuffixes.length > 0) {
      for (const suffix of hints.xmlScopeSuffixes) {
        if (scope === suffix || scope.endsWith(`/${suffix}`) || scope.startsWith(`${suffix}/`)) {
          score += 70;
          reasons.push("scope:xml-inside");
          break;
        }
      }
    }

    // Finding-ID discriminators.
    const idBoost = catalogIdBoost(finding.id, line);
    if (idBoost.score > 0) {
      score += idBoost.score;
      reasons.push(idBoost.reason);
    }

    // Downweight comment-ish lines.
    if (/^\s*(\/\/|<!--|\*)/.test(line)) score -= 10;

    if (score <= 0) continue;
    candidates.push({ line: lineIdx + 1, score, reasons });
  }

  if (candidates.length === 0) {
    // Fallback: search for any quoted value anywhere.
    for (const match of finding.message.matchAll(/"([^"\n]{3,80})"/g)) {
      const value = match[1]!;
      const idx = lines.findIndex((line) => line.includes(value));
      if (idx >= 0) {
        return {
          line: idx + 1,
          snippet: truncate((lines[idx] ?? "").trim(), 180),
          reason: `fallback:value:${truncate(value, 30)}`
        };
      }
    }
    return undefined;
  }

  candidates.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    return left.line - right.line;
  });

  const winner = candidates[0]!;
  return {
    line: winner.line,
    snippet: truncate((lines[winner.line - 1] ?? "").trim(), 180),
    reason: winner.reasons.join(", ")
  };
}

function catalogIdBoost(findingId: string, line: string): { score: number; reason: string } {
  const table: Record<string, RegExp[]> = {
    CATALOG_REQUIRED_FIELDS: [/"identity"\s*:/, /<identity/i, /<title/i, /<web_url/i, /"title"\s*:/i, /"web_url"\s*:/i],
    XML_MIXED_ELEMENT_SHAPE: [/<category\b/i],
    XML_PRODUCT_CATEGORY_PRIMARY_INVALID: [/<category\b/i, /primary\s*=/i],
    CONTENT_UPDATE_SHAPE_INVALID: [/"objects"\s*:/i, /"fields"\s*:/i],
    CONTENT_UPDATE_NESTED_CATEGORY_SHAPE: [/"type"\s*:\s*"category"/i, /"ancestors"\s*:/i],
    CONTENT_UPDATE_NESTED_VARIANT_SHAPE: [/"type"\s*:\s*"variant"/i],
    CONTENT_UPDATE_NESTED_VARIANT_ID_MISSING: [/"type"\s*:\s*"variant"/i],
    CONTENT_UPDATE_NESTED_VARIANT_ID_EQUALS_PARENT: [/"identity"\s*:/i],
    CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATE: [/"identity"\s*:/i],
    CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATES_TOP_LEVEL: [/"identity"\s*:/i],
    CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING: [/"nested"\s*:/i],
    CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE: [/"type"\s*:\s*"(?:variant|category|item|product)"/i],
    CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING: [/"fields"\s*:/i],
    CATEGORY_PAIRING_MISMATCH: [/"category"\s*:|<category\b/i, /"category_id"\s*:|<category_id/i],
    CATEGORY_PAIRING_FIELD_MISSING: [/"category_id"\s*:|<category_id/i],
    VARIANT_GROUP_NOT_CONSECUTIVE: [/"item_group_id"\s*:|<item_group_id/i],
    VARIANT_GROUP_SINGLETON: [/"item_group_id"\s*:|<item_group_id/i],
    VARIANT_GROUP_DISTINGUISHING_FIELD_MISSING: [/"item_group_id"\s*:|<item_group_id/i],
    AVAILABILITY_INVALID: [/"availability"\s*:|<availability\b/i],
    AVAILABILITY_RANK_INVALID: [/"availability_rank"\s*:|<availability_rank\b/i],
    FIELD_NAME_DISCOURAGED: [/"[^"]+[. [\\][^"]*"\s*:/]
  };
  const patterns = table[findingId];
  if (!patterns) return { score: 0, reason: "" };
  for (const pattern of patterns) {
    if (pattern.test(line)) return { score: 15, reason: `id:${findingId}` };
  }
  return { score: 0, reason: "" };
}

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 3).trimEnd()}...`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match `value` in `line` only when it is properly delimited — wrapped in
 * quotes, angle brackets, or bordered by characters that cannot be part of
 * the identifier/path. This prevents a short finding value like "category"
 * from winning on a line that merely contains "category-child-variant".
 */
function matchesDelimitedValue(line: string, value: string): boolean {
  const quoted = `"${value}"`;
  if (line.includes(quoted)) return true;
  const escaped = escapeRegExp(value);
  const re = new RegExp(`(^|[^A-Za-z0-9_./|:-])${escaped}($|[^A-Za-z0-9_./|:-])`);
  return re.test(line);
}
