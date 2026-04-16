import { scoreFindings, summarizeFindings } from "../core/findings.js";
import type { ValidationReport } from "../core/types.js";
import { parseFrontendArtifacts } from "./parse.js";
import { frontendRules } from "./rules.js";

export async function validateFrontend(
  paths: string[]
): Promise<ValidationReport & { artifacts: string[]; capabilities: string[] }> {
  const artifacts = await parseFrontendArtifacts(paths);
  const findings = frontendRules.flatMap((rule) => rule(artifacts));

  return {
    title: "Autocomplete Frontend Validation Report",
    artifacts: artifacts.map(
      (artifact) =>
        `${artifact.path}: ${artifact.sourceKind} / ${artifact.analyticsMode} (${Math.round(artifact.confidence * 100)}%)`
    ),
    capabilities: artifacts.map((artifact) => capabilitySummary(artifact)),
    score: scoreFindings(findings),
    findings,
    summary: summarizeFindings(findings)
  };
}

function capabilitySummary(artifact: Awaited<ReturnType<typeof parseFrontendArtifacts>>[number]): string {
  const endpoints = [
    artifact.capabilities.endpoints.autocomplete ? "autocomplete" : undefined,
    artifact.capabilities.endpoints.topItems ? "top_items" : undefined,
    artifact.capabilities.endpoints.trendingQueries ? "trending_queries" : undefined
  ].filter(Boolean);

  const analytics = [
    artifact.capabilities.analytics.autocompleteView ? "Autocomplete view" : undefined,
    artifact.capabilities.analytics.recommendationView ? "Recommendation view" : undefined,
    artifact.capabilities.analytics.clickEvent ? "click/select" : undefined,
    artifact.capabilities.responseFlow.tracksNoResults ? "no-results" : undefined
  ].filter(Boolean);

  return `${artifact.path}: endpoints=${endpoints.join(", ") || "none"}; analytics=${analytics.join(", ") || "none"}`;
}
