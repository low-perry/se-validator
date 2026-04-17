import { createFinding } from "../core/findings.js";
import type { ValidationFinding } from "../core/types.js";
import type { FrontendArtifact, FrontendFeatureExpectation, FrontendValidationProfile } from "./types.js";

export type FrontendRule = (artifacts: FrontendArtifact[], profile: FrontendValidationProfile) => ValidationFinding[];

export const frontendRules: FrontendRule[] = [
  validateParseErrors,
  validateCoreAutocompleteApi,
  validateCoreSearchApi,
  validateBrowserIntegration,
  validateResponseAndIdentityFlow,
  validateSearchResponseAndIdentityFlow,
  validateAnalyticsMode,
  validateAutocompleteAnalytics,
  validateSearchAnalytics,
  validateTopItemsFlow,
  validateTrendingQueriesFlow
];

function validateParseErrors(artifacts: FrontendArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) => {
    if (!artifact.parseError) return [];

    return frontendFinding({
      id: "FRONTEND_ARTIFACT_READ_ERROR",
      severity: "P0",
      title: "Frontend evidence could not be read",
      message: artifact.parseError,
      evidencePath: artifact.path,
      remediation: "Provide an HTML or JavaScript file that contains the autocomplete implementation.",
      docs: ["quickstart/autocomplete/query-suggestions"],
      confidence: 0.98
    });
  });
}

function validateCoreAutocompleteApi(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  if (profile.features.autocomplete === "disabled") return [];

  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (!artifact.capabilities.endpoints.autocomplete) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_ENDPOINT_MISSING",
          severity: "P0",
          title: "Frontend does not call the Autocomplete API",
          message: `${artifact.path} does not reference https://live.luigisbox.com/autocomplete/v2.`,
          evidencePath: artifact.path,
          remediation: "Call the public Autocomplete API from the frontend when the user types in the search input.",
          docs: ["autocomplete/api/v2/autocomplete", "quickstart/autocomplete/query-suggestions"],
          confidence: 0.94
        })
      );
    }

    if (!artifact.capabilities.requestParams.trackerId) {
      findings.push(requiredParamFinding(artifact, "tracker_id", "Send the public tracker_id with every autocomplete-related request."));
    }

    if (!artifact.capabilities.requestParams.query) {
      findings.push(requiredParamFinding(artifact, "q", "Send the current search input value as q for query autocomplete."));
    }

    if (!artifact.capabilities.requestParams.typeCounts) {
      findings.push(
        requiredParamFinding(
          artifact,
          "type",
          "Request result types and counts in type, for example item:6,category:3,query:5."
        )
      );
    }

    if (!artifact.capabilities.requestParams.hitFields) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_HIT_FIELDS_MISSING",
          severity: "P2",
          title: "Frontend autocomplete request does not limit hit_fields",
          message: `${artifact.path} does not include hit_fields in the autocomplete/top items requests.`,
          evidencePath: artifact.path,
          remediation: "Use hit_fields to request only the fields rendered in the dropdown, such as title,web_url,price,image_link_l.",
          docs: ["autocomplete/guides/integration-best-practices"],
          confidence: 0.82
        })
      );
    }

    return findings;
  });
}

function validateBrowserIntegration(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  if (profile.features.autocomplete === "disabled") return [];

  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (!artifact.capabilities.browser.dnsPrefetch) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_DNS_PREFETCH_MISSING",
          severity: "P2",
          title: "Frontend is missing DNS prefetch for live API",
          message: `${artifact.path} does not include <link rel="dns-prefetch" href="//live.luigisbox.com">.`,
          evidencePath: `${artifact.path}:head`,
          remediation: "Add DNS prefetch in the page/layout head to reduce the first autocomplete request latency.",
          docs: ["autocomplete/guides/integration-best-practices"],
          confidence: 0.78
        })
      );
    }

    if (!artifact.capabilities.browser.debounce) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_DEBOUNCE_MISSING",
          severity: "P2",
          title: "Autocomplete input is not debounced",
          message: `${artifact.path} does not show debounce or timeout logic around user input.`,
          evidencePath: artifact.path,
          remediation: "Debounce autocomplete requests so the frontend does not send a request for every keystroke.",
          docs: ["quickstart/autocomplete/query-suggestions"],
          confidence: 0.75
        })
      );
    }

    if (!artifact.capabilities.browser.inputListener) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_INPUT_LISTENER_MISSING",
          severity: "P1",
          title: "Frontend does not listen to search input changes",
          message: `${artifact.path} does not show an input event listener for fetching query suggestions.`,
          evidencePath: artifact.path,
          remediation: "Attach an input listener to the search box and call the autocomplete request function after debounce.",
          docs: ["quickstart/autocomplete/query-suggestions"],
          confidence: 0.82
        })
      );
    }

    return findings;
  });
}

function validateCoreSearchApi(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  if (profile.features.search === "disabled") return [];

  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (!artifact.capabilities.endpoints.search) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_ENDPOINT_MISSING",
          severity: "P0",
          title: "Frontend does not call the Search API",
          message: `${artifact.path} does not reference https://live.luigisbox.com/search or a declared Search API endpoint.`,
          evidencePath: artifact.path,
          remediation: "Call the Search API from the search results page, or provide a profile/evidence that declares the backend proxy used for Search.",
          docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
          confidence: 0.9
        })
      );
    }

    if (!artifact.capabilities.requestParams.trackerId) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_TRACKER_ID_MISSING",
          severity: "P0",
          title: "Search request is missing tracker_id",
          message: `${artifact.path} does not show tracker_id in the Search API request.`,
          evidencePath: artifact.path,
          remediation: "Send the public tracker_id with every Search API request.",
          docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
          confidence: 0.92
        })
      );
    }

    if (!artifact.capabilities.requestParams.query && !artifact.capabilities.requestParams.searchTypeFilter) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_QUERY_OR_FILTER_MISSING",
          severity: "P1",
          title: "Search request has neither query nor filters",
          message: `${artifact.path} does not show q or f[] in the Search API request.`,
          evidencePath: artifact.path,
          remediation: "Send q for user-entered searches, or send f[] filters for filter-only pages.",
          docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
          confidence: 0.82
        })
      );
    }

    findings.push(...validateSearchTypeFilters(artifact, profile));

    if (!artifact.capabilities.requestParams.hitFields) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_HIT_FIELDS_MISSING",
          severity: "P2",
          title: "Search request does not limit hit_fields",
          message: `${artifact.path} does not include hit_fields in the Search API request.`,
          evidencePath: artifact.path,
          remediation: "Request only fields rendered in the results UI, such as title,url,price_amount,image_link,brand,nested.",
          docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
          confidence: 0.82
        })
      );
    }

    return findings;
  });
}

function validateResponseAndIdentityFlow(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  if (profile.features.autocomplete === "disabled") return [];

  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (!artifact.capabilities.responseFlow.readsHits) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_HITS_NOT_READ",
          severity: "P1",
          title: "Frontend does not read response hits",
          message: `${artifact.path} does not show response.data.hits or equivalent response parsing.`,
          evidencePath: artifact.path,
          remediation: "Read the API hits array and use it as the single source for rendering and analytics.",
          docs: ["autocomplete/api/v2/autocomplete"],
          confidence: 0.86
        })
      );
    }

    if (!artifact.capabilities.responseFlow.rendersHits) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_HITS_NOT_RENDERED",
          severity: "P1",
          title: "Frontend does not render API hits",
          message: `${artifact.path} does not show hits passed into rendering logic.`,
          evidencePath: artifact.path,
          remediation: "Render suggestions from the same hits array that is later used for analytics.",
          docs: ["quickstart/autocomplete/query-suggestions"],
          confidence: 0.82
        })
      );
    }

    if (!artifact.capabilities.identityFlow.renderedIdentityUsesHitUrl) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_RENDERED_IDENTITY_NOT_HIT_URL",
          severity: "P1",
          title: "Rendered suggestion identity may not match catalog identity",
          message: `${artifact.path} does not show rendered suggestions storing hit.url as the item identity.`,
          evidencePath: artifact.path,
          remediation: "Store hit.url, or the documented identity field returned as url, on the rendered suggestion element.",
          docs: ["autocomplete/api/v2/autocomplete", "quickstart/autocomplete/query-suggestions"],
          confidence: 0.84
        })
      );
    }

    if (!artifact.capabilities.identityFlow.analyticsItemsUseHitUrl) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL",
          severity: "P1",
          title: "Autocomplete analytics may not use returned hit identity",
          message: `${artifact.path} does not show analytics items using hit.url as item_id/url.`,
          evidencePath: artifact.path,
          remediation: "Map analytics items from hits with item_id/url set to hit.url so API response, UI, and analytics use the same identity.",
          docs: ["quickstart/autocomplete/query-suggestions", "analytics/api/events"],
          confidence: 0.86
        })
      );
    }

    return findings;
  });
}

function validateSearchResponseAndIdentityFlow(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  if (profile.features.search === "disabled") return [];

  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (!artifact.capabilities.responseFlow.readsSearchResults) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_RESULTS_OBJECT_NOT_READ",
          severity: "P1",
          title: "Frontend does not read Search API results object",
          message: `${artifact.path} does not show response.data.results or data.results from the Search API response.`,
          evidencePath: artifact.path,
          remediation: "Read Search API responses from response.data.results, then use results.hits, results.facets, and results.total_hits.",
          docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
          confidence: 0.86
        })
      );
    }

    if (!artifact.capabilities.responseFlow.readsSearchHits) {
      const readsAutocompleteShape = artifact.capabilities.responseFlow.readsHits;
      findings.push(
        frontendFinding({
          id: readsAutocompleteShape ? "FRONTEND_SEARCH_HITS_WRONG_RESPONSE_SHAPE" : "FRONTEND_SEARCH_HITS_NOT_READ",
          severity: "P1",
          title: readsAutocompleteShape ? "Search UI reads root hits instead of results.hits" : "Frontend does not read Search results.hits",
          message: readsAutocompleteShape
            ? `${artifact.path} appears to read data.hits/root hits, but Search API hits live under results.hits.`
            : `${artifact.path} does not show data.results.hits or equivalent Search API hit parsing.`,
          evidencePath: artifact.path,
          remediation: "Use data.results.hits as the source for rendering and analytics on Search result pages.",
          docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
          confidence: readsAutocompleteShape ? 0.9 : 0.84
        })
      );
    }

    if (!artifact.capabilities.responseFlow.rendersSearchHits) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_HITS_NOT_RENDERED",
          severity: "P1",
          title: "Frontend does not render Search API hits",
          message: `${artifact.path} does not show results.hits being mapped into rendered product/result cards.`,
          evidencePath: artifact.path,
          remediation: "Render product cards from the same results.hits array that analytics uses.",
          docs: ["quickstart/search/building-custom-ui"],
          confidence: 0.82
        })
      );
    }

    if (!artifact.capabilities.responseFlow.rendersFacets) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_FACETS_NOT_RENDERED",
          severity: "P2",
          title: "Search UI does not show facet rendering",
          message: `${artifact.path} does not show results.facets being rendered or updated.`,
          evidencePath: artifact.path,
          remediation: "Render facets from data.results.facets when the custom Search UI supports filters.",
          docs: ["quickstart/search/building-custom-ui"],
          confidence: 0.72
        })
      );
    }

    if (!artifact.capabilities.identityFlow.renderedIdentityUsesHitUrl) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_RENDERED_IDENTITY_NOT_HIT_URL",
          severity: "P1",
          title: "Rendered Search result identity may not match catalog identity",
          message: `${artifact.path} does not show rendered result elements storing hit.url/result.url as the item identity.`,
          evidencePath: artifact.path,
          remediation: "Store the returned hit.url/result.url on rendered result links/buttons and reuse it for click analytics.",
          docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
          confidence: 0.84
        })
      );
    }

    if (!artifact.capabilities.identityFlow.analyticsItemsUseHitUrl) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_ANALYTICS_IDENTITY_NOT_HIT_URL",
          severity: "P1",
          title: "Search analytics may not use returned hit identity",
          message: `${artifact.path} does not show Search analytics items using hit.url as item_id/url.`,
          evidencePath: artifact.path,
          remediation: "Map Search Results analytics from hits with item_id/url set to hit.url so rendering and analytics use the same identity.",
          docs: ["quickstart/search/building-custom-ui", "analytics/api/events"],
          confidence: 0.86
        })
      );
    }

    return findings;
  });
}

function validateAnalyticsMode(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (artifact.analyticsMode === "unknown") {
      findings.push(
        frontendFinding({
          id: "FRONTEND_ANALYTICS_PATH_MISSING",
          severity: "P0",
          title: "Frontend does not show an analytics integration path",
          message: `${artifact.path} does not contain DataLayer Collector or Events API evidence.`,
          evidencePath: artifact.path,
          remediation: "Add either dataLayer.push events with the Luigi's Box collector script, or Events API POST payloads.",
          docs: ["quickstart/autocomplete/query-suggestions", "analytics/api/events"],
          confidence: 0.92
        })
      );
    }

    if (profile.analyticsMode === "datalayer" && !["datalayer", "mixed"].includes(artifact.analyticsMode)) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_EXPECTED_DATALAYER_ANALYTICS_MISSING",
          severity: "P0",
          title: "Profile expects DataLayer analytics but evidence uses another path",
          message: `${artifact.path} was reviewed with analyticsMode=datalayer but does not show dataLayer.push evidence.`,
          evidencePath: artifact.path,
          remediation: "Either add dataLayer.push analytics and the collector script, or update the profile to the actual analytics path.",
          docs: ["analytics/collector", "platform-foundations/lbx-script"],
          confidence: 0.9
        })
      );
    }

    if (profile.analyticsMode === "events-api" && !["events-api", "mixed"].includes(artifact.analyticsMode)) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_EXPECTED_EVENTS_API_ANALYTICS_MISSING",
          severity: "P0",
          title: "Profile expects Events API analytics but evidence uses another path",
          message: `${artifact.path} was reviewed with analyticsMode=events-api but does not show Events API POST evidence.`,
          evidencePath: artifact.path,
          remediation: "Either add Events API POST analytics, or update the profile to the actual analytics path.",
          docs: ["analytics/api/events", "quickstart/autocomplete/query-suggestions"],
          confidence: 0.9
        })
      );
    }

    if (artifact.analyticsMode === "datalayer" || artifact.analyticsMode === "mixed") {
      if (!artifact.collectorScript?.present) {
        findings.push(
          frontendFinding({
            id: "FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING",
            severity: "P0",
            title: "DataLayer page is missing the collector script",
            message: `${artifact.path} uses dataLayer.push but does not include the Luigi's Box collector script.`,
            evidencePath: `${artifact.path}:head`,
            remediation: `Add ${collectorScriptSnippet(profile)} to the shared head.`,
            docs: ["analytics/collector", "platform-foundations/lbx-script"],
            confidence: 0.95
          })
        );
      } else {
        if (!artifact.collectorScript.inHead) {
          findings.push(
            frontendFinding({
              id: "FRONTEND_DATALAYER_COLLECTOR_SCRIPT_NOT_IN_HEAD",
              severity: "P0",
              title: "DataLayer collector script is not in head",
              message: `${artifact.path} includes ${artifact.collectorScript.src}, but not inside <head>.`,
              evidencePath: `${artifact.path}:head`,
              remediation: "Move the collector script into the shared page/layout head.",
              docs: ["analytics/collector", "platform-foundations/lbx-script"],
              confidence: 0.93
            })
          );
        }

        if (!artifact.collectorScript.async) {
          findings.push(
            frontendFinding({
              id: "FRONTEND_DATALAYER_COLLECTOR_SCRIPT_NOT_ASYNC",
              severity: "P1",
              title: "DataLayer collector script is not async",
              message: `${artifact.path} includes ${artifact.collectorScript.src}, but the script tag is missing async.`,
              evidencePath: `${artifact.path}:head`,
              remediation: "Use the async collector script snippet from the docs.",
              docs: ["analytics/collector", "platform-foundations/lbx-script"],
              confidence: 0.86
            })
          );
        }
      }
    }

    if (artifact.analyticsMode === "events-api" || artifact.analyticsMode === "mixed") {
      if (!artifact.capabilities.analytics.eventsApiPost) {
        findings.push(
          frontendFinding({
            id: "FRONTEND_EVENTS_API_POST_MISSING",
            severity: "P0",
            title: "Events API path does not post analytics",
            message: `${artifact.path} references Events API behavior but does not show a POST to api.luigisbox.com.`,
            evidencePath: artifact.path,
            remediation: "POST Events API payloads after rendering suggestions and after suggestion clicks.",
            docs: ["analytics/api/events", "quickstart/autocomplete/query-suggestions"],
            confidence: 0.9
          })
        );
      }

      if (!artifact.capabilities.analytics.clientId) {
        findings.push(
          frontendFinding({
            id: "FRONTEND_EVENTS_API_CLIENT_ID_MISSING",
            severity: "P1",
            title: "Events API frontend evidence is missing client_id",
            message: `${artifact.path} does not show client_id assignment in analytics payloads.`,
            evidencePath: artifact.path,
            remediation: "Send a stable client_id with every Events API payload.",
            docs: ["analytics/api/events"],
            confidence: 0.85
          })
        );
      }

      if (!artifact.capabilities.analytics.eventId) {
        findings.push(
          frontendFinding({
            id: "FRONTEND_EVENTS_API_EVENT_ID_MISSING",
            severity: "P1",
            title: "Events API frontend evidence is missing unique event IDs",
            message: `${artifact.path} does not show unique id generation for Events API payloads.`,
            evidencePath: artifact.path,
            remediation: "Generate a unique id for each Events API event.",
            docs: ["analytics/api/events"],
            confidence: 0.82
          })
        );
      }
    }

    return findings;
  });
}

function validateAutocompleteAnalytics(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  if (profile.features.autocomplete === "disabled") return [];

  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (!artifact.capabilities.analytics.autocompleteView) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_VIEW_ANALYTICS_MISSING",
          severity: "P0",
          title: "Autocomplete view analytics are missing",
          message: `${artifact.path} does not show an Autocomplete list view after rendering suggestions.`,
          evidencePath: artifact.path,
          remediation: "After rendering suggestions, send an Autocomplete view event through DataLayer or Events API.",
          docs: ["quickstart/autocomplete/query-suggestions"],
          confidence: 0.92
        })
      );
    }

    if (!artifact.capabilities.analytics.autocompleteSearchTerm) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_QUERY_ANALYTICS_MISSING",
          severity: "P1",
          title: "Autocomplete analytics do not include the query",
          message: `${artifact.path} does not show search_term or query.string populated from the user's query.`,
          evidencePath: artifact.path,
          remediation: "Include the user's autocomplete query as search_term in DataLayer or query.string in Events API.",
          docs: ["quickstart/autocomplete/query-suggestions", "analytics/api/events"],
          confidence: 0.86
        })
      );
    }

    if (!artifact.capabilities.analytics.analyticsItemsFromHits) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_ITEMS_NOT_FROM_HITS",
          severity: "P1",
          title: "Autocomplete analytics items are not mapped from API hits",
          message: `${artifact.path} does not show analytics items: hits.map(...).`,
          evidencePath: artifact.path,
          remediation: "Build analytics items from the same hits array rendered to the user.",
          docs: ["quickstart/autocomplete/query-suggestions"],
          confidence: 0.86
        })
      );
    }

    if (!artifact.capabilities.analytics.itemPosition) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_ITEM_POSITION_MISSING",
          severity: "P2",
          title: "Autocomplete analytics item position is missing",
          message: `${artifact.path} does not show index or position based on the rendered order.`,
          evidencePath: artifact.path,
          remediation: "Send index/position as index + 1 for every rendered suggestion.",
          docs: ["quickstart/autocomplete/query-suggestions", "analytics/api/events"],
          confidence: 0.78
        })
      );
    }

    if (artifact.capabilities.responseFlow.handlesNoResults && !artifact.capabilities.responseFlow.tracksNoResults) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_NO_RESULTS_NOT_TRACKED",
          severity: "P1",
          title: "Autocomplete no-results branch is not tracked",
          message: `${artifact.path} handles empty hits but does not show an Autocomplete view with an empty items array.`,
          evidencePath: artifact.path,
          remediation: "When hits is empty, still send the Autocomplete view event with items: [].",
          docs: ["quickstart/autocomplete/query-suggestions"],
          confidence: 0.9
        })
      );
    }

    if (!artifact.capabilities.analytics.clickEvent) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_AUTOCOMPLETE_CLICK_ANALYTICS_MISSING",
          severity: "P1",
          title: "Autocomplete click analytics are missing",
          message: `${artifact.path} does not show suggestion click/select tracking.`,
          evidencePath: artifact.path,
          remediation: "Track selected suggestions as DataLayer select_item or Events API click with the rendered item identity.",
          docs: ["quickstart/autocomplete/query-suggestions", "analytics/api/events"],
          confidence: 0.88
        })
      );
    }

    if (!artifact.capabilities.identityFlow.clickUsesRenderedIdentity) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_CLICK_DOES_NOT_USE_RENDERED_IDENTITY",
          severity: "P1",
          title: "Click analytics may not use rendered item identity",
          message: `${artifact.path} does not show click analytics reading the selected element's item identity.`,
          evidencePath: artifact.path,
          remediation: "Read the selected element's data item identity and send it in the click/select event.",
          docs: ["quickstart/autocomplete/query-suggestions", "analytics/api/events"],
          confidence: 0.84
        })
      );
    }

    return findings;
  });
}

function validateSearchAnalytics(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  if (profile.features.search === "disabled") return [];

  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];

    if (!artifact.capabilities.analytics.searchResultsView) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_RESULTS_VIEW_ANALYTICS_MISSING",
          severity: "P0",
          title: "Search Results view analytics are missing",
          message: `${artifact.path} does not show a Search Results list view after rendering Search API results.`,
          evidencePath: artifact.path,
          remediation: "After rendering results.hits, send a Search Results view event through DataLayer or Events API.",
          docs: ["quickstart/search/building-custom-ui"],
          confidence: 0.92
        })
      );
    }

    if (!artifact.capabilities.analytics.searchResultsQuery) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_QUERY_ANALYTICS_MISSING",
          severity: "P1",
          title: "Search Results analytics do not include the query",
          message: `${artifact.path} does not show search_term or query.string populated from the user's search query.`,
          evidencePath: artifact.path,
          remediation: "Include the user's search query as search_term in DataLayer or query.string in Events API.",
          docs: ["quickstart/search/building-custom-ui", "analytics/api/events"],
          confidence: 0.86
        })
      );
    }

    if (!artifact.capabilities.analytics.analyticsItemsFromHits) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_ITEMS_NOT_FROM_HITS",
          severity: "P1",
          title: "Search Results analytics items are not mapped from hits",
          message: `${artifact.path} does not show analytics items: hits.map(...).`,
          evidencePath: artifact.path,
          remediation: "Build Search Results analytics items from the same hits array rendered to the user.",
          docs: ["quickstart/search/building-custom-ui"],
          confidence: 0.86
        })
      );
    }

    if (!artifact.capabilities.analytics.itemPosition) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_ITEM_POSITION_MISSING",
          severity: "P2",
          title: "Search Results analytics item position is missing",
          message: `${artifact.path} does not show index or position based on the rendered result order.`,
          evidencePath: artifact.path,
          remediation: "Send index/position as the rendered rank for every Search Results item.",
          docs: ["quickstart/search/building-custom-ui", "analytics/api/events"],
          confidence: 0.78
        })
      );
    }

    if (
      artifact.capabilities.responseFlow.skipsNoResultsTracking ||
      (artifact.capabilities.responseFlow.handlesNoResults && !artifact.capabilities.responseFlow.tracksNoResults)
    ) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_NO_RESULTS_NOT_TRACKED",
          severity: "P1",
          title: "Search no-results branch is not tracked",
          message: artifact.capabilities.responseFlow.skipsNoResultsTracking
            ? `${artifact.path} appears to return early when hits is empty, before sending Search Results analytics.`
            : `${artifact.path} handles empty hits but does not show a Search Results view with an empty items array.`,
          evidencePath: artifact.path,
          remediation: "When results.hits is empty, still send the Search Results view event with items: [].",
          docs: ["quickstart/search/building-custom-ui"],
          confidence: 0.9
        })
      );
    }

    if (!artifact.capabilities.analytics.clickEvent) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_CLICK_ANALYTICS_MISSING",
          severity: "P1",
          title: "Search result click analytics are missing",
          message: `${artifact.path} does not show Search result click/select tracking.`,
          evidencePath: artifact.path,
          remediation: "Track selected Search results as DataLayer select_item or Events API click with the rendered result identity.",
          docs: ["quickstart/search/building-custom-ui", "analytics/api/events"],
          confidence: 0.88
        })
      );
    }

    if (!artifact.capabilities.identityFlow.clickUsesRenderedIdentity) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_SEARCH_CLICK_DOES_NOT_USE_RENDERED_IDENTITY",
          severity: "P1",
          title: "Search click analytics may not use rendered result identity",
          message: `${artifact.path} does not show click analytics reading the selected result element's identity.`,
          evidencePath: artifact.path,
          remediation: "Read the selected result element's data identity and send it in the click/select event.",
          docs: ["quickstart/search/building-custom-ui", "analytics/api/events"],
          confidence: 0.84
        })
      );
    }

    return findings;
  });
}

function validateTopItemsFlow(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];
    const expectation = profile.features.topItems;

    if (!artifact.capabilities.endpoints.topItems) {
      if (expectation !== "disabled") {
        findings.push(
          frontendFinding({
            id: "FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED",
            severity: severityForMissingExpectedFeature(expectation),
            title: "Top Items on focus is not evidenced",
            message: `${artifact.path} does not reference https://live.luigisbox.com/v1/top_items.`,
            evidencePath: artifact.path,
            remediation:
              expectation === "required"
                ? "Add evidence for the expected Top Items API call on empty search focus."
                : "If the autocomplete UX shows suggestions on empty search focus, provide evidence for the Top Items API call.",
            docs: ["autocomplete/api/v1/top-items", "quickstart/autocomplete/top-items-api"],
            confidence: expectation === "required" ? 0.88 : 0.72
          })
        );
      }
      return findings;
    }

    if (expectation === "disabled") {
      findings.push(
        frontendFinding({
          id: "FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE",
          severity: "P2",
          title: "Top Items are present but profile says they are not used",
          message: `${artifact.path} references Top Items, while the validation profile sets topItems=disabled.`,
          evidencePath: artifact.path,
          remediation: "Either remove the Top Items integration from the UI evidence, or update the profile to topItems=optional/required.",
          docs: ["autocomplete/api/v1/top-items", "quickstart/autocomplete/top-items-api"],
          confidence: 0.78
        })
      );
      return findings;
    }

    if (!artifact.capabilities.browser.focusListener) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_TOP_ITEMS_FOCUS_LISTENER_MISSING",
          severity: "P2",
          title: "Top Items is not wired to search focus",
          message: `${artifact.path} calls Top Items but does not show a focus listener on the search input.`,
          evidencePath: artifact.path,
          remediation: "Fetch top items when the search box receives focus and the input is empty.",
          docs: ["quickstart/autocomplete/top-items-api"],
          confidence: 0.78
        })
      );
    }

    if (!artifact.capabilities.analytics.recommendationView) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_TOP_ITEMS_RECOMMENDATION_ANALYTICS_MISSING",
          severity: "P0",
          title: "Top Items are not tracked as Recommendation",
          message: `${artifact.path} calls Top Items but does not show Recommendation list analytics.`,
          evidencePath: artifact.path,
          remediation: "Track top items shown in autocomplete as a Recommendation view, not as Autocomplete.",
          docs: ["autocomplete/api/v1/top-items", "quickstart/autocomplete/top-items-api"],
          confidence: 0.92
        })
      );
    }

    if (!artifact.capabilities.analytics.autocompletePopupPlacement) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_TOP_ITEMS_AUTOCOMPLETE_POPUP_PLACEMENT_MISSING",
          severity: "P1",
          title: "Top Items Recommendation placement is missing",
          message: `${artifact.path} does not show autocomplete_popup in Recommendation analytics filters.`,
          evidencePath: artifact.path,
          remediation: "Set RecommenderClientId and/or Recommender to autocomplete_popup for top items in the autocomplete dropdown.",
          docs: ["quickstart/autocomplete/top-items-api", "analytics/api/events"],
          confidence: 0.88
        })
      );
    }

    return findings;
  });
}

function validateTrendingQueriesFlow(
  artifacts: FrontendArtifact[],
  profile: FrontendValidationProfile
): ValidationFinding[] {
  return artifacts.flatMap((artifact) => {
    const findings: ValidationFinding[] = [];
    const expectation = profile.features.trendingQueries;

    if (!artifact.capabilities.endpoints.trendingQueries) {
      if (expectation !== "disabled") {
        findings.push(
          frontendFinding({
            id: "FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED",
            severity: severityForMissingExpectedFeature(expectation),
            title: "Trending Queries integration is not evidenced",
            message: `${artifact.path} does not reference https://live.luigisbox.com/v2/trending_queries.`,
            evidencePath: artifact.path,
            remediation:
              expectation === "required"
                ? "Add evidence for the expected Trending Queries API call."
                : "If the UX uses dashboard-managed trending queries, provide evidence for the Trending Queries API call.",
            docs: ["autocomplete/api/v2/trending-queries", "quickstart/autocomplete/trending-queries"],
            confidence: expectation === "required" ? 0.86 : 0.72
          })
        );
      }
      return findings;
    }

    if (expectation === "disabled") {
      findings.push(
        frontendFinding({
          id: "FRONTEND_TRENDING_QUERIES_UNEXPECTED_BY_PROFILE",
          severity: "P2",
          title: "Trending Queries are present but profile says they are not used",
          message: `${artifact.path} references Trending Queries, while the validation profile sets trendingQueries=disabled.`,
          evidencePath: artifact.path,
          remediation:
            "Either remove the Trending Queries integration from the UI evidence, or update the profile to trendingQueries=optional/required.",
          docs: ["autocomplete/api/v2/trending-queries", "quickstart/autocomplete/trending-queries"],
          confidence: 0.78
        })
      );
      return findings;
    }

    if (!artifact.capabilities.responseFlow.mapsTrendingTitles) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_TRENDING_QUERY_TITLES_NOT_MAPPED",
          severity: "P1",
          title: "Trending query titles are not mapped from the response",
          message: `${artifact.path} calls Trending Queries but does not show response titles being read.`,
          evidencePath: artifact.path,
          remediation: "Map the Trending Queries API response with item.title before rendering placeholders or query suggestions.",
          docs: ["autocomplete/api/v2/trending-queries", "quickstart/autocomplete/trending-queries"],
          confidence: 0.84
        })
      );
    }

    if (!artifact.capabilities.responseFlow.usesTrendingAsPlaceholder && !artifact.capabilities.analytics.searchResultsView) {
      findings.push(
        frontendFinding({
          id: "FRONTEND_TRENDING_QUERY_USE_NOT_CLEAR",
          severity: "P2",
          title: "Trending query usage is not clear",
          message: `${artifact.path} calls Trending Queries but does not show placeholder usage or Search Results tracking after a click.`,
          evidencePath: artifact.path,
          remediation: "Use trending queries as placeholders, or if they are clickable, run search and track the resulting Search Results view.",
          docs: ["quickstart/autocomplete/trending-queries"],
          confidence: 0.76
        })
      );
    }

    return findings;
  });
}

function validateSearchTypeFilters(artifact: FrontendArtifact, profile: FrontendValidationProfile): ValidationFinding[] {
  const expectedTypes = profile.search?.expectedResultTypes ?? [];
  const actualTypes = artifact.capabilities.requestParams.searchTypeFilters;

  if (actualTypes.length === 0) {
    return [
      frontendFinding({
        id: "FRONTEND_SEARCH_TYPE_FILTER_MISSING",
        severity: expectedTypes.length > 0 ? "P1" : "P2",
        title: "Search request does not scope result type",
        message: expectedTypes.length > 0
          ? `${artifact.path} expects ${expectedTypes.join(", ")} results but does not show f[]=type:<type>.`
          : `${artifact.path} does not show f[]=type:<type> in the Search API request.`,
        evidencePath: artifact.path,
        remediation: expectedTypes.length > 0
          ? `Add f[]=type:${expectedTypes[0]} so the UI asks for the indexed result type.`
          : "Add f[]=type:<main-content-type> unless this Search UI intentionally mixes multiple result types.",
        docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
        confidence: expectedTypes.length > 0 ? 0.88 : 0.76
      })
    ];
  }

  const missing = expectedTypes.filter((type) => !actualTypes.includes(type));
  if (missing.length === 0) return [];

  return [
    frontendFinding({
      id: "FRONTEND_SEARCH_TYPE_FILTER_MISMATCH",
      severity: "P1",
      title: "Search UI filters the wrong result type",
      message: `${artifact.path} expects ${expectedTypes.join(", ")} results, but the Search request filters ${actualTypes.join(", ")}.`,
      evidencePath: artifact.path,
      remediation: `Use the indexed hit type in the Search request, for example f[]=type:${expectedTypes[0]}.`,
      docs: ["search/api/v1/search", "quickstart/search/building-custom-ui"],
      confidence: 0.9
    })
  ];
}

function requiredParamFinding(artifact: FrontendArtifact, param: string, remediation: string): ValidationFinding {
  return frontendFinding({
    id: "FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING",
    severity: "P0",
    title: "Frontend autocomplete request is missing a required parameter",
    message: `${artifact.path} does not show ${param} in the autocomplete request.`,
    evidencePath: artifact.path,
    remediation,
    docs: ["autocomplete/api/v2/autocomplete", "quickstart/autocomplete/query-suggestions"],
    confidence: 0.92
  });
}

function frontendFinding(input: Omit<Parameters<typeof createFinding>[0], "area">): ValidationFinding {
  return createFinding({ area: "frontend", ...input });
}

function severityForMissingExpectedFeature(expectation: FrontendFeatureExpectation): "P1" | "P2" {
  return expectation === "required" ? "P1" : "P2";
}

function collectorScriptSnippet(profile: FrontendValidationProfile): string {
  if (!profile.trackerId) return '<script async src="https://scripts.luigisbox.tech/LBX-YOUR_TRACKER_ID.js"></script>';

  const scriptId = profile.trackerId.includes("-") ? profile.trackerId.split("-").at(-1) : profile.trackerId;
  return `<script async src="https://scripts.luigisbox.tech/LBX-${scriptId}.js"></script>`;
}
