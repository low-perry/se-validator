# Investigation And TODOs

## Current Feed Import Investigation

Tracker: `757876-1071971`

The XML, JSON, and category feeds are all being imported into Luigi's Box. The latest Search API checks showed:

- Items: `24` total, `12` XML identities and `12` JSON identities.
- Categories: `32` total, `16` XML identities and `16` JSON identities.
- Category objects match between XML and JSON on `title`, `web_url`, and `hierarchy`.
- `image_link` and `image_link_l` are now present for both XML and JSON item imports.
- The earlier malformed hierarchy facet values with leading spaces are gone.

## Remaining Feed Difference

`all_categories_path` now behaves correctly across XML and JSON. Example:

```text
all_categories_path:Apparel||Men||T-shirts
=> SKU-1,json-SKU-1,SKU-2,json-SKU-2
```

`category_path` still differs because XML multi-category products currently have the secondary collection path first.

Example:

```json
// XML SKU-1
"category": [
  ["Collections", "New Arrivals"],
  ["Apparel", "Men", "T-shirts"]
]

// JSON json-SKU-1
"category": [
  ["Apparel", "Men", "T-shirts"],
  ["Collections", "New Arrivals"]
]
```

Current behavior:

```text
category_path:Apparel||Men||T-shirts
=> json-SKU-1,json-SKU-2

category_path:Collections||New Arrivals
=> SKU-1
```

Expected parity would return both XML and JSON items for the primary apparel path.

## Working Assumption

The dashboard mapping now splits XML categories correctly, but the generic XML import path is still not using `primary="true"` as the primary category marker. It may be using the first processed category, the last processed category, or a transformed order.

For now this is acceptable for the hackathon prototype. The validator should still preserve this as a known risk when comparing real imports.

## TODOs

- Add an import parity validator that compares Search API attributes for equivalent XML/JSON/content identities.
- Add a rule or report note for primary category ordering when products have multiple category paths.
- Confirmed through live Search API checks that Content Update uses the first nested category as the primary `category_path`.
- Compared `content-SKU-*` objects against `SKU-*` and `json-SKU-*`; see `results/search-api-content-update-parity-report.md`.
- Do not validate raw `category` response shape parity across XML, JSON, and Content Update. Content Update should use `nested` categories with `ancestors`; validator parity should focus on functional category behavior.
- Added category-item pairing validation and XML/JSON/Content Update fixtures for the default `category.id -> item.category_id` model; see `results/product-listing-pairing-report.md`.
- Decide whether `availability` and `availability_rank` type differences matter for client integrations.
