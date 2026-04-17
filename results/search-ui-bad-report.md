
Search Frontend Validation Report
Profile: service=search; analyticsMode=datalayer; autocomplete=disabled; search=required; topItems=disabled; trendingQueries=disabled; searchTypes=digital-products trackerId=757876-1071971
Score: 1/100
Findings: P0=2 P1=9 P2=2

Detected artifacts:
- fixtures/frontend/search-bad.html: html / datalayer (90%)

Detected capabilities:
- fixtures/frontend/search-bad.html: endpoints=search; analytics=Autocomplete view

P0 Findings

- [FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING] DataLayer page is missing the collector script
  Evidence: fixtures/frontend/search-bad.html:head
  Why: fixtures/frontend/search-bad.html uses dataLayer.push but does not include the Luigi's Box collector script.
  Fix: Add <script async src="https://scripts.luigisbox.tech/LBX-1071971.js"></script> to the shared head.
  Docs: [analytics/collector](https://docs.luigisbox.com/analytics/collector), [platform-foundations/lbx-script](https://docs.luigisbox.com/platform-foundations/lbx-script)
  Confidence: 0.95

- [FRONTEND_SEARCH_RESULTS_VIEW_ANALYTICS_MISSING] Search Results view analytics are missing
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show a Search Results list view after rendering Search API results.
  Fix: After rendering results.hits, send a Search Results view event through DataLayer or Events API.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.92

P1 Findings

- [FRONTEND_SEARCH_TYPE_FILTER_MISMATCH] Search UI filters the wrong result type
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html expects digital-products results, but the Search request filters item.
  Fix: Use the indexed hit type in the Search request, for example f[]=type:digital-products.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.9

- [FRONTEND_SEARCH_RESULTS_OBJECT_NOT_READ] Frontend does not read Search API results object
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show response.data.results or data.results from the Search API response.
  Fix: Read Search API responses from response.data.results, then use results.hits, results.facets, and results.total_hits.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.86

- [FRONTEND_SEARCH_HITS_WRONG_RESPONSE_SHAPE] Search UI reads root hits instead of results.hits
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html appears to read data.hits/root hits, but Search API hits live under results.hits.
  Fix: Use data.results.hits as the source for rendering and analytics on Search result pages.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.9

- [FRONTEND_SEARCH_HITS_NOT_RENDERED] Frontend does not render Search API hits
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show results.hits being mapped into rendered product/result cards.
  Fix: Render product cards from the same results.hits array that analytics uses.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.82

- [FRONTEND_SEARCH_RENDERED_IDENTITY_NOT_HIT_URL] Rendered Search result identity may not match catalog identity
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show rendered result elements storing hit.url/result.url as the item identity.
  Fix: Store the returned hit.url/result.url on rendered result links/buttons and reuse it for click analytics.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.84

- [FRONTEND_SEARCH_ANALYTICS_IDENTITY_NOT_HIT_URL] Search analytics may not use returned hit identity
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show Search analytics items using hit.url as item_id/url.
  Fix: Map Search Results analytics from hits with item_id/url set to hit.url so rendering and analytics use the same identity.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui), [analytics/api/events](https://docs.luigisbox.com/analytics/api/events)
  Confidence: 0.86

- [FRONTEND_SEARCH_NO_RESULTS_NOT_TRACKED] Search no-results branch is not tracked
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html appears to return early when hits is empty, before sending Search Results analytics.
  Fix: When results.hits is empty, still send the Search Results view event with items: [].
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.9

- [FRONTEND_SEARCH_CLICK_ANALYTICS_MISSING] Search result click analytics are missing
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show Search result click/select tracking.
  Fix: Track selected Search results as DataLayer select_item or Events API click with the rendered result identity.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui), [analytics/api/events](https://docs.luigisbox.com/analytics/api/events)
  Confidence: 0.88

- [FRONTEND_SEARCH_CLICK_DOES_NOT_USE_RENDERED_IDENTITY] Search click analytics may not use rendered result identity
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show click analytics reading the selected result element's identity.
  Fix: Read the selected result element's data identity and send it in the click/select event.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui), [analytics/api/events](https://docs.luigisbox.com/analytics/api/events)
  Confidence: 0.84

P2 Findings

- [FRONTEND_SEARCH_HIT_FIELDS_MISSING] Search request does not limit hit_fields
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not include hit_fields in the Search API request.
  Fix: Request only fields rendered in the results UI, such as title,url,price_amount,image_link,brand,nested.
  Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.82

- [FRONTEND_SEARCH_FACETS_NOT_RENDERED] Search UI does not show facet rendering
  Evidence: fixtures/frontend/search-bad.html
  Why: fixtures/frontend/search-bad.html does not show results.facets being rendered or updated.
  Fix: Render facets from data.results.facets when the custom Search UI supports filters.
  Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
  Confidence: 0.72
