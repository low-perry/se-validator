# Agent UI Review Report

Service: search
Generated: 2026-04-17T12:30:52.787Z
Docs root: /Users/lowperry/projects/docs
Profile: service=search; analyticsMode=datalayer; autocomplete=disabled; search=required; topItems=disabled; trendingQueries=disabled; searchTypes=digital-products trackerId=757876-1071971
Score: 100/100
Findings: P0=0 P1=0 P2=0

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/search-datalayer-good.html

## Detected Integration Shape
- fixtures/frontend/search-datalayer-good.html: html / datalayer (90%)

## Detected Capabilities
- fixtures/frontend/search-datalayer-good.html: endpoints=search; analytics=Search Results view, click/select, no-results

## Review Findings
No findings. The sample passes the current deterministic UI rule set.

### Why this passed
The validator verified each of the following against the inputs:
- fixtures/frontend/search-datalayer-good.html: Luigi's Box endpoints evidenced: search.
- fixtures/frontend/search-datalayer-good.html: analytics events evidenced: Search Results view, click/select, no-results.
- No P0/P1/P2 rules from the deterministic frontend rule set fired on the inputs.

## Docs Consulted

- [Building a custom search UI with the Search API](https://docs.luigisbox.com/quickstart/search/building-custom-ui) (quickstart/search/building-custom-ui): /Users/lowperry/projects/docs/src/content/docs/quickstart/search/building-custom-ui.md:119
  Reason: Quickstart guidance for implementation flow
  Section: Example: Search API request URL
  Matched: search, search api, tracker_id, `q`, f[], type:product, hit_fields, results.hits
  > `GET` `https://live.luigisbox.com/search?tracker_id= &q=digital+piano&f[]=type:product&facets=brand,category,price_amount&hit_fields=title,url,price_amount,image_link,brand,nested,color_code,color,id&page=1`

- [DataLayer collector](https://docs.luigisbox.com/analytics/collector) (analytics/collector): /Users/lowperry/projects/docs/src/content/docs/analytics/collector.md:172
  Reason: Related docs search match
  Section: Search results
  Matched: search, search api, analytics, Search Results, view_item_list, click, no results, dataLayer
  > Send a [`view_item_list`](https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#view_item_list) event when the search results list is displayed. The structure is identical to Autocomplete, except `item_list_name` is `"Search Results"`.

- [Quickstart: Send your first search events with the Events API](https://docs.luigisbox.com/quickstart/analytics/events-api-first-search) (quickstart/analytics/events-api-first-search): /Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/events-api-first-search.md:318
  Reason: Quickstart guidance for implementation flow
  Section: Structure the JSON payload
  Matched: search, tracker_id, analytics, Search Results, click, no results, dataLayer, Events API
  > The `resource_identifier` must match the url of the item from the search results list so Luigi's Box can link the click to the original...

- [Track your first search with DataLayer collector](https://docs.luigisbox.com/quickstart/analytics/datalayer-first-search) (quickstart/analytics/datalayer-first-search): /Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/datalayer-first-search.md:35
  Reason: Quickstart guidance for implementation flow
  Section: Step 1: Track your search results view
  Matched: search, analytics, Search Results, view_item_list, click, no results, dataLayer
  > The first step is to inform Luigi's Box about the search results presented to a user. This is done by pushing a `view_item_list` event...

- [../docs/public/examples/search/custom-search-ui-datalayer.html](https://docs.luigisbox.com/examples/search/custom-search-ui-datalayer.html): /Users/lowperry/projects/docs/public/examples/search/custom-search-ui-datalayer.html:382
  Reason: Runnable public example for this service
  Matched: search, tracker_id, f[], type:product, hit_fields, results.hits, results.facets, total_hits
  > // Always track — including when there are no results trackSearchView(query, data.results.hits, filters); } catch (error) {

- [../docs/public/examples/search/custom-search-ui.html](https://docs.luigisbox.com/examples/search/custom-search-ui.html): /Users/lowperry/projects/docs/public/examples/search/custom-search-ui.html:379
  Reason: Runnable public example for this service
  Matched: search, tracker_id, f[], type:product, hit_fields, results.hits, results.facets, total_hits
  > trackSearchView(query, data.results.hits); } catch (error) {

- [Event API](https://docs.luigisbox.com/analytics/api/events) (analytics/api/events): /Users/lowperry/projects/docs/src/content/docs/analytics/api/events.mdx:38
  Reason: API reference for request or payload contract
  Section: Overview
  Matched: search, search api, tracker_id, analytics, Search Results, click, dataLayer, Events API
  > The Events API accepts structured JSON events that describe what users see, click, and buy. It is the right choice when you need to...

- [Rendering banner campaigns with the Search API](https://docs.luigisbox.com/quickstart/search/banner-campaigns) (quickstart/search/banner-campaigns): /Users/lowperry/projects/docs/src/content/docs/quickstart/search/banner-campaigns.md:309
  Reason: Quickstart guidance for implementation flow
  Section: Step 6: keep your existing analytics approach
  Matched: search, search api, tracker_id, `q`, f[], type:product, hit_fields, results.hits
  > Banner campaigns do not replace the normal manual analytics requirements for Search API integrations. Continue sending analytics for the search results page as described...

- [Implementing variant search](https://docs.luigisbox.com/quickstart/search/variant-search) (quickstart/search/variant-search): /Users/lowperry/projects/docs/src/content/docs/quickstart/search/variant-search.md:49
  Reason: Quickstart guidance for implementation flow
  Section: Example
  Matched: search, search api, tracker_id, f[], type:product, analytics, Search Results, view_item_list
  > `GET` `https://live.luigisbox.com/search?tracker_id=YOUR_TRACKER_ID&q=t-shirt&f[]=type:product`

- [Search.js](https://docs.luigisbox.com/search/search-js) (search/search-js): /Users/lowperry/projects/docs/src/content/docs/search/search-js.md:621
  Reason: Related docs search match
  Section: Results component
  Matched: search, search api, analytics, Search Results, click, no results
  > Note that in case the Search API returns no results, search.js will render template with id `template-no-results`.

- [Search API](https://docs.luigisbox.com/search/api/v1/search) (search/api/v1/search): /Users/lowperry/projects/docs/src/content/docs/search/api/v1/search.mdx:207
  Reason: API reference for request or payload contract
  Section: Request headers
  Matched: search, search api, tracker_id, `q`, f[], type:product, hit_fields, total_hits
  > ```shell curl "https://live.luigisbox.com/search?tracker_id=YOUR_TRACKER_ID&q=harry+potter&f[]=type:item" \ -H "Accept-Encoding: gzip, deflate"

- [Quickstart: Tracking purchases and key conversions with the Events API](https://docs.luigisbox.com/quickstart/analytics/events-api-tracking-purchases) (quickstart/analytics/events-api-tracking-purchases): /Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/events-api-tracking-purchases.md:11
  Reason: Quickstart guidance for implementation flow
  Section: Introduction
  Matched: search, tracker_id, analytics, click, Events API
  > You've learned how to track what users [see and click on](/quickstart/analytics/events-api-first-search/) using the [Events API](/analytics/api/events/). The next crucial step is to track when they...

## Next Actions
- Run the sample in a browser and confirm the Search API request, rendered results, Search Results view event, and click event appear in DevTools.
- Use the live dashboard/debugger to confirm Search Results events are accepted after the UI renders results.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box search frontend integration.
Service: search
Profile: service=search; analyticsMode=datalayer; autocomplete=disabled; search=required; topItems=disabled; trendingQueries=disabled; searchTypes=digital-products trackerId=757876-1071971
Docs root: /Users/lowperry/projects/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/search-datalayer-good.html

Use the local docs and public examples first. Check whether the sample:
- calls the Search API with tracker_id, q or filters, f[]=type:<indexed-type>, and relevant hit_fields;
- reads Search API responses from data.results.hits, data.results.facets, and data.results.total_hits;
- renders results.hits from the same data used for analytics;
- keeps item identity consistent with hit.url/url returned by the API;
- sends Search Results view and click analytics after results are rendered;
- tracks no-result Search responses with an empty items array.

Current deterministic findings:
No deterministic findings yet.
```

## Explanation: Severities
- P0: blocking. The implementation likely cannot be considered integrated until this is fixed. Re-run review after remediation.
- P1: important. The integration runs but produces incorrect or low-quality data (wrong identity, missing analytics, mismatched profile).
- P2: advisory. The integration works, but the fix improves latency, robustness, or analytics richness.

## Explanation: Detected Integration Path
- DataLayer collector analytics
- Search API for a custom search results page
- No-results tracking branch
- Click/select analytics on result selection

## Explanation: Static vs Browser Evidence
- Static evidence comes from parsing the HTML/JS source files. It shows what the code says it will do, but cannot confirm runtime behavior.
- Browser evidence is captured by loading the page in a headless browser and observing real network requests, rendered DOM, and dataLayer pushes.
- This review used static evidence only. Pass --browser to add live observations (network calls, rendered hits, dataLayer events).

## Explanation: How Docs Were Selected
- Each hit is scored by keyword match against the integration shape, then surfaced with a reason explaining why it was included:
  - [Building a custom search UI with the Search API](https://docs.luigisbox.com/quickstart/search/building-custom-ui) (quickstart/search/building-custom-ui): Quickstart guidance for implementation flow
  - [DataLayer collector](https://docs.luigisbox.com/analytics/collector) (analytics/collector): Related docs search match
  - [Quickstart: Send your first search events with the Events API](https://docs.luigisbox.com/quickstart/analytics/events-api-first-search) (quickstart/analytics/events-api-first-search): Quickstart guidance for implementation flow
  - [Track your first search with DataLayer collector](https://docs.luigisbox.com/quickstart/analytics/datalayer-first-search) (quickstart/analytics/datalayer-first-search): Quickstart guidance for implementation flow
  - [../docs/public/examples/search/custom-search-ui-datalayer.html](https://docs.luigisbox.com/examples/search/custom-search-ui-datalayer.html): Runnable public example for this service
  - [../docs/public/examples/search/custom-search-ui.html](https://docs.luigisbox.com/examples/search/custom-search-ui.html): Runnable public example for this service
  - [Event API](https://docs.luigisbox.com/analytics/api/events) (analytics/api/events): API reference for request or payload contract
  - [Rendering banner campaigns with the Search API](https://docs.luigisbox.com/quickstart/search/banner-campaigns) (quickstart/search/banner-campaigns): Quickstart guidance for implementation flow
  - [Implementing variant search](https://docs.luigisbox.com/quickstart/search/variant-search) (quickstart/search/variant-search): Quickstart guidance for implementation flow
  - [Search.js](https://docs.luigisbox.com/search/search-js) (search/search-js): Related docs search match
  - [Search API](https://docs.luigisbox.com/search/api/v1/search) (search/api/v1/search): API reference for request or payload contract
  - [Quickstart: Tracking purchases and key conversions with the Events API](https://docs.luigisbox.com/quickstart/analytics/events-api-tracking-purchases) (quickstart/analytics/events-api-tracking-purchases): Quickstart guidance for implementation flow
