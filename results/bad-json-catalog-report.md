
Catalog Validation Report
Score: 32/100
Findings: P0=2 P1=5 P2=1

Detected artifacts:
- fixtures/catalog/bad-json-feed.json: feed-json / product-feed (90%)
- fixtures/catalog/bad-json-categories.json: feed-json / category-feed (90%)

P0 Findings

- [CATALOG_REQUIRED_FIELDS] Catalog object is missing required fields
  Evidence: fixtures/catalog/bad-json-feed.json:product-feed[3]
  Why: product "JSON-SKU-3" at fixtures/catalog/bad-json-feed.json[3] is missing web_url.
  Fix: Include stable identity, display title, and canonical web_url for each searchable object.
  Docs: indexing/feeds.md, indexing/data-layout.md, indexing/api/v1/content-update.mdx
  Confidence: 0.95

- [CATALOG_IDENTITY_DUPLICATE] Catalog identity is reused
  Evidence: fixtures/catalog/bad-json-feed.json:product-feed[3]
  Why: Identity "JSON-SKU-3" appears in both product "JSON-SKU-3" at fixtures/catalog/bad-json-feed.json[2] and product "JSON-SKU-3" at fixtures/catalog/bad-json-feed.json[3].
  Fix: Use a unique immutable identity across products, categories, brands, and articles.
  Docs: platform-foundations/identity.md, indexing/feeds.md, indexing/data-layout.md
  Confidence: 0.95

P1 Findings

- [CATEGORY_FEED_NOT_FLAT] Category feed contains nested category elements
  Evidence: fixtures/catalog/bad-json-categories.json:category-feed[2].category
  Why: category "json-cat-tshirts" at fixtures/catalog/bad-json-categories.json[2] contains a nested category. Category feeds should be flat and use hierarchy for parents.
  Fix: Move parent path into the hierarchy field instead of nesting category elements inside category elements.
  Docs: indexing/feeds.md
  Confidence: 0.9

- [CATEGORY_PAIRING_MISMATCH] Product category path does not match category feed
  Evidence: fixtures/catalog/bad-json-feed.json:product-feed[0].category
  Why: product "JSON-SKU-1" at fixtures/catalog/bad-json-feed.json[0] references "Apparel | Men's | T-shirts", but no category feed entry has matching hierarchy + title.
  Fix: Make product category paths match category feed hierarchy + title exactly, including spelling and delimiters.
  Docs: indexing/feeds.md
  Confidence: 0.9

- [AVAILABILITY_INVALID] Availability value is invalid
  Evidence: fixtures/catalog/bad-json-feed.json:product-feed[2].availability
  Why: product "JSON-SKU-3" at fixtures/catalog/bad-json-feed.json[2] has availability "yes". Expected 0 or 1.
  Fix: Set availability to 1 for available/orderable products or 0 for unavailable products.
  Docs: indexing/feeds.md, indexing/data-layout.md
  Confidence: 0.9

- [AVAILABILITY_RANK_INVALID] Availability rank is outside allowed range
  Evidence: fixtures/catalog/bad-json-feed.json:product-feed[2].availability_rank
  Why: product "JSON-SKU-3" at fixtures/catalog/bad-json-feed.json[2] has availability_rank "20". Expected integer from 1 to 15.
  Fix: Use availability_rank values from 1 to 15, where 15 means unavailable.
  Docs: indexing/feeds.md, indexing/data-layout.md
  Confidence: 0.9

- [VARIANT_GROUP_NOT_CONSECUTIVE] Variant group is not consecutive in feed
  Evidence: fixtures/catalog/bad-json-feed.json:item_group_id=JSON-SHIRT-1
  Why: item_group_id "JSON-SHIRT-1" appears at item positions 0, 2 in fixtures/catalog/bad-json-feed.json.
  Fix: List all variants with the same item_group_id consecutively in the feed.
  Docs: indexing/feeds.md
  Confidence: 0.95

P2 Findings

- [FIELD_NAME_DISCOURAGED] Field name uses discouraged characters
  Evidence: fixtures/catalog/bad-json-feed.json:product-feed[0].price.eur
  Why: product "JSON-SKU-1" at fixtures/catalog/bad-json-feed.json[0] uses field name "price.eur".
  Fix: Prefer concise snake_case field names without dots, brackets, or spaces.
  Docs: indexing/feeds.md, indexing/data-layout.md
  Confidence: 0.75
