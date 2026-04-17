# XML Product Feed + Category Feed

Fixtures in this group exercise the classic Luigi's Box XML feed shape: one `<items>` document for products and a flat `<categories>` document for category objects.

Files covered:

- Good: `good-feed.xml`, `good-categories.xml`, `good-feed-cat.xml`
- Bad: `bad-feed.xml`, `bad-categories.xml`

See the sibling explainers for related scenarios:

- [json-feeds.md](./json-feeds.md) is the JSON counterpart of these feeds.
- [known-bad-examples.md](./known-bad-examples.md) covers additional XML edge cases such as HTML-style boolean attributes, missing primary markers, and mixed element shapes.
- [category-item-pairing.md](./category-item-pairing.md) covers the `category_id` pairing model, which is expressed with different elements.

## Intended structure

Each `<item>` under `<items>` represents a product. Required elements are `<identity>`, `<title>`, and `<web_url>`. Multi-value fields (such as multiple category paths) use repeated elements, and `primary="true"` on `<category>` marks the canonical hierarchy for products that belong to more than one. Variant grouping uses `<item_group_id>` shared across consecutive items that differ by variant fields such as `<color>` or `<size>`.

The category feed is flat. Each `<category>` has `<identity>`, `<title>`, `<web_url>`, and an optional `<hierarchy>` that joins parent titles with ` | `. Category-feed `<category>` elements must not nest other `<category>` elements — parent relationships are declared through `<hierarchy>`, not nesting.

The two `good-feed-cat.xml` and `good-categories.xml` files are equivalent copies of the same 16-category tree; `good-feed-cat.xml` is used by the README example that pairs `good-feed.xml` with the matching categories.

## Why each fixture should pass or fail

### good-feed.xml + good-categories.xml (passes)

- Every product has identity, title, and web_url.
- Every multi-category product marks exactly one `primary="true"`.
- Variant groups (`SHIRT-1`, `HOODIE-1`, `DRESS-1`, `WTEE-1`, `SNEAKER-1`) are consecutive and carry differing `<color>` / `<size>`.
- Every product category path matches a category in the category feed's hierarchy + title.
- `<availability>` is `0` or `1`; `<availability_rank>` is in `1..15` and uses `15` for unavailable products.

### bad-feed.xml + bad-categories.xml (fails)

Designed to hit several high-severity rules:

- `SKU-1` uses `<category primary="true">Apparel | Men's | T-shirts</category>` — the apostrophe in "Men's" means the path does not match the category feed's `Apparel | Men | T-shirts`.
- `SKU-1` uses `<price.eur>` as a field name (disallowed character `.`).
- `SKU-2` is missing `<category>` entirely (no pairing evidence).
- `SKU-3` uses `<availability>yes</availability>` (expected 0 or 1) and `<availability_rank>20` (expected 1..15).
- `SKU-3` appears twice at non-consecutive positions, so the second occurrence is both an identity duplicate and a non-consecutive variant group entry.
- The second `SKU-3` is also missing `<web_url>`, so `CATALOG_REQUIRED_FIELDS` fires.
- `bad-categories.xml` nests a `<category>` inside a `<category>`, which is the shape category feeds should never use.

## Important fields

| Element | Why it matters |
|:--------|:---------------|
| `<identity>` | Must be unique across products, categories, brands, and articles. Reused identities break index-time merging and analytics. |
| `<title>`, `<web_url>` | Required for every indexed object. |
| `<category>` | Hierarchy as a pipe-joined path (`Apparel \| Men \| T-shirts`). When a product belongs to multiple hierarchies, exactly one element must carry `primary="true"`. |
| `primary="true"` on `<category>` | Selects the canonical category path. With multiple paths and no primary marker, the primary category becomes ambiguous. |
| `<hierarchy>` (on category) | Pipe-joined parent path (e.g. `Apparel \| Men`). Category objects cannot nest; parents are expressed through this field. |
| `<item_group_id>` | Groups variants. All items with the same group id must be consecutive and should differ by `<color>`, `<size>`, `<material>`, `<pattern>`, `<style>`, etc. |
| `<availability>` | Must be `0` or `1`. |
| `<availability_rank>` | Integer in `1..15`. Use `15` for unavailable products; other values combined with `availability=0` trigger `AVAILABILITY_RANK_UNAVAILABLE`. |

## Validator commands

```bash
# Passes
yarn validate catalog fixtures/catalog/good-feed.xml fixtures/catalog/good-categories.xml
yarn validate catalog fixtures/catalog/good-feed.xml fixtures/catalog/good-feed-cat.xml

# Fails
yarn validate catalog fixtures/catalog/bad-feed.xml fixtures/catalog/bad-categories.xml
```

## Expected key findings

### good-feed.xml + good-categories.xml

No findings. Score 100/100. This is the canonical happy-path for XML feeds. A captured review with richer profile information lives at `results/agent-catalog-review-good-feed-report.md`.

### bad-feed.xml + bad-categories.xml

From `src/catalog/rules.ts`, this pair should trigger:

- **P0 `CATALOG_REQUIRED_FIELDS`** — the duplicated `SKU-3` entry is missing `web_url`.
- **P0 `CATALOG_IDENTITY_DUPLICATE`** — `SKU-3` appears twice in `bad-feed.xml`.
- **P1 `CATEGORY_FEED_NOT_FLAT`** — `bad-categories.xml` nests a `<category>` inside `cat-tshirts`.
- **P1 `CATEGORY_PAIRING_MISMATCH`** — `SKU-1`'s path `Apparel | Men's | T-shirts` does not match the category feed's `Apparel | Men | T-shirts`.
- **P1 `CATEGORY_PAIRING_EVIDENCE_MISSING`** — `SKU-2` has no category path and no `category_id`, so pairing cannot be verified.
- **P1 `AVAILABILITY_INVALID`** — `SKU-3` uses availability `"yes"` (expected `0` or `1`).
- **P1 `AVAILABILITY_RANK_INVALID`** — `SKU-3` uses availability_rank `20` (expected `1..15`).
- **P1 `VARIANT_GROUP_NOT_CONSECUTIVE`** — `item_group_id="SHIRT-1"` is split across positions 0 and 2 (with `SKU-2` in between).
- **P2 `FIELD_NAME_DISCOURAGED`** — `<price.eur>` contains a disallowed `.` character.

Expect additional lower-priority noise as well (for example variant-group singleton warnings for `OTHER` in `SKU-2`). The P0 and P1 entries above are the ones worth demoing.
