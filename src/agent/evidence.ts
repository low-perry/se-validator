import type { ValidationFinding } from "../core/types.js";
import { parseFrontendArtifacts } from "../frontend/parse.js";
import type { FindingEvidence } from "./types.js";

const FINDING_PATTERNS: Record<string, RegExp[]> = {
  FRONTEND_AUTOCOMPLETE_ENDPOINT_MISSING: [/autocomplete\/v2/i, /AUTOCOMPLETE_API_URL/, /getSuggestions/i],
  FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING: [/URLSearchParams/i, /autocomplete\/v2/i, /\bsearch\s*:/i, /\bq\s*:/i],
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

export async function locateFindingEvidence(paths: string[], findings: ValidationFinding[]): Promise<FindingEvidence[]> {
  const artifacts = await parseFrontendArtifacts(paths);
  const evidence: FindingEvidence[] = [];

  for (const finding of findings) {
    const artifact = artifacts.find((candidate) => finding.evidencePath.startsWith(candidate.path)) ?? artifacts[0];
    if (!artifact) continue;

    const line = locateLine(artifact.raw, FINDING_PATTERNS[finding.id] ?? fallbackPatterns(finding));
    if (!line) continue;

    evidence.push({
      findingId: finding.id,
      evidencePath: finding.evidencePath,
      path: artifact.path,
      line: line.line,
      snippet: line.snippet,
      reason: line.pattern
    });
  }

  return evidence;
}

function locateLine(raw: string, patterns: RegExp[]): { line: number; snippet: string; pattern: string } | undefined {
  const lines = raw.split(/\r?\n/);
  let best: { line: number; snippet: string; pattern: string; score: number } | undefined;

  for (const pattern of patterns) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!pattern.test(line)) continue;

      const score = scoreLine(line, pattern);
      if (!best || score > best.score) {
        best = {
          line: index + 1,
          snippet: line.trim(),
          pattern: pattern.source,
          score
        };
      }
    }
  }

  if (!best) return undefined;

  return {
    line: best.line,
    snippet: truncate(best.snippet, 180),
    pattern: best.pattern
  };
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

function scoreLine(line: string, pattern: RegExp): number {
  let score = pattern.source.length;
  if (/fetch|axios|URLSearchParams|dataLayer|api\.luigisbox|live\.luigisbox/.test(line)) score += 20;
  if (/\bsearch\s*:/.test(line) || /\bq\s*:/.test(line)) score += 50;
  if (/<head\b/i.test(line)) score += 50;
  if (/dataset\.itemId|item_id|resource_identifier|items\s*:|hits\.map/.test(line)) score += 30;
  if (/TODO|console\.log/.test(line)) score -= 5;
  return score;
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 3).trimEnd()}...`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
