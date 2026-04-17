import { resolve } from "node:path";
import type { ValidationFinding } from "../core/types.js";
import { createFinding, scoreFindings, summarizeFindings, type FindingInput } from "../core/findings.js";
import { isRecord } from "../catalog/detect.js";
import { normalizeCatalog, stringValue, toArray, type NormalizedCatalogObject } from "../catalog/normalize.js";
import { parseCatalogArtifacts } from "../catalog/parse.js";
import {
  defaultCatalogValidationProfile,
  summarizeCatalogValidationProfile,
  type CatalogValidationProfile
} from "../catalog/profile.js";
import { validateCatalog } from "../catalog/validate.js";
import { findRelevantDocs } from "./docs.js";
import { locateCatalogEvidence } from "./evidence.js";
import type { AgentCatalogReview, AgentCatalogReviewOptions, CatalogStructureSummary } from "./types.js";

const variantFields = ["color", "colour", "color_code", "size", "material", "pattern", "style", "variant"];

export async function reviewCatalog(paths: string[], options: AgentCatalogReviewOptions): Promise<AgentCatalogReview> {
  const artifacts = await parseCatalogArtifacts(paths);
  const catalog = normalizeCatalog(artifacts);
  const profile = options.profile ?? defaultCatalogValidationProfile();
  const baseValidation = await validateCatalog(paths);
  const structures = artifacts.map((artifact) =>
    summarizeCatalogStructure(
      artifact.path,
      artifact.sourceKind,
      artifact.role,
      artifact.rootKey,
      artifact.confidence,
      artifact.parseError,
      catalog.objects.filter((object) => object.sourcePath === artifact.path)
    )
  );
  const profileFindings = options.profile ? validateCatalogProfile(catalog.objects, structures, profile) : [];
  const validation = {
    ...baseValidation,
    findings: [...baseValidation.findings, ...profileFindings],
    score: scoreFindings([...baseValidation.findings, ...profileFindings]),
    summary: summarizeFindings([...baseValidation.findings, ...profileFindings])
  };
  const evidence = await locateCatalogEvidence(paths, validation.findings);
  const docsHits = await findRelevantDocs({
    docsRoot: options.docsRoot,
    service: "catalog",
    findings: validation.findings,
    capabilities: structures.flatMap((structure) => [
      structure.sourceKind,
      structure.role,
      ...structure.categoryModel,
      ...structure.contentUpdateModel,
      ...structure.variantModel,
      ...structure.pairingModel
    ]),
    maxDocs: options.maxDocs
  });

  return {
    title: "Agent Catalog Review Report",
    generatedAt: new Date().toISOString(),
    docsRoot: resolve(options.docsRoot),
    inputs: paths.map((path) => resolve(path)),
    validation,
    profile: summarizeCatalogValidationProfile(profile),
    structures,
    evidence,
    docsHits,
    nextActions: buildCatalogNextActions(validation.findings, structures),
    promptForFollowUp: buildCatalogFollowUpPrompt(paths, options, validation.findings, structures, profile)
  };
}

export function formatAgentCatalogReview(review: AgentCatalogReview): string {
  const lines: string[] = [];

  lines.push(`# ${review.title}`);
  lines.push("");
  lines.push(`Generated: ${review.generatedAt}`);
  lines.push(`Docs root: ${review.docsRoot}`);
  lines.push(`Profile: ${review.profile}`);
  lines.push(`Score: ${review.validation.score}/100`);
  lines.push(
    `Findings: P0=${review.validation.summary.P0} P1=${review.validation.summary.P1} P2=${review.validation.summary.P2}`
  );

  lines.push("");
  lines.push("## Inputs Reviewed");
  for (const input of review.inputs) {
    lines.push(`- ${input}`);
  }

  lines.push("");
  lines.push("## Detected Artifacts");
  for (const artifact of review.validation.artifacts) {
    lines.push(`- ${artifact}`);
  }

  lines.push("");
  lines.push("## Inferred Catalog Structures");
  for (const structure of review.structures) {
    lines.push("");
    lines.push(`### ${structure.path}`);
    lines.push(`Format: ${structure.sourceKind}`);
    lines.push(`Role: ${structure.role}`);
    if (structure.rootKey) lines.push(`Root: ${structure.rootKey}`);
    lines.push(`Records: ${structure.recordCount}`);
    if (structure.parseError) lines.push(`Parse error: ${structure.parseError}`);
    lines.push(`Object counts: ${formatRecord(structure.objectCounts)}`);
    lines.push(`Required coverage: identity ${structure.requiredCoverage.identity}, title ${structure.requiredCoverage.title}, web_url ${structure.requiredCoverage.webUrl}`);
    lines.push(`Common fields: ${structure.fieldCoverage.join(", ") || "none"}`);
    pushStructureList(lines, "Category model", structure.categoryModel);
    pushStructureList(lines, "Content Update model", structure.contentUpdateModel);
    pushStructureList(lines, "Variant model", structure.variantModel);
    pushStructureList(lines, "Pairing model", structure.pairingModel);
    pushStructureList(lines, "Examples", structure.examples);
  }

  lines.push("");
  lines.push("## Review Findings");
  if (review.validation.findings.length === 0) {
    lines.push("No findings. The catalog evidence passes the current deterministic rule set.");
  } else {
    for (const finding of sortedFindings(review.validation.findings)) {
      lines.push("");
      lines.push(`### ${finding.severity} ${finding.id}`);
      lines.push(`State: ${finding.state}`);
      lines.push(`Area: ${finding.area}`);
      lines.push(`Evidence: ${finding.evidencePath}`);
      lines.push(`Problem: ${finding.message}`);
      lines.push(`Recommended fix: ${finding.remediation}`);
      const evidence = review.evidence.find(
        (candidate) => candidate.findingId === finding.id && candidate.evidencePath === finding.evidencePath
      );
      if (evidence) {
        lines.push(`Likely code: ${evidence.path}:${evidence.line}`);
        lines.push(`Snippet: \`${evidence.snippet}\``);
      }
      lines.push(`Docs: ${finding.docs.join(", ")}`);
      lines.push(`Confidence: ${finding.confidence}`);
    }
  }

  lines.push("");
  lines.push("## Docs Consulted");
  if (review.docsHits.length === 0) {
    lines.push("No local docs were found for this review. Check the --docs path.");
  } else {
    for (const hit of review.docsHits) {
      const slug = hit.slug ? ` (${hit.slug})` : "";
      lines.push("");
      lines.push(`- ${hit.title}${slug}: ${hit.path}:${hit.line}`);
      lines.push(`  Reason: ${hit.reason}`);
      if (hit.heading) lines.push(`  Section: ${hit.heading}`);
      lines.push(`  Matched: ${hit.matchedTerms.join(", ") || "path/reference"}`);
      lines.push(`  Excerpt: ${hit.excerpt}`);
    }
  }

  lines.push("");
  lines.push("## Next Actions");
  for (const action of review.nextActions) {
    lines.push(`- ${action}`);
  }

  lines.push("");
  lines.push("## Follow-up Prompt");
  lines.push("Use this prompt if you want another AI to continue the review with the same framing:");
  lines.push("");
  lines.push("```text");
  lines.push(review.promptForFollowUp);
  lines.push("```");

  return lines.join("\n");
}

function summarizeCatalogStructure(
  path: string,
  sourceKind: string,
  role: string,
  rootKey: string | undefined,
  confidence: number,
  parseError: string | undefined,
  objects: NormalizedCatalogObject[]
): CatalogStructureSummary {
  const fieldCounts = countFields(objects);
  const categoryModel = summarizeCategoryModel(objects);
  const contentUpdateModel = summarizeContentUpdateModel(objects);
  const variantModel = summarizeVariantModel(objects);
  const pairingModel = summarizePairingModel(objects);

  return {
    path,
    sourceKind,
    role,
    rootKey,
    confidence,
    parseError,
    recordCount: objects.length,
    objectCounts: countBy(objects.map((object) => object.objectType)),
    requiredCoverage: {
      identity: coverage(objects, (object) => Boolean(object.identity)),
      title: coverage(objects, (object) => Boolean(object.title)),
      webUrl: coverage(objects, (object) => Boolean(object.webUrl))
    },
    fieldCoverage: [...fieldCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 14)
      .map(([field, count]) => `${field} ${count}/${objects.length}`),
    categoryModel,
    contentUpdateModel,
    variantModel,
    pairingModel,
    examples: objects.slice(0, 5).map(exampleObject)
  };
}

function summarizeCategoryModel(objects: NormalizedCatalogObject[]): string[] {
  if (objects.length === 0) return ["No objects parsed."];

  const products = objects.filter((object) => object.objectType === "product");
  const categories = objects.filter((object) => object.objectType === "category");
  const productsWithPaths = products.filter((product) => product.categoryPaths.length > 0);
  const productsWithMultiplePaths = products.filter((product) => product.categoryPaths.length > 1);
  const categoryPathCount = products.reduce((total, product) => total + product.categoryPaths.length, 0);
  const models: string[] = [];

  if (categories.length > 0) {
    const hierarchyCount = categories.filter((category) => "hierarchy" in category.fields).length;
    models.push(`${categories.length} independently indexed categories; ${hierarchyCount} include hierarchy.`);
  }

  if (products.length > 0) {
    models.push(`${productsWithPaths.length}/${products.length} products expose category paths.`);
    models.push(`${productsWithMultiplePaths.length}/${products.length} products belong to multiple category hierarchies.`);
    models.push(`${categoryPathCount} total product category path references.`);
  }

  if (models.length === 0) models.push("No product/category hierarchy evidence found.");
  return models;
}

function summarizeContentUpdateModel(objects: NormalizedCatalogObject[]): string[] {
  const contentObjects = objects.filter((object) => object.role === "content-update");
  if (contentObjects.length === 0) return ["Not a Content Update payload."];

  let objectsWithNested = 0;
  let nestedCategories = 0;
  let nestedVariants = 0;
  let maxNested = 0;
  let ancestorRecords = 0;

  for (const object of contentObjects) {
    if (!isRecord(object.raw) || !Array.isArray(object.raw.nested)) continue;

    objectsWithNested += 1;
    maxNested = Math.max(maxNested, object.raw.nested.length);

    for (const nested of object.raw.nested) {
      if (!isRecord(nested)) continue;
      const type = stringValue(nested.type)?.toLowerCase();
      if (type === "category") {
        nestedCategories += 1;
        if (isRecord(nested.fields) && Array.isArray(nested.fields.ancestors)) {
          ancestorRecords += nested.fields.ancestors.length;
        }
      }
      if (type === "variant") nestedVariants += 1;
    }
  }

  return [
    `${contentObjects.length} top-level Content Update objects.`,
    `${objectsWithNested} objects have nested records; max nested count is ${maxNested}.`,
    `${nestedCategories} nested categories with ${ancestorRecords} ancestor records.`,
    `${nestedVariants} nested variants.`
  ];
}

function summarizeVariantModel(objects: NormalizedCatalogObject[]): string[] {
  const products = objects.filter((object) => object.objectType === "product");
  const grouped = new Map<string, NormalizedCatalogObject[]>();
  let nestedVariantCount = 0;

  for (const product of products) {
    if (product.itemGroupId) grouped.set(product.itemGroupId, [...(grouped.get(product.itemGroupId) ?? []), product]);
    if (isRecord(product.raw) && Array.isArray(product.raw.nested)) {
      nestedVariantCount += product.raw.nested.filter(
        (nested) => isRecord(nested) && stringValue(nested.type)?.toLowerCase() === "variant"
      ).length;
    }
  }

  const variantFieldsFound = variantFields.filter((field) => products.some((product) => product.fields[field] !== undefined));
  const models: string[] = [];
  if (grouped.size > 0) {
    const groupSizes = [...grouped.values()].map((group) => group.length).sort((left, right) => right - left);
    models.push(`${grouped.size} item_group_id groups; largest group has ${groupSizes[0] ?? 0} records.`);
  }
  if (nestedVariantCount > 0) models.push(`${nestedVariantCount} nested variants in Content Update objects.`);
  if (variantFieldsFound.length > 0) models.push(`Variant distinguishing fields observed: ${variantFieldsFound.join(", ")}.`);
  if (models.length === 0) models.push("No variant grouping or nested variant evidence found.");
  return models;
}

function summarizePairingModel(objects: NormalizedCatalogObject[]): string[] {
  const products = objects.filter((object) => object.objectType === "product");
  const categories = objects.filter((object) => object.objectType === "category");
  const productsWithCategoryIds = products.filter((product) => fieldValues(product.fields.category_id).length > 0);
  const categoriesWithIds = categories.filter((category) => fieldValues(category.fields.id).length > 0);
  const models: string[] = [];

  if (productsWithCategoryIds.length > 0 || categoriesWithIds.length > 0) {
    models.push(`${productsWithCategoryIds.length}/${products.length} products use category_id pairing fields.`);
    models.push(`${categoriesWithIds.length}/${categories.length} categories expose id pairing fields.`);
  }

  if (products.some((product) => product.categoryPaths.length > 0)) {
    models.push("Product/category relationship is also expressed through category paths.");
  }

  if (models.length === 0) models.push("No category_id pairing evidence found.");
  return models;
}

function validateCatalogProfile(
  objects: NormalizedCatalogObject[],
  structures: CatalogStructureSummary[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  return [
    ...validateProfileSource(structures, profile),
    ...validateProfileObjectTypes(objects, profile),
    ...validateProfileRequiredFields(objects, profile),
    ...validateProfileIdentityField(objects, profile),
    ...validateProfileCategoryModel(objects, profile),
    ...validateProfileVariantModel(objects, profile),
    ...validateProfileMultipleHierarchies(objects, profile),
    ...validateProfilePrimaryCategory(objects, profile)
  ];
}

function validateProfileSource(
  structures: CatalogStructureSummary[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  if (profile.expectedSource === "auto") return [];

  return structures
    .filter((structure) => structure.sourceKind !== profile.expectedSource)
    .map((structure) =>
      profileFinding({
        id: "CATALOG_PROFILE_SOURCE_MISMATCH",
        severity: "P1",
        title: "Catalog evidence source does not match profile",
        message: `${structure.path} is ${structure.sourceKind}, but the profile expects ${profile.expectedSource}.`,
        evidencePath: structure.path,
        remediation: "Review the intended indexing path. Either provide evidence in the expected format or update the catalog profile.",
        docs: ["indexing/feeds.md", "indexing/api/v1/content-update.mdx"],
        confidence: 0.9
      })
    );
}

function validateProfileObjectTypes(
  objects: NormalizedCatalogObject[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  if (profile.expectedObjectTypes.length === 0) return findings;

  const actualTypes = new Set(objects.map((object) => object.objectType));
  const expectedTypes = new Set(profile.expectedObjectTypes.map(profileObjectType));

  for (const expectedType of expectedTypes) {
    if (actualTypes.has(expectedType)) continue;

    findings.push(
      profileFinding({
        id: "CATALOG_PROFILE_OBJECT_TYPE_MISSING",
        severity: "P1",
        title: "Expected object type is missing",
        message: `The profile expects ${expectedType} objects, but none were found in the provided evidence.`,
        evidencePath: "catalog.objects",
        remediation: `Provide ${expectedType} objects or remove this type from expectedObjectTypes.`,
        docs: ["indexing/data-layout.md", "indexing/feeds.md", "indexing/api/v1/content-update.mdx"],
        confidence: 0.85
      })
    );
  }

  for (const actualType of actualTypes) {
    if (expectedTypes.has(actualType)) continue;

    findings.push(
      profileFinding({
        id: "CATALOG_PROFILE_OBJECT_TYPE_UNEXPECTED",
        severity: "P2",
        title: "Catalog evidence contains object type not declared in profile",
        message: `The evidence contains ${actualType} objects, but expectedObjectTypes is ${[...expectedTypes].join(", ")}.`,
        evidencePath: "catalog.objects",
        remediation: "Update expectedObjectTypes if this object type is intentional, or remove the unintended objects from the evidence.",
        docs: ["indexing/data-layout.md"],
        confidence: 0.75
      })
    );
  }

  return findings;
}

function validateProfileRequiredFields(
  objects: NormalizedCatalogObject[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  return objects.flatMap((object) => {
    const requiredFields = requiredFieldsForObject(object, profile);
    const missing = requiredFields.filter((field) => !objectHasField(object, field));
    if (missing.length === 0) return [];

    return profileFinding({
      id: "CATALOG_PROFILE_REQUIRED_FIELD_MISSING",
      severity: missing.some((field) => ["identity", "title", "web_url"].includes(field)) ? "P0" : "P1",
      title: "Catalog object is missing a profile-required field",
      message: `${objectLabel(object)} is missing profile-required field(s): ${missing.join(", ")}.`,
      evidencePath: objectPath(object),
      remediation: `Add ${missing.join(", ")} to this ${object.objectType}, or update requiredFieldsByType if the field is not required for this integration.`,
      docs: ["indexing/data-layout.md", "indexing/feeds.md", "indexing/api/v1/content-update.mdx"],
      confidence: 0.9
    });
  });
}

function validateProfileIdentityField(
  objects: NormalizedCatalogObject[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  const identityField = profile.identity.immutableIdentityField;
  if (identityField === "identity") return [];

  return objects
    .filter((object) => !objectHasField(object, identityField))
    .map((object) =>
      profileFinding({
        id: "CATALOG_PROFILE_IDENTITY_FIELD_MISSING",
        severity: "P1",
        area: "identity",
        title: "Profile identity field is not present on object",
        message: `${objectLabel(object)} does not expose the configured immutable identity field "${identityField}".`,
        evidencePath: objectPath(object),
        remediation: `Add ${identityField} to all indexed objects, or set identity.immutableIdentityField to the field actually used as stable identity.`,
        docs: ["platform-foundations/identity.md", "indexing/data-layout.md"],
        confidence: 0.85
      })
    );
}

function validateProfileCategoryModel(
  objects: NormalizedCatalogObject[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  const products = objects.filter((object) => object.objectType === "product");
  const categories = objects.filter((object) => object.objectType === "category");
  const productsWithCategoryPaths = products.filter((product) => product.categoryPaths.length > 0);
  const productsWithNestedCategories = products.filter((product) => nestedRecordsOfType(product, "category").length > 0);
  const productsWithCategoryIds = products.filter((product) => fieldValues(product.fields.category_id).length > 0);
  const categoriesWithIds = categories.filter((category) => fieldValues(category.fields.id).length > 0);
  const findings: ValidationFinding[] = [];

  if (profile.categoryModel === "auto") return [];

  if (profile.categoryModel === "none") {
    if (productsWithCategoryPaths.length > 0 || productsWithNestedCategories.length > 0 || productsWithCategoryIds.length > 0 || categories.length > 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_CATEGORY_MODEL_UNEXPECTED",
          severity: "P2",
          title: "Profile says no category model is expected, but category evidence exists",
          message: "The evidence contains category paths, nested categories, category_id pairing, or independently indexed categories.",
          evidencePath: "catalog.categories",
          remediation: "Set categoryModel to the intended category strategy, or remove category evidence if this integration should not support categories.",
          docs: ["indexing/data-layout.md", "indexing/feeds.md"],
          confidence: 0.8
        })
      );
    }
    return findings;
  }

  if (profile.categoryModel === "category_paths" && products.some((product) => product.categoryPaths.length === 0)) {
    findings.push(
      profileFinding({
        id: "CATALOG_PROFILE_CATEGORY_PATHS_MISSING",
        severity: "P1",
        title: "Profile expects product category paths",
        message: `${products.length - productsWithCategoryPaths.length}/${products.length} products do not expose category path evidence.`,
        evidencePath: "catalog.products.category",
        remediation: "Add category paths to every product, or choose a different categoryModel such as independent_categories_with_pairing.",
        docs: ["indexing/feeds.md", "indexing/data-layout.md"],
        confidence: 0.88
      })
    );
  }

  if (profile.categoryModel === "nested_categories" && productsWithNestedCategories.length === 0) {
    findings.push(
      profileFinding({
        id: "CATALOG_PROFILE_NESTED_CATEGORIES_MISSING",
        severity: "P1",
        title: "Profile expects nested categories",
        message: "No product has Content Update nested category records.",
        evidencePath: "catalog.products.nested",
        remediation: "Embed category objects in each item's nested array, or choose the profile category model that matches the actual integration.",
        docs: ["indexing/api/v1/content-update.mdx", "indexing/data-layout.md"],
        confidence: 0.88
      })
    );
  }

  if (profile.categoryModel === "independent_categories_with_pairing") {
    if (productsWithCategoryIds.length === 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_CATEGORY_PAIRING_ITEM_FIELD_MISSING",
          severity: "P1",
          title: "Profile expects item/category pairing, but items lack category_id",
          message: "No product exposes fields.category_id values.",
          evidencePath: "catalog.products.fields.category_id",
          remediation: "Add category_id to products so it can match category id fields, or choose a different categoryModel.",
          docs: ["product-listing/guides/pairing.md", "indexing/data-layout.md"],
          confidence: 0.88
        })
      );
    }

    if (categoriesWithIds.length === 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_CATEGORY_PAIRING_CATEGORY_FIELD_MISSING",
          severity: "P1",
          title: "Profile expects item/category pairing, but categories lack id",
          message: "No category exposes fields.id values.",
          evidencePath: "catalog.categories.fields.id",
          remediation: "Add id to category objects so product category_id values can match it, or choose a different categoryModel.",
          docs: ["product-listing/guides/pairing.md", "indexing/data-layout.md"],
          confidence: 0.88
        })
      );
    }
  }

  if (profile.categoryModel === "independent_categories_with_matching_hierarchy") {
    const categoriesWithHierarchy = categories.filter((category) => "hierarchy" in category.fields).length;
    if (categories.length === 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_INDEPENDENT_CATEGORIES_MISSING",
          severity: "P1",
          title: "Profile expects independent category objects",
          message: "No category objects were found.",
          evidencePath: "catalog.categories",
          remediation: "Provide a category feed/payload alongside product category paths.",
          docs: ["indexing/feeds.md", "indexing/data-layout.md"],
          confidence: 0.88
        })
      );
    }

    if (productsWithCategoryPaths.length === 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_CATEGORY_PATHS_MISSING",
          severity: "P1",
          title: "Profile expects product category paths",
          message: "No products expose category paths to match category hierarchy + title.",
          evidencePath: "catalog.products.category",
          remediation: "Add product category paths that match category hierarchy + title exactly.",
          docs: ["indexing/feeds.md", "indexing/data-layout.md"],
          confidence: 0.88
        })
      );
    }

    if (categories.length > 1 && categoriesWithHierarchy === 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_CATEGORY_HIERARCHY_MISSING",
          severity: "P1",
          title: "Profile expects category hierarchy matching",
          message: "Category objects exist, but none expose hierarchy fields.",
          evidencePath: "catalog.categories.hierarchy",
          remediation: "Add hierarchy to child categories so product paths can be matched to hierarchy + title.",
          docs: ["indexing/feeds.md", "indexing/data-layout.md"],
          confidence: 0.86
        })
      );
    }
  }

  return findings;
}

function validateProfileVariantModel(
  objects: NormalizedCatalogObject[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  if (profile.variantModel === "auto") return [];

  const products = objects.filter((object) => object.objectType === "product");
  const productsWithItemGroupId = products.filter((product) => Boolean(product.itemGroupId));
  const nestedVariantCount = products.reduce((count, product) => count + nestedRecordsOfType(product, "variant").length, 0);
  const findings: ValidationFinding[] = [];

  if (profile.variantModel === "none") {
    if (productsWithItemGroupId.length > 0 || nestedVariantCount > 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_VARIANT_MODEL_UNEXPECTED",
          severity: "P2",
          title: "Profile says variants are not expected, but variant evidence exists",
          message: `Found ${productsWithItemGroupId.length} products with item_group_id and ${nestedVariantCount} nested variants.`,
          evidencePath: "catalog.variants",
          remediation: "Set variantModel to item_group_id or nested_variants if variants are intentional, or remove variant evidence.",
          docs: ["indexing/feeds.md", "indexing/data-layout.md", "search/guides/variants.md"],
          confidence: 0.8
        })
      );
    }
  }

  if (profile.variantModel === "item_group_id") {
    if (productsWithItemGroupId.length === 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_ITEM_GROUP_ID_MISSING",
          severity: "P1",
          title: "Profile expects feed-style variant grouping",
          message: "No product exposes item_group_id.",
          evidencePath: "catalog.products.item_group_id",
          remediation: "Add item_group_id to feed products that are variants of the same product family, and list group members consecutively.",
          docs: ["indexing/feeds.md", "search/guides/variants.md"],
          confidence: 0.86
        })
      );
    }

    if (nestedVariantCount > 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_VARIANT_MODEL_MISMATCH",
          severity: "P2",
          title: "Profile expects item_group_id variants, but nested variants are present",
          message: `Found ${nestedVariantCount} nested variants.`,
          evidencePath: "catalog.products.nested",
          remediation: "Use item_group_id for feed-style variants, or set variantModel to nested_variants.",
          docs: ["indexing/feeds.md", "indexing/data-layout.md", "search/guides/variants.md"],
          confidence: 0.78
        })
      );
    }
  }

  if (profile.variantModel === "nested_variants") {
    if (nestedVariantCount === 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_NESTED_VARIANTS_MISSING",
          severity: "P1",
          title: "Profile expects nested variants",
          message: "No product has nested variant records.",
          evidencePath: "catalog.products.nested",
          remediation: "Attach variant objects under product nested arrays, or set variantModel to item_group_id/none.",
          docs: ["indexing/data-layout.md", "indexing/api/v1/content-update.mdx", "search/guides/variants.md"],
          confidence: 0.88
        })
      );
    }

    if (productsWithItemGroupId.length > 0) {
      findings.push(
        profileFinding({
          id: "CATALOG_PROFILE_VARIANT_MODEL_MISMATCH",
          severity: "P2",
          title: "Profile expects nested variants, but item_group_id is present",
          message: `${productsWithItemGroupId.length} products expose item_group_id.`,
          evidencePath: "catalog.products.item_group_id",
          remediation: "Use nested variant records for Content Update variant modeling, or set variantModel to item_group_id.",
          docs: ["indexing/data-layout.md", "search/guides/variants.md"],
          confidence: 0.78
        })
      );
    }
  }

  return findings;
}

function validateProfileMultipleHierarchies(
  objects: NormalizedCatalogObject[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  const products = objects.filter((object) => object.objectType === "product");
  if (products.length === 0 || profile.multipleCategoryHierarchies === "allowed") return [];

  const productsWithMultiplePaths = products.filter((product) => product.categoryPaths.length > 1);

  if (profile.multipleCategoryHierarchies === "expected" && productsWithMultiplePaths.length === 0) {
    return [
      profileFinding({
        id: "CATALOG_PROFILE_MULTIPLE_HIERARCHIES_MISSING",
        severity: "P2",
        title: "Profile expects products in multiple category hierarchies",
        message: "No product has more than one category path.",
        evidencePath: "catalog.products.category",
        remediation: "Add secondary category paths where products should belong to multiple hierarchies, or set multipleCategoryHierarchies to allowed/disallowed.",
        docs: ["indexing/feeds.md", "indexing/data-layout.md"],
        confidence: 0.72
      })
    ];
  }

  if (profile.multipleCategoryHierarchies === "disallowed" && productsWithMultiplePaths.length > 0) {
    return productsWithMultiplePaths.map((product) =>
      profileFinding({
        id: "CATALOG_PROFILE_MULTIPLE_HIERARCHIES_UNEXPECTED",
        severity: "P1",
        title: "Profile disallows multiple category hierarchies",
        message: `${objectLabel(product)} has ${product.categoryPaths.length} category paths.`,
        evidencePath: objectPath(product),
        remediation: "Keep only the canonical category path for this product, or set multipleCategoryHierarchies to allowed/expected.",
        docs: ["indexing/feeds.md", "indexing/data-layout.md"],
        confidence: 0.84
      })
    );
  }

  return [];
}

function validateProfilePrimaryCategory(
  objects: NormalizedCatalogObject[],
  profile: CatalogValidationProfile
): ValidationFinding[] {
  if (profile.primaryCategory !== "required_when_multiple") return [];

  return objects
    .filter((object) => object.objectType === "product" && object.categoryPaths.length > 1 && !hasExplicitPrimaryCategory(object))
    .map((object) =>
      profileFinding({
        id: "CATALOG_PROFILE_PRIMARY_CATEGORY_MISSING",
        severity: "P1",
        title: "Profile expects an explicit primary category for multi-hierarchy products",
        message: `${objectLabel(object)} has ${object.categoryPaths.length} category paths but no explicit primary category marker was detected.`,
        evidencePath: objectPath(object),
        remediation: "Mark exactly one category hierarchy as primary, or set primaryCategory to auto/not_required if first category order is the intended signal.",
        docs: ["indexing/feeds.md", "indexing/data-layout.md"],
        confidence: 0.82
      })
    );
}

function profileFinding(input: FindingInput): ValidationFinding {
  return createFinding(input);
}

function profileObjectType(type: string): NormalizedCatalogObject["objectType"] {
  if (type === "item" || type === "product") return "product";
  if (type === "category") return "category";
  if (type === "brand") return "brand";
  if (type === "article") return "article";
  return "content-object";
}

function requiredFieldsForObject(object: NormalizedCatalogObject, profile: CatalogValidationProfile): string[] {
  if (object.objectType === "product") return profile.requiredFieldsByType.item;
  if (object.objectType === "category") return profile.requiredFieldsByType.category;
  if (object.objectType === "brand") return profile.requiredFieldsByType.brand;
  if (object.objectType === "article") return profile.requiredFieldsByType.article;
  return [];
}

function objectHasField(object: NormalizedCatalogObject, field: string): boolean {
  if (field === "identity") return Boolean(object.identity);
  if (field === "title") return Boolean(object.title);
  if (field === "web_url") return Boolean(object.webUrl);

  const directField = object.fields[field];
  if (hasValue(directField)) return true;

  if (field === "webUrl" && hasValue(object.fields.web_url)) return true;
  if (field === "item_group_id" && Boolean(object.itemGroupId)) return true;

  if (isRecord(object.raw) && hasValue(object.raw[field])) return true;
  return false;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value) && "#text" in value) return hasValue(value["#text"]);
  if (isRecord(value)) return Object.keys(value).length > 0;
  return false;
}

function nestedRecordsOfType(object: NormalizedCatalogObject, type: string): Record<string, unknown>[] {
  if (!isRecord(object.raw) || !Array.isArray(object.raw.nested)) return [];
  return object.raw.nested.filter(
    (nested): nested is Record<string, unknown> =>
      isRecord(nested) && stringValue(nested.type)?.toLowerCase() === type
  );
}

function hasExplicitPrimaryCategory(object: NormalizedCatalogObject): boolean {
  if (isRecord(object.raw)) {
    const feedCategories = toArray(object.raw.category).filter(isRecord);
    if (feedCategories.some((category) => xmlAttributeValue(category, "primary") === "true")) return true;

    const nestedCategories = nestedRecordsOfType(object, "category");
    if (nestedCategories.some((category) => contentPrimaryMarker(category) === true)) return true;
  }

  if (contentPrimaryMarker({ primary: object.fields.primary }) === true) return true;

  return [
    object.fields.primary_category,
    object.fields.primary_category_id,
    object.fields.primary_category_identity
  ].some(hasValue);
}

function xmlAttributeValue(value: unknown, attributeName: string): string | undefined {
  if (!isRecord(value)) return undefined;
  return stringValue(value[`@_${attributeName}`])?.toLowerCase();
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

function objectLabel(object: NormalizedCatalogObject): string {
  const identity = object.identity ? ` "${object.identity}"` : "";
  return `${object.objectType}${identity} at ${object.sourcePath}[${object.index}]`;
}

function objectPath(object: NormalizedCatalogObject): string {
  return `${object.sourcePath}:${object.role}[${object.index}]`;
}

function buildCatalogNextActions(findings: ValidationFinding[], structures: CatalogStructureSummary[]): string[] {
  if (findings.length === 0) {
    return [
      "Try the same review on a real client feed URL and compare the inferred structure against the intended indexing model.",
      "If this feed is meant for PLP/category pages, verify category hierarchy behavior through a service/search check after indexing."
    ];
  }

  const actions = sortedFindings(findings)
    .slice(0, 7)
    .map((finding) => `${finding.severity}: ${finding.remediation}`);

  if (structures.some((structure) => structure.sourceKind === "content-update-json")) {
    actions.push("For Content Update payloads, confirm whether nested categories/variants are intended to be embedded under items or indexed independently.");
  }

  if (findings.some((finding) => finding.severity === "P0")) {
    actions.push("Fix P0 issues before sending this evidence to an indexing endpoint or dashboard feed processor.");
  }

  return actions;
}

function buildCatalogFollowUpPrompt(
  paths: string[],
  options: AgentCatalogReviewOptions,
  findings: ValidationFinding[],
  structures: CatalogStructureSummary[],
  profile: CatalogValidationProfile
): string {
  const findingSummary = findings.length
    ? findings.map((finding) => `${finding.severity} ${finding.id}: ${finding.title}`).join("\n")
    : "No deterministic findings yet.";
  const structureSummary = structures
    .map((structure) => `${structure.path}: ${structure.sourceKind}/${structure.role}, records=${structure.recordCount}`)
    .join("\n");

  return [
    "You are reviewing Luigi's Box indexing evidence: XML feeds, JSON feeds, or Content Update payloads.",
    `Docs root: ${resolve(options.docsRoot)}`,
    `Files to inspect: ${paths.map((path) => resolve(path)).join(", ")}`,
    `Catalog review profile: ${summarizeCatalogValidationProfile(profile)}`,
    "",
    "Use local docs first. Check whether the sample:",
    "- has a recognizable feed or Content Update root structure;",
    "- provides stable identity, title, and web_url for every indexed object;",
    "- keeps identities unique across products, categories, brands, articles, and variants;",
    "- models category hierarchies consistently with either category paths, nested categories, or category_id pairing;",
    "- marks exactly one primary category when one product belongs to multiple XML category paths;",
    "- uses valid Content Update objects[] with type, identity, fields, and one-level nested records only;",
    "- models variants with item_group_id or nested variants plus distinguishing fields such as color or size;",
    "- uses availability and availability_rank consistently.",
    "",
    "Inferred structures:",
    structureSummary,
    "",
    "Current deterministic findings:",
    findingSummary
  ].join("\n");
}

function countFields(objects: NormalizedCatalogObject[]): Map<string, number> {
  const fields = new Map<string, number>();
  for (const object of objects) {
    for (const field of Object.keys(object.fields)) {
      fields.set(field, (fields.get(field) ?? 0) + 1);
    }
  }
  return fields;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function coverage(objects: NormalizedCatalogObject[], predicate: (object: NormalizedCatalogObject) => boolean): string {
  if (objects.length === 0) return "0/0";
  const count = objects.filter(predicate).length;
  return `${count}/${objects.length} (${Math.round((count / objects.length) * 100)}%)`;
}

function fieldValues(value: unknown): string[] {
  return toArray(value)
    .map(stringValue)
    .filter((entry): entry is string => Boolean(entry));
}

function exampleObject(object: NormalizedCatalogObject): string {
  const identity = object.identity ?? "missing identity";
  const title = object.title ?? "missing title";
  const extras = [
    object.categoryPaths.length > 0 ? `${object.categoryPaths.length} category path(s)` : undefined,
    object.itemGroupId ? `item_group_id=${object.itemGroupId}` : undefined
  ].filter(Boolean);
  return `${object.objectType} ${identity}: ${title}${extras.length > 0 ? ` (${extras.join(", ")})` : ""}`;
}

function pushStructureList(lines: string[], label: string, values: string[]): void {
  lines.push(`${label}:`);
  for (const value of values.length > 0 ? values : ["none"]) {
    lines.push(`- ${value}`);
  }
}

function formatRecord(record: Record<string, number>): string {
  const entries = Object.entries(record);
  if (entries.length === 0) return "none";
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function sortedFindings(findings: ValidationFinding[]): ValidationFinding[] {
  const severityRank: Record<ValidationFinding["severity"], number> = { P0: 0, P1: 1, P2: 2 };
  return [...findings].sort((left, right) => {
    const severity = severityRank[left.severity] - severityRank[right.severity];
    if (severity !== 0) return severity;
    return left.id.localeCompare(right.id);
  });
}
