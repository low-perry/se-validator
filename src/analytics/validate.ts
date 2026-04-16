import { scoreFindings, summarizeFindings } from "../core/findings.js";
import type { ValidationReport } from "../core/types.js";
import { parseAnalyticsArtifacts } from "./parse.js";
import { analyticsRules } from "./rules.js";

export async function validateAnalytics(paths: string[]): Promise<ValidationReport & { artifacts: string[]; events: string[] }> {
  const artifacts = await parseAnalyticsArtifacts(paths);
  const findings = analyticsRules.flatMap((rule) => rule(artifacts));

  return {
    title: reportTitle(artifacts.map((artifact) => artifact.sourceKind)),
    artifacts: artifacts.map(
      (artifact) =>
        `${artifact.path}: ${artifact.sourceKind} (${artifact.events.length} event${artifact.events.length === 1 ? "" : "s"}, ${Math.round(
          artifact.confidence * 100
        )}%)`
    ),
    events: artifacts.flatMap((artifact) =>
      artifact.events.map((event) => `${event.sourcePath}:events[${event.index}]: ${event.method} / ${event.kind}${listSummary(event.payload)}`)
    ),
    score: scoreFindings(findings),
    findings,
    summary: summarizeFindings(findings)
  };
}

function reportTitle(sourceKinds: string[]): string {
  const hasEventsApi = sourceKinds.includes("events-api-json");
  const hasDataLayer = sourceKinds.includes("datalayer-html") || sourceKinds.includes("datalayer-js");

  if (hasDataLayer && !hasEventsApi) return "Analytics DataLayer Collector Validation Report";
  if (hasEventsApi && !hasDataLayer) return "Analytics Events API Validation Report";
  return "Analytics Validation Report";
}

function listSummary(payload: unknown): string {
  if (isRecord(payload) && isRecord(payload.ecommerce) && typeof payload.ecommerce.item_list_name === "string") {
    return ` / ${payload.ecommerce.item_list_name}`;
  }

  if (!isRecord(payload) || !isRecord(payload.lists)) return "";

  const listNames = Object.keys(payload.lists);
  if (listNames.length === 0) return " / no lists";
  return ` / ${listNames.join(", ")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
