# Agent UI Review Report

Service: autocomplete
Generated: 2026-04-17T00:57:29.045Z
Docs root: /Users/lowperry/projects/se-validator/docs
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=optional; trendingQueries=optional
Score: 77/100
Findings: P0=0 P1=2 P2=3

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-hardcoded-items.html

## Detected Integration Shape
- fixtures/frontend/autocomplete-hardcoded-items.html: html / datalayer (90%)

## Detected Capabilities
- fixtures/frontend/autocomplete-hardcoded-items.html: endpoints=autocomplete; analytics=Autocomplete view, click/select, no-results

## Review Findings

### P1 FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-hardcoded-items.html
Problem: fixtures/frontend/autocomplete-hardcoded-items.html does not show analytics items using hit.url as item_id/url.
Recommended fix: Map analytics items from hits with item_id/url set to hit.url so API response, UI, and analytics use the same identity.
Likely code: fixtures/frontend/autocomplete-hardcoded-items.html:76
Snippet: `window.dataLayer.push({ event: "select_item", ecommerce: { items: [{ item_id: itemId }] } });`
Docs: quickstart/autocomplete/query-suggestions, analytics/api/events
Confidence: 0.86

### P1 FRONTEND_AUTOCOMPLETE_ITEMS_NOT_FROM_HITS
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-hardcoded-items.html
Problem: fixtures/frontend/autocomplete-hardcoded-items.html does not show analytics items: hits.map(...).
Recommended fix: Build analytics items from the same hits array rendered to the user.
Likely code: fixtures/frontend/autocomplete-hardcoded-items.html:76
Snippet: `window.dataLayer.push({ event: "select_item", ecommerce: { items: [{ item_id: itemId }] } });`
Docs: quickstart/autocomplete/query-suggestions
Confidence: 0.86

### P2 FRONTEND_AUTOCOMPLETE_ITEM_POSITION_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-hardcoded-items.html
Problem: fixtures/frontend/autocomplete-hardcoded-items.html does not show index or position based on the rendered order.
Recommended fix: Send index/position as index + 1 for every rendered suggestion.
Likely code: fixtures/frontend/autocomplete-hardcoded-items.html:53
Snippet: `button.dataset.position = index + 1;`
Docs: quickstart/autocomplete/query-suggestions, analytics/api/events
Confidence: 0.78

### P2 FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-hardcoded-items.html
Problem: fixtures/frontend/autocomplete-hardcoded-items.html does not reference https://live.luigisbox.com/v1/top_items.
Recommended fix: If the autocomplete UX shows suggestions on empty search focus, provide evidence for the Top Items API call.
Docs: autocomplete/api/v1/top-items, quickstart/autocomplete/top-items-api
Confidence: 0.72

### P2 FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-hardcoded-items.html
Problem: fixtures/frontend/autocomplete-hardcoded-items.html does not reference https://live.luigisbox.com/v2/trending_queries.
Recommended fix: If the UX uses dashboard-managed trending queries, provide evidence for the Trending Queries API call.
Docs: autocomplete/api/v2/trending-queries, quickstart/autocomplete/trending-queries
Confidence: 0.72

## Docs Consulted
No local docs were found for this review. Check the --docs path.

## Next Actions
- P1: Map analytics items from hits with item_id/url set to hit.url so API response, UI, and analytics use the same identity.
- P1: Build analytics items from the same hits array rendered to the user.
- P2: Send index/position as index + 1 for every rendered suggestion.
- P2: If the autocomplete UX shows suggestions on empty search focus, provide evidence for the Top Items API call.
- P2: If the UX uses dashboard-managed trending queries, provide evidence for the Trending Queries API call.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box autocomplete frontend integration.
Service: autocomplete
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=optional; trendingQueries=optional
Docs root: /Users/lowperry/projects/se-validator/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-hardcoded-items.html

Use the local docs and public examples first. Check whether the sample:
- calls the Autocomplete API with tracker_id, q, type, and relevant hit_fields;
- renders response hits from the same data used for analytics;
- keeps item identity consistent with the hit.url/url returned by the API;
- sends view and click analytics after results are rendered;
- tracks no-result autocomplete responses with an empty items array;
- tracks Top Items as Recommendation with autocomplete_popup when used;
- treats Trending Queries as dashboard-managed content and tracks resulting searches if they are clickable.

Current deterministic findings:
P1 FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL: Autocomplete analytics may not use returned hit identity
P1 FRONTEND_AUTOCOMPLETE_ITEMS_NOT_FROM_HITS: Autocomplete analytics items are not mapped from API hits
P2 FRONTEND_AUTOCOMPLETE_ITEM_POSITION_MISSING: Autocomplete analytics item position is missing
P2 FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED: Top Items on focus is not evidenced
P2 FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED: Trending Queries integration is not evidenced
```
