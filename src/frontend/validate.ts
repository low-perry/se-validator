import { scoreFindings, summarizeFindings } from "../core/findings.js";
import type { ValidationReport } from "../core/types.js";
import { parseFrontendArtifacts } from "./parse.js";
import { defaultFrontendValidationProfile, normalizeFrontendValidationProfile, summarizeFrontendValidationProfile } from "./profile.js";
import { frontendRules } from "./rules.js";
import type { FrontendValidationProfile } from "./types.js";

export interface FrontendValidationOptions {
  profile?: FrontendValidationProfile;
}

export async function validateFrontend(
  paths: string[],
  options: FrontendValidationOptions = {}
): Promise<ValidationReport & { artifacts: string[]; capabilities: string[]; profile: string }> {
  const artifacts = await parseFrontendArtifacts(paths);
  const profile = options.profile ?? inferFrontendValidationProfile(artifacts);
  const findings = frontendRules.flatMap((rule) => rule(artifacts, profile));

  return {
    title: `${profile.service === "search" ? "Search" : "Autocomplete"} Frontend Validation Report`,
    profile: summarizeFrontendValidationProfile(profile),
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

function inferFrontendValidationProfile(artifacts: Awaited<ReturnType<typeof parseFrontendArtifacts>>): FrontendValidationProfile {
  const hasSearch = artifacts.some((artifact) => artifact.capabilities.endpoints.search);
  const hasAutocomplete = artifacts.some((artifact) => artifact.capabilities.endpoints.autocomplete);

  if (hasSearch && !hasAutocomplete) {
    return normalizeFrontendValidationProfile({ service: "search" });
  }

  return defaultFrontendValidationProfile();
}

function capabilitySummary(artifact: Awaited<ReturnType<typeof parseFrontendArtifacts>>[number]): string {
  const endpoints = [
    artifact.capabilities.endpoints.autocomplete ? "autocomplete" : undefined,
    artifact.capabilities.endpoints.search ? "search" : undefined,
    artifact.capabilities.endpoints.topItems ? "top_items" : undefined,
    artifact.capabilities.endpoints.trendingQueries ? "trending_queries" : undefined
  ].filter(Boolean);

  const analytics = [
    artifact.capabilities.analytics.autocompleteView ? "Autocomplete view" : undefined,
    artifact.capabilities.analytics.searchResultsView ? "Search Results view" : undefined,
    artifact.capabilities.analytics.recommendationView ? "Recommendation view" : undefined,
    artifact.capabilities.analytics.clickEvent ? "click/select" : undefined,
    artifact.capabilities.responseFlow.tracksNoResults ? "no-results" : undefined
  ].filter(Boolean);

  return `${artifact.path}: endpoints=${endpoints.join(", ") || "none"}; analytics=${analytics.join(", ") || "none"}`;
}
