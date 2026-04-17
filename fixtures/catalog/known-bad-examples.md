# Known Bad / Edge Case Fixtures

Single-purpose fixtures that each target one specific rule or parse failure. Unlike `bad-feed.xml` and `bad-json-feed.json` (which combine many issues), these files isolate a narrow scenario so demos can show "this input trips exactly this rule."

Files covered:

- `cross-type-duplicate-feed.json`, `cross-type-duplicate-categories.json`
- `invalid-html-attribute-feed.xml`
- `html-page-feed.html`
- `missing-primary-feed.xml`
- `mixed-category-shape-feed.xml`

See sibling explainers for the combined-issue counterparts:

- [xml-feeds.md](./xml-feeds.md) for the combined XML bad fixture.
- [json-feeds.md](./json-feeds.md) for the combined JSON bad fixture.
- [content-update.md](./content-update.md) for Content Update shape edge cases.

## Fixture-by-fixture notes

### cross-type-duplicate-feed.json + cross-type-duplicate-categories.json

**What it is.** Two tiny JSON feeds that both use the identity `SHARED-ID-1`, but one is a product feed entry and the other is a category feed entry. Demonstrates that identity uniqueness is enforced across *all* object types, not just within a single feed.

**Why it fails.** `CATALOG_IDENTITY_DUPLICATE` is triggered when the same identity appears twice in the normalized catalog, regardless of object type. Also, because the product has no `category_id` and no category feed entry with matching hierarchy + title, pairing evidence is ambiguous.

**Command.**

```bash
yarn validate catalog fixtures/catalog/cross-type-duplicate-feed.json fixtures/catalog/cross-type-duplicate-categories.json
```

**Expected key findings.**

- **P0 `CATALOG_IDENTITY_DUPLICATE`** — `SHARED-ID-1` appears in both feeds.
- **P1 `CATEGORY_PAIRING_MISMATCH`** — product's `["Shared"]` category path has no matching hierarchy + title in the category feed.

---

### invalid-html-attribute-feed.xml

**What it is.** A single-product XML feed whose `<description>` contains an `<img ... crossorigin>` tag with an HTML-style boolean attribute. HTML accepts unquoted boolean attributes, but XML requires every attribute to have a value. `fast-xml-parser` rejects this file at validation time.

**Why it fails.** Parser validation fails before the rule layer runs. `src/catalog/rules.ts` translates the XML validator error into a `CATALOG_ARTIFACT_PARSE_ERROR` with the title "XML contains an HTML-style boolean attribute", and suggests either quoting the attribute (e.g. `crossorigin="anonymous"`) or wrapping the HTML snippet in CDATA.

**Command.**

```bash
yarn validate catalog fixtures/catalog/invalid-html-attribute-feed.xml
```

**Expected key findings.**

- **P0 `CATALOG_ARTIFACT_PARSE_ERROR`** — XML contains an HTML-style boolean attribute `crossorigin`.

---

### html-page-feed.html

**What it is.** A bare HTML page (not a feed) — the kind of document that a client might accidentally send when they paste a repository viewer URL, a login page, or a dashboard URL instead of a feed download URL.

**Why it fails.** The detector in `src/catalog/detect.ts` recognizes the `<!doctype html>` / `<html>` / `<head>` / `<body>` signature and marks the artifact with the parse error "Input appears to be an HTML document, not an XML or JSON catalog feed." `rules.ts` surfaces that as `CATALOG_ARTIFACT_PARSE_ERROR` with the title "URL or file returned an HTML page instead of a feed".

**Command.**

```bash
yarn validate catalog fixtures/catalog/html-page-feed.html
```

**Expected key findings.**

- **P0 `CATALOG_ARTIFACT_PARSE_ERROR`** — file returned an HTML page instead of a feed.

---

### missing-primary-feed.xml

**What it is.** A single-product XML feed where the product belongs to two category hierarchies, but neither `<category>` carries a `primary="true"` attribute. Both `<category>` elements are plain text only.

**Why it fails.** When a product has more than one `<category>` value, the validator requires exactly one `primary="true"` marker to identify the canonical path. With zero primary markers the `XML_PRODUCT_CATEGORY_PRIMARY_INVALID` rule fires. No category feed is provided, so the pairing rule also flags that it cannot verify hierarchies.

**Command.**

```bash
# Standalone (no category feed -> pairing evidence warning)
yarn validate catalog fixtures/catalog/missing-primary-feed.xml

# With the good category feed
yarn validate catalog fixtures/catalog/missing-primary-feed.xml fixtures/catalog/good-categories.xml
```

**Expected key findings.**

- **P1 `XML_PRODUCT_CATEGORY_PRIMARY_INVALID`** — product has 2 category values and 0 marked `primary="true"`.
- **P1 `CATEGORY_PAIRING_EVIDENCE_MISSING`** — when run standalone, the validator cannot confirm pairing because no category feed is present. (When paired with `good-categories.xml`, both category paths match the feed and this finding does not fire.)

---

### mixed-category-shape-feed.xml

**What it is.** A two-product XML feed where one product's `<category>` carries a `primary="true"` attribute (so `fast-xml-parser` treats it as "text-with-attributes") and the other product's `<category>` is plain text. Mixing these two XML shapes on the same element is a well-known source of feed mapper crashes: a mapper can traverse one shape successfully and then hit a primitive/nesting type error on the other.

**Why it fails.** `validateXmlMixedElementShapes` scans each source file for elements that appear as both `primitive` and `text-with-attributes` shapes. When it finds one, it emits a P0 `XML_MIXED_ELEMENT_SHAPE` finding with the recommendation to make the element structurally consistent across every record.

**Command.**

```bash
yarn validate catalog fixtures/catalog/mixed-category-shape-feed.xml fixtures/catalog/good-categories.xml
```

**Expected key findings.**

- **P0 `XML_MIXED_ELEMENT_SHAPE`** — `<category>` is used as both plain text and text with attributes in the same product feed.
