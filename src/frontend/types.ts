import type { CollectorScriptEvidence } from "../analytics/types.js";

export type FrontendSourceKind = "html" | "javascript" | "unknown";
export type FrontendAnalyticsMode = "datalayer" | "events-api" | "mixed" | "unknown";
export type FrontendExpectedAnalyticsMode = "any" | "datalayer" | "events-api";
export type FrontendFeatureExpectation = "required" | "optional" | "disabled";
export type FrontendReviewService = "autocomplete" | "search";

export interface FrontendValidationProfile {
  service: FrontendReviewService;
  trackerId?: string;
  analyticsMode: FrontendExpectedAnalyticsMode;
  features: {
    autocomplete: FrontendFeatureExpectation;
    search: FrontendFeatureExpectation;
    topItems: FrontendFeatureExpectation;
    trendingQueries: FrontendFeatureExpectation;
  };
  search?: {
    expectedResultTypes?: string[] | undefined;
  };
}

export interface FrontendArtifact {
  path: string;
  raw: string;
  sourceKind: FrontendSourceKind;
  analyticsMode: FrontendAnalyticsMode;
  collectorScript: CollectorScriptEvidence | undefined;
  capabilities: FrontendCapabilities;
  parseError: string | undefined;
  confidence: number;
}

export interface FrontendCapabilities {
  endpoints: {
    autocomplete: boolean;
    search: boolean;
    topItems: boolean;
    trendingQueries: boolean;
  };
  requestParams: {
    trackerId: boolean;
    query: boolean;
    typeCounts: boolean;
    searchTypeFilter: boolean;
    searchTypeFilters: string[];
    hitFields: boolean;
    facets: boolean;
    page: boolean;
    size: boolean;
  };
  browser: {
    dnsPrefetch: boolean;
    debounce: boolean;
    inputListener: boolean;
    focusListener: boolean;
  };
  responseFlow: {
    readsHits: boolean;
    readsSearchResults: boolean;
    readsSearchHits: boolean;
    rendersHits: boolean;
    rendersSearchHits: boolean;
    rendersFacets: boolean;
    rendersPagination: boolean;
    handlesNoResults: boolean;
    tracksNoResults: boolean;
    skipsNoResultsTracking: boolean;
    mapsTrendingTitles: boolean;
    usesTrendingAsPlaceholder: boolean;
  };
  identityFlow: {
    renderedIdentityUsesHitUrl: boolean;
    analyticsItemsUseHitUrl: boolean;
    clickUsesRenderedIdentity: boolean;
  };
  analytics: {
    dataLayerPush: boolean;
    eventsApiPost: boolean;
    clientId: boolean;
    eventId: boolean;
    autocompleteView: boolean;
    autocompleteSearchTerm: boolean;
    searchResultsQuery: boolean;
    analyticsItemsFromHits: boolean;
    itemPosition: boolean;
    clickEvent: boolean;
    addToCartEvent: boolean;
    recommendationView: boolean;
    autocompletePopupPlacement: boolean;
    searchResultsView: boolean;
  };
}
