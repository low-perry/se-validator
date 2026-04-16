export type AutocompleteEndpoint =
  | "autocomplete"
  | "top_items"
  | "personalized_top_items"
  | "trending_queries";

export type QueryParamValue = string | number | boolean | Array<string | number | boolean>;

export interface ServiceProfile {
  service: "autocomplete-api";
  checks: ServiceCheck[];
}

export interface ServiceCheck {
  name: string;
  endpoint: AutocompleteEndpoint;
  request: ServiceRequest;
  expect?: ServiceExpectation;
  analytics?: ServiceAnalyticsExpectation;
}

export interface ServiceRequest {
  url: string;
  params?: Record<string, QueryParamValue>;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface ServiceExpectation {
  status?: number;
  minResults?: number;
  maxResults?: number;
  resultTypes?: string[];
  containsIdentities?: string[];
  requiredRootFields?: string[];
  requiredHitFields?: string[];
  requiredAttributeFields?: string[];
  requireGuid?: boolean;
  requireRecommendationId?: boolean;
}

export interface ServiceAnalyticsExpectation {
  viewListName?: "Autocomplete" | "Recommendation" | "Search Results";
  clickAction?: "click" | "add-to-cart";
  noResultsEventRequired?: boolean;
  recommendationPlacement?: string;
  clickRunsSearch?: boolean;
  notes?: string[];
}

export interface ServiceArtifact {
  path: string;
  raw: string;
  parsed: unknown;
  profile: ServiceProfile | undefined;
  parseError: string | undefined;
  confidence: number;
}

export interface ServiceCheckExecution {
  artifactPath: string;
  checkName: string;
  endpoint: AutocompleteEndpoint | "unknown";
  url: string;
  status: number | undefined;
  durationMs: number | undefined;
  data: unknown;
  error: string | undefined;
}
