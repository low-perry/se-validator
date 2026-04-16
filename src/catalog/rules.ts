import { createFinding } from "../core/findings.js";
import type { ValidationFinding } from "../core/types.js";
import { isRecord } from "./detect.js";
import {
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
        title: parseErrorTitle(artifact.parseError, artifact.path),
        message: artifact.parseError,
        evidencePath: artifact.path,
        remediation: parseErrorRemediation(artifact.parseError, artifact.path),
        docs: ["indexing/feeds.md", "indexing/api/v1/content-update.mdx"],
        confidence: 0.98
      });
    }

    if (artifact.sourceKind !== "unknown" && artifact.role !== "unknown") return [];

    return createFinding({
      id: "CATALOG_ARTIFACT_UNRECOGNIZED",
      severity: "P0",
      title: "Catalog artifact could not be classified",
      message: `The artifact ${artifact.path} was parsed, but its root shape does not look like a known feed or Content Update payload.`,
      evidencePath: artifact.path,
      remediation: "Provide an XML/JSON feed with a recognized root such as items, products, categories, brands, articles, or a Content Update payload with objects[].",
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
          remediation: `Make <${field}> structurally consistent across all records. For a simple sample feed, remove attributes like primary="true" from <${field}>. If attributes are required, use the same attribute structure for every occurrence or confirm the importer mapping supports mixed XML element shapes.`,
          docs: ["indexing/feeds.md"],
          confidence: 0.9
        })
      );
    }
  }

  return findings;
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
        });
      }
    });

    return findings;
  });
}

function validateCategoryFeedFlatness(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.objects.flatMap((object) => {
    if (object.objectType !== "category" || !isRecord(object.raw) || !("category" in object.raw)) return [];

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
  const categories = catalog.objects.filter((object) => object.objectType === "category");
  const products = catalog.objects.filter((object) => object.objectType === "product");

  if (products.length === 0) return [];

  if (categories.length === 0 || products.every((product) => product.categoryPaths.length === 0)) {
    return [
      createFinding({
        id: "CATEGORY_PAIRING_EVIDENCE_MISSING",
        severity: "P1",
        state: "unknown",
        title: "Cannot verify product/category pairing",
        message: "Product category paths or category feed evidence is missing.",
        evidencePath: "catalog.categoryPaths",
        remediation: "Provide both product feed category paths and a category feed to validate exact hierarchy/title matching.",
        docs: ["indexing/feeds.md"],
        confidence: 0.65
      })
    ];
  }

  const categoryPaths = new Set(
    categories.map((category) => {
      const hierarchy = stringValue(category.fields.hierarchy);
      return normalizeCategoryPath(hierarchy ? `${hierarchy} | ${category.title ?? ""}` : category.title ?? "");
    })
  );

  return products.flatMap((product) =>
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
  );
}

function validateAvailability(catalog: NormalizedCatalog): ValidationFinding[] {
  return catalog.objects.flatMap((object) => {
    if (object.objectType !== "product" && object.objectType !== "content-object") return [];

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
    if (object.objectType !== "product" || !object.itemGroupId) continue;
    bySource.set(object.sourcePath, [...(bySource.get(object.sourcePath) ?? []), object]);
  }

  for (const [sourcePath, objects] of bySource) {
    const positionsByGroup = new Map<string, number[]>();
    for (const object of objects) {
      if (!object.itemGroupId) continue;
      positionsByGroup.set(object.itemGroupId, [...(positionsByGroup.get(object.itemGroupId) ?? []), object.index]);
    }

    for (const [groupId, positions] of positionsByGroup) {
      const sorted = [...positions].sort((a, b) => a - b);
      const isConsecutive = sorted.every((position, index) => index === 0 || position === sorted[index - 1]! + 1);
      if (isConsecutive) continue;

      findings.push(
        createFinding({
          id: "VARIANT_GROUP_NOT_CONSECUTIVE",
          severity: "P1",
          title: "Variant group is not consecutive in feed",
          message: `item_group_id "${groupId}" appears at item positions ${sorted.join(", ")} in ${sourcePath}.`,
          evidencePath: `${sourcePath}:item_group_id=${groupId}`,
          remediation: "List all variants with the same item_group_id consecutively in the feed.",
          docs: ["indexing/feeds.md"],
          confidence: 0.95
        })
      );
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

function parseErrorTitle(parseError: string, path: string): string {
  if (looksLikeGithubBlobUrl(path)) {
    return "GitHub page URL was parsed instead of the raw feed file";
  }

  if (parseError.includes("boolean attribute")) {
    return "XML contains an HTML-style boolean attribute";
  }

  return "Catalog artifact could not be parsed";
}

function parseErrorRemediation(parseError: string, path: string): string {
  if (looksLikeGithubBlobUrl(path)) {
    return "Use the raw GitHub file URL, not the GitHub blob/page URL. Change https://github.com/<org>/<repo>/blob/<branch>/<path> to https://raw.githubusercontent.com/<org>/<repo>/<branch>/<path>, or open the file on GitHub and copy the Raw link.";
  }

  const booleanAttributeMatch = parseError.match(/boolean attribute '([^']+)' is not allowed/);
  if (booleanAttributeMatch) {
    const attributeName = booleanAttributeMatch[1];
    return `XML requires every attribute to have a value. Replace ${attributeName} with ${attributeName}="anonymous" or ${attributeName}="" where appropriate, or wrap raw HTML snippets in CDATA.`;
  }

  return "Fix the XML/JSON syntax before validating catalog semantics. If a field contains HTML, escape it or wrap it in CDATA.";
}

function looksLikeGithubBlobUrl(path: string): boolean {
  return path.startsWith("https://github.com/") && path.includes("/blob/");
}

function label(object: NormalizedCatalogObject): string {
  const identity = object.identity ? ` "${object.identity}"` : "";
  return `${object.objectType}${identity} at ${object.sourcePath}[${object.index}]`;
}

function objectPath(object: NormalizedCatalogObject): string {
  return `${object.sourcePath}:${object.role}[${object.index}]`;
}
