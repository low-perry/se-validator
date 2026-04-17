import { resolve } from "node:path";
import type { ValidationFinding } from "../core/types.js";
import { defaultFrontendValidationProfile, summarizeFrontendValidationProfile } from "../frontend/profile.js";
import { validateFrontend } from "../frontend/validate.js";
import { runBrowserReview } from "./browser.js";
import { findRelevantDocs } from "./docs.js";
import { locateFindingEvidence } from "./evidence.js";
import type { AgentReviewOptions, AgentUiReview, DocsHit } from "./types.js";

const SEVERITY_RANK: Record<ValidationFinding["severity"], number> = {
  P0: 0,
  P1: 1,
  P2: 2
};

export async function reviewUi(paths: string[], options: AgentReviewOptions): Promise<AgentUiReview> {
  const profile = options.profile ?? defaultFrontendValidationProfile();
  const validation = await validateFrontend(paths, { profile });
  const evidence = await locateFindingEvidence(paths, validation.findings);
  const docsHits = await findRelevantDocs({
    docsRoot: options.docsRoot,
    service: options.service,
    findings: validation.findings,
    capabilities: validation.capabilities,
    maxDocs: options.maxDocs
  });
  const browser =
    options.browser?.enabled === true
      ? await runBrowserReview(paths, {
          query: options.browser.query,
          timeoutMs: options.browser.timeoutMs,
          profile
        })
      : [];

  return {
    title: "Agent UI Review Report",
    service: options.service,
    generatedAt: new Date().toISOString(),
    docsRoot: resolve(options.docsRoot),
    inputs: paths.map((path) => resolve(path)),
    validation,
    profile: summarizeFrontendValidationProfile(profile),
    evidence,
    docsHits,
    browser,
    nextActions: buildNextActions(validation.findings),
    promptForFollowUp: buildPromptForFollowUp(paths, options, validation.findings, profile)
  };
}

export function formatAgentUiReview(review: AgentUiReview): string {
  const lines: string[] = [];

  lines.push(`# ${review.title}`);
  lines.push("");
  lines.push(`Service: ${review.service}`);
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
  lines.push("## Detected Integration Shape");
  for (const artifact of review.validation.artifacts) {
    lines.push(`- ${artifact}`);
  }

  if (review.validation.capabilities.length > 0) {
    lines.push("");
    lines.push("## Detected Capabilities");
    for (const capability of review.validation.capabilities) {
      lines.push(`- ${capability}`);
    }
  }

  lines.push("");
  lines.push("## Review Findings");
  if (review.validation.findings.length === 0) {
    lines.push("No findings. The sample passes the current deterministic UI rule set.");
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

  if (review.browser.length > 0) {
    lines.push("");
    lines.push("## Browser Evidence");
    for (const result of review.browser) {
      lines.push("");
      lines.push(`- ${result.path}: ${result.status}`);
      lines.push(`  ${result.message}`);
      for (const observation of result.observations) {
        lines.push(`  - ${observation}`);
      }
      lines.push(`  - Autocomplete requests: ${result.requests.autocomplete.length}`);
      lines.push(`  - Top Items requests: ${result.requests.topItems.length}`);
      lines.push(`  - Trending Queries requests: ${result.requests.trendingQueries.length}`);
      lines.push(`  - Analytics requests: ${result.requests.analytics.length}`);
      lines.push(`  - dataLayer events: ${result.dataLayerEvents.length}`);
    }
  }

  lines.push("");
  lines.push("## Docs Consulted");
  if (review.docsHits.length === 0) {
    lines.push("No local docs were found for this review. Check the --docs path.");
  } else {
    for (const hit of review.docsHits) {
      lines.push("");
      lines.push(`- ${formatDocHit(hit)}`);
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

function buildNextActions(findings: ValidationFinding[]): string[] {
  if (findings.length === 0) {
    return [
      "Run the sample in a browser and confirm the autocomplete request, rendered hits, view event, and click event appear in DevTools.",
      "Use the live dashboard/debugger to confirm events are accepted after the UI renders suggestions."
    ];
  }

  const actions = sortedFindings(findings)
    .slice(0, 6)
    .map((finding) => `${finding.severity}: ${finding.remediation}`);

  if (findings.some((finding) => finding.severity === "P0")) {
    actions.push("Re-run this command after fixing P0 items; P0 means the implementation likely cannot be considered integrated.");
  }

  return actions;
}

function buildPromptForFollowUp(
  paths: string[],
  options: AgentReviewOptions,
  findings: ValidationFinding[],
  profile: ReturnType<typeof defaultFrontendValidationProfile>
): string {
  const findingSummary = findings.length
    ? findings.map((finding) => `${finding.severity} ${finding.id}: ${finding.title}`).join("\n")
    : "No deterministic findings yet.";

  return [
    "You are reviewing a Luigi's Box autocomplete frontend integration.",
    `Service: ${options.service}`,
    `Profile: ${summarizeFrontendValidationProfile(profile)}`,
    `Docs root: ${resolve(options.docsRoot)}`,
    `Files to inspect: ${paths.map((path) => resolve(path)).join(", ")}`,
    "",
    "Use the local docs and public examples first. Check whether the sample:",
    "- calls the Autocomplete API with tracker_id, q, type, and relevant hit_fields;",
    "- renders response hits from the same data used for analytics;",
    "- keeps item identity consistent with the hit.url/url returned by the API;",
    "- sends view and click analytics after results are rendered;",
    "- tracks no-result autocomplete responses with an empty items array;",
    "- tracks Top Items as Recommendation with autocomplete_popup when used;",
    "- treats Trending Queries as dashboard-managed content and tracks resulting searches if they are clickable.",
    "",
    "Current deterministic findings:",
    findingSummary
  ].join("\n");
}

function sortedFindings(findings: ValidationFinding[]): ValidationFinding[] {
  return [...findings].sort((left, right) => {
    const severity = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
    if (severity !== 0) return severity;
    return left.id.localeCompare(right.id);
  });
}

function formatDocHit(hit: DocsHit): string {
  const slug = hit.slug ? ` (${hit.slug})` : "";
  return `${hit.title}${slug}: ${hit.path}:${hit.line}`;
}
