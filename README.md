# SE Validator

TypeScript prototype for validating Luigi's Box client-led integration evidence.

## Current First Win

Catalog validation accepts XML feeds, JSON feeds, or Content Update payloads, detects the artifact type, normalizes the objects, and reports high-risk catalog issues.

```bash
yarn validate catalog fixtures/catalog/bad-feed.xml fixtures/catalog/bad-categories.xml
yarn validate catalog fixtures/catalog/bad-json-feed.json fixtures/catalog/bad-json-categories.json
yarn validate catalog fixtures/catalog/cross-type-duplicate-feed.json fixtures/catalog/cross-type-duplicate-categories.json
yarn validate catalog fixtures/catalog/invalid-html-attribute-feed.xml
yarn validate catalog fixtures/catalog/mixed-category-shape-feed.xml fixtures/catalog/good-categories.xml
yarn validate catalog fixtures/catalog/missing-primary-feed.xml fixtures/catalog/good-categories.xml
yarn validate catalog fixtures/catalog/bad-content-update.json
yarn validate catalog fixtures/catalog/bad-content-update-primary-order.json
yarn validate catalog fixtures/catalog/bad-content-update-nested-variants.json
yarn validate catalog fixtures/catalog/bad-content-update-pairing.json
yarn validate catalog fixtures/catalog/good-feed.xml fixtures/catalog/good-categories.xml
yarn validate catalog fixtures/catalog/good-feed.xml fixtures/catalog/good-feed-cat.xml
yarn validate catalog fixtures/catalog/good-json-feed.json fixtures/catalog/good-json-categories.json
yarn validate catalog fixtures/catalog/good-pairing-feed.xml fixtures/catalog/good-pairing-categories.xml
yarn validate catalog fixtures/catalog/good-json-pairing-feed.json fixtures/catalog/good-json-pairing-categories.json
yarn validate catalog fixtures/catalog/good-content-update.json
yarn validate catalog fixtures/catalog/good-content-update-full.json
yarn validate catalog fixtures/catalog/good-content-update-nested-variants.json
yarn validate catalog fixtures/catalog/good-content-update-pairing.json fixtures/catalog/good-content-update-pairing-plain.json fixtures/catalog/good-content-update-pairing-array.json
yarn validate analytics fixtures/analytics/events-api-good.json
yarn validate analytics fixtures/analytics/events-api-bad.json
yarn validate analytics fixtures/analytics/datalayer-good.html
yarn validate analytics fixtures/analytics/datalayer-bad.html
yarn validate service fixtures/service/autocomplete-good.json
yarn validate service fixtures/service/autocomplete-bad.json
yarn validate frontend fixtures/frontend/autocomplete-datalayer-good.html fixtures/frontend/autocomplete-events-api-good.html
yarn validate frontend fixtures/frontend/autocomplete-bad.html
yarn validate catalog --report results/bad-json-catalog-report.md fixtures/catalog/bad-json-feed.json fixtures/catalog/bad-json-categories.json
```

## Scripts

```bash
yarn typecheck
yarn validate catalog <paths...>
yarn validate analytics <paths...>
yarn validate service <paths...>
yarn validate frontend <paths...>
yarn validate catalog "https://example.com/path/to/feed.xml"
```
