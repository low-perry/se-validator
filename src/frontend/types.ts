import type { CollectorScriptEvidence } from "../analytics/types.js";

export type FrontendSourceKind = "html" | "javascript" | "unknown";
export type FrontendAnalyticsMode = "datalayer" | "events-api" | "mixed" | "unknown";

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
    topItems: boolean;
    trendingQueries: boolean;
  };
  requestParams: {
    trackerId: boolean;
    query: boolean;
    typeCounts: boolean;
    hitFields: boolean;
  };
  browser: {
    dnsPrefetch: boolean;
    debounce: boolean;
    inputListener: boolean;
    focusListener: boolean;
  };
  responseFlow: {
    readsHits: boolean;
    rendersHits: boolean;
    handlesNoResults: boolean;
    tracksNoResults: boolean;
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
    analyticsItemsFromHits: boolean;
    itemPosition: boolean;
    clickEvent: boolean;
    addToCartEvent: boolean;
    recommendationView: boolean;
    autocompletePopupPlacement: boolean;
    searchResultsView: boolean;
  };
}
