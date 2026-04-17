import type { ValidationFinding, ValidationReport } from "../core/types.js";
import type { CatalogValidationProfile } from "../catalog/profile.js";
import type { FrontendValidationProfile } from "../frontend/types.js";

export type AgentReviewService = "autocomplete" | "catalog";

export interface AgentReviewOptions {
  docsRoot: string;
  service: AgentReviewService;
  profile?: FrontendValidationProfile;
  maxDocs: number;
  browser?: {
    enabled: boolean;
    query: string;
    timeoutMs: number;
  };
}

export interface DocsHit {
  path: string;
  url: string;
  title: string;
  slug: string | undefined;
  heading: string | undefined;
  line: number;
  reason: string;
  excerpt: string;
  score: number;
  matchedTerms: string[];
}

export interface AgentUiReview {
  title: string;
  service: AgentReviewService;
  generatedAt: string;
  docsRoot: string;
  inputs: string[];
  validation: ValidationReport & { artifacts: string[]; capabilities: string[]; profile: string };
  profile: string;
  evidence: FindingEvidence[];
  docsHits: DocsHit[];
  browser: BrowserReviewResult[];
  nextActions: string[];
  promptForFollowUp: string;
}

export interface AgentCatalogReview {
  title: string;
  generatedAt: string;
  docsRoot: string;
  inputs: string[];
  validation: ValidationReport & { artifacts: string[] };
  profile: string;
  structures: CatalogStructureSummary[];
  evidence: FindingEvidence[];
  docsHits: DocsHit[];
  nextActions: string[];
  promptForFollowUp: string;
}

export interface DocsSearchInput {
  docsRoot: string;
  service: AgentReviewService;
  findings: ValidationFinding[];
  capabilities: string[];
  maxDocs: number;
}

export interface FindingEvidence {
  findingId: string;
  evidencePath: string;
  path: string;
  line: number;
  snippet: string;
  reason: string;
}

export interface BrowserReviewResult {
  path: string;
  status: "passed" | "failed" | "skipped";
  message: string;
  requests: {
    autocomplete: string[];
    topItems: string[];
    trendingQueries: string[];
    analytics: string[];
  };
  dataLayerEvents: unknown[];
  renderedText: string | undefined;
  resultElementCount: number | undefined;
  observations: string[];
}

export interface CatalogStructureSummary {
  path: string;
  sourceKind: string;
  role: string;
  rootKey: string | undefined;
  confidence: number;
  parseError: string | undefined;
  recordCount: number;
  objectCounts: Record<string, number>;
  requiredCoverage: {
    identity: string;
    title: string;
    webUrl: string;
  };
  fieldCoverage: string[];
  categoryModel: string[];
  contentUpdateModel: string[];
  variantModel: string[];
  pairingModel: string[];
  examples: string[];
}

export interface AgentCatalogReviewOptions {
  docsRoot: string;
  maxDocs: number;
  profile?: CatalogValidationProfile;
}
