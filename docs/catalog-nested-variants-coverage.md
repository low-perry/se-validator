# Catalog Nested Variant Validation Coverage

Variant indexing is represented in two different ways depending on the integration path.

## Feed variants

XML and JSON feeds model variants as flat product records linked by `item_group_id`.

Covered rules:

- Every top-level product identity is unique.
- All records with the same `item_group_id` must be consecutive.
- A group with only one item is suspicious and gets a low-severity warning.
- Variant groups should include differing variant attributes such as `color`, `size`, `material`, `pattern`, `style`, or `color_code`.
- Stable base attributes such as `brand` and primary category should stay consistent within the group.

## Content Update nested variants

Content Update payloads model collapsed variants as `nested` objects with `type: "variant"`.

Covered rules:

- Nested variant identities are required.
- Nested variant identities must not equal the parent product identity.
- Nested variant identities must not duplicate top-level object identities.
- Nested variant identities must be unique across the payload.
- Nested variants should be attached only to item/product parents.
- Nested variant `fields.title` and `fields.web_url` are required by this validator.
- Nested variants should include a distinguishing attribute such as `color`, `size`, `material`, `pattern`, `style`, or `color_code`.
- Nested variants must not contain their own `nested` arrays.
- More than 10 nested variants on a product is flagged as a performance risk.

## Analytics consequence

The indexing model changes what analytics identity should be sent later:

- Flat variant mode tracks the displayed variant identity.
- Collapsed/best-variant mode tracks the parent product identity, even if the visible tile uses nested variant data.
