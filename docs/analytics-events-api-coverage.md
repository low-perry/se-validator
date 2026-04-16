# Analytics Events API Validation Coverage

Source docs audited:

- `/Users/lowperry/projects/docs/src/content/docs/analytics/api/events.mdx`
- `/Users/lowperry/projects/docs/src/content/docs/analytics/api_guides/tracking-user-journey.md`
- `/Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/object-identity.md`

## Supported Events API Shapes

| Evidence shape | Covered by validator | Good fixture coverage |
| --- | --- | --- |
| `pv` page/detail view | Required envelope, `url`, optional `title`, optional common envelope fields | `events-api-good.json` events 0-1 |
| `event` + `Search Results` | Exact list name, `query.string`, `query.filters`, `items[]`, item fields, positions, `_Guid`, `_Variant` | events 2-3 |
| `event` + `Autocomplete` | Exact list name, `query.string`, `query.filters`, `items[]`, item fields, positions, `_Guid`, `_Variant` | event 4 |
| `event` + `Product Listing` | Exact list name, `items[]`, `query.scopes`, category scope, brand scope, filters, positions | events 5-6 |
| `event` + `Recommendation` | Exact list name, `items[]`, `RecommenderClientId`, `RecommendationId`, `ItemIds`, `Recommender`, `Type`, `_Variant` | events 7-8 |
| `click` result click | Required envelope, `action.type`, `action.resource_identifier` | events 9-10 |
| `click` micro-conversion | Same outer shape as click, custom `action.type` | events 11-12 |
| `transaction` purchase | Required envelope, `items[]`, `url`, `count`, `total_price`, optional title and discount flags | event 13 |

## Supported List Names

The Events API docs define exactly these list names for `type: "event"` payloads:

- `Search Results`
- `Autocomplete`
- `Product Listing`
- `Recommendation`

List names are case-sensitive. `Top Items` shown in an empty autocomplete popup should be reported as `Recommendation`, with both `RecommenderClientId` and `Recommender` set to `autocomplete_popup`.

## Allowed Rich Metadata In The Good Fixture

Common envelope fields:

- `customer_id`
- `platform` as string and `[platform, version]`
- `local_timestamp` in seconds
- `user_agent`
- `referer`
- `context`
- `ab_test_variant`
- `consent_granted`
- `recommendation_id`

List/query metadata:

- `query.filters._Guid`
- `query.filters._Variant`
- Active user-visible filters such as `brand`, `category`, `sort by`, `availability`, `price`, `color`, and `size`
- Product Listing category scope through `_category_label` and `_category_identity`
- Product Listing brand scope through `_brand_label` and `_brand_identity`
- Recommendation metadata through `RecommenderClientId`, `RecommendationId`, `ItemIds`, `Recommender`, and `Type`

## What This Proves

The static validator proves that the evidence payloads match the documented Events API shapes, list names, required fields, and high-risk attribution metadata.

It does not prove that Luigi's Box ingested the events. For ingestion proof, send a controlled test batch with a unique `client_id`, then verify it in Live Session Explorer before using the main analytics dashboards.
