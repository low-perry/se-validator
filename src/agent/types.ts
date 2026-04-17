import type { ValidationFinding, ValidationReport } from "../core/types.js";

export type AgentReviewService = "autocomplete";

export interface AgentReviewOptions {
  docsRoot: string;
  service: AgentReviewService;
  maxDocs: number;
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
  validation: ValidationReport & { artifacts: string[]; capabilities: string[] };
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
