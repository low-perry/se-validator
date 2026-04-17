# Category-Item Pairing

Luigi's Box supports an independent "pairing" model that links items to categories through matching ids, alongside (or instead of) category hierarchy paths. The default documented mapping is:

```text
category.fields.id  ->  item.fields.category_id
```

In feeds this maps to `<id>` on category elements and `<category_id>` on item elements. In Content Update it maps to `fields.id` on category objects and `fields.category_id` on item objects. Item `category_id` may be a scalar or an array — an item that belongs to multiple pairing categories can list them all.

Files covered:

- Good: `good-pairing-feed.xml`, `good-pairing-categories.xml`, `good-json-pairing-feed.json`, `good-json-pairing-categories.json`, `good-content-update-pairing.json`, `good-content-update-pairing-plain.json`, `good-content-update-pairing-array.json`
- Bad: `bad-content-update-pairing.json`

See the sibling explainers for related context:

- [xml-feeds.md](./xml-feeds.md) and [json-feeds.md](./json-feeds.md) cover the classic hierarchy-path pairing model (what most fixtures use).
- [content-update.md](./content-update.md) covers the rest of the Content Update payload rules.
- [../../results/product-listing-pairing-report.md](../../results/product-listing-pairing-report.md) is the live-API verification log this fixture set was built against.

## Intended structure

### XML feed pair

`good-pairing-feed.xml` products carry `<category_id>` elements. `good-pairing-categories.xml` categories carry `<id>`:

```xml
<item>
  <identity>pairingxml-SKU-1</identity>
  <category_id>pairingxml-primary</category_id>
</item>

<category>
  <identity>pairingxml-cat-primary</identity>
  <id>pairingxml-primary</id>
</category>
```

A second item repeats `<category_id>` twice to show that multiple pairing ids are expressed as repeated elements.

### JSON feed pair

`good-json-pairing-feed.json` uses scalar or array `category_id`:

```json
{ "category_id": "pairingjson-primary" }
{ "category_id": ["pairingjson-primary", "pairingjson-secondary"] }
```

`good-json-pairing-categories.json` categories carry `id`.

### Content Update variants

Three Content Update fixtures demonstrate supported shapes:

- `good-content-update-pairing.json` — scalar `category_id`, one category with `fields.id`.
- `good-content-update-pairing-plain.json` — scalar `category_id`, minimal payload.
- `good-content-update-pairing-array.json` — array `category_id` pointing at two categories.

The bad fixture `bad-content-update-pairing.json` references `category_id: "missing-pairing-category"` for which no category object exists.

## Why each fixture should pass or fail

### Good fixtures

- Every item `category_id` value matches a category's `id` (or `fields.id`).
- Every item either has pairing ids **or** classic category paths — in this group they use pairing exclusively.
- Required fields (`identity`, `title`, `web_url`) are all present; `availability` / `availability_rank` are valid.

### bad-content-update-pairing.json

One item (`bad-pairing-SKU-1`) points at `category_id: "missing-pairing-category"`, which no category object declares. The only available category exposes `fields.id: "bad-pairing-clearance"`. The rule requires every referenced id to match exactly, including case and type.

## Important fields

| Path | Why it matters |
|:-----|:---------------|
| Category `<id>` / `fields.id` | Pairing target. Without this, the validator reports `CATEGORY_PAIRING_FIELD_MISSING` when items try to pair. |
| Item `<category_id>` / `fields.category_id` | Pairing source. Scalar or array. |
| Matching values | Each item `category_id` must equal at least one category `id`. Mismatches trigger `CATEGORY_PAIRING_MISMATCH`. |
| Missing item evidence | An item with neither hierarchy paths nor `category_id` triggers `CATEGORY_PAIRING_EVIDENCE_MISSING`. |

## Validator commands

```bash
# Passes — feed pairs
yarn validate catalog fixtures/catalog/good-pairing-feed.xml fixtures/catalog/good-pairing-categories.xml
yarn validate catalog fixtures/catalog/good-json-pairing-feed.json fixtures/catalog/good-json-pairing-categories.json

# Passes — Content Update variants
yarn validate catalog \
  fixtures/catalog/good-content-update-pairing.json \
  fixtures/catalog/good-content-update-pairing-plain.json \
  fixtures/catalog/good-content-update-pairing-array.json

# Fails
yarn validate catalog fixtures/catalog/bad-content-update-pairing.json
```

## Expected key findings

### All good fixtures

No findings. Score 100/100. Each of these was verified live against the hackathon tracker — see `results/product-listing-pairing-report.md` for the captured log, including the Search API queries used to confirm that the paired items are retrievable by `f[]=category_id:<value>`.

### bad-content-update-pairing.json

- **P1 `CATEGORY_PAIRING_MISMATCH`** — item `bad-pairing-SKU-1` references `category_id "missing-pairing-category"`, but no category object has `fields.id` equal to that value.

No P0 findings in this fixture: the item is structurally valid, just pointed at a nonexistent pairing target.
