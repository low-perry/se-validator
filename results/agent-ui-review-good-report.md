# Agent UI Review Report

Service: autocomplete
Generated: 2026-04-17T00:41:01.243Z
Docs root: /Users/lowperry/projects/docs
Profile: service=autocomplete; analyticsMode=events-api; autocomplete=required; topItems=required; trendingQueries=required trackerId=757876-1071971
Score: 100/100
Findings: P0=0 P1=0 P2=0

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-events-api-good.html

## Detected Integration Shape
- fixtures/frontend/autocomplete-events-api-good.html: html / events-api (90%)

## Detected Capabilities
- fixtures/frontend/autocomplete-events-api-good.html: endpoints=autocomplete, top_items, trending_queries; analytics=Autocomplete view, Recommendation view, click/select, no-results

## Review Findings
No findings. The sample passes the current deterministic UI rule set.

## Docs Consulted

- Getting query suggestions via the Autocomplete API (quickstart/autocomplete/query-suggestions): /Users/lowperry/projects/docs/src/content/docs/quickstart/autocomplete/query-suggestions.md:120
  Reason: Quickstart guidance for implementation flow
  Section: Example
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, hit.url
  Excerpt: This code sets up the necessary configuration and an event listener on our search input. When the user types, it calls the `getSuggestions` function, which makes a GET request to the Autocomplete API with the required parameters (`tracker_id`, `q`, `type`)...

- Implementing top items with the API (quickstart/autocomplete/top-items-api): /Users/lowperry/projects/docs/src/content/docs/quickstart/autocomplete/top-items-api.md:23
  Reason: Quickstart guidance for implementation flow
  Section: Who is this guide for
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, hit.url
  Excerpt: - Developers who have understood the ["Getting query suggestions via the Autocomplete API"](/quickstart/autocomplete/query-suggestions/) and now want to add top items shown on focus. - Mobile developers (iOS, Android) who are integrating search suggestions.

- ../docs/public/examples/autocomplete/trending-queries.html: /Users/lowperry/projects/docs/public/examples/autocomplete/trending-queries.html:657
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, click
  Excerpt: filters: { RecommenderClientId: 'autocomplete_popup', Recommender: 'autocomplete_popup',

- ../docs/public/examples/autocomplete/top-items.html: /Users/lowperry/projects/docs/public/examples/autocomplete/top-items.html:552
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, click
  Excerpt: filters: { RecommenderClientId: 'autocomplete_popup', Recommender: 'autocomplete_popup',

- DataLayer collector (analytics/collector): /Users/lowperry/projects/docs/src/content/docs/analytics/collector.md:344
  Reason: Related docs search match
  Section: Recommendations
  Matched: autocomplete, autocomplete api, `type`, analytics, Autocomplete, view_item_list, click, no results
  Excerpt: This section also applies to Top Items displayed in an autocomplete dropdown when the user focuses the search box. Set `item_list_name` to `"Recommendation"` and set both `Recommender` and `RecommenderClientId` to `autocomplete_popup`. :::

- Autocomplete tutorial (tutorials/autocomplete): /Users/lowperry/projects/docs/src/content/docs/tutorials/autocomplete.md:72
  Reason: Related docs search match
  Section: User clicks into empty searchbox
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, analytics
  Excerpt: When the user clicks into the searchbox, display the autocomplete popup immediately, showing recommendations. Call the [Top items](/autocomplete/api/v1/top-items/) API endpoint to load recommendations for categories, brands, products and other types you hav...

- ../docs/public/examples/autocomplete/trending-queries-datalayer.html: /Users/lowperry/projects/docs/public/examples/autocomplete/trending-queries-datalayer.html:614
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, view_item_list
  Excerpt: filters: { Recommender: "autocomplete_popup", RecommenderClientId: "autocomplete_popup",

- Implementing trending queries suggestions (quickstart/autocomplete/trending-queries): /Users/lowperry/projects/docs/src/content/docs/quickstart/autocomplete/trending-queries.md:209
  Reason: Quickstart guidance for implementation flow
  Section: Analytics for trending queries
  Matched: autocomplete, tracker_id, `q`, hits, hit.url, analytics, Autocomplete, view_item_list
  Excerpt: No special "view" analytics event is needed for displaying trending queries. However, if a user clicks on a trending query suggestion that you've rendered in a list, your application should:

- Event API (analytics/api/events): /Users/lowperry/projects/docs/src/content/docs/analytics/api/events.mdx:290
  Reason: API reference for request or payload contract
  Section: Item fields
  Matched: autocomplete, tracker_id, `type`, analytics, Autocomplete, click, Recommendation, autocomplete_popup
  Excerpt: If your empty-state autocomplete shows **Top Items** on focus, do **not** track it as `Autocomplete`. Track it as a [Recommendation event](#recommendation-events) and set both `Recommender` and `RecommenderClientId` to `autocomplete_popup`.

- ../docs/public/examples/autocomplete/top-items-datalayer.html: /Users/lowperry/projects/docs/public/examples/autocomplete/top-items-datalayer.html:386
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, view_item_list
  Excerpt: // Top Items on focus are tracked as Recommendation with autocomplete_popup trackTopItemsView(hits);

- ../docs/public/examples/autocomplete/query-suggestions.html: /Users/lowperry/projects/docs/public/examples/autocomplete/query-suggestions.html:293
  Reason: Runnable public example for this service
  Matched: autocomplete, tracker_id, hit_fields, hits, hit.url, analytics, Autocomplete, click
  Excerpt: // CONFIGURATION const TRACKER_ID = '179075-204259'; const AUTOCOMPLETE_API_URL = 'https://live.luigisbox.com/autocomplete/v2';

- Autocomplete API (autocomplete/api/v2/autocomplete): /Users/lowperry/projects/docs/src/content/docs/autocomplete/api/v2/autocomplete.mdx:157
  Reason: API reference for request or payload contract
  Section: How to Make a Request
  Matched: autocomplete, autocomplete api, tracker_id, `q`, `type`, hit_fields, hits, analytics
  Excerpt: 1. Send a `GET` request to `https://live.luigisbox.com/autocomplete/v2`. 2. Include `tracker_id`, the partial query `q`, and the desired `type` values. 3. URL-encode query parameters correctly.

## Next Actions
- Run the sample in a browser and confirm the autocomplete request, rendered hits, view event, and click event appear in DevTools.
- Use the live dashboard/debugger to confirm events are accepted after the UI renders suggestions.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing a Luigi's Box autocomplete frontend integration.
Service: autocomplete
Profile: service=autocomplete; analyticsMode=events-api; autocomplete=required; topItems=required; trendingQueries=required trackerId=757876-1071971
Docs root: /Users/lowperry/projects/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-events-api-good.html

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
