# Agent UI Review Report

Service: autocomplete
Generated: 2026-04-17T00:57:53.002Z
Docs root: /Users/lowperry/projects/se-validator/docs
Profile: service=autocomplete; analyticsMode=events-api; autocomplete=required; topItems=required; trendingQueries=required trackerId=757876-1071971
Score: 100/100
Findings: P0=0 P1=0 P2=0

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-events-api-styled.html

## Detected Integration Shape
- fixtures/frontend/autocomplete-events-api-styled.html: html / events-api (90%)

## Detected Capabilities
- fixtures/frontend/autocomplete-events-api-styled.html: endpoints=autocomplete, top_items, trending_queries; analytics=Autocomplete view, Recommendation view, click/select, no-results

## Review Findings
No findings. The sample passes the current deterministic UI rule set.

## Docs Consulted
No local docs were found for this review. Check the --docs path.

## Next Actions
- Run the sample in a browser and confirm the autocomplete request, rendered hits, view event, and click event appear in DevTools.
- Use the live dashboard/debugger to confirm events are accepted after the UI renders suggestions.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box autocomplete frontend integration.
Service: autocomplete
Profile: service=autocomplete; analyticsMode=events-api; autocomplete=required; topItems=required; trendingQueries=required trackerId=757876-1071971
Docs root: /Users/lowperry/projects/se-validator/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-events-api-styled.html

Use the local docs and public examples first. Check whether the sample:
- calls the Autocomplete API with tracker_id, q, type, and relevant hit_fields;
- renders response hits from the same data used for analytics;
- keeps item identity consistent with the hit.url/url returned by the API;
- sends view and click analytics after results are rendered;
- tracks no-result autocomplete responses with an empty items array;
- tracks Top Items as Recommendation with autocomplete_popup when used;
- treats Trending Queries as dashboard-managed content and tracks resulting searches if they are clickable.

Current deterministic findings:
No deterministic findings yet.
```
