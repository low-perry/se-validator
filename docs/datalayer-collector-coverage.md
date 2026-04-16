# DataLayer Collector Validation Coverage

Source docs audited:

- `/Users/lowperry/projects/docs/src/content/docs/analytics/collector.md`
- `/Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/datalayer-first-search.md`
- `/Users/lowperry/projects/docs/src/content/docs/quickstart/analytics/datalayer-tracking-purchases.md`

## Scope

This validator slice covers the `window.dataLayer.push(...)` integration path only. It intentionally does not validate `gtag(...)` snippets.

For live browser behavior, static payload shape is not enough. The Luigi's Box collector script must be present in the page/layout `<head>` so it can subscribe before page events fire:

```html
<script async src="https://scripts.luigisbox.tech/LBX-1071971.js"></script>
```

## Supported DataLayer Events

| Event | Covered by validator | Good fixture coverage |
| --- | --- | --- |
| `luigisbox.collector.customer_id` | top-level `customer_id` | event 0 |
| `view_item` | `ecommerce.items[]` with one `item_id` | event 1 |
| `view_item_list` + `Search Results` | `item_list_name`, `search_term`, `items[]`, filters, positions | events 2-3 |
| `view_item_list` + `Autocomplete` | `item_list_name`, `search_term`, `items[]`, filters, positions | event 4 |
| `view_item_list` + `Product Listing` | `item_list_name`, `items[]`, `scopes.CategoryLabel`, `scopes.CategoryIdentity`, filters | event 5 |
| `view_item_list` + `Recommendation` | recommender filters, `items[]`, Top Items `autocomplete_popup` convention | events 6-7 |
| `select_item` | exactly one item with `item_id` | event 8 |
| `add_to_cart` | one item, `currency`, `value` | event 9 |
| `purchase` | `transaction_id`, `value`, `currency`, purchase item fields, value total check | event 10 |

## Runtime Verification

Status: confirmed on 2026-04-16.

The `window.dataLayer.push(...)` events were run in a browser with the Luigi's Box collector script loaded, and the events were confirmed to be sent correctly.

This closes the main runtime gap for the hackathon demo: the validator is no longer only checking static snippet shape; it is checking evidence for a browser collector path that has been manually verified end to end.

## What This Proves

The validator proves that the browser-side snippet is structurally compatible with the DataLayer Collector docs and that the LBX collector script is present in `<head>` for HTML evidence.

Together with the runtime verification above, this proves the current DataLayer demo fixture is both structurally valid and capable of sending events through the collector.

Future client evidence should still be checked in a browser because frontend timing, routing, consent gates, tag managers, and conditional rendering can change when events actually fire.
