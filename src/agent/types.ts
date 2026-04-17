import type { ValidationFinding, ValidationReport } from "../core/types.js";
import type { FrontendValidationProfile } from "../frontend/types.js";

export type AgentReviewService = "autocomplete";

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

export interface DocsSearchInput {
  docsRoot: string;
  service: AgentReviewService;
  findings: ValidationFinding[];
  capabilities: string[];
  maxDocs: number;
}

export interface FindingEvidence {
  findingId: string;
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
