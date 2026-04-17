import { resolve } from "node:path";
import type { ValidationFinding } from "../core/types.js";
import { defaultFrontendValidationProfile, summarizeFrontendValidationProfile } from "../frontend/profile.js";
import { validateFrontend } from "../frontend/validate.js";
import { runBrowserReview } from "./browser.js";
import { docsMarkdownLink, findRelevantDocs } from "./docs.js";
import { locateFindingEvidence } from "./evidence.js";
import type { AgentReviewOptions, AgentUiReview, DocsHit, FindingEvidence } from "./types.js";

const SEVERITY_RANK: Record<ValidationFinding["severity"], number> = {
  P0: 0,
  P1: 1,
  P2: 2
};

type EvidenceKind = "static" | "docs" | "browser";

interface FindingDebugNote {
  lookedFor: string;
  whyItMatters: string;
  evidenceKind: EvidenceKind;
}

// Hand-written mapping of finding id -> plain-English debug note. Keeps lookedFor / whyItMatters
// short and deterministic. When a finding id is missing from this table, the formatter falls back
// to a derivation from the finding metadata.
const FINDING_DEBUG_NOTES: Record<string, FindingDebugNote> = {
  FRONTEND_ARTIFACT_READ_ERROR: {
    lookedFor: "an HTML or JavaScript artifact that could be parsed into a frontend integration.",
    whyItMatters: "Without parseable evidence the validator cannot review the integration at all.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_ENDPOINT_MISSING: {
    lookedFor: "a request to https://live.luigisbox.com/autocomplete/v2 from the frontend.",
    whyItMatters: "Without the Autocomplete API call the search box cannot return Luigi's Box suggestions.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING: {
    lookedFor: "tracker_id, q, and type query parameters on the autocomplete request.",
    whyItMatters: "Missing required params either skip the integration entirely or return wrong results under the wrong tracker.",
    evidenceKind: "static"
  },
  FRONTEND_HIT_FIELDS_MISSING: {
    lookedFor: "a hit_fields query parameter on the autocomplete/top_items request.",
    whyItMatters: "Without hit_fields every response returns all indexed fields, wasting bandwidth and slowing the dropdown.",
    evidenceKind: "static"
  },
  FRONTEND_DNS_PREFETCH_MISSING: {
    lookedFor: "<link rel=\"dns-prefetch\" href=\"//live.luigisbox.com\"> in the document head.",
    whyItMatters: "DNS prefetch trims tens of ms off the first autocomplete request, a visible UX win on slow connections.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_DEBOUNCE_MISSING: {
    lookedFor: "debounce or setTimeout logic wrapping the autocomplete fetch call.",
    whyItMatters: "Without debounce the frontend fires one request per keystroke, hammering the API and the user's network.",
    evidenceKind: "static"
  },
  FRONTEND_INPUT_LISTENER_MISSING: {
    lookedFor: "an addEventListener(\"input\", ...) on the search input wired to the suggestion fetcher.",
    whyItMatters: "Without an input listener typing never triggers an autocomplete request, so the dropdown stays empty.",
    evidenceKind: "static"
  },
  FRONTEND_HITS_NOT_READ: {
    lookedFor: "code that reads response.hits (or equivalent) from the Autocomplete API response.",
    whyItMatters: "If the response hits array is never consumed, rendering and analytics cannot share the canonical data.",
    evidenceKind: "static"
  },
  FRONTEND_HITS_NOT_RENDERED: {
    lookedFor: "hits.forEach or hits.map feeding the dropdown renderer.",
    whyItMatters: "Without rendering the hits the API call is wasted and users see nothing useful.",
    evidenceKind: "static"
  },
  FRONTEND_RENDERED_IDENTITY_NOT_HIT_URL: {
    lookedFor: "hit.url (or the documented url identity) stored on the rendered suggestion element.",
    whyItMatters: "If rendered identity drifts from the catalog url, analytics and recommendations cannot be joined back to the product.",
    evidenceKind: "static"
  },
  FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL: {
    lookedFor: "analytics items whose item_id/url is set to hit.url returned by the API.",
    whyItMatters: "Analytics keyed off the wrong field poison Luigi's Box ML models with identities that never appear in the catalog.",
    evidenceKind: "static"
  },
  FRONTEND_ANALYTICS_PATH_MISSING: {
    lookedFor: "either dataLayer.push analytics or Events API POSTs in the frontend evidence.",
    whyItMatters: "Without an analytics path Luigi's Box cannot learn from clicks or rank results for this client.",
    evidenceKind: "static"
  },
  FRONTEND_EXPECTED_DATALAYER_ANALYTICS_MISSING: {
    lookedFor: "dataLayer.push events, as required by the configured profile.",
    whyItMatters: "Profile mismatch means either the profile is stale or dataLayer analytics are silently missing.",
    evidenceKind: "static"
  },
  FRONTEND_EXPECTED_EVENTS_API_ANALYTICS_MISSING: {
    lookedFor: "POST requests to api.luigisbox.com/v1/events, as required by the configured profile.",
    whyItMatters: "Profile mismatch means either the profile is stale or Events API calls are silently missing.",
    evidenceKind: "static"
  },
  FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING: {
    lookedFor: "<script src=\"https://scripts.luigisbox.tech/LBX-*.js\"> in the document head.",
    whyItMatters: "Without the collector script dataLayer.push events are never read and every tracked event is dropped.",
    evidenceKind: "static"
  },
  FRONTEND_DATALAYER_COLLECTOR_SCRIPT_NOT_IN_HEAD: {
    lookedFor: "the collector script tag inside <head>, not later in <body>.",
    whyItMatters: "A collector loaded after <body> may miss early dataLayer.push events fired during page bootstrap.",
    evidenceKind: "static"
  },
  FRONTEND_DATALAYER_COLLECTOR_SCRIPT_NOT_ASYNC: {
    lookedFor: "async attribute on the collector <script> tag.",
    whyItMatters: "A synchronous collector script blocks rendering and hurts Core Web Vitals on every page load.",
    evidenceKind: "static"
  },
  FRONTEND_EVENTS_API_POST_MISSING: {
    lookedFor: "fetch or axios POST to https://api.luigisbox.com/v1/events.",
    whyItMatters: "The Events API path is declared but no payloads are sent, so analytics are empty.",
    evidenceKind: "static"
  },
  FRONTEND_EVENTS_API_CLIENT_ID_MISSING: {
    lookedFor: "a stable client_id attached to Events API payloads.",
    whyItMatters: "Without client_id, sessions cannot be linked across events and user-level metrics break.",
    evidenceKind: "static"
  },
  FRONTEND_EVENTS_API_EVENT_ID_MISSING: {
    lookedFor: "a unique id (e.g. crypto.randomUUID()) generated per Events API event.",
    whyItMatters: "Missing event ids prevent Luigi's Box from deduplicating retries and cause double-counting.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_VIEW_ANALYTICS_MISSING: {
    lookedFor: "an Autocomplete view event fired after suggestions render (view_item_list or Events API type=Autocomplete).",
    whyItMatters: "Without a view event the dashboard never sees that the dropdown was shown, breaking impression metrics and learning.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_QUERY_ANALYTICS_MISSING: {
    lookedFor: "search_term (DataLayer) or query.string (Events API) populated from the user's query.",
    whyItMatters: "Without the query string Luigi's Box cannot correlate events to what the user typed, breaking search-term reports.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_ITEMS_NOT_FROM_HITS: {
    lookedFor: "analytics items built from hits.map(...) (the same array used for rendering).",
    whyItMatters: "If analytics items are not sourced from hits, rendered UI and tracked events can disagree and poison the ML feedback loop.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_ITEM_POSITION_MISSING: {
    lookedFor: "a position/index field (index + 1) on analytics items.",
    whyItMatters: "Position data is required to measure click-through-rate per rank and to tune ordering.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_NO_RESULTS_NOT_TRACKED: {
    lookedFor: "an Autocomplete view event with items: [] when hits is empty.",
    whyItMatters: "Untracked zero-result queries are invisible to Luigi's Box, so search gaps never surface in reporting.",
    evidenceKind: "static"
  },
  FRONTEND_AUTOCOMPLETE_CLICK_ANALYTICS_MISSING: {
    lookedFor: "a click/select_item handler that fires an analytics event with the rendered item identity.",
    whyItMatters: "Click events are the primary ML signal; without them ranking never improves from real usage.",
    evidenceKind: "static"
  },
  FRONTEND_CLICK_DOES_NOT_USE_RENDERED_IDENTITY: {
    lookedFor: "the click handler reading the rendered element's data identity (dataset.itemId / data-item-id).",
    whyItMatters: "Clicks reporting a different identity than what was rendered make per-item CTR data meaningless.",
    evidenceKind: "static"
  },
  FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED: {
    lookedFor: "a request to https://live.luigisbox.com/v1/top_items.",
    whyItMatters: "Top Items on focus are expected for this profile; missing the call means the empty-state dropdown is unusable.",
    evidenceKind: "static"
  },
  FRONTEND_TOP_ITEMS_UNEXPECTED_BY_PROFILE: {
    lookedFor: "no Top Items usage, because the profile sets topItems=disabled.",
    whyItMatters: "Either the profile is stale or the integration is shipping a feature the SE believed was turned off.",
    evidenceKind: "static"
  },
  FRONTEND_TOP_ITEMS_FOCUS_LISTENER_MISSING: {
    lookedFor: "addEventListener(\"focus\", ...) on the search input wired to fetchTopItems.",
    whyItMatters: "Without a focus listener top items never load on empty-search focus, defeating the empty-state dropdown.",
    evidenceKind: "static"
  },
  FRONTEND_TOP_ITEMS_RECOMMENDATION_ANALYTICS_MISSING: {
    lookedFor: "Recommendation (not Autocomplete) view events when top items render.",
    whyItMatters: "Mislabeling top items as Autocomplete distorts every empty-state search metric and breaks ML attribution.",
    evidenceKind: "static"
  },
  FRONTEND_TOP_ITEMS_AUTOCOMPLETE_POPUP_PLACEMENT_MISSING: {
    lookedFor: "RecommenderClientId/Recommender set to autocomplete_popup on top-item Recommendation events.",
    whyItMatters: "Without the placement tag top items blend with on-page recommendation widgets and cannot be reported separately.",
    evidenceKind: "static"
  },
  FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED: {
    lookedFor: "a request to https://live.luigisbox.com/v2/trending_queries.",
    whyItMatters: "Trending Queries are dashboard-managed content; without the call the SE's configured terms never reach users.",
    evidenceKind: "static"
  },
  FRONTEND_TRENDING_QUERIES_UNEXPECTED_BY_PROFILE: {
    lookedFor: "no Trending Queries usage, because the profile sets trendingQueries=disabled.",
    whyItMatters: "Either the profile is stale or the integration is shipping a feature the SE believed was turned off.",
    evidenceKind: "static"
  },
  FRONTEND_TRENDING_QUERY_TITLES_NOT_MAPPED: {
    lookedFor: "item.title read from the Trending Queries response and fed into rendering.",
    whyItMatters: "Without mapping titles, dashboard-managed trending terms never appear to the user.",
    evidenceKind: "static"
  },
  FRONTEND_TRENDING_QUERY_USE_NOT_CLEAR: {
    lookedFor: "either placeholder usage (value written to the input) or a Search Results view event after trending click.",
    whyItMatters: "Unclear trending usage means the dashboard-curated terms are fetched but never produce a trackable search.",
    evidenceKind: "static"
  }
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

export interface FormatAgentUiReviewOptions {
  explain?: boolean;
}

export function formatAgentUiReview(review: AgentUiReview, options: FormatAgentUiReviewOptions = {}): string {
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
    const passedChecks = buildWhyThisPassedChecks(review.validation.capabilities);
    if (passedChecks.length > 0) {
      lines.push("");
      lines.push("### Why this passed");
      lines.push("The validator verified each of the following against the inputs:");
      for (const check of passedChecks) {
        lines.push(`- ${check}`);
      }
    }
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
      lines.push(`Docs: ${formatFindingDocs(finding.docs)}`);
      lines.push(`Confidence: ${finding.confidence}`);
      lines.push("");
      lines.push("Debug Notes:");
      for (const note of buildFindingDebugNotes(finding, evidence)) {
        lines.push(`- ${note}`);
      }
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
      lines.push(`  > ${quoteExcerpt(hit.excerpt)}`);
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

  if (options.explain === true) {
    lines.push(...formatAgentUiReviewExplain(review));
  }

  return lines.join("\n");
}

export function formatAgentUiReviewExplain(review: AgentUiReview): string[] {
  const lines: string[] = [];

  lines.push("");
  lines.push("## Explanation: Severities");
  lines.push(
    "- P0: blocking. The implementation likely cannot be considered integrated until this is fixed. Re-run review after remediation."
  );
  lines.push(
    "- P1: important. The integration runs but produces incorrect or low-quality data (wrong identity, missing analytics, mismatched profile)."
  );
  lines.push(
    "- P2: advisory. The integration works, but the fix improves latency, robustness, or analytics richness."
  );

  lines.push("");
  lines.push("## Explanation: Detected Integration Path");
  const integrationPath = describeIntegrationPath(review);
  if (integrationPath.length === 0) {
    lines.push("- No integration shape was detected from the provided evidence.");
  } else {
    for (const line of integrationPath) {
      lines.push(`- ${line}`);
    }
  }

  lines.push("");
  lines.push("## Explanation: Static vs Browser Evidence");
  lines.push(
    "- Static evidence comes from parsing the HTML/JS source files. It shows what the code says it will do, but cannot confirm runtime behavior."
  );
  lines.push(
    "- Browser evidence is captured by loading the page in a headless browser and observing real network requests, rendered DOM, and dataLayer pushes."
  );
  if (review.browser.length === 0) {
    lines.push(
      "- This review used static evidence only. Pass --browser to add live observations (network calls, rendered hits, dataLayer events)."
    );
  } else {
    for (const result of review.browser) {
      const total =
        result.requests.autocomplete.length +
        result.requests.topItems.length +
        result.requests.trendingQueries.length +
        result.requests.analytics.length;
      lines.push(
        `- ${result.path} (${result.status}): ${total} request(s) captured; ${result.dataLayerEvents.length} dataLayer event(s). Static findings above were cross-referenced against this runtime capture.`
      );
    }
  }

  lines.push("");
  lines.push("## Explanation: How Docs Were Selected");
  if (review.docsHits.length === 0) {
    lines.push("- No docs were surfaced. Check the --docs path points at a local Luigi's Box docs repository.");
  } else {
    lines.push(
      "- Each hit is scored by keyword match against the integration shape, then surfaced with a reason explaining why it was included:"
    );
    for (const hit of review.docsHits) {
      const slug = hit.slug ? ` (${hit.slug})` : "";
      lines.push(`  - [${hit.title}](${hit.url})${slug}: ${hit.reason}`);
    }
  }

  return lines;
}

function describeIntegrationPath(review: AgentUiReview): string[] {
  const parts: string[] = [];
  const capabilitiesText = review.validation.capabilities.join(" ").toLowerCase();
  const artifactsText = review.validation.artifacts.join(" ").toLowerCase();

  const analyticsMode = detectAnalyticsMode(capabilitiesText, artifactsText);
  if (analyticsMode) parts.push(analyticsMode);

  if (/\bautocomplete\b/.test(capabilitiesText)) {
    parts.push("Autocomplete API for query suggestions");
  }

  if (/top_items|top items/.test(capabilitiesText)) {
    parts.push("Top Items on focus (recommendation placeholder before the user types)");
  }

  if (/trending_queries|trending queries/.test(capabilitiesText)) {
    parts.push("Trending Queries placeholder (dashboard-managed query suggestions)");
  }

  if (/no-results/.test(capabilitiesText)) {
    parts.push("No-results tracking branch");
  }

  if (/click\/select/.test(capabilitiesText)) {
    parts.push("Click/select analytics on suggestion selection");
  }

  return parts;
}

function detectAnalyticsMode(capabilitiesText: string, artifactsText: string): string | undefined {
  const hasDataLayer = /datalayer/.test(artifactsText) || /datalayer/.test(capabilitiesText);
  const hasEventsApi = /events api|events-api|\bevents\b/.test(capabilitiesText);
  if (hasDataLayer && hasEventsApi) return "Hybrid analytics (DataLayer + Events API)";
  if (hasDataLayer) return "DataLayer collector analytics";
  if (hasEventsApi) return "Events API analytics";
  return undefined;
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
  return `[${hit.title}](${hit.url})${slug}: ${hit.path}:${hit.line}`;
}

function formatFindingDocs(docs: string[]): string {
  if (docs.length === 0) return "none";
  return docs.map(docsMarkdownLink).join(", ");
}

function quoteExcerpt(excerpt: string): string {
  const words = excerpt.split(/\s+/).filter(Boolean);
  if (words.length <= 24) return excerpt;
  return `${words.slice(0, 24).join(" ")}...`;
}

function buildFindingDebugNotes(finding: ValidationFinding, evidence: FindingEvidence | undefined): string[] {
  const note = FINDING_DEBUG_NOTES[finding.id];
  const lookedFor = note?.lookedFor ?? deriveLookedFor(finding);
  const whyItMatters = note?.whyItMatters ?? deriveWhyItMatters(finding);
  const evidenceKind = resolveEvidenceKind(finding, evidence, note?.evidenceKind);

  return [
    `What we looked for: ${lookedFor}`,
    `What we found: ${describeWhatFound(evidence)}`,
    `Why it matters: ${whyItMatters}`,
    `Evidence type: ${evidenceKind}`
  ];
}

function describeWhatFound(evidence: FindingEvidence | undefined): string {
  if (!evidence) {
    return "no matching code path in the reviewed artifact (the pattern was absent).";
  }
  return `\`${evidence.snippet}\` at ${evidence.path}:${evidence.line}.`;
}

function deriveLookedFor(finding: ValidationFinding): string {
  // Safe fallback for finding ids that are not in the hand-written table.
  return `${finding.title.toLowerCase()} (rule ${finding.id}).`;
}

function deriveWhyItMatters(finding: ValidationFinding): string {
  return `${finding.remediation}`;
}

function resolveEvidenceKind(
  finding: ValidationFinding,
  evidence: FindingEvidence | undefined,
  hint: EvidenceKind | undefined
): EvidenceKind {
  if (evidence) return "static";
  if (hint) return hint;
  // For a frontend finding with no located snippet we still classify as static: the rule is run
  // against parsed artifacts, the snippet is just absent. Docs/browser kinds are reserved for
  // future rule sources.
  if (finding.area === "frontend") return "static";
  return "static";
}

function buildWhyThisPassedChecks(capabilities: string[]): string[] {
  // Turn the per-artifact capability summary strings (from validateFrontend) into verification
  // bullets. Each entry is of the form "<path>: endpoints=<list>; analytics=<list>". We expand
  // that into readable checks so a clean report explains which signals were positively observed.
  const checks: string[] = [];

  for (const summary of capabilities) {
    const [pathPart, ...rest] = summary.split(":");
    if (!pathPart || rest.length === 0) continue;
    const body = rest.join(":").trim();
    const parts = body.split(";").map((part) => part.trim()).filter(Boolean);

    const endpointsPart = parts.find((part) => part.startsWith("endpoints="));
    const analyticsPart = parts.find((part) => part.startsWith("analytics="));

    const endpoints = endpointsPart ? endpointsPart.slice("endpoints=".length).trim() : "";
    const analytics = analyticsPart ? analyticsPart.slice("analytics=".length).trim() : "";

    const endpointsList = endpoints && endpoints !== "none"
      ? endpoints.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    const analyticsList = analytics && analytics !== "none"
      ? analytics.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (endpointsList.length > 0) {
      checks.push(`${pathPart.trim()}: Luigi's Box endpoints evidenced: ${endpointsList.join(", ")}.`);
    }
    if (analyticsList.length > 0) {
      checks.push(`${pathPart.trim()}: analytics events evidenced: ${analyticsList.join(", ")}.`);
    }
  }

  checks.push("No P0/P1/P2 rules from the deterministic frontend rule set fired on the inputs.");
  return checks;
}
