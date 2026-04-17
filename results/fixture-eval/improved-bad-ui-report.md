# Agent UI Review Report

Service: autocomplete
Generated: 2026-04-17T01:33:14.418Z
Docs root: /Users/lowperry/projects/docs
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=optional; trendingQueries=optional
Score: 65/100
Findings: P0=1 P1=2 P2=2

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html

## Detected Integration Shape
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html: html / datalayer (90%)

## Detected Capabilities
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html: endpoints=autocomplete, top_items, trending_queries; analytics=Autocomplete view, Recommendation view, click/select, no-results

## Review Findings

### P0 FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING
State: failed
Area: frontend
Evidence: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html
Problem: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html does not show q in the autocomplete request.
Recommended fix: Send the current search input value as q for query autocomplete.
Likely code: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html:46
Snippet: `search: query,`
Docs: autocomplete/api/v2/autocomplete, quickstart/autocomplete/query-suggestions
Confidence: 0.92

### P1 FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL
State: failed
Area: frontend
Evidence: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html
Problem: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html does not show analytics items using hit.url as item_id/url.
Recommended fix: Map analytics items from hits with item_id/url set to hit.url so API response, UI, and analytics use the same identity.
Likely code: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html:127
Snippet: `window.dataLayer.push({ event: "select_item", ecommerce: { items: [{ item_id: itemId }] } });`
Docs: quickstart/autocomplete/query-suggestions, analytics/api/events
Confidence: 0.86

### P1 FRONTEND_TRENDING_QUERY_TITLES_NOT_MAPPED
State: failed
Area: frontend
Evidence: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html
Problem: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html calls Trending Queries but does not show response titles being read.
Recommended fix: Map the Trending Queries API response with item.title before rendering placeholders or query suggestions.
Likely code: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html:76
Snippet: `await fetch(`${TRENDING_QUERIES_API_URL}?${new URLSearchParams({ tracker_id: TRACKER_ID })}`);`
Docs: autocomplete/api/v2/trending-queries, quickstart/autocomplete/trending-queries
Confidence: 0.84

### P2 FRONTEND_TOP_ITEMS_FOCUS_LISTENER_MISSING
State: failed
Area: frontend
Evidence: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html
Problem: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html calls Top Items but does not show a focus listener on the search input.
Recommended fix: Fetch top items when the search box receives focus and the input is empty.
Likely code: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html:62
Snippet: `async function getTopItemsSuggestions() {`
Docs: quickstart/autocomplete/top-items-api
Confidence: 0.78

### P2 FRONTEND_TRENDING_QUERY_USE_NOT_CLEAR
State: failed
Area: frontend
Evidence: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html
Problem: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html calls Trending Queries but does not show placeholder usage or Search Results tracking after a click.
Recommended fix: Use trending queries as placeholders, or if they are clickable, run search and track the resulting Search Results view.
Likely code: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html:76
Snippet: `await fetch(`${TRENDING_QUERIES_API_URL}?${new URLSearchParams({ tracker_id: TRACKER_ID })}`);`
Docs: quickstart/autocomplete/trending-queries
Confidence: 0.76

## Docs Consulted
No local docs were found for this review. Check the --docs path.

## Next Actions
- P0: Send the current search input value as q for query autocomplete.
- P1: Map analytics items from hits with item_id/url set to hit.url so API response, UI, and analytics use the same identity.
- P1: Map the Trending Queries API response with item.title before rendering placeholders or query suggestions.
- P2: Fetch top items when the search box receives focus and the input is empty.
- P2: Use trending queries as placeholders, or if they are clickable, run search and track the resulting Search Results view.
- Re-run this command after fixing P0 items; P0 means the implementation likely cannot be considered integrated.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box autocomplete frontend integration.
Service: autocomplete
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=optional; trendingQueries=optional
Docs root: /Users/lowperry/projects/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html

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
P1 FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL: Autocomplete analytics may not use returned hit identity
P2 FRONTEND_TOP_ITEMS_FOCUS_LISTENER_MISSING: Top Items is not wired to search focus
P1 FRONTEND_TRENDING_QUERY_TITLES_NOT_MAPPED: Trending query titles are not mapped from the response
P2 FRONTEND_TRENDING_QUERY_USE_NOT_CLEAR: Trending query usage is not clear
```
