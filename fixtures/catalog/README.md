# Catalog Fixtures

Demo and test fixtures for `yarn validate catalog`.

This directory holds every catalog input the validator knows how to handle: XML and JSON feeds, Content Update payloads, category-item pairing examples, and deliberately broken files used to exercise rule coverage. Each group has a dedicated explainer co-located here so demos can show a single representative command plus the specific findings it should produce.

## How the validator consumes these fixtures

```bash
yarn validate catalog <paths...>
# optional: write a markdown report instead of just printing it
yarn validate catalog --report results/my-report.md <paths...>
```

The validator auto-detects each artifact (`feed-xml` / `feed-json` / `content-update-json`) and its role (`product-feed`, `category-feed`, or `content-update`) from the file's root structure (see `src/catalog/detect.ts`). You can pass a product feed and a category feed in the same invocation; pairing rules need both to verify hierarchy + title alignment.

## Fixture groups

| Group | Fixtures | Explainer |
|:------|:---------|:----------|
| XML product feed + category feed | `good-feed.xml`, `good-categories.xml`, `good-feed-cat.xml`, `bad-feed.xml`, `bad-categories.xml` | [xml-feeds.md](./xml-feeds.md) |
| JSON product feed + category feed | `good-json-feed.json`, `good-json-categories.json`, `bad-json-feed.json`, `bad-json-categories.json` | [json-feeds.md](./json-feeds.md) |
| Content Update full payload | `good-content-update.json`, `good-content-update-full.json`, `bad-content-update.json`, `bad-content-update-primary-order.json` | [content-update.md](./content-update.md) |
| Content Update nested variants | `good-content-update-nested-variants.json`, `bad-content-update-nested-variants.json` | [content-update-nested-variants.md](./content-update-nested-variants.md) |
| Category-item pairing | `good-pairing-feed.xml`, `good-pairing-categories.xml`, `good-json-pairing-feed.json`, `good-json-pairing-categories.json`, `good-content-update-pairing.json`, `good-content-update-pairing-plain.json`, `good-content-update-pairing-array.json`, `bad-content-update-pairing.json` | [category-item-pairing.md](./category-item-pairing.md) |
| Known bad / edge cases | `cross-type-duplicate-feed.json`, `cross-type-duplicate-categories.json`, `invalid-html-attribute-feed.xml`, `html-page-feed.html`, `missing-primary-feed.xml`, `mixed-category-shape-feed.xml` | [known-bad-examples.md](./known-bad-examples.md) |

## Naming conventions

- `good-*` files should pass with zero findings (score 100/100).
- `bad-*` files should trigger one or more findings; each explainer lists the expected rule IDs.
- Identity prefixes keep demo data separated by source:
  - `SKU-*` / `cat-*` for XML
  - `json-SKU-*` / `json-cat-*` for JSON feeds
  - `content-SKU-*` / `content-cat-*` for Content Update
  - `pairingxml-*`, `pairingjson-*`, `pairing-*`, `pairingplain-*`, `pairing-array-*` for category-item pairing fixtures
  - `nested-*` for Content Update nested variant fixtures

## Related documentation

- [../../docs/catalog-nested-variants-coverage.md](../../docs/catalog-nested-variants-coverage.md) — rule coverage notes for feed vs Content Update variant indexing.
- [../../results/product-listing-pairing-report.md](../../results/product-listing-pairing-report.md) — live-API verification log used when the pairing fixtures were authored.
- [../../results/bad-json-catalog-report.md](../../results/bad-json-catalog-report.md) — captured validator output for `bad-json-feed.json` + `bad-json-categories.json`.
- [../../results/agent-catalog-review-good-feed-report.md](../../results/agent-catalog-review-good-feed-report.md) — captured review of the good XML fixtures.
- [../../results/agent-catalog-review-bad-content-update-report.md](../../results/agent-catalog-review-bad-content-update-report.md) — captured review of `bad-content-update-nested-variants.json`.
