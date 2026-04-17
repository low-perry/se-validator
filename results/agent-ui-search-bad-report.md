# Agent UI Review Report

Service: search
Generated: 2026-04-17T12:30:52.921Z
Docs root: /Users/lowperry/projects/docs
Profile: service=search; analyticsMode=datalayer; autocomplete=disabled; search=required; topItems=disabled; trendingQueries=disabled; searchTypes=digital-products trackerId=757876-1071971
Score: 1/100
Findings: P0=2 P1=9 P2=2

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/search-bad.html

## Detected Integration Shape
- fixtures/frontend/search-bad.html: html / datalayer (90%)

## Detected Capabilities
- fixtures/frontend/search-bad.html: endpoints=search; analytics=Autocomplete view

## Review Findings

### P0 FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html:head
Problem: fixtures/frontend/search-bad.html uses dataLayer.push but does not include the Luigi's Box collector script.
Recommended fix: Add <script async src="https://scripts.luigisbox.tech/LBX-1071971.js"></script> to the shared head.
Likely code: fixtures/frontend/search-bad.html:3
Snippet: `<head>`
Docs: [analytics/collector](https://docs.luigisbox.com/analytics/collector), [platform-foundations/lbx-script](https://docs.luigisbox.com/platform-foundations/lbx-script)
Confidence: 0.95

Debug Notes:
- What we looked for: <script src="https://scripts.luigisbox.tech/LBX-*.js"> in the document head.
- What we found: `<head>` at fixtures/frontend/search-bad.html:3.
- Why it matters: Without the collector script dataLayer.push events are never read and every tracked event is dropped.
- Evidence type: static

### P0 FRONTEND_SEARCH_RESULTS_VIEW_ANALYTICS_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show a Search Results list view after rendering Search API results.
Recommended fix: After rendering results.hits, send a Search Results view event through DataLayer or Events API.
Likely code: fixtures/frontend/search-bad.html:38
Snippet: `resultsContainer.innerHTML = hits.map((hit) => {`
Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.92

Debug Notes:
- What we looked for: a Search Results view event fired after rendering results.hits.
- What we found: `resultsContainer.innerHTML = hits.map((hit) => {` at fixtures/frontend/search-bad.html:38.
- Why it matters: Without a Search Results impression, Luigi's Box cannot learn which ranked results were shown.
- Evidence type: static

### P1 FRONTEND_SEARCH_ANALYTICS_IDENTITY_NOT_HIT_URL
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show Search analytics items using hit.url as item_id/url.
Recommended fix: Map Search Results analytics from hits with item_id/url set to hit.url so rendering and analytics use the same identity.
Likely code: fixtures/frontend/search-bad.html:15
Snippet: `const API_ENDPOINT = "https://live.luigisbox.com/search";`
Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui), [analytics/api/events](https://docs.luigisbox.com/analytics/api/events)
Confidence: 0.86

Debug Notes:
- What we looked for: search analytics may not use returned hit identity (rule FRONTEND_SEARCH_ANALYTICS_IDENTITY_NOT_HIT_URL).
- What we found: `const API_ENDPOINT = "https://live.luigisbox.com/search";` at fixtures/frontend/search-bad.html:15.
- Why it matters: Map Search Results analytics from hits with item_id/url set to hit.url so rendering and analytics use the same identity.
- Evidence type: static

### P1 FRONTEND_SEARCH_CLICK_ANALYTICS_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show Search result click/select tracking.
Recommended fix: Track selected Search results as DataLayer select_item or Events API click with the rendered result identity.
Likely code: fixtures/frontend/search-bad.html:38
Snippet: `resultsContainer.innerHTML = hits.map((hit) => {`
Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui), [analytics/api/events](https://docs.luigisbox.com/analytics/api/events)
Confidence: 0.88

Debug Notes:
- What we looked for: a click/select_item handler for rendered Search result cards.
- What we found: `resultsContainer.innerHTML = hits.map((hit) => {` at fixtures/frontend/search-bad.html:38.
- Why it matters: Click events are the feedback signal for Search ranking; without them relevance cannot improve from usage.
- Evidence type: static

### P1 FRONTEND_SEARCH_CLICK_DOES_NOT_USE_RENDERED_IDENTITY
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show click analytics reading the selected result element's identity.
Recommended fix: Read the selected result element's data identity and send it in the click/select event.
Likely code: fixtures/frontend/search-bad.html:38
Snippet: `resultsContainer.innerHTML = hits.map((hit) => {`
Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui), [analytics/api/events](https://docs.luigisbox.com/analytics/api/events)
Confidence: 0.84

Debug Notes:
- What we looked for: search click analytics may not use rendered result identity (rule FRONTEND_SEARCH_CLICK_DOES_NOT_USE_RENDERED_IDENTITY).
- What we found: `resultsContainer.innerHTML = hits.map((hit) => {` at fixtures/frontend/search-bad.html:38.
- Why it matters: Read the selected result element's data identity and send it in the click/select event.
- Evidence type: static

### P1 FRONTEND_SEARCH_HITS_NOT_RENDERED
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show results.hits being mapped into rendered product/result cards.
Recommended fix: Render product cards from the same results.hits array that analytics uses.
Likely code: fixtures/frontend/search-bad.html:15
Snippet: `const API_ENDPOINT = "https://live.luigisbox.com/search";`
Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.82

Debug Notes:
- What we looked for: frontend does not render search api hits (rule FRONTEND_SEARCH_HITS_NOT_RENDERED).
- What we found: `const API_ENDPOINT = "https://live.luigisbox.com/search";` at fixtures/frontend/search-bad.html:15.
- Why it matters: Render product cards from the same results.hits array that analytics uses.
- Evidence type: static

### P1 FRONTEND_SEARCH_HITS_WRONG_RESPONSE_SHAPE
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html appears to read data.hits/root hits, but Search API hits live under results.hits.
Recommended fix: Use data.results.hits as the source for rendering and analytics on Search result pages.
Likely code: fixtures/frontend/search-bad.html:15
Snippet: `const API_ENDPOINT = "https://live.luigisbox.com/search";`
Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.9

Debug Notes:
- What we looked for: code reading data.results.hits from the Search API response.
- What we found: `const API_ENDPOINT = "https://live.luigisbox.com/search";` at fixtures/frontend/search-bad.html:15.
- Why it matters: Search API wraps hits under results; reading root data.hits leaves rendering and analytics empty.
- Evidence type: static

### P1 FRONTEND_SEARCH_NO_RESULTS_NOT_TRACKED
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html appears to return early when hits is empty, before sending Search Results analytics.
Recommended fix: When results.hits is empty, still send the Search Results view event with items: [].
Likely code: fixtures/frontend/search-bad.html:15
Snippet: `const API_ENDPOINT = "https://live.luigisbox.com/search";`
Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.9

Debug Notes:
- What we looked for: a Search Results view event with items: [] when results.hits is empty.
- What we found: `const API_ENDPOINT = "https://live.luigisbox.com/search";` at fixtures/frontend/search-bad.html:15.
- Why it matters: Untracked zero-result searches are invisible in reporting, so content gaps cannot be discovered.
- Evidence type: static

### P1 FRONTEND_SEARCH_RENDERED_IDENTITY_NOT_HIT_URL
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show rendered result elements storing hit.url/result.url as the item identity.
Recommended fix: Store the returned hit.url/result.url on rendered result links/buttons and reuse it for click analytics.
Likely code: fixtures/frontend/search-bad.html:38
Snippet: `resultsContainer.innerHTML = hits.map((hit) => {`
Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.84

Debug Notes:
- What we looked for: rendered search result identity may not match catalog identity (rule FRONTEND_SEARCH_RENDERED_IDENTITY_NOT_HIT_URL).
- What we found: `resultsContainer.innerHTML = hits.map((hit) => {` at fixtures/frontend/search-bad.html:38.
- Why it matters: Store the returned hit.url/result.url on rendered result links/buttons and reuse it for click analytics.
- Evidence type: static

### P1 FRONTEND_SEARCH_RESULTS_OBJECT_NOT_READ
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show response.data.results or data.results from the Search API response.
Recommended fix: Read Search API responses from response.data.results, then use results.hits, results.facets, and results.total_hits.
Likely code: fixtures/frontend/search-bad.html:38
Snippet: `resultsContainer.innerHTML = hits.map((hit) => {`
Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.86

Debug Notes:
- What we looked for: frontend does not read search api results object (rule FRONTEND_SEARCH_RESULTS_OBJECT_NOT_READ).
- What we found: `resultsContainer.innerHTML = hits.map((hit) => {` at fixtures/frontend/search-bad.html:38.
- Why it matters: Read Search API responses from response.data.results, then use results.hits, results.facets, and results.total_hits.
- Evidence type: static

### P1 FRONTEND_SEARCH_TYPE_FILTER_MISMATCH
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html expects digital-products results, but the Search request filters item.
Recommended fix: Use the indexed hit type in the Search request, for example f[]=type:digital-products.
Likely code: fixtures/frontend/search-bad.html:38
Snippet: `resultsContainer.innerHTML = hits.map((hit) => {`
Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.9

Debug Notes:
- What we looked for: the Search API type filter matching the expected indexed hit type in the profile.
- What we found: `resultsContainer.innerHTML = hits.map((hit) => {` at fixtures/frontend/search-bad.html:38.
- Why it matters: If the UI asks for type:item while the feed indexed type:digital-products, the objects exist but never appear in that UI.
- Evidence type: static

### P2 FRONTEND_SEARCH_FACETS_NOT_RENDERED
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not show results.facets being rendered or updated.
Recommended fix: Render facets from data.results.facets when the custom Search UI supports filters.
Likely code: fixtures/frontend/search-bad.html:15
Snippet: `const API_ENDPOINT = "https://live.luigisbox.com/search";`
Docs: [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.72

Debug Notes:
- What we looked for: search ui does not show facet rendering (rule FRONTEND_SEARCH_FACETS_NOT_RENDERED).
- What we found: `const API_ENDPOINT = "https://live.luigisbox.com/search";` at fixtures/frontend/search-bad.html:15.
- Why it matters: Render facets from data.results.facets when the custom Search UI supports filters.
- Evidence type: static

### P2 FRONTEND_SEARCH_HIT_FIELDS_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/search-bad.html
Problem: fixtures/frontend/search-bad.html does not include hit_fields in the Search API request.
Recommended fix: Request only fields rendered in the results UI, such as title,url,price_amount,image_link,brand,nested.
Likely code: fixtures/frontend/search-bad.html:15
Snippet: `const API_ENDPOINT = "https://live.luigisbox.com/search";`
Docs: [search/api/v1/search](https://docs.luigisbox.com/search/api/v1/search), [quickstart/search/building-custom-ui](https://docs.luigisbox.com/quickstart/search/building-custom-ui)
Confidence: 0.82

Debug Notes:
- What we looked for: search request does not limit hit_fields (rule FRONTEND_SEARCH_HIT_FIELDS_MISSING).
- What we found: `const API_ENDPOINT = "https://live.luigisbox.com/search";` at fixtures/frontend/search-bad.html:15.
- Why it matters: Request only fields rendered in the results UI, such as title,url,price_amount,image_link,brand,nested.
- Evidence type: static

## Docs Consulted

- [Building a custom search UI with the Search API](https://docs.luigisbox.com/quickstart/search/building-custom-ui) (quickstart/search/building-custom-ui): /Users/lowperry/projects/docs/src/content/docs/quickstart/search/building-custom-ui.md:556
  Reason: Referenced by FRONTEND_SEARCH_TYPE_FILTER_MISMATCH
  Section: Step 7: track analytics events manually
  Matched: search, search api, tracker_id, `q`, f[], type:product, hit_fields, results.hits
  > You have two options for sending analytics: the **DataLayer Collector** (recommended for web integrations that already use a `dataLayer`) or the **Events API** (recommended...

- [DataLayer collector](https://docs.luigisbox.com/analytics/collector) (analytics/collector): /Users/lowperry/projects/docs/src/content/docs/analytics/collector.md:172
  Reason: Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  Section: Search results
  Matched: search, search api, analytics, Search Results, view_item_list, click, no results, dataLayer
  > Send a [`view_item_list`](https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#view_item_list) event when the search results list is displayed. The structure is identical to Autocomplete, except `item_list_name` is `"Search Results"`.

- [Search API](https://docs.luigisbox.com/search/api/v1/search) (search/api/v1/search): /Users/lowperry/projects/docs/src/content/docs/search/api/v1/search.mdx:221
  Reason: Referenced by FRONTEND_SEARCH_TYPE_FILTER_MISMATCH
  Section: How to Make a Request
  Matched: search, search api, tracker_id, `q`, f[], type:product, hit_fields, total_hits
  > 3. Pass filters, facets, sorting, and personalization through query parameters. 4. Keep `hit_fields` tight to reduce payload size when building a custom UI.

- [Event API](https://docs.luigisbox.com/analytics/api/events) (analytics/api/events): /Users/lowperry/projects/docs/src/content/docs/analytics/api/events.mdx:38
  Reason: Referenced by FRONTEND_SEARCH_ANALYTICS_IDENTITY_NOT_HIT_URL
  Section: Overview
  Matched: search, search api, tracker_id, analytics, Search Results, click, dataLayer, Events API
  > The Events API accepts structured JSON events that describe what users see, click, and buy. It is the right choice when you need to...

- [The Tracking Script](https://docs.luigisbox.com/platform-foundations/lbx-script) (platform-foundations/lbx-script): /Users/lowperry/projects/docs/src/content/docs/platform-foundations/lbx-script.md:11
  Reason: Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  Matched: search, analytics, type, script, platform, foundations, view
  > unique tracking script. This script activates Luigi's Box services, including Analytics, Autocomplete, Search, Product Listing, and Recommender.

- [Search.js](https://docs.luigisbox.com/search/search-js) (search/search-js): /Users/lowperry/projects/docs/src/content/docs/search/search-js.md:1162
  Reason: Related docs search match
  Section: Backend results rendering
  Matched: search, search api, analytics, Search Results, click, no results, frontend, type
  > 2. Loading state is set -- if your templates allow this, the UI enters the loading mode, for example, a loading spinner is shown....

- [Quickstart: Send your first search events with the Events API](https://docs.luigisbox.com/quickstart/analytics/events-api-first-search) (quickstart/analytics/events-api-first-search): /Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/events-api-first-search.md:25
  Reason: Quickstart guidance for implementation flow
  Section: Who is this guide for
  Matched: search, tracker_id, analytics, Search Results, click, no results, dataLayer, Events API
  > - Sending analytics events from their backend server. - Working on a website but prefer not to use the JavaScript-based [DataLayer Collector](/quickstart/analytics/datalayer-first-search/).

- [Rendering banner campaigns with the Search API](https://docs.luigisbox.com/quickstart/search/banner-campaigns) (quickstart/search/banner-campaigns): /Users/lowperry/projects/docs/src/content/docs/quickstart/search/banner-campaigns.md:40
  Reason: Quickstart guidance for implementation flow
  Section: Prerequisites
  Matched: search, search api, tracker_id, `q`, f[], type:product, hit_fields, results.hits
  > :::caution This guide assumes you already understand the basics from [Building a custom search UI with the Search API](/quickstart/search/building-custom-ui/). If you do not already...

- [../docs/public/examples/search/custom-search-ui-datalayer.html](https://docs.luigisbox.com/examples/search/custom-search-ui-datalayer.html): /Users/lowperry/projects/docs/public/examples/search/custom-search-ui-datalayer.html:382
  Reason: Runnable public example for this service
  Matched: search, tracker_id, f[], type:product, hit_fields, results.hits, results.facets, total_hits
  > // Always track — including when there are no results trackSearchView(query, data.results.hits, filters); } catch (error) {

- [Analytics and object identity: the foundation of Luigi's Box effectiveness](https://docs.luigisbox.com/quickstart/analytics/object-identity) (quickstart/analytics/object-identity): /Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/object-identity.md:42
  Reason: Quickstart guidance for implementation flow
  Section: Why is object identity critical for analytics?
  Matched: search, analytics, Search Results, click, dataLayer, Events API, type, filter
  > For this [feedback loop](/analytics/#identity-and-the-feedback-loop) to work effectively, the [object identity](/platform-foundations/identity/) used in your analytics events **must exactly match** the identity used when indexing that...

- [../docs/public/examples/search/custom-search-ui.html](https://docs.luigisbox.com/examples/search/custom-search-ui.html): /Users/lowperry/projects/docs/public/examples/search/custom-search-ui.html:379
  Reason: Runnable public example for this service
  Matched: search, tracker_id, f[], type:product, hit_fields, results.hits, results.facets, total_hits
  > trackSearchView(query, data.results.hits); } catch (error) {

- [Track your first search with DataLayer collector](https://docs.luigisbox.com/quickstart/analytics/datalayer-first-search) (quickstart/analytics/datalayer-first-search): /Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/datalayer-first-search.md:35
  Reason: Quickstart guidance for implementation flow
  Section: Step 1: Track your search results view
  Matched: search, analytics, Search Results, view_item_list, click, no results, dataLayer, type
  > The first step is to inform Luigi's Box about the search results presented to a user. This is done by pushing a `view_item_list` event...

## Next Actions
- P0: Add <script async src="https://scripts.luigisbox.tech/LBX-1071971.js"></script> to the shared head.
- P0: After rendering results.hits, send a Search Results view event through DataLayer or Events API.
- P1: Map Search Results analytics from hits with item_id/url set to hit.url so rendering and analytics use the same identity.
- P1: Track selected Search results as DataLayer select_item or Events API click with the rendered result identity.
- P1: Read the selected result element's data identity and send it in the click/select event.
- P1: Render product cards from the same results.hits array that analytics uses.
- Re-run this command after fixing P0 items; P0 means the implementation likely cannot be considered integrated.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box search frontend integration.
Service: search
Profile: service=search; analyticsMode=datalayer; autocomplete=disabled; search=required; topItems=disabled; trendingQueries=disabled; searchTypes=digital-products trackerId=757876-1071971
Docs root: /Users/lowperry/projects/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/search-bad.html

Use the local docs and public examples first. Check whether the sample:
- calls the Search API with tracker_id, q or filters, f[]=type:<indexed-type>, and relevant hit_fields;
- reads Search API responses from data.results.hits, data.results.facets, and data.results.total_hits;
- renders results.hits from the same data used for analytics;
- keeps item identity consistent with hit.url/url returned by the API;
- sends Search Results view and click analytics after results are rendered;
- tracks no-result Search responses with an empty items array.

Current deterministic findings:
P1 FRONTEND_SEARCH_TYPE_FILTER_MISMATCH: Search UI filters the wrong result type
P2 FRONTEND_SEARCH_HIT_FIELDS_MISSING: Search request does not limit hit_fields
P1 FRONTEND_SEARCH_RESULTS_OBJECT_NOT_READ: Frontend does not read Search API results object
P1 FRONTEND_SEARCH_HITS_WRONG_RESPONSE_SHAPE: Search UI reads root hits instead of results.hits
P1 FRONTEND_SEARCH_HITS_NOT_RENDERED: Frontend does not render Search API hits
P2 FRONTEND_SEARCH_FACETS_NOT_RENDERED: Search UI does not show facet rendering
P1 FRONTEND_SEARCH_RENDERED_IDENTITY_NOT_HIT_URL: Rendered Search result identity may not match catalog identity
P1 FRONTEND_SEARCH_ANALYTICS_IDENTITY_NOT_HIT_URL: Search analytics may not use returned hit identity
P0 FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING: DataLayer page is missing the collector script
P0 FRONTEND_SEARCH_RESULTS_VIEW_ANALYTICS_MISSING: Search Results view analytics are missing
P1 FRONTEND_SEARCH_NO_RESULTS_NOT_TRACKED: Search no-results branch is not tracked
P1 FRONTEND_SEARCH_CLICK_ANALYTICS_MISSING: Search result click analytics are missing
P1 FRONTEND_SEARCH_CLICK_DOES_NOT_USE_RENDERED_IDENTITY: Search click analytics may not use rendered result identity
```

## Explanation: Severities
- P0: blocking. The implementation likely cannot be considered integrated until this is fixed. Re-run review after remediation.
- P1: important. The integration runs but produces incorrect or low-quality data (wrong identity, missing analytics, mismatched profile).
- P2: advisory. The integration works, but the fix improves latency, robustness, or analytics richness.

## Explanation: Detected Integration Path
- DataLayer collector analytics
- Search API for a custom search results page

## Explanation: Static vs Browser Evidence
- Static evidence comes from parsing the HTML/JS source files. It shows what the code says it will do, but cannot confirm runtime behavior.
- Browser evidence is captured by loading the page in a headless browser and observing real network requests, rendered DOM, and dataLayer pushes.
- This review used static evidence only. Pass --browser to add live observations (network calls, rendered hits, dataLayer events).

## Explanation: How Docs Were Selected
- Each hit is scored by keyword match against the integration shape, then surfaced with a reason explaining why it was included:
  - [Building a custom search UI with the Search API](https://docs.luigisbox.com/quickstart/search/building-custom-ui) (quickstart/search/building-custom-ui): Referenced by FRONTEND_SEARCH_TYPE_FILTER_MISMATCH
  - [DataLayer collector](https://docs.luigisbox.com/analytics/collector) (analytics/collector): Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  - [Search API](https://docs.luigisbox.com/search/api/v1/search) (search/api/v1/search): Referenced by FRONTEND_SEARCH_TYPE_FILTER_MISMATCH
  - [Event API](https://docs.luigisbox.com/analytics/api/events) (analytics/api/events): Referenced by FRONTEND_SEARCH_ANALYTICS_IDENTITY_NOT_HIT_URL
  - [The Tracking Script](https://docs.luigisbox.com/platform-foundations/lbx-script) (platform-foundations/lbx-script): Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  - [Search.js](https://docs.luigisbox.com/search/search-js) (search/search-js): Related docs search match
  - [Quickstart: Send your first search events with the Events API](https://docs.luigisbox.com/quickstart/analytics/events-api-first-search) (quickstart/analytics/events-api-first-search): Quickstart guidance for implementation flow
  - [Rendering banner campaigns with the Search API](https://docs.luigisbox.com/quickstart/search/banner-campaigns) (quickstart/search/banner-campaigns): Quickstart guidance for implementation flow
  - [../docs/public/examples/search/custom-search-ui-datalayer.html](https://docs.luigisbox.com/examples/search/custom-search-ui-datalayer.html): Runnable public example for this service
  - [Analytics and object identity: the foundation of Luigi's Box effectiveness](https://docs.luigisbox.com/quickstart/analytics/object-identity) (quickstart/analytics/object-identity): Quickstart guidance for implementation flow
  - [../docs/public/examples/search/custom-search-ui.html](https://docs.luigisbox.com/examples/search/custom-search-ui.html): Runnable public example for this service
  - [Track your first search with DataLayer collector](https://docs.luigisbox.com/quickstart/analytics/datalayer-first-search) (quickstart/analytics/datalayer-first-search): Quickstart guidance for implementation flow
