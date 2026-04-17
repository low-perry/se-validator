import { createFinding } from "../core/findings.js";
import type { ValidationFinding } from "../core/types.js";
import { isRecord } from "./detect.js";
import {
  isCategoryObject,
  isProductLikeObject,
  normalizeCategoryPath,
  stringValue,
  toArray,
  type NormalizedCatalog,
  type NormalizedCatalogObject
} from "./normalize.js";

type CatalogRule = (catalog: NormalizedCatalog) => ValidationFinding[];

export const catalogRules: CatalogRule[] = [
  validateRecognizedArtifacts,
  validateRequiredFields,
  validateXmlMixedElementShapes,
  validateXmlPrimaryCategoryMarkers,
  validateIdentityUniqueness,
  validateContentUpdateShape,
  validateCategoryFeedFlatness,
  validateCategoryPairing,
  validateAvailability,
  validateVariantGroupOrdering,
  validateFieldNames
];

function validateRecognizedArtifacts(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.artifacts.flatMap((artifact) => {
    if (artifact.parseError) {
      return createFinding({
        id: "CATALOG_ARTIFACT_PARSE_ERROR",
        severity: "P0",
        title: parseErrorTitle(artifact.parseError),
        message: artifact.parseError,
        evidencePath: artifact.path,
        remediation: parseErrorRemediation(artifact.parseError),
        docs: ["indexing/feeds.md", "indexing/api/v1/content-update.mdx"],
        confidence: 0.98
      });
    }

    if (artifact.role === "custom-feed" && catalog.objects.every((object) => object.sourcePath !== artifact.path)) {
      return createFinding({
        id: "CATALOG_ARTIFACT_UNRECOGNIZED",
        severity: "P0",
        title: "Custom catalog feed contains no detectable records",
        message: `The artifact ${artifact.path} has root "${artifact.rootKey ?? "unknown"}", but the validator could not find record children inside it.`,
        evidencePath: artifact.path,
        remediation: "Use a wrapper/record shape such as <digital_products><digital_product>...</digital_product></digital_products> or { \"digital_products\": [{ ... }] }.",
        docs: ["indexing/feeds.md"],
        confidence: 0.86
      });
    }

    if (artifact.sourceKind !== "unknown" && artifact.role !== "unknown") return [];

    return createFinding({
      id: "CATALOG_ARTIFACT_UNRECOGNIZED",
      severity: "P0",
      title: "Catalog artifact could not be classified",
      message: `The artifact ${artifact.path} was parsed, but its root shape does not look like a known feed or Content Update payload.`,
      evidencePath: artifact.path,
      remediation: "Provide an XML/JSON feed with a root wrapper and record children such as items/item, products/product, digital_products/digital_product, or any custom type wrapper, or provide a Content Update payload with objects[].",
      docs: ["indexing/feeds.md", "indexing/api/v1/content-update.mdx"],
      confidence: 0.9
    });
  });
}

function validateRequiredFields(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.objects.flatMap((object) => {
    const missing: string[] = [];

    if (!object.identity) missing.push("identity");
    if (!object.title) missing.push(object.role === "content-update" ? "fields.title" : "title");
    if (!object.webUrl) missing.push(object.role === "content-update" ? "fields.web_url" : "web_url");

    if (missing.length === 0) return [];

    return createFinding({
      id: "CATALOG_REQUIRED_FIELDS",
      severity: "P0",
      title: "Catalog object is missing required fields",
      message: `${label(object)} is missing ${missing.join(", ")}.`,
      evidencePath: objectPath(object),
      remediation: "Include stable identity, display title, and canonical web_url for each searchable object.",
      docs: ["indexing/feeds.md", "indexing/data-layout.md", "indexing/api/v1/content-update.mdx"],
      confidence: 0.95
    });
  });
}

function validateXmlMixedElementShapes(catalog: NormalizedCatalog): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const objectsBySource = new Map<string, NormalizedCatalogObject[]>();

  for (const object of catalog.objects) {
    if (object.sourceKind !== "feed-xml" || !isRecord(object.raw)) continue;
    const key = `${object.sourcePath}:${object.role}`;
    objectsBySource.set(key, [...(objectsBySource.get(key) ?? []), object]);
  }

  for (const [sourceKey, objects] of objectsBySource) {
    const shapesByField = new Map<string, Set<string>>();

    for (const object of objects) {
      if (!isRecord(object.raw)) continue;

      for (const [field, rawValue] of Object.entries(object.raw)) {
        if (field.startsWith("@_")) continue;
        const shapes = shapesByField.get(field) ?? new Set<string>();
        for (const shape of xmlValueShapes(rawValue)) {
          shapes.add(shape);
        }
        shapesByField.set(field, shapes);
      }
    }

    for (const [field, shapes] of shapesByField) {
      if (!(shapes.has("primitive") && shapes.has("text-with-attributes"))) continue;

      findings.push(
        createFinding({
          id: "XML_MIXED_ELEMENT_SHAPE",
          severity: "P0",
          title: "XML element is sometimes plain text and sometimes an attributed object",
          message: `${sourceKey} uses <${field}> as both plain text and text with attributes. Feed mappers can traverse one shape and then crash on the other with a primitive/nesting error.`,
          evidencePath: `${sourceKey}.${field}`,
          remediation: `Make <${field}> structurally consistent across all records. If primary category markers are required, every <${field}> occurrence should carry a primary attribute, using primary="true" for the main value and primary="false" for secondary values.`,
          docs: ["indexing/feeds.md"],
          confidence: 0.9
        })
      );
    }
  }

  return findings;
}

function validateXmlPrimaryCategoryMarkers(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.objects.flatMap((object) => {
    if (object.sourceKind !== "feed-xml" || !isProductLikeObject(object) || !isRecord(object.raw)) return [];

    const categories = toArray(object.raw.category);
    if (categories.length <= 1) return [];

    const primaryCount = categories.filter((category) => xmlAttributeValue(category, "primary") === "true").length;
    if (primaryCount === 1) return [];

    return createFinding({
      id: "XML_PRODUCT_CATEGORY_PRIMARY_INVALID",
      severity: "P1",
      title: "Product with multiple category paths does not have exactly one primary category",
      message: `${label(object)} has ${categories.length} category values and ${primaryCount} marked primary="true".`,
      evidencePath: `${objectPath(object)}.category`,
      remediation: "Mark the product's canonical category with primary=\"true\" and all secondary category paths with primary=\"false\".",
      docs: ["indexing/feeds.md", "indexing/data-layout.md"],
      confidence: 0.9
    });
  });
}

function validateIdentityUniqueness(catalog: NormalizedCatalog): ValidationFinding[] {
  const seen = new Map<string, NormalizedCatalogObject>();
  const findings: ValidationFinding[] = [];

  for (const object of catalog.objects) {
    if (!object.identity) continue;

    const first = seen.get(object.identity);
    if (!first) {
      seen.set(object.identity, object);
      continue;
    }

    findings.push(
      createFinding({
        id: "CATALOG_IDENTITY_DUPLICATE",
        severity: "P0",
        area: "identity",
        title: "Catalog identity is reused",
        message: `Identity "${object.identity}" appears in both ${label(first)} and ${label(object)}.`,
        evidencePath: objectPath(object),
        remediation: "Use a unique immutable identity across products, categories, brands, and articles.",
        docs: ["platform-foundations/identity.md", "indexing/feeds.md", "indexing/data-layout.md"],
        confidence: 0.95
      })
    );
  }

  return findings;
}

function validateContentUpdateShape(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.artifacts.flatMap((artifact) => {
    if (artifact.role !== "content-update") return [];

    const findings: ValidationFinding[] = [];
    if (!isRecord(artifact.parsed) || !Array.isArray(artifact.parsed.objects)) return findings;

    if (artifact.parsed.objects.length > 100) {
      findings.push(
        createFinding({
          id: "CONTENT_UPDATE_BATCH_SIZE",
          severity: "P2",
          title: "Content Update batch is larger than recommended",
          message: `${artifact.path} contains ${artifact.parsed.objects.length} objects. The docs recommend around 100 objects per request.`,
          evidencePath: `${artifact.path}:objects`,
          remediation: "Split large Content Update batches into smaller requests.",
          docs: ["indexing/api/v1/content-update.mdx"],
          confidence: 0.9
        })
      );
    }

    findings.push(...validateContentUpdateNestedVariantIdentities(artifact.path, artifact.parsed.objects));

    artifact.parsed.objects.forEach((record, index) => {
      if (!isRecord(record)) {
        findings.push(contentShapeFinding(artifact.path, index, "Object is not a JSON object."));
        return;
      }

      if (!record.type) {
        findings.push(contentShapeFinding(artifact.path, index, "Object is missing required top-level type."));
      }

      if (!isRecord(record.fields)) {
        findings.push(contentShapeFinding(artifact.path, index, "Object is missing required fields object."));
      }

      if ("nested" in record && !Array.isArray(record.nested)) {
        findings.push(contentShapeFinding(artifact.path, index, "nested must be an array when present."));
      }

      if (Array.isArray(record.nested)) {
        findings.push(...validateContentUpdateNestedCategoryUniqueness(artifact.path, index, record.nested));
        findings.push(...validateContentUpdatePrimaryCategoryOrder(artifact.path, index, record));
        findings.push(...validateContentUpdateNestedVariantCount(artifact.path, index, record.nested));

        if (record.nested.length > 10) {
          findings.push(
            createFinding({
              id: "CONTENT_UPDATE_HIGH_NESTED_COUNT",
              severity: "P2",
              title: "Content Update object has many nested records",
              message: `objects[${index}] has ${record.nested.length} nested records. More than 10 is discouraged for performance.`,
              evidencePath: `${artifact.path}:objects[${index}].nested`,
              remediation: "Reduce nested records per object where possible.",
              docs: ["indexing/api/v1/content-update.mdx"],
              confidence: 0.85
            })
          );
        }

        record.nested.forEach((nested, nestedIndex) => {
          if (!isRecord(nested)) {
            findings.push(contentShapeFinding(artifact.path, index, `nested[${nestedIndex}] is not an object.`));
            return;
          }

          for (const key of ["type", "identity", "fields"]) {
            if (!(key in nested)) {
              findings.push(contentShapeFinding(artifact.path, index, `nested[${nestedIndex}] is missing ${key}.`));
            }
          }

          if ("fields" in nested && !isRecord(nested.fields)) {
            findings.push(contentShapeFinding(artifact.path, index, `nested[${nestedIndex}].fields must be an object.`));
          }

          if (stringValue(nested.type)?.toLowerCase() === "category") {
            findings.push(...validateContentUpdateNestedCategory(artifact.path, index, nested, nestedIndex));
          }

          if (stringValue(nested.type)?.toLowerCase() === "variant") {
            findings.push(...validateContentUpdateNestedVariant(artifact.path, index, record, nested, nestedIndex));
          }

          if (isRecord(nested.fields) && "ancestors" in nested.fields && !Array.isArray(nested.fields.ancestors)) {
            findings.push(
              createFinding({
                id: "CONTENT_UPDATE_ANCESTORS_ARRAY",
                severity: "P1",
                title: "Category ancestors should be an array",
                message: `objects[${index}].nested[${nestedIndex}].fields.ancestors exists but is not an array.`,
                evidencePath: `${artifact.path}:objects[${index}].nested[${nestedIndex}].fields.ancestors`,
                remediation: "Represent category ancestors as an ordered array from top-level parent to immediate parent.",
                docs: ["indexing/data-layout.md"],
                confidence: 0.9
              })
            );
          }

          if (isRecord(nested.fields) && Array.isArray(nested.fields.ancestors)) {
            nested.fields.ancestors.forEach((ancestor, ancestorIndex) => {
              findings.push(
                ...validateContentUpdateCategoryAncestor(artifact.path, index, nestedIndex, ancestor, ancestorIndex)
              );
            });
          }
        });
      }
    });

    return findings;
  });
}

interface NestedVariantLocation {
  objectIndex: number;
  nestedIndex: number;
}

function validateContentUpdateNestedVariantIdentities(path: string, objects: unknown[]): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const topLevelIdentities = new Map<string, number>();
  const nestedVariantIdentities = new Map<string, NestedVariantLocation>();

  objects.forEach((record, objectIndex) => {
    if (!isRecord(record)) return;
    const identity = stringValue(record.identity);
    if (identity) topLevelIdentities.set(identity, objectIndex);
  });

  objects.forEach((record, objectIndex) => {
    if (!isRecord(record) || !Array.isArray(record.nested)) return;
    const parentIdentity = stringValue(record.identity);

    record.nested.forEach((nested, nestedIndex) => {
      if (!isRecord(nested) || stringValue(nested.type)?.toLowerCase() !== "variant") return;

      const identity = stringValue(nested.identity);
      if (!identity) {
        findings.push(
          createFinding({
            id: "CONTENT_UPDATE_NESTED_VARIANT_ID_MISSING",
            severity: "P0",
            area: "identity",
            title: "Nested variant is missing identity",
            message: `objects[${objectIndex}].nested[${nestedIndex}] is a variant but has no stable identity.`,
            evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}].identity`,
            remediation: "Give every nested variant a unique immutable identity.",
            docs: ["indexing/data-layout.md", "search/guides/variants.md"],
            confidence: 0.96
          })
        );
        return;
      }

      if (identity === parentIdentity) {
        findings.push(
          createFinding({
            id: "CONTENT_UPDATE_NESTED_VARIANT_ID_EQUALS_PARENT",
            severity: "P0",
            area: "identity",
            title: "Nested variant identity equals parent product identity",
            message: `objects[${objectIndex}].nested[${nestedIndex}] reuses parent identity "${identity}".`,
            evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}].identity`,
            remediation: "Use the parent product identity for the top-level item and a distinct identity for every nested variant.",
            docs: ["indexing/data-layout.md", "platform-foundations/identity.md"],
            confidence: 0.96
          })
        );
      } else {
        const topLevelIndex = topLevelIdentities.get(identity);
        if (topLevelIndex !== undefined) {
          findings.push(
            createFinding({
              id: "CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATES_TOP_LEVEL",
              severity: "P0",
              area: "identity",
              title: "Nested variant identity duplicates a top-level object identity",
              message: `Nested variant identity "${identity}" also appears as objects[${topLevelIndex}].identity.`,
              evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}].identity`,
              remediation: "Nested variant identities must be unique at index level and must not duplicate product, category, brand, or article identities.",
              docs: ["indexing/data-layout.md", "platform-foundations/identity.md"],
              confidence: 0.94
            })
          );
        }
      }

      const firstVariant = nestedVariantIdentities.get(identity);
      if (firstVariant) {
        findings.push(
          createFinding({
            id: "CONTENT_UPDATE_NESTED_VARIANT_ID_DUPLICATE",
            severity: "P0",
            area: "identity",
            title: "Nested variant identity is reused",
            message: `Nested variant identity "${identity}" appears at objects[${firstVariant.objectIndex}].nested[${firstVariant.nestedIndex}] and objects[${objectIndex}].nested[${nestedIndex}].`,
            evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}].identity`,
            remediation: "Give every nested variant a unique identity, even when variants belong to different parent products.",
            docs: ["indexing/data-layout.md", "search/guides/variants.md"],
            confidence: 0.96
          })
        );
      } else {
        nestedVariantIdentities.set(identity, { objectIndex, nestedIndex });
      }
    });
  });

  return findings;
}

function validateContentUpdateNestedCategoryUniqueness(
  path: string,
  objectIndex: number,
  nestedRecords: unknown[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const identities = new Map<string, number>();
  const categoryPaths = new Map<string, number>();

  nestedRecords.forEach((nested, nestedIndex) => {
    if (!isRecord(nested) || stringValue(nested.type)?.toLowerCase() !== "category") return;

    const identity = stringValue(nested.identity);
    if (identity) {
      const firstIndex = identities.get(identity);
      if (firstIndex !== undefined) {
        findings.push(
          createFinding({
            id: "CONTENT_UPDATE_DUPLICATE_NESTED_CATEGORY",
            severity: "P1",
            title: "Content Update product repeats a nested category identity",
            message: `objects[${objectIndex}] repeats nested category identity "${identity}" at nested[${firstIndex}] and nested[${nestedIndex}].`,
            evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}]`,
            remediation: "Send each category path once per product. Repeated category identities can create ambiguous category paths.",
            docs: ["indexing/data-layout.md", "indexing/api/v1/content-update.mdx"],
            confidence: 0.85
          })
        );
      } else {
        identities.set(identity, nestedIndex);
      }
    }

    const categoryPath = contentNestedCategoryPath(nested);
    if (!categoryPath) return;

    const firstPathIndex = categoryPaths.get(categoryPath);
    if (firstPathIndex !== undefined) {
      findings.push(
        createFinding({
          id: "CONTENT_UPDATE_DUPLICATE_NESTED_CATEGORY_PATH",
          severity: "P1",
          title: "Content Update product repeats a nested category path",
          message: `objects[${objectIndex}] repeats nested category path "${categoryPath}" at nested[${firstPathIndex}] and nested[${nestedIndex}].`,
          evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}]`,
          remediation: "Send each category hierarchy once per product.",
          docs: ["indexing/data-layout.md", "indexing/api/v1/content-update.mdx"],
          confidence: 0.85
        })
      );
    } else {
      categoryPaths.set(categoryPath, nestedIndex);
    }
  });

  return findings;
}

function validateContentUpdatePrimaryCategoryOrder(
  path: string,
  objectIndex: number,
  record: Record<string, unknown>
): ValidationFinding[] {
  if (!Array.isArray(record.nested)) return [];

  const nestedCategories = record.nested.filter(
    (nested): nested is Record<string, unknown> =>
      isRecord(nested) && stringValue(nested.type)?.toLowerCase() === "category"
  );
  if (nestedCategories.length <= 1) return [];

  const findings: ValidationFinding[] = [];
  const primaryMarkers = nestedCategories
    .map((category, categoryIndex) => ({ category, categoryIndex, primary: contentPrimaryMarker(category) }))
    .filter((entry) => entry.primary === true);

  if (primaryMarkers.length > 1) {
    findings.push(
      createFinding({
        id: "CONTENT_UPDATE_PRIMARY_CATEGORY_AMBIGUOUS",
        severity: "P1",
        title: "Content Update item has multiple primary category markers",
        message: `objects[${objectIndex}] marks ${primaryMarkers.length} nested categories as primary.`,
        evidencePath: `${path}:objects[${objectIndex}].nested`,
        remediation: "Use nested category order as the primary-category signal, or mark exactly one category as primary and place it first.",
        docs: ["indexing/data-layout.md", "product-listing/api/v1.md"],
        confidence: 0.85
      })
    );
  }

  const markedPrimary = primaryMarkers[0];
  if (markedPrimary && markedPrimary.categoryIndex !== 0) {
    const markedPath = contentNestedCategoryPath(markedPrimary.category) ?? `nested[${markedPrimary.categoryIndex}]`;
    findings.push(
      createFinding({
        id: "CONTENT_UPDATE_PRIMARY_CATEGORY_NOT_FIRST",
        severity: "P1",
        title: "Content Update primary category marker is not first",
        message: `objects[${objectIndex}] marks "${markedPath}" as primary, but category_path uses the first nested category as the primary hierarchy.`,
        evidencePath: `${path}:objects[${objectIndex}].nested[${markedPrimary.categoryIndex}]`,
        remediation: "Move the canonical category hierarchy to nested[0]. Put secondary category hierarchies after it.",
        docs: ["indexing/data-layout.md", "product-listing/api/v1.md"],
        confidence: 0.9
      })
    );
  }

  if (isRecord(record.fields) && "category" in record.fields) {
    const declaredCategoryPaths = categoryPathsFromContentCategoryField(record.fields.category);
    const firstDeclaredPath = declaredCategoryPaths[0];
    const firstNestedPath = contentNestedCategoryPath(nestedCategories[0]!);

    if (firstDeclaredPath && firstNestedPath && firstDeclaredPath !== firstNestedPath) {
      findings.push(
        createFinding({
          id: "CONTENT_UPDATE_PRIMARY_CATEGORY_ORDER_MISMATCH",
          severity: "P1",
          title: "Content Update declared category order disagrees with nested category order",
          message: `objects[${objectIndex}] declares "${firstDeclaredPath}" first in fields.category, but nested[0] resolves to "${firstNestedPath}".`,
          evidencePath: `${path}:objects[${objectIndex}].nested[0]`,
          remediation: "Make the first nested category match the canonical category path, or remove fields.category and rely on nested category order.",
          docs: ["indexing/data-layout.md", "product-listing/api/v1.md"],
          confidence: 0.85
        })
      );
    }
  }

  return findings;
}

function validateContentUpdateNestedVariantCount(
  path: string,
  objectIndex: number,
  nestedRecords: unknown[]
): ValidationFinding[] {
  const variantCount = nestedRecords.filter(
    (nested) => isRecord(nested) && stringValue(nested.type)?.toLowerCase() === "variant"
  ).length;
  if (variantCount <= 10) return [];

  return [
    createFinding({
      id: "CONTENT_UPDATE_HIGH_NESTED_VARIANT_COUNT",
      severity: "P2",
      title: "Product has many nested variants",
      message: `objects[${objectIndex}] has ${variantCount} nested variants. Variant-aware search is recommended for average variant counts below 10.`,
      evidencePath: `${path}:objects[${objectIndex}].nested`,
      remediation: "Keep nested variant counts small, or reconsider whether variant-aware search is the right model for this product family.",
      docs: ["search/guides/variants.md", "quickstart/search/variant-search.md"],
      confidence: 0.86
    })
  ];
}

function validateContentUpdateNestedVariant(
  path: string,
  objectIndex: number,
  parent: Record<string, unknown>,
  nested: Record<string, unknown>,
  nestedIndex: number
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const fields = isRecord(nested.fields) ? nested.fields : undefined;
  const parentType = stringValue(parent.type)?.toLowerCase();
  const evidencePath = `${path}:objects[${objectIndex}].nested[${nestedIndex}]`;

  if (!isProductLikeContentType(parentType)) {
    findings.push(
      createFinding({
        id: "CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE",
        severity: "P1",
        title: "Nested variant is attached to a non-product object",
        message: `objects[${objectIndex}].nested[${nestedIndex}] is a variant, but the parent type is "${parentType ?? "missing"}".`,
        evidencePath,
        remediation: "Attach nested variants only to item/product objects.",
        docs: ["indexing/data-layout.md", "search/guides/variants.md"],
        confidence: 0.88
      })
    );
  }

  if (!fields) return findings;

  if (!stringValue(fields.title)) {
    findings.push(contentNestedVariantFinding(path, objectIndex, nestedIndex, "Nested variant fields.title is missing."));
  }

  if (!stringValue(fields.web_url)) {
    findings.push(contentNestedVariantFinding(path, objectIndex, nestedIndex, "Nested variant fields.web_url is missing."));
  }

  if ("nested" in nested) {
    findings.push(
      createFinding({
        id: "CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING",
        severity: "P1",
        title: "Nested variant contains another nested array",
        message: `objects[${objectIndex}].nested[${nestedIndex}] contains nested children. Content Update should use only one level of nesting.`,
        evidencePath: `${evidencePath}.nested`,
        remediation: "Keep variants one level below the parent product. Do not nest objects inside nested variants.",
        docs: ["indexing/api/v1/content-update.mdx", "indexing/data-layout.md"],
        confidence: 0.9
      })
    );
  }

  if (!hasVariantDistinguishingField(fields)) {
    findings.push(
      createFinding({
        id: "CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING",
        severity: "P2",
        title: "Nested variant has no distinguishing attributes",
        message: `objects[${objectIndex}].nested[${nestedIndex}] does not include a clear variant attribute such as color, size, material, pattern, or style.`,
        evidencePath: `${evidencePath}.fields`,
        remediation: "Add attributes that let users and ranking distinguish variants, such as color, size, material, pattern, style, or color_code.",
        docs: ["indexing/data-layout.md", "indexing/feeds.md"],
        confidence: 0.78
      })
    );
  }

  return findings;
}

function isProductLikeContentType(type: string | undefined): boolean {
  if (!type) return false;
  return !["category", "brand", "article"].includes(type);
}

function validateContentUpdateNestedCategory(
  path: string,
  objectIndex: number,
  nested: Record<string, unknown>,
  nestedIndex: number
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const fields = isRecord(nested.fields) ? nested.fields : undefined;
  if (!fields) return findings;

  if (!stringValue(nested.identity)) {
    findings.push(contentNestedCategoryFinding(path, objectIndex, nestedIndex, "Nested category is missing identity."));
  }

  if (!stringValue(fields.title)) {
    findings.push(contentNestedCategoryFinding(path, objectIndex, nestedIndex, "Nested category fields.title is missing."));
  }

  if (!stringValue(fields.web_url)) {
    findings.push(contentNestedCategoryFinding(path, objectIndex, nestedIndex, "Nested category fields.web_url is missing."));
  }

  return findings;
}

function validateContentUpdateCategoryAncestor(
  path: string,
  objectIndex: number,
  nestedIndex: number,
  ancestor: unknown,
  ancestorIndex: number
): ValidationFinding[] {
  const evidencePath = `${path}:objects[${objectIndex}].nested[${nestedIndex}].fields.ancestors[${ancestorIndex}]`;

  if (!isRecord(ancestor)) {
    return [
      createFinding({
        id: "CONTENT_UPDATE_CATEGORY_ANCESTOR_SHAPE",
        severity: "P1",
        title: "Content Update category ancestor is not an object",
        message: `objects[${objectIndex}].nested[${nestedIndex}].fields.ancestors[${ancestorIndex}] is not an object.`,
        evidencePath,
        remediation: "Each ancestor must be a category object with type, identity, and fields.title.",
        docs: ["indexing/data-layout.md", "indexing/api/v1/content-update.mdx"],
        confidence: 0.9
      })
    ];
  }

  const findings: ValidationFinding[] = [];
  const fields = isRecord(ancestor.fields) ? ancestor.fields : undefined;

  if (stringValue(ancestor.type)?.toLowerCase() !== "category") {
    findings.push(contentAncestorFinding(evidencePath, "Category ancestor type should be category."));
  }

  if (!stringValue(ancestor.identity)) {
    findings.push(contentAncestorFinding(evidencePath, "Category ancestor identity is missing."));
  }

  if (!fields) {
    findings.push(contentAncestorFinding(evidencePath, "Category ancestor fields must be an object."));
    return findings;
  }

  if (!stringValue(fields.title)) {
    findings.push(contentAncestorFinding(evidencePath, "Category ancestor fields.title is missing."));
  }

  if (!stringValue(fields.web_url)) {
    findings.push(contentAncestorFinding(evidencePath, "Category ancestor fields.web_url is missing."));
  }

  return findings;
}

function validateCategoryFeedFlatness(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.objects.flatMap((object) => {
    if (!isCategoryObject(object) || !isRecord(object.raw) || !("category" in object.raw)) return [];

    return createFinding({
      id: "CATEGORY_FEED_NOT_FLAT",
      severity: "P1",
      title: "Category feed contains nested category elements",
      message: `${label(object)} contains a nested category. Category feeds should be flat and use hierarchy for parents.`,
      evidencePath: `${objectPath(object)}.category`,
      remediation: "Move parent path into the hierarchy field instead of nesting category elements inside category elements.",
      docs: ["indexing/feeds.md"],
      confidence: 0.9
    });
  });
}

function validateCategoryPairing(catalog: NormalizedCatalog): ValidationFinding[] {
  const categories = catalog.objects.filter(isCategoryObject);
  const products = catalog.objects.filter(isProductLikeObject);

  if (products.length === 0) return [];

  const independentPairingFindings = validateIndependentCategoryPairing(categories, products);
  const productsWithoutCategoryPaths = products.filter((product) => product.categoryPaths.length === 0);
  const productsWithIndependentPairing = products.filter((product) => fieldValues(product.fields.category_id).length > 0);

  if (products.every((product) => product.categoryPaths.length === 0)) {
    if (productsWithIndependentPairing.length > 0) {
      return [...independentPairingFindings, ...missingProductPairingEvidenceFindings(productsWithoutCategoryPaths)];
    }

    return [
      createFinding({
        id: "CATEGORY_PAIRING_EVIDENCE_MISSING",
        severity: "P1",
        state: "unknown",
        title: "Cannot verify product/category pairing",
        message: "Product category paths, nested category evidence, or category-item pairing fields are missing.",
        evidencePath: "catalog.categoryPaths",
        remediation:
          "Provide feed/nested category paths, or declare category-item pairing with category fields.id and item fields.category_id.",
        docs: ["indexing/feeds.md", "product-listing/guides/pairing.md"],
        confidence: 0.65
      })
    ];
  }

  if (categories.length === 0) {
    const categoryPathsAreSelfContainedContentUpdateEvidence = products.every(
      (product) => product.categoryPaths.length === 0 || product.role === "content-update"
    );
    if (categoryPathsAreSelfContainedContentUpdateEvidence) return [];

    return [
      createFinding({
        id: "CATEGORY_PAIRING_EVIDENCE_MISSING",
        severity: "P1",
        state: "unknown",
        title: "Cannot verify product/category pairing",
        message: "A product feed has category paths, but no category feed evidence is available.",
        evidencePath: "catalog.categoryPaths",
        remediation: "Provide both product feed category paths and a category feed to validate exact hierarchy/title matching.",
        docs: ["indexing/feeds.md"],
        confidence: 0.65
      })
    ];
  }

  const categoryPaths = new Set(
    categories.map((category) => {
      const hierarchy = categoryHierarchyValue(category.fields.hierarchy);
      return normalizeCategoryPath(hierarchy ? `${hierarchy} | ${category.title ?? ""}` : category.title ?? "");
    })
  );

  return [
    ...independentPairingFindings,
    ...missingProductPairingEvidenceFindings(productsWithoutCategoryPaths),
    ...products.flatMap((product) =>
      product.categoryPaths
      .filter((path) => !categoryPaths.has(path))
      .map((path) =>
        createFinding({
          id: "CATEGORY_PAIRING_MISMATCH",
          severity: "P1",
          title: "Product category path does not match category feed",
          message: `${label(product)} references "${path}", but no category feed entry has matching hierarchy + title.`,
          evidencePath: `${objectPath(product)}.category`,
          remediation: "Make product category paths match category feed hierarchy + title exactly, including spelling and delimiters.",
          docs: ["indexing/feeds.md"],
          confidence: 0.9
        })
      )
    )
  ];
}

function missingProductPairingEvidenceFindings(products: NormalizedCatalogObject[]): ValidationFinding[] {
  return products
    .filter((product) => fieldValues(product.fields.category_id).length === 0)
    .map((product) =>
      createFinding({
        id: "CATEGORY_PAIRING_EVIDENCE_MISSING",
        severity: "P1",
        state: "unknown",
        title: "Cannot verify product/category pairing",
        message: `${label(product)} has neither category paths nor fields.category_id pairing evidence.`,
        evidencePath: objectPath(product),
        remediation:
          "Provide nested category evidence for hierarchy filters, or provide fields.category_id that maps to a category fields.id value.",
        docs: ["indexing/data-layout.md", "product-listing/guides/pairing.md"],
        confidence: 0.65
      })
    );
}

function validateIndependentCategoryPairing(
  categories: NormalizedCatalogObject[],
  products: NormalizedCatalogObject[]
): ValidationFinding[] {
  const categoryIds = new Set(categories.flatMap((category) => fieldValues(category.fields.id)));
  const productsWithCategoryIds = products.filter((product) => fieldValues(product.fields.category_id).length > 0);

  if (productsWithCategoryIds.length === 0) return [];

  if (categories.length === 0) {
    return [
      createFinding({
        id: "CATEGORY_PAIRING_EVIDENCE_MISSING",
        severity: "P1",
        state: "unknown",
        title: "Cannot verify category-item pairing",
        message: "Items use fields.category_id, but no category objects are available in the provided evidence.",
        evidencePath: "catalog.categories",
        remediation: "Provide category objects with fields.id values matching item fields.category_id.",
        docs: ["product-listing/guides/pairing.md"],
        confidence: 0.75
      })
    ];
  }

  if (categoryIds.size === 0) {
    return [
      createFinding({
        id: "CATEGORY_PAIRING_FIELD_MISSING",
        severity: "P1",
        title: "Category objects are missing pairing ids",
        message: "Items use fields.category_id, but category objects do not expose fields.id values.",
        evidencePath: "catalog.categories.fields.id",
        remediation: "Add fields.id to category objects, or confirm the configured pairing field.",
        docs: ["product-listing/guides/pairing.md"],
        confidence: 0.85
      })
    ];
  }

  return productsWithCategoryIds.flatMap((product) =>
    fieldValues(product.fields.category_id)
      .filter((categoryId) => !categoryIds.has(categoryId))
      .map((categoryId) =>
        createFinding({
          id: "CATEGORY_PAIRING_MISMATCH",
          severity: "P1",
          title: "Item category_id does not match a category id",
          message: `${label(product)} references category_id "${categoryId}", but no category object has fields.id "${categoryId}".`,
          evidencePath: `${objectPath(product)}.fields.category_id`,
          remediation: "Make item fields.category_id values match category fields.id exactly, including case and type.",
          docs: ["product-listing/guides/pairing.md"],
          confidence: 0.9
        })
      )
  );
}

function validateAvailability(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.objects.flatMap((object) => {
    if (!isProductLikeObject(object)) return [];

    const findings: ValidationFinding[] = [];
    const availability = stringValue(object.fields.availability);
    const availabilityRank = stringValue(object.fields.availability_rank);

    if (availability !== undefined && availability !== "0" && availability !== "1") {
      findings.push(
        createFinding({
          id: "AVAILABILITY_INVALID",
          severity: "P1",
          title: "Availability value is invalid",
          message: `${label(object)} has availability "${availability}". Expected 0 or 1.`,
          evidencePath: `${objectPath(object)}.availability`,
          remediation: "Set availability to 1 for available/orderable products or 0 for unavailable products.",
          docs: ["indexing/feeds.md", "indexing/data-layout.md"],
          confidence: 0.9
        })
      );
    }

    if (availabilityRank !== undefined) {
      const rank = Number(availabilityRank);
      if (!Number.isInteger(rank) || rank < 1 || rank > 15) {
        findings.push(
          createFinding({
            id: "AVAILABILITY_RANK_INVALID",
            severity: "P1",
            title: "Availability rank is outside allowed range",
            message: `${label(object)} has availability_rank "${availabilityRank}". Expected integer from 1 to 15.`,
            evidencePath: `${objectPath(object)}.availability_rank`,
            remediation: "Use availability_rank values from 1 to 15, where 15 means unavailable.",
            docs: ["indexing/feeds.md", "indexing/data-layout.md"],
            confidence: 0.9
          })
        );
      }

      if (availability === "0" && rank !== 15) {
        findings.push(
          createFinding({
            id: "AVAILABILITY_RANK_UNAVAILABLE",
            severity: "P1",
            title: "Unavailable product should use availability_rank 15",
            message: `${label(object)} has availability 0 but availability_rank ${rank}.`,
            evidencePath: `${objectPath(object)}.availability_rank`,
            remediation: "Use availability_rank 15 for unavailable products.",
            docs: ["indexing/feeds.md"],
            confidence: 0.85
          })
        );
      }
    }

    return findings;
  });
}

function validateVariantGroupOrdering(catalog: NormalizedCatalog): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const bySource = new Map<string, NormalizedCatalogObject[]>();

  for (const object of catalog.objects) {
    if (!isProductLikeObject(object) || !object.itemGroupId) continue;
    if (object.sourceKind !== "feed-xml" && object.sourceKind !== "feed-json") continue;
    bySource.set(object.sourcePath, [...(bySource.get(object.sourcePath) ?? []), object]);
  }

  for (const [sourcePath, objects] of bySource) {
    const objectsByGroup = new Map<string, NormalizedCatalogObject[]>();
    for (const object of objects) {
      if (!object.itemGroupId) continue;
      objectsByGroup.set(object.itemGroupId, [...(objectsByGroup.get(object.itemGroupId) ?? []), object]);
    }

    for (const [groupId, groupObjects] of objectsByGroup) {
      const positions = groupObjects.map((object) => object.index);
      const sorted = [...positions].sort((a, b) => a - b);
      const isConsecutive = sorted.every((position, index) => index === 0 || position === sorted[index - 1]! + 1);
      if (!isConsecutive) {
        findings.push(
          createFinding({
            id: "VARIANT_GROUP_NOT_CONSECUTIVE",
            severity: "P1",
            title: "Variant group is not consecutive in feed",
            message: `item_group_id "${groupId}" appears at item positions ${sorted.join(", ")} in ${sourcePath}.`,
            evidencePath: `${sourcePath}:item_group_id=${groupId}`,
            remediation: "List all variants with the same item_group_id consecutively in the feed.",
            docs: ["indexing/feeds.md", "search/guides/variants.md"],
            confidence: 0.95
          })
        );
      }

      if (groupObjects.length === 1) {
        findings.push(
          createFinding({
            id: "VARIANT_GROUP_SINGLETON",
            severity: "P2",
            title: "Variant group contains only one item",
            message: `item_group_id "${groupId}" appears on only one item in ${sourcePath}.`,
            evidencePath: `${sourcePath}:item_group_id=${groupId}`,
            remediation: "Use item_group_id only when at least two variants belong to the same product group, or remove it from standalone products.",
            docs: ["indexing/feeds.md", "search/guides/variants.md"],
            confidence: 0.82
          })
        );
      }

      if (groupObjects.length > 1 && !hasDifferingVariantAttribute(groupObjects)) {
        findings.push(
          createFinding({
            id: "VARIANT_GROUP_DISTINGUISHING_FIELD_MISSING",
            severity: "P2",
            title: "Variant group has no clear distinguishing attribute",
            message: `item_group_id "${groupId}" does not have differing color, size, material, pattern, style, or similar variant attributes.`,
            evidencePath: `${sourcePath}:item_group_id=${groupId}`,
            remediation: "Add variant-specific attributes so users can distinguish variants, for example color, size, material, pattern, style, or color_code.",
            docs: ["indexing/feeds.md"],
            confidence: 0.8
          })
        );
      }

      findings.push(...validateVariantGroupBaseConsistency(sourcePath, groupId, groupObjects));
    }
  }

  return findings;
}

function validateFieldNames(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.objects.flatMap((object) =>
    Object.keys(object.fields)
      .filter((field) => field.includes(".") || field.includes("[") || field.includes("]") || field.includes(" "))
      .map((field) =>
        createFinding({
          id: "FIELD_NAME_DISCOURAGED",
          severity: "P2",
          title: "Field name uses discouraged characters",
          message: `${label(object)} uses field name "${field}".`,
          evidencePath: `${objectPath(object)}.${field}`,
          remediation: "Prefer concise snake_case field names without dots, brackets, or spaces.",
          docs: ["indexing/feeds.md", "indexing/data-layout.md"],
          confidence: 0.75
        })
      )
  );
}

function xmlValueShapes(value: unknown): string[] {
  return toArray(value).map((entry) => {
    if (isRecord(entry) && "#text" in entry && Object.keys(entry).some((key) => key.startsWith("@_"))) {
      return "text-with-attributes";
    }

    if (isRecord(entry)) return "object";
    return "primitive";
  });
}

function categoryHierarchyValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const parts = value.map(stringValue).filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(" | ") : undefined;
  }

  return stringValue(value);
}

function fieldValues(value: unknown): string[] {
  return toArray(value)
    .map(stringValue)
    .filter((entry): entry is string => Boolean(entry));
}

function xmlAttributeValue(value: unknown, attributeName: string): string | undefined {
  if (!isRecord(value)) return undefined;
  return stringValue(value[`@_${attributeName}`])?.toLowerCase();
}

function contentNestedCategoryPath(category: Record<string, unknown>): string | undefined {
  if (!isRecord(category.fields)) return undefined;

  const ancestorTitles = Array.isArray(category.fields.ancestors)
    ? category.fields.ancestors
        .map((ancestor) => (isRecord(ancestor) && isRecord(ancestor.fields) ? stringValue(ancestor.fields.title) : undefined))
        .filter((title): title is string => Boolean(title))
    : [];
  const leafTitle = stringValue(category.fields.title);
  if (!leafTitle) return undefined;

  return normalizeCategoryPath([...ancestorTitles, leafTitle].join(" | "));
}

function contentPrimaryMarker(category: Record<string, unknown>): boolean | undefined {
  const marker = category.primary ?? (isRecord(category.fields) ? category.fields.primary : undefined);
  if (typeof marker === "boolean") return marker;
  if (typeof marker === "number") return marker === 1;
  if (typeof marker === "string") {
    const normalized = marker.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }

  return undefined;
}

function categoryPathsFromContentCategoryField(value: unknown): string[] {
  return toArray(value)
    .map((category) => {
      if (Array.isArray(category)) return category.map(String).join(" | ");
      if (typeof category === "string") return category;
      return undefined;
    })
    .filter((path): path is string => Boolean(path))
    .map(normalizeCategoryPath);
}

function contentNestedCategoryFinding(
  path: string,
  objectIndex: number,
  nestedIndex: number,
  message: string
): ValidationFinding {
  return createFinding({
    id: "CONTENT_UPDATE_NESTED_CATEGORY_SHAPE",
    severity: "P1",
    title: "Content Update nested category is incomplete",
    message,
    evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}]`,
    remediation: "Nested categories should include type, identity, fields.title, fields.web_url, and ordered fields.ancestors when they are not top-level categories.",
    docs: ["indexing/data-layout.md", "indexing/api/v1/content-update.mdx"],
    confidence: 0.9
  });
}

function contentNestedVariantFinding(
  path: string,
  objectIndex: number,
  nestedIndex: number,
  message: string
): ValidationFinding {
  return createFinding({
    id: "CONTENT_UPDATE_NESTED_VARIANT_SHAPE",
    severity: "P1",
    title: "Content Update nested variant is incomplete",
    message,
    evidencePath: `${path}:objects[${objectIndex}].nested[${nestedIndex}]`,
    remediation: "Nested variants should include type variant, unique identity, fields.title, fields.web_url, and distinguishing fields such as color or size.",
    docs: ["indexing/data-layout.md", "search/guides/variants.md"],
    confidence: 0.9
  });
}

function contentAncestorFinding(evidencePath: string, message: string): ValidationFinding {
  return createFinding({
    id: "CONTENT_UPDATE_CATEGORY_ANCESTOR_SHAPE",
    severity: "P1",
    title: "Content Update category ancestor is incomplete",
    message,
    evidencePath,
    remediation: "Each category ancestor should have type category, a stable identity, and fields with title and web_url.",
    docs: ["indexing/data-layout.md", "indexing/api/v1/content-update.mdx"],
    confidence: 0.9
  });
}

function contentShapeFinding(path: string, index: number, message: string): ValidationFinding {
  return createFinding({
    id: "CONTENT_UPDATE_SHAPE_INVALID",
    severity: "P0",
    title: "Content Update object shape is invalid",
    message,
    evidencePath: `${path}:objects[${index}]`,
    remediation: "Content Update payloads must contain objects[] where each object has identity, type, and fields with title.",
    docs: ["indexing/api/v1/content-update.mdx", "indexing/data-layout.md"],
    confidence: 0.9
  });
}

function parseErrorTitle(parseError: string): string {
  if (parseError.includes("HTML document")) {
    return "URL or file returned an HTML page instead of a feed";
  }

  if (parseError.includes("boolean attribute")) {
    return "XML contains an HTML-style boolean attribute";
  }

  return "Catalog artifact could not be parsed";
}

function parseErrorRemediation(parseError: string): string {
  if (parseError.includes("HTML document")) {
    return "Use a direct feed or download URL that returns XML or JSON, not an HTML page, repository viewer, login screen, dashboard page, or redirect target.";
  }

  const booleanAttributeMatch = parseError.match(/boolean attribute '([^']+)' is not allowed/);
  if (booleanAttributeMatch) {
    const attributeName = booleanAttributeMatch[1];
    return `XML requires every attribute to have a value. Replace ${attributeName} with ${attributeName}="anonymous" or ${attributeName}="" where appropriate, or wrap raw HTML snippets in CDATA.`;
  }

  return "Fix the XML/JSON syntax before validating catalog semantics. If a field contains HTML, escape it or wrap it in CDATA.";
}

function label(object: NormalizedCatalogObject): string {
  const identity = object.identity ? ` "${object.identity}"` : "";
  return `${object.objectType}${identity} at ${object.sourcePath}[${object.index}]`;
}

function objectPath(object: NormalizedCatalogObject): string {
  const scope = object.role === "custom-feed" ? object.objectType : object.role;
  return `${object.sourcePath}:${scope}[${object.index}]`;
}

const variantDistinguishingFields = [
  "color",
  "colour",
  "color_code",
  "size",
  "material",
  "pattern",
  "style",
  "variant",
  "variant_name",
  "variant_title"
];

function hasVariantDistinguishingField(fields: Record<string, unknown>): boolean {
  return variantDistinguishingFields.some((field) => comparableFieldValue(fields[field]) !== undefined);
}

function hasDifferingVariantAttribute(objects: NormalizedCatalogObject[]): boolean {
  return variantDistinguishingFields.some((field) => {
    const values = new Set(objects.map((object) => comparableFieldValue(object.fields[field])).filter(Boolean));
    return values.size > 1;
  });
}

function validateVariantGroupBaseConsistency(
  sourcePath: string,
  groupId: string,
  objects: NormalizedCatalogObject[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  const brandValues = new Set(objects.map((object) => comparableFieldValue(object.fields.brand) ?? "__missing__"));
  if (brandValues.size > 1) {
    findings.push(
      createFinding({
        id: "VARIANT_GROUP_BRAND_INCONSISTENT",
        severity: "P1",
        title: "Variant group has inconsistent brand values",
        message: `item_group_id "${groupId}" has variants with different brand values in ${sourcePath}.`,
        evidencePath: `${sourcePath}:item_group_id=${groupId}.brand`,
        remediation: "Keep stable base attributes such as brand consistent across variants in the same item_group_id.",
        docs: ["indexing/feeds.md"],
        confidence: 0.86
      })
    );
  }

  const primaryCategoryPaths = new Set(
    objects.map((object) => object.categoryPaths[0] ?? "__missing__").filter((path) => path !== "__missing__")
  );
  if (primaryCategoryPaths.size > 1) {
    findings.push(
      createFinding({
        id: "VARIANT_GROUP_CATEGORY_INCONSISTENT",
        severity: "P1",
        title: "Variant group has inconsistent primary categories",
        message: `item_group_id "${groupId}" has variants with different primary category paths in ${sourcePath}.`,
        evidencePath: `${sourcePath}:item_group_id=${groupId}.category`,
        remediation: "Keep stable base attributes such as primary category consistent across variants in the same item_group_id.",
        docs: ["indexing/feeds.md"],
        confidence: 0.86
      })
    );
  }

  return findings;
}

function comparableFieldValue(value: unknown): string | undefined {
  const scalar = stringValue(value);
  if (scalar) return scalar.toLowerCase();

  if (Array.isArray(value)) {
    const parts = value.map(stringValue).filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join("|").toLowerCase() : undefined;
  }

  return undefined;
}
