import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ValidationFinding } from "../core/types.js";
import { isRecord } from "../catalog/detect.js";
import { normalizeCatalog, stringValue, toArray, type NormalizedCatalogObject } from "../catalog/normalize.js";
import { parseCatalogArtifacts } from "../catalog/parse.js";
import { validateCatalog } from "../catalog/validate.js";
import { findRelevantDocs } from "./docs.js";
import type { AgentCatalogReview, CatalogStructureSummary, FindingEvidence } from "./types.js";

export interface AgentCatalogReviewOptions {
  docsRoot: string;
  maxDocs: number;
}

const variantFields = ["color", "colour", "color_code", "size", "material", "pattern", "style", "variant"];

export async function reviewCatalog(paths: string[], options: AgentCatalogReviewOptions): Promise<AgentCatalogReview> {
  const artifacts = await parseCatalogArtifacts(paths);
  const catalog = normalizeCatalog(artifacts);
  const validation = await validateCatalog(paths);
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
  const evidence = await locateCatalogFindingEvidence(paths, validation.findings);
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
    structures,
    evidence,
    docsHits,
    nextActions: buildCatalogNextActions(validation.findings, structures),
    promptForFollowUp: buildCatalogFollowUpPrompt(paths, options, validation.findings, structures)
  };
}

export function formatAgentCatalogReview(review: AgentCatalogReview): string {
  const lines: string[] = [];

  lines.push(`# ${review.title}`);
  lines.push("");
  lines.push(`Generated: ${review.generatedAt}`);
  lines.push(`Docs root: ${review.docsRoot}`);
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
  structures: CatalogStructureSummary[]
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

async function locateCatalogFindingEvidence(paths: string[], findings: ValidationFinding[]): Promise<FindingEvidence[]> {
  const rawByPath = new Map<string, string>();
  const evidence: FindingEvidence[] = [];

  for (const path of paths) {
    rawByPath.set(path, await readFile(path, "utf8").catch(() => ""));
  }

  for (const finding of findings) {
    const path = paths.find((candidate) => finding.evidencePath.startsWith(candidate)) ?? paths[0];
    if (!path) continue;

    const raw = rawByPath.get(path);
    if (!raw) continue;

    const line = locateCatalogLine(raw, finding);
    if (!line) continue;

    evidence.push({
      findingId: finding.id,
      evidencePath: finding.evidencePath,
      path,
      line: line.line,
      snippet: line.snippet,
      reason: line.reason
    });
  }

  return evidence;
}

function locateCatalogLine(raw: string, finding: ValidationFinding): { line: number; snippet: string; reason: string } | undefined {
  const patterns = catalogEvidencePatterns(finding);
  const lines = raw.split(/\r?\n/);

  for (const pattern of patterns) {
    const index = lines.findIndex((line) => pattern.test(line));
    if (index !== -1) {
      return {
        line: index + 1,
        snippet: truncate(lines[index]!.trim(), 180),
        reason: pattern.source
      };
    }
  }

  return undefined;
}

function catalogEvidencePatterns(finding: ValidationFinding): RegExp[] {
  const patterns: RegExp[] = [];
  const quotedValues = [...finding.message.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter(Boolean);
  for (const value of quotedValues) patterns.push(new RegExp(escapeRegExp(value!), "i"));

  const field = finding.evidencePath.match(/\.([A-Za-z_][A-Za-z0-9_]*)$/)?.[1];
  if (field) {
    patterns.push(new RegExp(`<${escapeRegExp(field)}(?:\\s|>)`, "i"));
    patterns.push(new RegExp(`"${escapeRegExp(field)}"\\s*:`, "i"));
  }

  if (finding.evidencePath.includes("nested")) patterns.push(/"nested"\s*:|<nested/i);
  if (finding.evidencePath.includes("objects")) patterns.push(/"objects"\s*:/i);

  const byId: Record<string, RegExp[]> = {
    CATALOG_REQUIRED_FIELDS: [/<identity>|"identity"\s*:/i, /<title>|"title"\s*:/i, /<web_url>|"web_url"\s*:/i],
    XML_MIXED_ELEMENT_SHAPE: [/<category/i],
    XML_PRODUCT_CATEGORY_PRIMARY_INVALID: [/<category/i],
    CONTENT_UPDATE_SHAPE_INVALID: [/"objects"\s*:/i, /"fields"\s*:/i],
    CONTENT_UPDATE_NESTED_CATEGORY_SHAPE: [/"type"\s*:\s*"category"/i, /"ancestors"\s*:/i],
    CONTENT_UPDATE_NESTED_VARIANT_SHAPE: [/"type"\s*:\s*"variant"/i],
    CONTENT_UPDATE_NESTED_VARIANT_ID_MISSING: [/"type"\s*:\s*"variant"/i],
    CONTENT_UPDATE_NESTED_VARIANT_DISTINGUISHING_FIELD_MISSING: [/"type"\s*:\s*"variant"/i],
    CATEGORY_PAIRING_MISMATCH: [/"category_id"\s*:/i, /<category_id>/i],
    CATEGORY_PAIRING_FIELD_MISSING: [/"category_id"\s*:/i, /<category_id>/i],
    VARIANT_GROUP_NOT_CONSECUTIVE: [/<item_group_id>|"item_group_id"\s*:/i],
    VARIANT_GROUP_SINGLETON: [/<item_group_id>|"item_group_id"\s*:/i],
    VARIANT_GROUP_DISTINGUISHING_FIELD_MISSING: [/<item_group_id>|"item_group_id"\s*:/i],
    AVAILABILITY_INVALID: [/<availability>|"availability"\s*:/i],
    AVAILABILITY_RANK_INVALID: [/<availability_rank>|"availability_rank"\s*:/i],
    FIELD_NAME_DISCOURAGED: [/"[^"]+[. [\\]][^"]*"\s*:/i]
  };

  patterns.push(...(byId[finding.id] ?? []));
  return patterns.length > 0 ? patterns : [/.+/];
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

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 3).trimEnd()}...`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
