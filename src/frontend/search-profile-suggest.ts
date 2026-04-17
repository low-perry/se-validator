import { isRecord } from "../catalog/detect.js";
import { normalizeFrontendValidationProfile } from "./profile.js";
import type { FrontendExpectedAnalyticsMode, FrontendValidationProfile } from "./types.js";

export interface SearchFrontendProfileSuggestionInput {
  trackerId: string;
  query?: string;
  filters?: string[];
  size?: number;
  analyticsMode?: FrontendExpectedAnalyticsMode;
}

export interface SearchFrontendProfileSuggestion {
  requestUrl: string;
  profile: FrontendValidationProfile;
  totalHits: number | undefined;
  observedTypes: SearchObservedType[];
  warnings: string[];
}

export interface SearchObservedType {
  type: string;
  count: number;
  sampleIdentities: string[];
  sampleTitles: string[];
}

interface TypeAccumulator {
  count: number;
  identities: Set<string>;
  titles: Set<string>;
}

export async function suggestSearchFrontendProfile(
  input: SearchFrontendProfileSuggestionInput
): Promise<SearchFrontendProfileSuggestion> {
  const requestUrl = buildSearchRequestUrl(input);
  const response = await fetch(requestUrl, {
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip, deflate",
      "user-agent": "se-validator/0.1"
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Search API returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const parsed = parseJson(text);
  const results = isRecord(parsed) && isRecord(parsed.results) ? parsed.results : undefined;
  const hits = Array.isArray(results?.hits) ? results.hits : [];
  const totalHits = typeof results?.total_hits === "number" ? results.total_hits : undefined;
  const observedTypes = summarizeHitTypes(hits);
  const expectedResultTypes = observedTypes.map((entry) => entry.type);
  const warnings: string[] = [];

  if (!results) {
    warnings.push("Search API response did not contain a results object.");
  }

  if (hits.length === 0) {
    warnings.push("Search API returned no hits for this query/filter sample, so no expected result type could be inferred.");
  }

  if (observedTypes.length === 0 && hits.length > 0) {
    warnings.push("Search API returned hits, but none had a readable type field.");
  }

  if (observedTypes.length > 1) {
    warnings.push("Multiple hit types were observed. Keep all expectedResultTypes only if this UI intentionally renders mixed result types.");
  }

  return {
    requestUrl,
    profile: normalizeFrontendValidationProfile({
      service: "search",
      trackerId: input.trackerId,
      analyticsMode: input.analyticsMode ?? "any",
      features: {
        autocomplete: "disabled",
        search: "required",
        topItems: "disabled",
        trendingQueries: "disabled"
      },
      search: {
        expectedResultTypes
      }
    }),
    totalHits,
    observedTypes,
    warnings
  };
}

export function formatSearchFrontendProfileSuggestion(suggestion: SearchFrontendProfileSuggestion): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("Search Frontend Profile Suggestion");
  lines.push(`Request: ${suggestion.requestUrl}`);
  lines.push(`Total hits: ${suggestion.totalHits ?? "unknown"}`);

  lines.push("");
  lines.push("Observed hit types:");
  if (suggestion.observedTypes.length === 0) {
    lines.push("- none");
  } else {
    for (const entry of suggestion.observedTypes) {
      const identities = entry.sampleIdentities.length ? ` examples=${entry.sampleIdentities.join(", ")}` : "";
      const titles = entry.sampleTitles.length ? ` titles=${entry.sampleTitles.join(" | ")}` : "";
      lines.push(`- ${entry.type}: ${entry.count}${identities}${titles}`);
    }
  }

  if (suggestion.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of suggestion.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("");
  lines.push("Suggested frontend profile JSON:");
  lines.push(JSON.stringify(suggestion.profile, null, 2));

  return lines.join("\n");
}

function buildSearchRequestUrl(input: SearchFrontendProfileSuggestionInput): string {
  const url = new URL("https://live.luigisbox.com/search");
  url.searchParams.set("tracker_id", input.trackerId);
  if (input.query?.trim()) {
    url.searchParams.set("q", input.query.trim());
  }
  for (const filter of input.filters ?? []) {
    if (filter.trim()) {
      url.searchParams.append("f[]", filter.trim());
    }
  }
  url.searchParams.set("hit_fields", "title,url");
  url.searchParams.set("size", String(input.size ?? 10));
  return url.toString();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Search API response was not valid JSON.");
  }
}

function summarizeHitTypes(hits: unknown[]): SearchObservedType[] {
  const counts = new Map<string, TypeAccumulator>();

  for (const hit of hits) {
    if (!isRecord(hit) || typeof hit.type !== "string" || hit.type.trim() === "") continue;

    const type = hit.type.trim();
    const current = counts.get(type) ?? {
      count: 0,
      identities: new Set<string>(),
      titles: new Set<string>()
    };

    current.count += 1;
    if (typeof hit.url === "string" && hit.url.trim()) {
      current.identities.add(hit.url.trim());
    }

    if (isRecord(hit.attributes)) {
      const title = hit.attributes.title;
      if (typeof title === "string" && title.trim()) {
        current.titles.add(title.trim());
      }
    }

    counts.set(type, current);
  }

  return [...counts.entries()]
    .map(([type, value]) => ({
      type,
      count: value.count,
      sampleIdentities: [...value.identities].slice(0, 3),
      sampleTitles: [...value.titles].slice(0, 2)
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.type.localeCompare(right.type);
    });
}
