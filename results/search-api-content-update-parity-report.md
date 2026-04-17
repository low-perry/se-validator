# Search API Content Update Parity Report

Date: 2026-04-16
Tracker: `757876-1071971`

## Signed Content Update POST

Submitted `/Users/lowperry/projects/se-validator/fixtures/catalog/good-content-update-full.json` to:

```text
POST https://live.luigisbox.com/v1/content
```

Result:

```json
{
  "http_status": 201,
  "ok_count": 28
}
```

The payload contains 16 category objects and 12 item objects.

## Item Search Parity

Exact title Search API checks found all 12 expected identity triples:

```text
SKU-N
json-SKU-N
content-SKU-N
```

for `N = 1..12`.

After adding missing `color` and `size` fields to the Content Update fixture, these display fields match across XML feed, JSON feed, and Content Update items:

- `title`
- `web_url`
- `brand`
- `price`
- `image_link_l`
- `color`
- `size`

`availability` and `availability_rank` are semantically equal across methods. XML feed results return them as strings, while JSON feed and Content Update results return numbers.

## Category Object Parity

Filtering category search by category `web_url` found all 16 expected category triples:

```text
cat-*
json-cat-*
content-cat-*
```

The checked category fields match across all three methods:

- `title`
- `web_url`
- `hierarchy`

Note: empty `type:category` searches did not return `content-cat-*` objects during this run, but category identity/title queries and `web_url` filters did return them.

## Functional Category Filter Checks

These are the important behavior checks for category membership.

```text
f[]=category_path:Apparel||Men||T-shirts
=> json-SKU-1,content-SKU-1,json-SKU-2,content-SKU-2

f[]=all_categories_path:Apparel||Men||T-shirts
=> SKU-1,json-SKU-1,content-SKU-1,SKU-2,json-SKU-2,content-SKU-2

f[]=category_path:Collections||New Arrivals
=> SKU-11,SKU-1

f[]=all_categories_path:Collections||New Arrivals
=> SKU-11,json-SKU-11,content-SKU-11,SKU-1,json-SKU-1,content-SKU-1

f[]=category:T-shirts
=> SKU-7,json-SKU-7,content-SKU-7,SKU-1,json-SKU-1,content-SKU-1,SKU-8,json-SKU-8,content-SKU-8,SKU-2,json-SKU-2,content-SKU-2

f[]=brand:Example Brand
=> SKU-3,json-SKU-3,content-SKU-3,SKU-1,json-SKU-1,content-SKU-1,SKU-4,json-SKU-4,content-SKU-4,SKU-2,json-SKU-2,content-SKU-2

f[]=availability:1
=> 30 item hits across XML, JSON, and Content Update
```

## Remaining Caveats And Decision

The known XML primary-category issue still exists:

- XML multi-category products are still primary-filtered under the collection path.
- JSON and Content Update products are primary-filtered under the intended product taxonomy path.
- `all_categories_path` works across all three methods.

Content Update multi-category items return a flattened raw `category` hit field, for example:

```json
["Apparel", "Men", "T-shirts", "Collections", "New Arrivals"]
```

instead of two separate raw category arrays. This is a response-shape difference, not currently a validation failure.

Decision:

- Do not add feed-style raw `category` fields to Content Update payloads just to mirror XML/JSON response shape.
- Keep Content Update payloads aligned with the data-layout model: category membership is represented through `nested` category objects and `fields.ancestors`.
- Do not make raw `category` response parity a validator rule.
- Validate user-facing behavior through `category_path`, `all_categories_path`, direct category lookup, and availability of nested category hits.
- Treat independent category/product pairing as a separate Product Listing validation rule. The docs describe a configurable mapping layer, with the default pairing expecting a category object field `id` and a product object field `category_id`.

This matters because a client UI should not depend on the raw `category` hit field having the same shape across ingestion methods. For breadcrumbs, category pages, and facets, the safer validation target is functional category behavior.

For Product Listing/category-page integrations, the validator should also require explicit evidence of the configured pairing:

- Which category field identifies the listing category, for example `id`.
- Which item field references that category, for example `category_id`.
- Whether every referenced item category value exists on at least one indexed category object.
- Whether the requested PLP filter works through Search API, for example `plp=category` with the mapped category value.
