/**
 * Machine-readable Zod schemas for validator and agent report outputs.
 *
 * Downstream consumers (the bundled tools/report-viewer, other UIs, and any
 * automation that depends on --json output) can import these schemas as a
 * stable contract and refuse to render payloads that don't parse.
 *
 * Schemas are intentionally aligned to the hand-written TS interfaces in
 * `core/types.ts`, `agent/types.ts`, `catalog/validate.ts`, and
 * `frontend/validate.ts`. Cross-check helpers at the bottom of the file
 * enforce that inferred types stay assignment-compatible with the source
 * TypeScript types, so if an interface drifts the typechecker will fail.
 */
import { z } from "zod";
import type { Severity, ValidationFinding, ValidationReport } from "./types.js";
// Severity is imported to assert schema <-> TS alignment via the cross-checks
// at the bottom of this file; eslint/tsc would otherwise flag it as unused.
import type {
  AgentUiReview,
  AgentCatalogReview,
  BrowserReviewResult,
  CatalogStructureSummary,
  DocsHit,
  FindingEvidence
} from "../agent/types.js";

/**
 * Helper for `field: T | undefined` style declarations. Using `.optional()`
 * alone inside `z.object` would produce `field?: T | undefined`, which does
 * not satisfy `exactOptionalPropertyTypes` against a required-but-nullable
 * property. `z.union([schema, z.undefined()])` keeps the key required while
 * still accepting an explicit `undefined` value.
 */
const optionalValue = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, z.undefined()]);

export const severitySchema = z.enum(["P0", "P1", "P2"]);
export const findingStateSchema = z.enum(["failed", "unknown"]);
export const validationAreaSchema = z.enum(["catalog", "identity", "analytics", "service", "frontend"]);

export const validationFindingSchema = z.object({
  id: z.string(),
  severity: severitySchema,
  state: findingStateSchema,
  area: validationAreaSchema,
  title: z.string(),
  message: z.string(),
  evidencePath: z.string(),
  remediation: z.string(),
  docs: z.array(z.string()),
  confidence: z.number()
});

export const validationSummarySchema = z.object({
  P0: z.number(),
  P1: z.number(),
  P2: z.number()
});

export const validationReportSchema = z.object({
  title: z.string(),
  score: z.number(),
  findings: z.array(validationFindingSchema),
  summary: validationSummarySchema
});

/** Shape returned by {@link validateCatalog}. */
export const catalogValidationReportSchema = validationReportSchema.extend({
  artifacts: z.array(z.string())
});

/** Shape returned by {@link validateFrontend}. */
export const frontendValidationReportSchema = validationReportSchema.extend({
  artifacts: z.array(z.string()),
  capabilities: z.array(z.string()),
  profile: z.string()
});

export const docsHitSchema = z.object({
  path: z.string(),
  title: z.string(),
  slug: optionalValue(z.string()),
  heading: optionalValue(z.string()),
  line: z.number(),
  reason: z.string(),
  excerpt: z.string(),
  score: z.number(),
  matchedTerms: z.array(z.string())
});

export const findingEvidenceSchema = z.object({
  findingId: z.string(),
  evidencePath: z.string(),
  path: z.string(),
  line: z.number(),
  snippet: z.string(),
  reason: z.string()
});

export const browserReviewResultSchema = z.object({
  path: z.string(),
  status: z.enum(["passed", "failed", "skipped"]),
  message: z.string(),
  requests: z.object({
    autocomplete: z.array(z.string()),
    topItems: z.array(z.string()),
    trendingQueries: z.array(z.string()),
    analytics: z.array(z.string())
  }),
  dataLayerEvents: z.array(z.unknown()),
  renderedText: optionalValue(z.string()),
  resultElementCount: optionalValue(z.number()),
  observations: z.array(z.string())
});

/**
 * Inferred catalog structure summary emitted by the agent catalog review.
 * Mirrors `CatalogStructureSummary` in `src/agent/types.ts` and captures the
 * structure payload that {@link reviewCatalog} layers on top of the base
 * {@link validateCatalog} report.
 */
export const catalogStructureSummarySchema = z.object({
  path: z.string(),
  sourceKind: z.string(),
  role: z.string(),
  rootKey: optionalValue(z.string()),
  confidence: z.number(),
  parseError: optionalValue(z.string()),
  recordCount: z.number(),
  objectCounts: z.record(z.string(), z.number()),
  requiredCoverage: z.object({
    identity: z.string(),
    title: z.string(),
    webUrl: z.string()
  }),
  fieldCoverage: z.array(z.string()),
  categoryModel: z.array(z.string()),
  contentUpdateModel: z.array(z.string()),
  variantModel: z.array(z.string()),
  pairingModel: z.array(z.string()),
  examples: z.array(z.string())
});

/** Agent review service enum (matches `AgentReviewService`). */
export const agentReviewServiceSchema = z.enum(["autocomplete", "catalog"]);

/** Shape returned by {@link reviewUi}. */
export const agentUiReviewSchema = z.object({
  title: z.string(),
  service: agentReviewServiceSchema,
  generatedAt: z.string(),
  docsRoot: z.string(),
  inputs: z.array(z.string()),
  validation: frontendValidationReportSchema,
  profile: z.string(),
  evidence: z.array(findingEvidenceSchema),
  docsHits: z.array(docsHitSchema),
  browser: z.array(browserReviewResultSchema),
  nextActions: z.array(z.string()),
  promptForFollowUp: z.string()
});

/** Shape returned by {@link reviewCatalog}. */
export const agentCatalogReviewSchema = z.object({
  title: z.string(),
  generatedAt: z.string(),
  docsRoot: z.string(),
  inputs: z.array(z.string()),
  validation: catalogValidationReportSchema,
  profile: z.string(),
  structures: z.array(catalogStructureSummarySchema),
  evidence: z.array(findingEvidenceSchema),
  docsHits: z.array(docsHitSchema),
  nextActions: z.array(z.string()),
  promptForFollowUp: z.string()
});

/** Convenience aggregate: all report shapes emitted by the CLI. */
export const reportSchemas = {
  validationReport: validationReportSchema,
  catalogValidationReport: catalogValidationReportSchema,
  frontendValidationReport: frontendValidationReportSchema,
  agentUiReview: agentUiReviewSchema,
  agentCatalogReview: agentCatalogReviewSchema,
  browserReviewResult: browserReviewResultSchema,
  catalogStructureSummary: catalogStructureSummarySchema,
  docsHit: docsHitSchema,
  findingEvidence: findingEvidenceSchema
} as const;

// ---------------------------------------------------------------------------
// Compile-time cross-checks.
//
// These type-only assertions fail typecheck if a schema's inferred shape
// drifts away from the hand-written TypeScript interface it is supposed to
// mirror. They deliberately check both directions so adding or removing a
// field on either side is caught.
// ---------------------------------------------------------------------------

type AssertExtends<Actual extends Expected, Expected> = true;

type _SeverityCheck = AssertExtends<z.infer<typeof severitySchema>, Severity> &
  AssertExtends<Severity, z.infer<typeof severitySchema>>;

type _ValidationFindingCheck = AssertExtends<z.infer<typeof validationFindingSchema>, ValidationFinding> &
  AssertExtends<ValidationFinding, z.infer<typeof validationFindingSchema>>;

type _ValidationReportCheck = AssertExtends<z.infer<typeof validationReportSchema>, ValidationReport> &
  AssertExtends<ValidationReport, z.infer<typeof validationReportSchema>>;

type _DocsHitCheck = AssertExtends<z.infer<typeof docsHitSchema>, DocsHit> &
  AssertExtends<DocsHit, z.infer<typeof docsHitSchema>>;

type _FindingEvidenceCheck = AssertExtends<z.infer<typeof findingEvidenceSchema>, FindingEvidence> &
  AssertExtends<FindingEvidence, z.infer<typeof findingEvidenceSchema>>;

type _BrowserReviewResultCheck = AssertExtends<z.infer<typeof browserReviewResultSchema>, BrowserReviewResult> &
  AssertExtends<BrowserReviewResult, z.infer<typeof browserReviewResultSchema>>;

type _CatalogStructureSummaryCheck = AssertExtends<
  z.infer<typeof catalogStructureSummarySchema>,
  CatalogStructureSummary
> &
  AssertExtends<CatalogStructureSummary, z.infer<typeof catalogStructureSummarySchema>>;

type _AgentUiReviewCheck = AssertExtends<z.infer<typeof agentUiReviewSchema>, AgentUiReview> &
  AssertExtends<AgentUiReview, z.infer<typeof agentUiReviewSchema>>;

type _AgentCatalogReviewCheck = AssertExtends<z.infer<typeof agentCatalogReviewSchema>, AgentCatalogReview> &
  AssertExtends<AgentCatalogReview, z.infer<typeof agentCatalogReviewSchema>>;
