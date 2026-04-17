import { isRecord } from "../catalog/detect.js";
import { normalizeFrontendValidationProfile } from "./profile.js";
import type {
  FrontendExpectedAnalyticsMode,
  FrontendFeatureExpectation,
  FrontendValidationProfile
} from "./types.js";

export interface AutocompleteFrontendProfileSuggestionInput {
  trackerId: string;
  query?: string;
  autocompleteType?: string;
  topItemsType?: string;
  hitFields?: string;
  analyticsMode?: FrontendExpectedAnalyticsMode;
  topItems?: FeaturePolicy;
  trendingQueries?: FeaturePolicy;
}

export type FeaturePolicy = FrontendFeatureExpectation | "auto";

export interface AutocompleteFrontendProfileSuggestion {
  profile: FrontendValidationProfile;
  endpoints: AutocompleteEndpointObservation[];
  warnings: string[];
}

export interface AutocompleteEndpointObservation {
  endpoint: "autocomplete" | "top_items" | "trending_queries";
  requestUrl: string;
  ok: boolean;
  status: number;
  hitCount: number;
  observedTypes: AutocompleteObservedType[];
  sampleIdentities: string[];
  sampleTitles: string[];
  error: string | undefined;
}

export interface AutocompleteObservedType {
  type: string;
  count: number;
}

interface EndpointRequest {
  endpoint: AutocompleteEndpointObservation["endpoint"];
  url: URL;
}

interface TypeAccumulator {
  count: number;
}

export async function suggestAutocompleteFrontendProfile(
  input: AutocompleteFrontendProfileSuggestionInput
): Promise<AutocompleteFrontendProfileSuggestion> {
  const endpointRequests = buildEndpointRequests(input);
  const endpoints = await Promise.all(endpointRequests.map(fetchEndpointObservation));
  const autocomplete = endpoints.find((endpoint) => endpoint.endpoint === "autocomplete");
  const topItems = endpoints.find((endpoint) => endpoint.endpoint === "top_items");
  const trendingQueries = endpoints.find((endpoint) => endpoint.endpoint === "trending_queries");
  const warnings = buildWarnings(endpoints);

  const topItemsExpectation = resolveFeaturePolicy(input.topItems ?? "auto", topItems);
  const trendingQueriesExpectation = resolveFeaturePolicy(input.trendingQueries ?? "auto", trendingQueries);

  if ((input.topItems ?? "auto") === "auto" && topItemsExpectation === "optional") {
    warnings.push(
      "Top Items returned data, so the generated profile marks topItems=optional. Change it to required only if the UI must show Top Items on empty search focus."
    );
  }

  if ((input.trendingQueries ?? "auto") === "auto" && trendingQueriesExpectation === "optional") {
    warnings.push(
      "Trending Queries returned data, so the generated profile marks trendingQueries=optional. Change it to required only if the UI must expose configured trending queries."
    );
  }

  if (autocomplete && autocomplete.hitCount === 0) {
    warnings.push("Autocomplete returned no hits for the sampled query. The generated profile still requires autocomplete because this is a query-suggestion review.");
  }

  return {
    profile: normalizeFrontendValidationProfile({
      service: "autocomplete",
      trackerId: input.trackerId,
      analyticsMode: input.analyticsMode ?? "any",
      features: {
        autocomplete: "required",
        search: "disabled",
        topItems: topItemsExpectation,
        trendingQueries: trendingQueriesExpectation
      }
    }),
    endpoints,
    warnings
  };
}

export function formatAutocompleteFrontendProfileSuggestion(suggestion: AutocompleteFrontendProfileSuggestion): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("Autocomplete Frontend Profile Suggestion");

  lines.push("");
  lines.push("Live endpoint samples:");
  for (const endpoint of suggestion.endpoints) {
    lines.push(`- ${endpoint.endpoint}: ${endpoint.ok ? "HTTP " + endpoint.status : "FAILED"} hits=${endpoint.hitCount}`);
    lines.push(`  Request: ${endpoint.requestUrl}`);
    if (endpoint.error) {
      lines.push(`  Error: ${endpoint.error}`);
    }
    if (endpoint.observedTypes.length > 0) {
      lines.push(
        `  Types: ${endpoint.observedTypes.map((type) => `${type.type}:${type.count}`).join(", ")}`
      );
    }
    if (endpoint.sampleIdentities.length > 0) {
      lines.push(`  Examples: ${endpoint.sampleIdentities.join(", ")}`);
    }
    if (endpoint.sampleTitles.length > 0) {
      lines.push(`  Titles: ${endpoint.sampleTitles.join(" | ")}`);
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

function buildEndpointRequests(input: AutocompleteFrontendProfileSuggestionInput): EndpointRequest[] {
  const autocomplete = new URL("https://live.luigisbox.com/autocomplete/v2");
  autocomplete.searchParams.set("tracker_id", input.trackerId);
  autocomplete.searchParams.set("q", input.query?.trim() || "shirt");
  autocomplete.searchParams.set("type", input.autocompleteType?.trim() || "item:6,category:3,query:5");
  autocomplete.searchParams.set("hit_fields", input.hitFields?.trim() || "title,url");

  const topItems = new URL("https://live.luigisbox.com/v1/top_items");
  topItems.searchParams.set("tracker_id", input.trackerId);
  topItems.searchParams.set("type", input.topItemsType?.trim() || "item:5,category:3");
  topItems.searchParams.set("hit_fields", input.hitFields?.trim() || "title,url");

  const trendingQueries = new URL("https://live.luigisbox.com/v2/trending_queries");
  trendingQueries.searchParams.set("tracker_id", input.trackerId);

  return [
    { endpoint: "autocomplete", url: autocomplete },
    { endpoint: "top_items", url: topItems },
    { endpoint: "trending_queries", url: trendingQueries }
  ];
}

async function fetchEndpointObservation(request: EndpointRequest): Promise<AutocompleteEndpointObservation> {
  const requestUrl = request.url.toString();

  try {
    const response = await fetch(requestUrl, {
      headers: {
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
        "user-agent": "se-validator/0.1"
      }
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        endpoint: request.endpoint,
        requestUrl,
        ok: false,
        status: response.status,
        hitCount: 0,
        observedTypes: [],
        sampleIdentities: [],
        sampleTitles: [],
        error: text.slice(0, 500) || response.statusText || "Request failed"
      };
    }

    const parsed = parseJson(text, request.endpoint);
    const hits = extractHits(request.endpoint, parsed);
    const hitSamples = summarizeHits(hits);

    return {
      endpoint: request.endpoint,
      requestUrl,
      ok: true,
      status: response.status,
      hitCount: hits.length,
      observedTypes: hitSamples.observedTypes,
      sampleIdentities: hitSamples.sampleIdentities,
      sampleTitles: hitSamples.sampleTitles,
      error: undefined
    };
  } catch (error) {
    return {
      endpoint: request.endpoint,
      requestUrl,
      ok: false,
      status: 0,
      hitCount: 0,
      observedTypes: [],
      sampleIdentities: [],
      sampleTitles: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function extractHits(endpoint: AutocompleteEndpointObservation["endpoint"], parsed: unknown): unknown[] {
  if (endpoint === "trending_queries") {
    return Array.isArray(parsed) ? parsed : [];
  }

  if (isRecord(parsed) && Array.isArray(parsed.hits)) {
    return parsed.hits;
  }

  return [];
}

function summarizeHits(hits: unknown[]): {
  observedTypes: AutocompleteObservedType[];
  sampleIdentities: string[];
  sampleTitles: string[];
} {
  const types = new Map<string, TypeAccumulator>();
  const sampleIdentities = new Set<string>();
  const sampleTitles = new Set<string>();

  for (const hit of hits) {
    if (isRecord(hit)) {
      if (typeof hit.type === "string" && hit.type.trim()) {
        const type = hit.type.trim();
        const current = types.get(type) ?? { count: 0 };
        current.count += 1;
        types.set(type, current);
      }

      if (typeof hit.url === "string" && hit.url.trim()) {
        sampleIdentities.add(hit.url.trim());
      }

      if (isRecord(hit.attributes) && typeof hit.attributes.title === "string" && hit.attributes.title.trim()) {
        sampleTitles.add(stripHtml(hit.attributes.title.trim()));
      } else if (typeof hit.title === "string" && hit.title.trim()) {
        sampleTitles.add(stripHtml(hit.title.trim()));
      }
    }
  }

  return {
    observedTypes: [...types.entries()]
      .map(([type, value]) => ({ type, count: value.count }))
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.type.localeCompare(right.type);
      }),
    sampleIdentities: [...sampleIdentities].slice(0, 3),
    sampleTitles: [...sampleTitles].slice(0, 3)
  };
}

function resolveFeaturePolicy(
  policy: FeaturePolicy,
  observation: AutocompleteEndpointObservation | undefined
): FrontendFeatureExpectation {
  if (policy !== "auto") return policy;
  return observation?.ok === true && observation.hitCount > 0 ? "optional" : "disabled";
}

function buildWarnings(endpoints: AutocompleteEndpointObservation[]): string[] {
  const warnings: string[] = [];

  for (const endpoint of endpoints) {
    if (!endpoint.ok) {
      warnings.push(`${endpoint.endpoint} sample failed: ${endpoint.error ?? `HTTP ${endpoint.status}`}`);
    }

    if (endpoint.ok && endpoint.hitCount === 0) {
      warnings.push(`${endpoint.endpoint} sample returned no hits.`);
    }

    if (endpoint.endpoint !== "trending_queries" && endpoint.ok && endpoint.hitCount > 0 && endpoint.observedTypes.length === 0) {
      warnings.push(`${endpoint.endpoint} returned hits, but no readable hit type values were found.`);
    }
  }

  return warnings;
}

function parseJson(text: string, endpoint: AutocompleteEndpointObservation["endpoint"]): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${endpoint} response was not valid JSON.`);
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}
