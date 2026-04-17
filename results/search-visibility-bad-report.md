
Service API Validation Report
Score: 62/100
Findings: P0=0 P1=5 P2=1

Detected artifacts:
- fixtures/service/search-visibility-bad.json: search-visibility (1 check, 95%)

Detected checks:
- fixtures/service/search-visibility-bad.json:checks[0]: search / Digital products queried with item filter

Live requests:
- Digital products queried with item filter: 200 in 142ms / https://live.luigisbox.com/search?tracker_id=757876-1071971&q=shirt&f%5B%5D=type%3Aitem&hit_fields=title%2Cweb_url&size=5

P1 Findings

- [SERVICE_SEARCH_TYPE_FILTER_MISMATCH] Search request filters the wrong result type
  Evidence: fixtures/service/search-visibility-bad.json:checks[0].request.params.f[]
  Why: "Digital products queried with item filter" expects digital-products results, but request type filters are item.
  Fix: Use the type value that the catalog actually indexed, for example f[]=type:digital-products.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.9

- [SERVICE_ANALYTICS_LIST_MISMATCH] Service check maps to the wrong analytics list
  Evidence: fixtures/service/search-visibility-bad.json:checks[0].analytics.viewListName
  Why: "Digital products queried with item filter" should be tracked as Search Results, but declares Autocomplete.
  Fix: Set analytics.viewListName to Search Results for this endpoint behavior.
  Docs: [quickstart/autocomplete/query-suggestions](https://docs.luigisbox.com/quickstart/autocomplete/query-suggestions), [quickstart/autocomplete/top-items-api](https://docs.luigisbox.com/quickstart/autocomplete/top-items-api), [quickstart/autocomplete/trending-queries](https://docs.luigisbox.com/quickstart/autocomplete/trending-queries), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.9

- [SERVICE_SEARCH_CLICK_TRACKING_MISSING] Search result click tracking is missing
  Evidence: fixtures/service/search-visibility-bad.json:checks[0].analytics.clickAction
  Why: "Digital products queried with item filter" does not state that result clicks are tracked as click actions.
  Fix: Track product/result selection as an Events API click action or dataLayer select_item with the clicked catalog identity.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.86

- [SERVICE_RESULT_TYPE_MISSING] Expected result type is missing
  Evidence: fixtures/service/search-visibility-bad.json:checks[0].response.results.hits
  Why: "Digital products queried with item filter" did not return any digital-products hit.
  Fix: Check the type parameter counts and catalog content for the expected object type.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.88

- [SERVICE_EXPECTED_IDENTITY_MISSING] Expected catalog identity is missing from service response
  Evidence: fixtures/service/search-visibility-bad.json:checks[0].response.results.hits
  Why: "Digital products queried with item filter" did not return digSKU-1001.
  Fix: Verify the object exists in the catalog, is indexed, matches the query/filter, and is not excluded by availability/ranking setup.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.88

P2 Findings

- [SERVICE_SEARCH_NO_RESULTS_EVENT_MISSING] Search no-results tracking is not declared
  Evidence: fixtures/service/search-visibility-bad.json:checks[0].analytics.noResultsEventRequired
  Why: "Digital products queried with item filter" does not declare that zero-result searches are still tracked.
  Fix: Send the Search Results view event even when the hits array is empty so zero-result queries can be learned from.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.84
