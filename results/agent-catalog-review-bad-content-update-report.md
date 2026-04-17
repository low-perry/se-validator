# Agent Catalog Review Report

Generated: 2026-04-17T00:50:49.069Z
Docs root: /Users/lowperry/projects/docs
Score: 28/100
Findings: P0=3 P1=3 P2=2

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json

## Detected Artifacts
- fixtures/catalog/bad-content-update-nested-variants.json: content-update-json / content-update (96%)

## Inferred Catalog Structures

### fixtures/catalog/bad-content-update-nested-variants.json
Format: content-update-json
Role: content-update
Root: objects
Records: 2
Object counts: category=1, product=1
Required coverage: identity 2/2 (100%), title 2/2 (100%), web_url 2/2 (100%)
Common fields: title 2/2, web_url 2/2
Category model:
- 1 independently indexed categories; 0 include hierarchy.
- 1/1 products expose category paths.
- 0/1 products belong to multiple category hierarchies.
- 1 total product category path references.
Content Update model:
- 2 top-level Content Update objects.
- 2 objects have nested records; max nested count is 6.
- 1 nested categories with 0 ancestor records.
- 6 nested variants.
Variant model:
- 5 nested variants in Content Update objects.
Pairing model:
- Product/category relationship is also expressed through category paths.
Examples:
- category duplicate-top-level-variant: Duplicated Identity Category
- product bad-nested-parent: Bad Nested Variant Parent (1 category path(s))

## Review Findings

### P0 CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATE
State: failed
Area: identity
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[3].identity
Problem: Nested variant identity "duplicate-nested-variant" appears at objects[1].nested[2] and objects[1].nested[3].
Recommended fix: Give every nested variant a unique identity, even when variants belong to different parent products.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:47
Snippet: `"identity": "duplicate-nested-variant",`
Docs: indexing/data-layout.md, search/guides/variants.md
Confidence: 0.96

### P0 CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATES_TOP_LEVEL
State: failed
Area: identity
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[4].identity
Problem: Nested variant identity "duplicate-top-level-variant" also appears as objects[0].identity.
Recommended fix: Nested variant identities must be unique at index level and must not duplicate product, category, brand, or article identities.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:4
Snippet: `"identity": "duplicate-top-level-variant",`
Docs: indexing/data-layout.md, platform-foundations/identity.md
Confidence: 0.94

### P0 CONTENT_UPDATE_NESTED_VARIANT_ID_EQUALS_PARENT
State: failed
Area: identity
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[1].identity
Problem: objects[1].nested[1] reuses parent identity "bad-nested-parent".
Recommended fix: Use the parent product identity for the top-level item and a distinct identity for every nested variant.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:23
Snippet: `"identity": "bad-nested-parent",`
Docs: indexing/data-layout.md, platform-foundations/identity.md
Confidence: 0.96

### P1 CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING
State: failed
Area: catalog
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[2].nested
Problem: objects[1].nested[2] contains nested children. Content Update should use only one level of nesting.
Recommended fix: Keep variants one level below the parent product. Do not nest objects inside nested variants.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:10
Snippet: `"nested": [`
Docs: indexing/api/v1/content-update.mdx, indexing/data-layout.md
Confidence: 0.9

### P1 CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE
State: failed
Area: catalog
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[0].nested[0]
Problem: objects[0].nested[0] is a variant, but the parent type is "category".
Recommended fix: Attach nested variants only to item/product objects.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:5
Snippet: `"type": "category",`
Docs: indexing/data-layout.md, search/guides/variants.md
Confidence: 0.88

### P1 CONTENT_UPDATE_NESTED_VARIANT_SHAPE
State: failed
Area: catalog
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[1]
Problem: Nested variant fields.web_url is missing.
Recommended fix: Nested variants should include type variant, unique identity, fields.title, fields.web_url, and distinguishing fields such as color or size.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:10
Snippet: `"nested": [`
Docs: indexing/data-layout.md, search/guides/variants.md
Confidence: 0.9

### P2 CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING
State: failed
Area: catalog
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[1].fields
Problem: objects[1].nested[1] does not include a clear variant attribute such as color, size, material, pattern, or style.
Recommended fix: Add attributes that let users and ranking distinguish variants, such as color, size, material, pattern, style, or color_code.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:6
Snippet: `"fields": {`
Docs: indexing/data-layout.md, indexing/feeds.md
Confidence: 0.78

### P2 CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING
State: failed
Area: catalog
Evidence: fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[5].fields
Problem: objects[1].nested[5] does not include a clear variant attribute such as color, size, material, pattern, or style.
Recommended fix: Add attributes that let users and ranking distinguish variants, such as color, size, material, pattern, style, or color_code.
Likely code: fixtures/catalog/bad-content-update-nested-variants.json:6
Snippet: `"fields": {`
Docs: indexing/data-layout.md, indexing/feeds.md
Confidence: 0.78

## Docs Consulted

- Data Layout and Modeling Guide - Feeds (indexing/feeds): /Users/lowperry/projects/docs/src/content/docs/indexing/feeds.md:338
  Reason: Related docs search match
  Section: Variant fields
  Matched: feed, feeds, content update, identity, title, web_url, category, hierarchy
  Excerpt: |:-----------|:-----|:---------|:------------|:--------| | `item_group_id` | String | | Links individual product variants together for variants search mode. All variants of the same product must share the same `item_group_id` and **must be listed consecutiv...

- Data Layout and Modeling Guide (indexing/data-layout): /Users/lowperry/projects/docs/src/content/docs/indexing/data-layout.md:130
  Reason: Related docs search match
  Section: Special fields
  Matched: feed, feeds, content update, objects, identity, title, web_url, category
  Excerpt: | `availability_rank` | Number | | A more advanced and granular version of `availability`. Accepts values from 1 (most available) to 15 (unavailable). Use this for nuanced availability states like "low stock" (e.g., `3`), "backorder" (e.g., `8`), or "out of...

- Content Update (POST) (indexing/api/v1/content-update): /Users/lowperry/projects/docs/src/content/docs/indexing/api/v1/content-update.mdx:27
  Reason: API reference for request or payload contract
  Section: Overview
  Matched: content update, objects, identity, title, web_url, category, nested, variant
  Excerpt: This is a **full replacement operation**. When you update an existing object, any fields you omit from the request will be removed from the index. If you only need to update specific fields, it is more efficient to use the [Partial Content Update API](/inde...

- Quickstart: Indexing with Luigi's Box (quickstart/indexing/indexing-api): /Users/lowperry/projects/docs/src/content/docs/quickstart/indexing/indexing-api.md:11
  Reason: Quickstart guidance for implementation flow
  Section: Introduction
  Matched: feed, content update, objects, identity, title, web_url, category, availability
  Excerpt: This guide provides a step-by-step walkthrough for developers to send their first product data to Luigi's Box for indexing using the [Content Update API](/indexing/api/v1/content-update/). The Content Update API is the recommended method for ensuring your s...

- Partial Content Update (PATCH) (indexing/api/v1/partial-update): /Users/lowperry/projects/docs/src/content/docs/indexing/api/v1/partial-update.mdx:24
  Reason: API reference for request or payload contract
  Section: Overview
  Matched: content update, objects, identity, title, nested, availability, content, update
  Excerpt: This endpoint is ideal for making small, frequent updates to existing objects, such as changing a product price, description, or availability. You only need to send the `identity` of the object and the specific `fields` you want to add or modify.

- Structuring your data for indexing (quickstart/indexing/data-layout): /Users/lowperry/projects/docs/src/content/docs/quickstart/indexing/data-layout.md:44
  Reason: Quickstart guidance for implementation flow
  Section: The `index-object`: your fundamental data unit
  Matched: feed, feeds, objects, identity, title, web_url, category, hierarchy
  Excerpt: The data you send to Luigi's Box, whether via API or feeds, is conceptualized as a collection of `index-objects`. Each `index-object` represents a single item you want to make searchable, like a product, a category, an article, or a brand.

- Content Export (GET) (indexing/api/v1/export): /Users/lowperry/projects/docs/src/content/docs/indexing/api/v1/export.mdx:340
  Reason: API reference for request or payload contract
  Section: Related endpoints
  Matched: content update, objects, identity, title, web_url, category, nested, variant
  Excerpt: - [Content Update](/indexing/api/v1/content-update/) adds or fully replaces indexed objects. - [Partial Content Update](/indexing/api/v1/partial-update/) updates specific fields without replacing the full object.

- Update by Query (PATCH) (indexing/api/v1/query-update): /Users/lowperry/projects/docs/src/content/docs/indexing/api/v1/query-update.mdx:358
  Reason: API reference for request or payload contract
  Section: Related endpoints
  Matched: content update, objects, title, category, content, update, indexing, data
  Excerpt: - [Content Update](/indexing/api/v1/content-update/) creates or replaces objects. - [Partial Content Update](/indexing/api/v1/partial-update/) updates specific fields only.

- Content Removal (DELETE) (indexing/api/v1/content-removal): /Users/lowperry/projects/docs/src/content/docs/indexing/api/v1/content-removal.mdx:313
  Reason: API reference for request or payload contract
  Section: Related endpoints
  Matched: content update, objects, identity, title, category, content, update, indexing
  Excerpt: - [Content Update](/indexing/api/v1/content-update/) creates or replaces objects. - [Partial Content Update](/indexing/api/v1/partial-update/) updates specific fields only.

- Object Identity (platform-foundations/identity): /Users/lowperry/projects/docs/src/content/docs/platform-foundations/identity.md:102
  Reason: Related docs search match
  Section: Step 3: Reindex catalog
  Matched: feed, feeds, content update, objects, identity, title, category, content
  Excerpt: - **Content Updates API:** You must delete the old objects (by URL) and send the new objects (by ID). - **Feeds:** We will manage the reindex for you by reprocessing the full feed.

- Variant search (search/guides/variants): /Users/lowperry/projects/docs/src/content/docs/search/guides/variants.md:50
  Reason: Related docs search match
  Section: Data requirements
  Matched: feed, feeds, title, nested, variant, item_group_id, content, indexing
  Excerpt: - **API:** Index [Nested variants](/indexing/data-layout/#nested-variants). - **Feeds:** Use an [`item_group_id` grouping identifier](/indexing/feeds/#variant-fields) and follow the [variant search requirements](/indexing/feeds/#product-variants-in-feeds).

- Indexing Data (indexing): /Users/lowperry/projects/docs/src/content/docs/indexing/index.md:61
  Reason: Related docs search match
  Section: Core concepts
  Matched: feed, feeds, content update, identity, title, category, availability, content
  Excerpt: - [**Data Layout:**](/indexing/data-layout/) Luigi's Box follows a "convention over configuration" approach. While you have flexibility in naming attributes, several special fields have predefined behaviors that impact search results and ranking. For exampl...

## Next Actions
- P0: Give every nested variant a unique identity, even when variants belong to different parent products.
- P0: Nested variant identities must be unique at index level and must not duplicate product, category, brand, or article identities.
- P0: Use the parent product identity for the top-level item and a distinct identity for every nested variant.
- P1: Keep variants one level below the parent product. Do not nest objects inside nested variants.
- P1: Attach nested variants only to item/product objects.
- P1: Nested variants should include type variant, unique identity, fields.title, fields.web_url, and distinguishing fields such as color or size.
- P2: Add attributes that let users and ranking distinguish variants, such as color, size, material, pattern, style, or color_code.
- For Content Update payloads, confirm whether nested categories/variants are intended to be embedded under items or indexed independently.
- Fix P0 issues before sending this evidence to an indexing endpoint or dashboard feed processor.

## Follow-up Prompt
Use this prompt if you want another AI to continue the review with the same framing:

```text
You are reviewing Luigi's Box indexing evidence: XML feeds, JSON feeds, or Content Update payloads.
Docs root: /Users/lowperry/projects/docs
Files to inspect: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json

Use local docs first. Check whether the sample:
- has a recognizable feed or Content Update root structure;
- provides stable identity, title, and web_url for every indexed object;
- keeps identities unique across products, categories, brands, articles, and variants;
- models category hierarchies consistently with either category paths, nested categories, or category_id pairing;
- marks exactly one primary category when one product belongs to multiple XML category paths;
- uses valid Content Update objects[] with type, identity, fields, and one-level nested records only;
- models variants with item_group_id or nested variants plus distinguishing fields such as color or size;
- uses availability and availability_rank consistently.

Inferred structures:
fixtures/catalog/bad-content-update-nested-variants.json: content-update-json/content-update, records=2

Current deterministic findings:
P0 CONTENT_UPDATE_NESTED_VARIANT_ID_EQUALS_PARENT: Nested variant identity equals parent product identity
P0 CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATE: Nested variant identity is reused
P0 CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATES_TOP_LEVEL: Nested variant identity duplicates a top-level object identity
P1 CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE: Nested variant is attached to a non-product object
P1 CONTENT_UPDATE_NESTED_VARIANT_SHAPE: Content Update nested variant is incomplete
P2 CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING: Nested variant has no distinguishing attributes
P1 CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING: Nested variant contains another nested array
P2 CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING: Nested variant has no distinguishing attributes
```
