# Agent UI Review Report

Service: autocomplete
Generated: 2026-04-17T00:57:28.584Z
Docs root: /Users/lowperry/projects/se-validator/docs
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=optional; trendingQueries=optional
Score: 91/100
Findings: P0=0 P1=0 P2=3

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-no-debounce.html

## Detected Integration Shape
- fixtures/frontend/autocomplete-no-debounce.html: html / datalayer (90%)

## Detected Capabilities
- fixtures/frontend/autocomplete-no-debounce.html: endpoints=autocomplete; analytics=Autocomplete view, click/select, no-results

## Review Findings

### P2 FRONTEND_AUTOCOMPLETE_DEBOUNCE_MISSING
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-no-debounce.html
Problem: fixtures/frontend/autocomplete-no-debounce.html does not show debounce or timeout logic around user input.
Recommended fix: Debounce autocomplete requests so the frontend does not send a request for every keystroke.
Likely code: fixtures/frontend/autocomplete-no-debounce.html:74
Snippet: `searchInput.addEventListener("input", (event) => getSuggestions(event.target.value));`
Docs: quickstart/autocomplete/query-suggestions
Confidence: 0.75

### P2 FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-no-debounce.html
Problem: fixtures/frontend/autocomplete-no-debounce.html does not reference https://live.luigisbox.com/v1/top_items.
Recommended fix: If the autocomplete UX shows suggestions on empty search focus, provide evidence for the Top Items API call.
Docs: autocomplete/api/v1/top-items, quickstart/autocomplete/top-items-api
Confidence: 0.72

### P2 FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED
State: failed
Area: frontend
Evidence: fixtures/frontend/autocomplete-no-debounce.html
Problem: fixtures/frontend/autocomplete-no-debounce.html does not reference https://live.luigisbox.com/v2/trending_queries.
Recommended fix: If the UX uses dashboard-managed trending queries, provide evidence for the Trending Queries API call.
Docs: autocomplete/api/v2/trending-queries, quickstart/autocomplete/trending-queries
Confidence: 0.72

## Docs Consulted
No local docs were found for this review. Check the --docs path.

## Next Actions
- P2: Debounce autocomplete requests so the frontend does not send a request for every keystroke.
- P2: If the autocomplete UX shows suggestions on empty search focus, provide evidence for the Top Items API call.
- P2: If the UX uses dashboard-managed trending queries, provide evidence for the Trending Queries API call.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box autocomplete frontend integration.
Service: autocomplete
Profile: service=autocomplete; analyticsMode=any; autocomplete=required; topItems=optional; trendingQueries=optional
Docs root: /Users/lowperry/projects/se-validator/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-no-debounce.html

Use the local docs and public examples first. Check whether the sample:
- calls the Autocomplete API with tracker_id, q, type, and relevant hit_fields;
- renders response hits from the same data used for analytics;
- keeps item identity consistent with the hit.url/url returned by the API;
- sends view and click analytics after results are rendered;
- tracks no-result autocomplete responses with an empty items array;
- tracks Top Items as Recommendation with autocomplete_popup when used;
- treats Trending Queries as dashboard-managed content and tracks resulting searches if they are clickable.

Current deterministic findings:
P2 FRONTEND_AUTOCOMPLETE_DEBOUNCE_MISSING: Autocomplete input is not debounced
P2 FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED: Top Items on focus is not evidenced
P2 FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED: Trending Queries integration is not evidenced
```
