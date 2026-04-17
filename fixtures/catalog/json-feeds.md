# JSON Product Feed + Category Feed

Fixtures in this group exercise the JSON feed shape: either a bare JSON array of product records or a `{"items": [...]}` / `{"categories": [...]}` object. The rule surface is the same as XML feeds, but the JSON model represents multi-value fields differently (arrays) and uses `[]` of `[]` category paths instead of repeated XML elements.

Files covered:

- Good: `good-json-feed.json`, `good-json-categories.json`
- Bad: `bad-json-feed.json`, `bad-json-categories.json`

See the sibling explainers for related scenarios:

- [xml-feeds.md](./xml-feeds.md) — same validator rules, different source shape.
- [content-update.md](./content-update.md) covers the Content Update payload shape, which is distinct from a feed.
- [known-bad-examples.md](./known-bad-examples.md) covers `cross-type-duplicate-feed.json` and `cross-type-duplicate-categories.json`, which sit in the JSON-feed format but exist to flag identity collisions across product and category feeds.

## Intended structure

Each product record has `identity`, `title`, and `web_url`. The `category` field is an array of hierarchies, where each hierarchy is itself an array of ancestor titles:

```json
"category": [
  ["Apparel", "Men", "T-shirts"],
  ["Collections", "New Arrivals"]
]
```

The first hierarchy is treated as the canonical primary category (no `primary` flag exists in the JSON shape). Variant grouping uses `item_group_id` shared across consecutive records that differ by variant fields such as `color` or `size`.

Category records have `identity`, `title`, and `web_url`. `hierarchy` is a ` | `-joined string of parent titles ("Apparel | Men"). JSON categories must not nest `category` under `category` — parents are declared through `hierarchy`.

The good-json feeds accept both bare JSON arrays (as used by the good fixtures) and `{"items": [...]}` / `{"categories": [...]}` wrappers (as used by the bad fixtures). Both forms are recognized by the detector in `src/catalog/detect.ts`.

## Why each fixture should pass or fail

### good-json-feed.json + good-json-categories.json (passes)

- Every record has identity, title, and web_url.
- Variant groups (`json-SHIRT-1`, `json-HOODIE-1`, `json-DRESS-1`, `json-WTEE-1`, `json-SNEAKER-1`) are consecutive and carry differing `color` / `size`.
- Every product category path matches a category-feed hierarchy + title.
- `availability` is `0` or `1`; `availability_rank` is in `1..15` and uses `15` for unavailable products.

### bad-json-feed.json + bad-json-categories.json (fails)

Parallels `bad-feed.xml` + `bad-categories.xml` so the same rules are exercised in the JSON format:

- `JSON-SKU-1` uses `"Men's"` in its category path — does not match the category feed's `Men`.
- `JSON-SKU-1` uses a `price.eur` field name (disallowed `.` character).
- `JSON-SKU-2` has no category path (no pairing evidence).
- `JSON-SKU-3` uses `"availability": "yes"` and `"availability_rank": 20`.
- `JSON-SKU-3` appears twice at positions 2 and 3 — the second record is missing `web_url` and reuses the identity.
- `bad-json-categories.json` nests a `category` inside `json-cat-tshirts`.

## Important fields

| JSON key | Why it matters |
|:---------|:---------------|
| `identity` | Must be unique across products, categories, brands, and articles. |
| `title`, `web_url` | Required for every indexed object. |
| `category` (on product) | Array of hierarchy arrays. The first entry is the canonical primary path. |
| `hierarchy` (on category) | Pipe-joined parent path (e.g. `Apparel \| Men`). JSON categories cannot nest. |
| `item_group_id` | Groups variants. Must be consecutive; variants should differ by `color`, `size`, `material`, `pattern`, `style`, etc. |
| `availability` | Must be `0` or `1`. String `"yes"` is invalid. |
| `availability_rank` | Integer in `1..15`. |

Note: the detector decides `role` partly from the path name when the file is a bare JSON array. `good-json-feed.json` ends with `feed.json` (product feed) and `good-json-categories.json` contains `categor` in its name (category feed). Keep file names aligned with this convention.

## Validator commands

```bash
# Passes
yarn validate catalog fixtures/catalog/good-json-feed.json fixtures/catalog/good-json-categories.json

# Fails
yarn validate catalog fixtures/catalog/bad-json-feed.json fixtures/catalog/bad-json-categories.json

# Optional: write the bad-case report to disk
yarn validate catalog --report results/bad-json-catalog-report.md \
  fixtures/catalog/bad-json-feed.json fixtures/catalog/bad-json-categories.json
```

## Expected key findings

### good-json-feed.json + good-json-categories.json

No findings. Score 100/100. A captured report lives at `results/good-json-catalog-report.md`.

### bad-json-feed.json + bad-json-categories.json

From the captured report at `results/bad-json-catalog-report.md` (Score 32/100, P0=2, P1=5, P2=1):

- **P0 `CATALOG_REQUIRED_FIELDS`** — duplicated `JSON-SKU-3` entry is missing `web_url`.
- **P0 `CATALOG_IDENTITY_DUPLICATE`** — `JSON-SKU-3` appears twice.
- **P1 `CATEGORY_FEED_NOT_FLAT`** — `json-cat-tshirts` contains a nested category.
- **P1 `CATEGORY_PAIRING_MISMATCH`** — `Apparel | Men's | T-shirts` does not match any category feed entry.
- **P1 `AVAILABILITY_INVALID`** — `JSON-SKU-3` has availability `"yes"`.
- **P1 `AVAILABILITY_RANK_INVALID`** — `JSON-SKU-3` has availability_rank `20`.
- **P1 `VARIANT_GROUP_NOT_CONSECUTIVE`** — `JSON-SHIRT-1` group is split across positions 0 and 2.
- **P2 `FIELD_NAME_DISCOURAGED`** — `price.eur` field name includes a disallowed `.`.
