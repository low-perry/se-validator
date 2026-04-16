# Autocomplete Service Validation Coverage

This slice validates direct Autocomplete API integration evidence through a JSON service profile.

## Covered endpoints

- `GET https://live.luigisbox.com/autocomplete/v2`
  - Requires `tracker_id`, `q`, and `type`.
  - Recommends `hit_fields`.
  - Validates JSON object response with `hits[]`.
  - Can require `guid` so autocomplete analytics can be correlated.
- `GET https://live.luigisbox.com/v1/top_items`
  - Requires `tracker_id` and `type`.
  - Recommends `hit_fields`.
  - Validates JSON object response with `hits[]`.
  - Can require `recommendation_id`.
- `GET https://live.luigisbox.com/v2/trending_queries`
  - Requires `tracker_id`.
  - Validates JSON array response where each entry has `title`.
  - The list is configured in the Luigi's Box dashboard, not through API parameters.
  - For this hackathon tracker, seven trending queries are currently configured, so the good fixture expects at least seven entries.

## Analytics contract checks

Direct API use does not send analytics automatically, so each service check must declare the expected analytics behavior:

- Query autocomplete results must be tracked as `Autocomplete`.
- Autocomplete no-result responses should still send an Autocomplete view with an empty item list.
- Autocomplete suggestion selection must be tracked as a click/select event.
- Top items shown on empty search focus must be tracked as `Recommendation`, not `Autocomplete`.
- Top items in an autocomplete popup should use `autocomplete_popup` as the recommendation placement.
- Trending query display does not require a view event by itself.
- Trending query click should execute search and track the resulting `Search Results` view.

## Current fixture behavior

`fixtures/service/autocomplete-good.json` uses the hackathon tracker and validates:

- XML feed identities such as `SKU-1`.
- JSON feed identities such as `json-SKU-1`.
- Content Update identities such as `content-SKU-1`.
- Top items response shape and recommendation metadata.
- Trending queries endpoint reachability, array shape, and the dashboard-managed count of at least seven entries.

Trending queries are dashboard-managed. If the dashboard configuration changes, update `fixtures/service/autocomplete-good.json` so `expect.minResults` reflects the intended configured count.
