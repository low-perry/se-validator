# Content Update Full Payload

Fixtures in this group exercise the Content Update JSON payload shape that the indexing API accepts at `POST /v1/content`. The root is always `{"objects": [ ... ]}`, and each object declares its own `type` (`item`, `category`, `brand`, `article`, or `variant` when nested), its `identity`, and a `fields` map. Unlike feeds, Content Update objects can attach related records directly via `nested`, and category hierarchy is expressed through `fields.ancestors` rather than a ` | `-joined string.

Files covered:

- Good: `good-content-update.json`, `good-content-update-full.json`
- Bad: `bad-content-update.json`, `bad-content-update-primary-order.json`

See the sibling explainers for related scenarios:

- [content-update-nested-variants.md](./content-update-nested-variants.md) covers `nested: [{ "type": "variant" }]` specifically.
- [category-item-pairing.md](./category-item-pairing.md) covers the independent `fields.category_id` → `fields.id` pairing model in Content Update payloads.
- [xml-feeds.md](./xml-feeds.md) and [json-feeds.md](./json-feeds.md) cover the feed alternatives.

## Intended structure

A Content Update payload is a single JSON object with an `objects` array. Each element:

```json
{
  "identity": "content-SKU-1",
  "type": "item",
  "fields": {
    "title": "...",
    "web_url": "...",
    "availability": 1
  },
  "nested": [
    { "type": "category", "identity": "...", "fields": { "title": "...", "web_url": "...", "ancestors": [ ... ] } }
  ]
}
```

Rules that apply beyond the feed rules:

- Every object needs a top-level `type` and a `fields` object.
- If `nested` is present, it must be an array. Only one level of nesting is allowed.
- Category objects nested on a product express the product's category path. The first nested category is treated as the primary category.
- Category ancestors (`fields.ancestors`) must be an array of category objects, each with its own `type`, `identity`, and `fields.title` / `fields.web_url`.
- Content Update batches are recommended to stay around 100 objects per request.

## Why each fixture should pass or fail

### good-content-update.json (passes)

A minimal example: a single `item` product with one nested `category` and its two ancestor categories. Every required field is present. The `ancestors` array is properly ordered from top-level parent (`cat-apparel`) down to the immediate parent (`cat-men`).

### good-content-update-full.json (passes)

The full end-to-end example: 16 independent categories, 12 products, and the nested categories each product belongs to (with ancestors). Demonstrates:

- Mix of top-level categories with and without `fields.hierarchy`.
- 12 top-level product objects. Multi-hierarchy products (8 of 12) place their canonical category path as `nested[0]` and a secondary hierarchy as `nested[1]`.
- 5 `item_group_id` variant groups (`content-SHIRT-1`, `content-HOODIE-1`, etc.) expressed as sibling top-level items.
- Consistent `availability` / `availability_rank` values.

### bad-content-update.json (fails)

A compact fixture that triggers each Content Update shape rule:

- `objects[0].nested[0].fields.ancestors` is a single object instead of an array.
- `objects[0].nested[0].fields` has no `web_url`.
- `objects[0].nested[1]` has no `type` (only `identity` + `fields`).
- `objects[1].fields` has no `title`.
- `objects[1].nested` is the string `"this should be an array"` instead of an array.
- `objects[2]` reuses the identity `SKU-100` already used by `objects[0]`.

### bad-content-update-primary-order.json (fails)

Exercises the rules for declaring which nested category is the primary. The product:

- Declares `fields.category` with `["Apparel", "Men", "T-shirts"]` as the first entry.
- Puts `content-cat-collections-new-arrivals` at `nested[0]`, so the resolved first nested path is `Collections | New Arrivals`.
- Adds `"primary": true` on the second nested category (`content-cat-men-tshirts`).

These disagree with each other. The validator flags both the primary marker position and the ordering mismatch between `fields.category` and `nested`.

## Important fields

| Path | Why it matters |
|:-----|:---------------|
| `objects[].identity` | Unique across products, categories, brands, articles, and nested variants. |
| `objects[].type` | Required top-level. Controls interpretation ("item", "category", ...). |
| `objects[].fields.title`, `objects[].fields.web_url` | Required for every object. |
| `objects[].nested` | Optional. Must be an array. One level of nesting only (nested variants must not carry their own `nested`). |
| `objects[].nested[].type` + `.identity` + `.fields` | All three required on every nested record. |
| `objects[].nested[].fields.ancestors` | Optional on categories. If present, must be an array ordered top-parent → immediate-parent. |
| `objects[].nested[].primary` (or `fields.primary`) | Optional. Marks the primary nested category. The marked category must be at `nested[0]`. |
| `objects[].fields.category` | Optional. When present, its first hierarchy must agree with `nested[0]`'s category path. |
| `objects[].fields.availability`, `fields.availability_rank` | Same rules as feed fixtures (0 or 1; 1..15; 15 for unavailable). |

## Validator commands

```bash
# Passes
yarn validate catalog fixtures/catalog/good-content-update.json
yarn validate catalog fixtures/catalog/good-content-update-full.json

# Fails
yarn validate catalog fixtures/catalog/bad-content-update.json
yarn validate catalog fixtures/catalog/bad-content-update-primary-order.json
```

## Expected key findings

### good-content-update.json and good-content-update-full.json

No findings. Score 100/100. Captured reports live at `results/good-content-update-full-report.md` and `results/agent-catalog-review-content-update-report.md` (which runs against `good-content-update-full.json`).

### bad-content-update.json

From `src/catalog/rules.ts` this fixture triggers:

- **P0 `CATALOG_REQUIRED_FIELDS`** — `objects[1]` has no `fields.title`.
- **P0 `CATALOG_IDENTITY_DUPLICATE`** — `objects[2]` reuses `SKU-100`.
- **P0 `CONTENT_UPDATE_SHAPE_INVALID`** — multiple instances: `objects[0].nested[1]` missing `type`, `objects[1].nested` is not an array.
- **P1 `CONTENT_UPDATE_ANCESTORS_ARRAY`** — `objects[0].nested[0].fields.ancestors` is not an array.
- **P1 `CONTENT_UPDATE_NESTED_CATEGORY_SHAPE`** — `objects[0].nested[0]` has no `fields.web_url`.

### bad-content-update-primary-order.json

Triggers the primary-category ordering rules:

- **P1 `CONTENT_UPDATE_PRIMARY_CATEGORY_NOT_FIRST`** — `content-cat-men-tshirts` is marked primary but sits at `nested[1]`, not `nested[0]`.
- **P1 `CONTENT_UPDATE_PRIMARY_CATEGORY_ORDER_MISMATCH`** — `fields.category[0]` resolves to `Apparel | Men | T-shirts` while `nested[0]` resolves to `Collections | New Arrivals`.
