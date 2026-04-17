# Agent Catalog Review Report

Generated: 2026-04-17T01:33:14.376Z
Docs root: /Users/lowperry/projects/docs
Score: 28/100
Findings: P0=3 P1=3 P2=2

## Inputs Reviewed
- /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json

## Detected Artifacts
- /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json: content-update-json / content-update (96%)

## Inferred Catalog Structures

### /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json
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
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[3].identity
Problem: Nested variant identity "duplicate-nested-variant" appears at objects[1].nested[2] and objects[1].nested[3].
Recommended fix: Give every nested variant a unique identity, even when variants belong to different parent products.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:57
Snippet: `"identity": "duplicate-nested-variant",`
Docs: indexing/data-layout.md, search/guides/variants.md
Confidence: 0.96

### P0 CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATES_TOP_LEVEL
State: failed
Area: identity
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[4].identity
Problem: Nested variant identity "duplicate-top-level-variant" also appears as objects[0].identity.
Recommended fix: Nested variant identities must be unique at index level and must not duplicate product, category, brand, or article identities.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:66
Snippet: `"identity": "duplicate-top-level-variant",`
Docs: indexing/data-layout.md, platform-foundations/identity.md
Confidence: 0.94

### P0 CONTENT_UPDATE_NESTED_VARIANT_ID_EQUALS_PARENT
State: failed
Area: identity
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[1].identity
Problem: objects[1].nested[1] reuses parent identity "bad-nested-parent".
Recommended fix: Use the parent product identity for the top-level item and a distinct identity for every nested variant.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:40
Snippet: `"identity": "bad-nested-parent",`
Docs: indexing/data-layout.md, platform-foundations/identity.md
Confidence: 0.96

### P1 CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING
State: failed
Area: catalog
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[2].nested
Problem: objects[1].nested[2] contains nested children. Content Update should use only one level of nesting.
Recommended fix: Keep variants one level below the parent product. Do not nest objects inside nested variants.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:53
Snippet: `"nested": []`
Docs: indexing/api/v1/content-update.mdx, indexing/data-layout.md
Confidence: 0.9

### P1 CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE
State: failed
Area: catalog
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[0].nested[0]
Problem: objects[0].nested[0] is a variant, but the parent type is "category".
Recommended fix: Attach nested variants only to item/product objects.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:12
Snippet: `"type": "variant",`
Docs: indexing/data-layout.md, search/guides/variants.md
Confidence: 0.88

### P1 CONTENT_UPDATE_NESTED_VARIANT_SHAPE
State: failed
Area: catalog
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[1]
Problem: Nested variant fields.web_url is missing.
Recommended fix: Nested variants should include type variant, unique identity, fields.title, fields.web_url, and distinguishing fields such as color or size.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:39
Snippet: `"type": "variant",`
Docs: indexing/data-layout.md, search/guides/variants.md
Confidence: 0.9

### P2 CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING
State: failed
Area: catalog
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[1].fields
Problem: objects[1].nested[1] does not include a clear variant attribute such as color, size, material, pattern, or style.
Recommended fix: Add attributes that let users and ranking distinguish variants, such as color, size, material, pattern, style, or color_code.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:41
Snippet: `"fields": {`
Docs: indexing/data-layout.md, indexing/feeds.md
Confidence: 0.78

### P2 CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING
State: failed
Area: catalog
Evidence: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:objects[1].nested[5].fields
Problem: objects[1].nested[5] does not include a clear variant attribute such as color, size, material, pattern, or style.
Recommended fix: Add attributes that let users and ranking distinguish variants, such as color, size, material, pattern, style, or color_code.
Likely code: /Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json:76
Snippet: `"fields": {`
Docs: indexing/data-layout.md, indexing/feeds.md
Confidence: 0.78

## Docs Consulted
No local docs were found for this review. Check the --docs path.

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
/Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json: content-update-json/content-update, records=2

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
