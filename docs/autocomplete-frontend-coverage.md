# Autocomplete Frontend Validation Coverage

This slice validates frontend HTML/JavaScript evidence for a direct Autocomplete API implementation.

It does not execute browser code. It statically checks whether the implementation contains the API calls, rendering flow, and analytics wiring that the docs require.

## Profile Generator

When the expected autocomplete feature set is unclear, sample the live Autocomplete, Top Items, and Trending Queries APIs and generate a frontend profile:

```bash
yarn suggest autocomplete-profile \
  --tracker-id 757876-1071971 \
  --query shirt \
  --analytics-mode datalayer \
  --out results/autocomplete-profile-suggested.json
```

By default, the generator keeps query autocomplete required. In `auto` mode it marks Top Items and Trending Queries as `optional` only when the live endpoint returns data, because endpoint availability does not prove that the UI is required to render that feature.

If the intended UX is explicit, override the generated policy:

```bash
yarn suggest autocomplete-profile \
  --tracker-id 757876-1071971 \
  --query shirt \
  --top-items required \
  --trending-queries disabled \
  --analytics-mode events-api \
  --out results/autocomplete-profile-explicit.json
```

## Covered API behavior

- Query suggestions call `https://live.luigisbox.com/autocomplete/v2`.
- Query suggestions send `tracker_id`, `q`, and `type`.
- Query suggestions and top items use `hit_fields` to keep responses small.
- Top items call `https://live.luigisbox.com/v1/top_items`.
- Trending queries call `https://live.luigisbox.com/v2/trending_queries`.
- Trending query titles are read from `item.title`.

## Covered browser behavior

- DNS prefetch for `live.luigisbox.com`.
- Debounced search input handling.
- Search input `input` listener for query suggestions.
- Search input `focus` listener for top items on empty search.
- API `hits` are read and passed into rendering.
- Empty autocomplete result branches are tracked, not only rendered.

## Covered identity flow

- Rendered suggestions store the returned `hit.url` as the item identity.
- Analytics items use `hit.url` as the identity (`item_id` or `url`).
- Click analytics read the identity from the selected rendered element.

This is the main bridge between the service API check and analytics validation: the same API hit identity should flow into the UI and then into analytics.

## Covered analytics behavior

For DataLayer Collector evidence:

- `dataLayer.push` is present.
- The Luigi's Box collector script is present, async, and inside `<head>`.
- Autocomplete views use `event: "view_item_list"` and `item_list_name: "Autocomplete"`.
- Autocomplete views include `search_term`.
- Top items shown in autocomplete use `item_list_name: "Recommendation"`.
- Top items include `RecommenderClientId` or `Recommender` set to `autocomplete_popup`.
- Clicks use `select_item`.

For Events API evidence:

- Payloads are POSTed to `https://api.luigisbox.com/`.
- Payloads include `client_id`.
- Payloads generate unique `id` values.
- Autocomplete views use `lists.Autocomplete`.
- Top items use `lists.Recommendation`.
- Clicks use `type: "click"` with `resource_identifier`.

## Known limitations

- The validator is static. It cannot prove event order at runtime.
- Dynamic code with unusual abstractions may need fixture/profile support later.
- It checks for strong evidence patterns, not every possible valid implementation style.
