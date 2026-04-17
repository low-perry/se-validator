# Category-Item Pairing Report

Date: 2026-04-16
Tracker: `757876-1071971`

## What Was Tested

The docs describe pairing as a mapping from a category field to an item field. The default documented mapping is:

```text
category.fields.id -> item.fields.category_id
```

This is separate from hierarchical category paths and separate from Content Update nested category/ancestor modeling.

## Feed Fixtures

Added XML and JSON feed fixtures that use the same default pairing model:

- `fixtures/catalog/good-pairing-feed.xml`
  - Items use `<category_id>pairingxml-*</category_id>`
  - One item repeats `<category_id>` to model multiple category ids
- `fixtures/catalog/good-pairing-categories.xml`
  - Categories expose `<id>pairingxml-*</id>`
- `fixtures/catalog/good-json-pairing-feed.json`
  - Items use `category_id` as a scalar or array
- `fixtures/catalog/good-json-pairing-categories.json`
  - Categories expose `id`

These fixtures pass:

```text
yarn validate catalog fixtures/catalog/good-pairing-feed.xml fixtures/catalog/good-pairing-categories.xml
yarn validate catalog fixtures/catalog/good-json-pairing-feed.json fixtures/catalog/good-json-pairing-categories.json
```

## Content Update Fixtures

Added minimal Content Update fixtures:

- `fixtures/catalog/good-content-update-pairing.json`
  - Category identity: `pairing-cat-clearance`
  - Category `fields.id`: `pairing-clearance`
  - Items use `fields.category_id: "pairing-clearance"`
- `fixtures/catalog/good-content-update-pairing-plain.json`
  - Category identity and `fields.id`: `pairingplain`
  - Item uses `fields.category_id: "pairingplain"`
- `fixtures/catalog/good-content-update-pairing-array.json`
  - Two categories expose distinct `fields.id` values
  - One item uses `fields.category_id` as an array containing both ids
- `fixtures/catalog/bad-content-update-pairing.json`
  - Item references a missing `fields.category_id` value

The good fixtures now pass:

```text
yarn validate catalog fixtures/catalog/good-content-update-pairing.json fixtures/catalog/good-content-update-pairing-plain.json fixtures/catalog/good-content-update-pairing-array.json
```

The bad fixture reports a P1 `CATEGORY_PAIRING_MISMATCH`:

```text
yarn validate catalog fixtures/catalog/bad-content-update-pairing.json
```

## Live API Results

Posted the pairing payloads to:

```text
POST https://live.luigisbox.com/v1/content
```

Results:

```json
{ "http_status": 201, "ok_count": 3 }
{ "http_status": 201, "ok_count": 2 }
```

After indexing delay, these Search API checks worked:

```text
GET /search?f[]=type:item&f[]=category_id:pairing-clearance
=> pairing-SKU-1,pairing-SKU-2

GET /search?f[]=type:item&f[]=category_id:pairing-clearance&plp=category_id
=> pairing-SKU-1,pairing-SKU-2

GET /search?f[]=type:item&f[]=category_id:pairingplain&plp=category_id
=> pairingplain-SKU-1
```

Category objects were also searchable:

```text
q=pairing-clearance&type=category
=> pairing-cat-clearance

q=pairingplain&type=category
=> pairingplain
```

## Scalar Versus Array Values

Single scalar values work:

```json
{
  "fields": {
    "id": "pairingplain"
  }
}
```

```json
{
  "fields": {
    "category_id": "pairingplain"
  }
}
```

Single-element arrays were also posted and verified live after indexing delay:

```json
{
  "fields": {
    "id": ["pairingarray"]
  }
}
```

```json
{
  "fields": {
    "category_id": ["pairingarray"]
  }
}
```

Result:

```text
GET /search?f[]=type:item&f[]=category_id:pairingarray&plp=category_id
=> pairingarray-SKU-1
```

Practical recommendation:

- Use scalar `category_id` when an item belongs to exactly one independent category id.
- Use array `category_id` when an item belongs to multiple independent category ids.
- Category `id` can be scalar because each category object represents one category.

## Validator Decision

The catalog validator now treats category-item pairing as valid category evidence when:

- Feed items provide `category_id`, or Content Update items provide `fields.category_id`.
- Feed categories provide `id`, or Content Update category objects provide `fields.id`.
- Every item `category_id` value matches at least one category `id` value.

This rule supports scalar and array values.
