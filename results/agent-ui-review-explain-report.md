# Agent UI Review Report

Service: autocomplete
Generated: 2026-04-17T00:41:05.208Z
Docs root: /Users/lowperry/projects/docs
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=disabled; trendingQueries=disabled
Score: 20/100
Findings: P0=2 P1=5 P2=5

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-bad.html

## Detected Integration Shape
- fixtures/frontend/autocomplete-bad.html: html / datalayer (90%)

## Detected Capabilities
- fixtures/frontend/autocomplete-bad.html: endpoints=autocomplete, top_items; analytics=Autocomplete view

## Review Findings

### P0 FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not show q in the autocomplete request.
Recommended fix: Send the current search input value as q for query autocomplete.
Likely code: fixtures/frontend/autocomplete-bad.html:20
Snippet: `search: query,`
Docs: autocomplete/api/v2/autocomplete, quickstart/autocomplete/query-suggestions
Confidence: 0.92

### P0 FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html:head
Problem: fixtures/frontend/autocomplete-bad.html uses dataLayer.push but does not include the Luigi's Box collector script.
Recommended fix: Add <script async src="https://scripts.luigisbox.tech/LBX-YOUR_TRACKER_ID.js"></script> to the shared head.
Likely code: fixtures/frontend/autocomplete-bad.html:3
Snippet: `<head>`
Docs: analytics/collector, platform-foundations/lbx-script
Confidence: 0.95

### P1 FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not show analytics items using hit.url as item_id/url.
Recommended fix: Map analytics items from hits with item_id/url set to hit.url so API response, UI, and analytics use the same identity.
Likely code: fixtures/frontend/autocomplete-bad.html:61
Snippet: `item_id: hit.attributes.title,`
Docs: quickstart/autocomplete/query-suggestions, analytics/api/events
Confidence: 0.86

### P1 FRONTEND_AUTOCOMPLETE_CLICK_ANALYTICS_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not show suggestion click/select tracking.
Recommended fix: Track selected suggestions as DataLayer select_item or Events API click with the rendered item identity.
Docs: quickstart/autocomplete/query-suggestions, analytics/api/events
Confidence: 0.88

### P1 FRONTEND_AUTOCOMPLETE_NO_RESULTS_NOT_TRACKED
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html handles empty hits but does not show an Autocomplete view with an empty items array.
Recommended fix: When hits is empty, still send the Autocomplete view event with items: [].
Likely code: fixtures/frontend/autocomplete-bad.html:25
Snippet: `if (!data.hits || data.hits.length === 0) {`
Docs: quickstart/autocomplete/query-suggestions
Confidence: 0.9

### P1 FRONTEND_AUTOCOMPLETE_QUERY_ANALYTICS_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not show search_term or query.string populated from the user's query.
Recommended fix: Include the user's autocomplete query as search_term in DataLayer or query.string in Events API.
Docs: quickstart/autocomplete/query-suggestions, analytics/api/events
Confidence: 0.86

### P1 FRONTEND_RENDERED_IDENTITY_NOT_HIT_URL
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not show rendered suggestions storing hit.url as the item identity.
Recommended fix: Store hit.url, or the documented identity field returned as url, on the rendered suggestion element.
Likely code: fixtures/frontend/autocomplete-bad.html:49
Snippet: `itemButton.dataset.itemId = item.attributes.title;`
Docs: autocomplete/api/v2/autocomplete, quickstart/autocomplete/query-suggestions
Confidence: 0.84

### P2 FRONTEND_AUTOCOMPLETE_DEBOUNCE_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not show debounce or timeout logic around user input.
Recommended fix: Debounce autocomplete requests so the frontend does not send a request for every keystroke.
Likely code: fixtures/frontend/autocomplete-bad.html:68
Snippet: `searchInput.addEventListener("input", (event) => getSuggestions(event.target.value));`
Docs: quickstart/autocomplete/query-suggestions
Confidence: 0.75

### P2 FRONTEND_AUTOCOMPLETE_ITEM_POSITION_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not show index or position based on the rendered order.
Recommended fix: Send index/position as index + 1 for every rendered suggestion.
Likely code: fixtures/frontend/autocomplete-bad.html:60
Snippet: `items: hits.map((hit) => ({`
Docs: quickstart/autocomplete/query-suggestions, analytics/api/events
Confidence: 0.78

### P2 FRONTEND_DNS_PREFETCH_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html:head
Problem: fixtures/frontend/autocomplete-bad.html does not include <link rel="dns-prefetch" href="//live.luigisbox.com">.
Recommended fix: Add DNS prefetch in the page/layout head to reduce the first autocomplete request latency.
Likely code: fixtures/frontend/autocomplete-bad.html:3
Snippet: `<head>`
Docs: autocomplete/guides/integration-best-practices
Confidence: 0.78

### P2 FRONTEND_HIT_FIELDS_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html does not include hit_fields in the autocomplete/top items requests.
Recommended fix: Use hit_fields to request only the fields rendered in the dropdown, such as title,web_url,price,image_link_l.
Likely code: fixtures/frontend/autocomplete-bad.html:12
Snippet: `const AUTOCOMPLETE_API_URL = "https://live.luigisbox.com/autocomplete/v2";`
Docs: autocomplete/guides/integration-best-practices
Confidence: 0.82

### P2 FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: fixtures/frontend/autocomplete-bad.html references Top Items, while the validation profile sets topItems=disabled.
Recommended fix: Either remove the Top Items integration from the UI evidence, or update the profile to topItems=optional/required.
Likely code: fixtures/frontend/autocomplete-bad.html:13
Snippet: `const TOP_ITEMS_API_URL = "https://live.luigisbox.com/v1/top_items";`
Docs: autocomplete/api/v1/top-items, quickstart/autocomplete/top-items-api
Confidence: 0.78

## Browser Evidence

- fixtures/frontend/autocomplete-bad.html: passed
  Browser evidence was observed.
  - Observed 1 Autocomplete API request(s).
  - Observed 1 Top Items request(s).
  - Observed rendered output (5 candidate element(s)).
  - Autocomplete requests: 1
  - Top Items requests: 1
  - Trending Queries requests: 0
  - Analytics requests: 0
  - dataLayer events: 0

## Docs Consulted

- Getting query suggestions via the Autocomplete API (quickstart/autocomplete/query-suggestions): /Users/lowperry/projects/docs/src/content/docs/quickstart/autocomplete/query-suggestions.md:120
  Reason: Referenced by FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING
  Section: Example
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, hit.url
  Excerpt: This code sets up the necessary configuration and an event listener on our search input. When the user types, it calls the `getSuggestions` function, which makes a GET request to the Autocomplete API with the required parameters (`tracker_id`, `q`, `type`)...

- Event API (analytics/api/events): /Users/lowperry/projects/docs/src/content/docs/analytics/api/events.mdx:290
  Reason: Referenced by FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL
  Section: Item fields
  Matched: autocomplete, tracker_id, `type`, analytics, Autocomplete, click, Recommendation, autocomplete_popup
  Excerpt: If your empty-state autocomplete shows **Top Items** on focus, do **not** track it as `Autocomplete`. Track it as a [Recommendation event](#recommendation-events) and set both `Recommender` and `RecommenderClientId` to `autocomplete_popup`.

- DataLayer collector (analytics/collector): /Users/lowperry/projects/docs/src/content/docs/analytics/collector.md:340
  Reason: Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  Section: Recommendations
  Matched: autocomplete, autocomplete api, `type`, analytics, Autocomplete, view_item_list, click, no results
  Excerpt: Send a [`view_item_list`](https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#view_item_list) event when a recommendation widget displays items.

- Implementing top items with the API (quickstart/autocomplete/top-items-api): /Users/lowperry/projects/docs/src/content/docs/quickstart/autocomplete/top-items-api.md:108
  Reason: Referenced by FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE
  Section: Step 3: Update analytics for different suggestion types
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, hit.url
  Excerpt: To distinguish between regular query-based suggestions and top items shown on focus, we need to adjust our analytics tracking. You have two options for sending analytics: the **DataLayer Collector** (recommended for web integrations that already use a `data...

- Autocomplete API (autocomplete/api/v2/autocomplete): /Users/lowperry/projects/docs/src/content/docs/autocomplete/api/v2/autocomplete.mdx:29
  Reason: Referenced by FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING
  Section: Overview
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, analytics
  Excerpt: This endpoint is public and requires no authentication. We strongly recommend implementing it directly on the frontend to minimize latency. For guidance on when to use the API directly versus `Autocomplete.js`, see [Integration Best Practices](/autocomplete...

- Top Items API (autocomplete/api/v1/top-items): /Users/lowperry/projects/docs/src/content/docs/autocomplete/api/v1/top-items.mdx:23
  Reason: Referenced by FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE
  Section: Overview
  Matched: autocomplete, tracker_id, `type`, hit_fields, hits, analytics, Autocomplete, top_items
  Excerpt: If you show top items inside an autocomplete dropdown when the user focuses an empty search box, track the rendered list as a recommendation event, not as autocomplete. Use `autocomplete_popup` as the placement identifier. See [Events API](/analytics/api/ev...

- Integration best practices (autocomplete/guides/integration-best-practices): /Users/lowperry/projects/docs/src/content/docs/autocomplete/guides/integration-best-practices.md:40
  Reason: Referenced by FRONTEND_HIT_FIELDS_MISSING
  Section: Fetch only necessary fields
  Matched: autocomplete, autocomplete api, tracker_id, hit_fields, analytics, Autocomplete, required, param
  Excerpt: Use the `hit_fields` parameter to specify a comma-separated list of fields.

- The Tracking Script (platform-foundations/lbx-script): /Users/lowperry/projects/docs/src/content/docs/platform-foundations/lbx-script.md:20
  Reason: Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  Matched: autocomplete, analytics, Autocomplete, required, integration, script, platform, foundations
  Excerpt: :::note This script is required unless you are performing a full server-side integration via the API. :::

- Autocomplete tutorial (tutorials/autocomplete): /Users/lowperry/projects/docs/src/content/docs/tutorials/autocomplete.md:164
  Reason: Related docs search match
  Section: Fire dataLayer event
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, analytics
  Excerpt: After the top items recommendations have been rendered, fire a [recommendation dataLayer event](/analytics/collector/#recommender-example) describing what you have just rendered.

- ../docs/public/examples/autocomplete/top-items.html: /Users/lowperry/projects/docs/public/examples/autocomplete/top-items.html:409
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, click
  Excerpt: // Send analytics for this on-focus Top Items view (Recommendation list) sendTopItemsViewAnalytics(hits);

- ../docs/public/examples/autocomplete/top-items-datalayer.html: /Users/lowperry/projects/docs/public/examples/autocomplete/top-items-datalayer.html:386
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, view_item_list
  Excerpt: // Top Items on focus are tracked as Recommendation with autocomplete_popup trackTopItemsView(hits);

- ../docs/public/examples/autocomplete/trending-queries.html: /Users/lowperry/projects/docs/public/examples/autocomplete/trending-queries.html:424
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, click
  Excerpt: // Send analytics for this on-focus Top Items view (Recommendation list) sendTopItemsViewAnalytics(hits);

## Next Actions
- P0: Send the current search input value as q for query autocomplete.
- P0: Add <script async src="https://scripts.luigisbox.tech/LBX-YOUR_TRACKER_ID.js"></script> to the shared head.
- P1: Map analytics items from hits with item_id/url set to hit.url so API response, UI, and analytics use the same identity.
- P1: Track selected suggestions as DataLayer select_item or Events API click with the rendered item identity.
- P1: When hits is empty, still send the Autocomplete view event with items: [].
- P1: Include the user's autocomplete query as search_term in DataLayer or query.string in Events API.
- Re-run this command after fixing P0 items; P0 means the implementation likely cannot be considered integrated.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box autocomplete frontend integration.
Service: autocomplete
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=disabled; trendingQueries=disabled
Docs root: /Users/lowperry/projects/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-bad.html

Use the local docs and public examples first. Check whether the sample:
- calls the Autocomplete API with tracker_id, q, type, and relevant hit_fields;
- renders response hits from the same data used for analytics;
- keeps item identity consistent with the hit.url/url returned by the API;
- sends view and click analytics after results are rendered;
- tracks no-result autocomplete responses with an empty items array;
- tracks Top Items as Recommendation with autocomplete_popup when used;
- treats Trending Queries as dashboard-managed content and tracks resulting searches if they are clickable.

Current deterministic findings:
P0 FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING: Frontend autocomplete request is missing a required parameter
P2 FRONTEND_HIT_FIELDS_MISSING: Frontend autocomplete request does not limit hit_fields
P2 FRONTEND_DNS_PREFETCH_MISSING: Frontend is missing DNS prefetch for live API
P2 FRONTEND_AUTOCOMPLETE_DEBOUNCE_MISSING: Autocomplete input is not debounced
P1 FRONTEND_RENDERED_IDENTITY_NOT_HIT_URL: Rendered suggestion identity may not match catalog identity
P1 FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL: Autocomplete analytics may not use returned hit identity
P0 FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING: DataLayer autocomplete page is missing the collector script
P1 FRONTEND_AUTOCOMPLETE_QUERY_ANALYTICS_MISSING: Autocomplete analytics do not include the query
P2 FRONTEND_AUTOCOMPLETE_ITEM_POSITION_MISSING: Autocomplete analytics item position is missing
P1 FRONTEND_AUTOCOMPLETE_NO_RESULTS_NOT_TRACKED: Autocomplete no-results branch is not tracked
P1 FRONTEND_AUTOCOMPLETE_CLICK_ANALYTICS_MISSING: Autocomplete click analytics are missing
P2 FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE: Top Items are present but profile says they are not used
```

## Explanation: Severities
- P0: blocking. The implementation likely cannot be considered integrated until this is fixed. Re-run review after remediation.
- P1: important. The integration runs but produces incorrect or low-quality data (wrong identity, missing analytics, mismatched profile).
- P2: advisory. The integration works, but the fix improves latency, robustness, or analytics richness.

## Explanation: Detected Integration Path
- DataLayer collector analytics
- Autocomplete API for query suggestions
- Top Items on focus (recommendation placeholder before the user types)

## Explanation: Static vs Browser Evidence
- Static evidence comes from parsing the HTML/JS source files. It shows what the code says it will do, but cannot confirm runtime behavior.
- Browser evidence is captured by loading the page in a headless browser and observing real network requests, rendered DOM, and dataLayer pushes.
- fixtures/frontend/autocomplete-bad.html (passed): 2 request(s) captured; 0 dataLayer event(s). Static findings above were cross-referenced against this runtime capture.

## Explanation: How Docs Were Selected
- Each hit is scored by keyword match against the integration shape, then surfaced with a reason explaining why it was included:
  - Getting query suggestions via the Autocomplete API (quickstart/autocomplete/query-suggestions): Referenced by FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING
  - Event API (analytics/api/events): Referenced by FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL
  - DataLayer collector (analytics/collector): Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  - Implementing top items with the API (quickstart/autocomplete/top-items-api): Referenced by FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE
  - Autocomplete API (autocomplete/api/v2/autocomplete): Referenced by FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING
  - Top Items API (autocomplete/api/v1/top-items): Referenced by FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE
  - Integration best practices (autocomplete/guides/integration-best-practices): Referenced by FRONTEND_HIT_FIELDS_MISSING
  - The Tracking Script (platform-foundations/lbx-script): Referenced by FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
  - Autocomplete tutorial (tutorials/autocomplete): Related docs search match
  - ../docs/public/examples/autocomplete/top-items.html: Runnable public example for this service
  - ../docs/public/examples/autocomplete/top-items-datalayer.html: Runnable public example for this service
  - ../docs/public/examples/autocomplete/trending-queries.html: Runnable public example for this service
