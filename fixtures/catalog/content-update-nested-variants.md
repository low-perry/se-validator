# Content Update Nested Variants

Fixtures in this group exercise the specific rules for `nested: [{ "type": "variant", ... }]` inside a Content Update payload. Feed-style variant grouping via `item_group_id` is covered separately in [xml-feeds.md](./xml-feeds.md) and [json-feeds.md](./json-feeds.md); the rule coverage write-up for both modes is in [../../docs/catalog-nested-variants-coverage.md](../../docs/catalog-nested-variants-coverage.md).

Files covered:

- Good: `good-content-update-nested-variants.json`
- Bad: `bad-content-update-nested-variants.json`

See also [content-update.md](./content-update.md) for the rest of the Content Update shape rules.

## Intended structure

A product indexed in "collapsed / best-variant" mode has its variants inlined as `nested` objects with `type: "variant"`:

```json
{
  "identity": "nested-parent-tshirt",
  "type": "item",
  "fields": { "title": "Premium T-shirt", "web_url": "...", "availability": 1 },
  "nested": [
    { "type": "category", "identity": "...", "fields": { ... } },
    { "type": "variant",  "identity": "nested-parent-tshirt-red-m",
      "fields": { "title": "Premium T-shirt Red M", "web_url": "...", "color": "Red", "size": "M", "availability": 1 } }
  ]
}
```

Each nested variant must:

- have its own stable `identity`;
- differ from the parent product identity;
- not duplicate any top-level `objects[].identity` or any other nested variant identity;
- include `fields.title` and `fields.web_url`;
- include at least one distinguishing attribute (`color`, `size`, `material`, `pattern`, `style`, `color_code`, `variant`, `variant_name`, or `variant_title`);
- be attached to an `item` / `product` parent, not a category;
- not carry its own `nested` array (Content Update is one level deep).

## Why each fixture should pass or fail

### good-content-update-nested-variants.json (passes)

- One `item` product (`nested-parent-tshirt`) with one nested category and two nested variants.
- Each variant has a unique identity (`nested-parent-tshirt-red-m`, `nested-parent-tshirt-blue-l`) different from the parent and from each other.
- Each variant has `title`, `web_url`, and differing `color` + `size`.

### bad-content-update-nested-variants.json (fails)

Deliberately stuffs every nested-variant rule into two records:

- `objects[0]` is a **category** (`duplicate-top-level-variant`) with a nested **variant** child — variants must attach to items, not categories.
- `objects[1]` is an item. Its nested array contains:
  - a nested category object whose `identity` equals the top-level category identity from `objects[0]` (`duplicate-top-level-variant`);
  - a variant (`nested[1]`) whose `identity` equals the parent product identity `bad-nested-parent`;
  - two variants that share the identity `duplicate-nested-variant` (`nested[2]` and `nested[3]`); `nested[2]` also contains its own empty `nested: []`, which is forbidden;
  - a variant whose `identity` (`duplicate-top-level-variant`) collides with the top-level category identity from `objects[0]`;
  - a variant with no distinguishing attribute (`variant-without-distinguishing-fields`).

## Important fields

| Path | Why it matters |
|:-----|:---------------|
| `nested[].identity` (when `type == "variant"`) | Required. Unique among top-level identities and among all nested variant identities. Must not equal the parent identity. |
| `nested[].fields.title` and `nested[].fields.web_url` | Required. Missing either triggers `CONTENT_UPDATE_NESTED_VARIANT_SHAPE`. |
| Parent `type` | Must be `item` / `product`. A variant nested on a category triggers `CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE`. |
| Distinguishing attribute on variant | Missing triggers the P2 `CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING`. Recognized fields: `color`, `colour`, `color_code`, `size`, `material`, `pattern`, `style`, `variant`, `variant_name`, `variant_title`. |
| `nested[].nested` on variants | Forbidden. Content Update allows only one level of nesting (triggers `CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING`). |
| Parent nested variant count | More than 10 triggers the P2 `CONTENT_UPDATE_HIGH_NESTED_VARIANT_COUNT`. |

## Validator commands

```bash
# Passes
yarn validate catalog fixtures/catalog/good-content-update-nested-variants.json

# Fails
yarn validate catalog fixtures/catalog/bad-content-update-nested-variants.json
```

## Expected key findings

### good-content-update-nested-variants.json

No findings. Score 100/100. A captured report lives at `results/good-catalog-nested-variants-report.md`.

### bad-content-update-nested-variants.json

From the captured review at `results/agent-catalog-review-bad-content-update-report.md` (Score 28/100, P0=3, P1=3, P2=2):

- **P0 `CONTENT_UPDATE_NESTED_VARIANT_ID_EQUALS_PARENT`** — `objects[1].nested[1]` reuses parent identity `bad-nested-parent`.
- **P0 `CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATE`** — the identity `duplicate-nested-variant` appears at `objects[1].nested[2]` and `objects[1].nested[3]`.
- **P0 `CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATES_TOP_LEVEL`** — `objects[1].nested[4]` uses `duplicate-top-level-variant`, which is already a top-level identity at `objects[0]`.
- **P1 `CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE`** — `objects[0].nested[0]` is a variant attached to a category parent.
- **P1 `CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING`** — `objects[1].nested[2]` contains its own `nested` array.
- **P1 `CONTENT_UPDATE_NESTED_VARIANT_SHAPE`** — `objects[1].nested[1]` is missing `fields.web_url`.
- **P2 `CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING`** — fires twice (`objects[1].nested[1]` and `objects[1].nested[5]` lack color/size/etc.).
