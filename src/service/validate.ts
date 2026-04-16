import { scoreFindings, summarizeFindings } from "../core/findings.js";
import type { ValidationReport } from "../core/types.js";
import { isRecord } from "../catalog/detect.js";
import { parseServiceProfiles } from "./parse.js";
import { executeServiceCheck } from "./http.js";
import { serviceRules } from "./rules.js";
import type { AutocompleteEndpoint, ServiceArtifact, ServiceCheck, ServiceCheckExecution } from "./types.js";

export async function validateService(
  paths: string[]
): Promise<ValidationReport & { artifacts: string[]; checks: string[]; requests: string[] }> {
  const artifacts = await parseServiceProfiles(paths);
  const executions = await executeChecks(artifacts);
  const findings = serviceRules.flatMap((rule) => rule(artifacts, executions));

  return {
    title: "Autocomplete Service API Validation Report",
    artifacts: artifacts.map(
      (artifact) =>
        `${artifact.path}: ${artifact.profile?.service ?? "unknown"} (${artifact.profile?.checks.length ?? 0} check${
          artifact.profile?.checks.length === 1 ? "" : "s"
        }, ${Math.round(artifact.confidence * 100)}%)`
    ),
    checks: artifacts.flatMap((artifact) =>
      artifact.profile?.checks.map((check, index) => `${artifact.path}:checks[${index}]: ${check.endpoint} / ${check.name}`) ?? []
    ),
    requests: executions.map(
      (execution) =>
        `${execution.checkName}: ${execution.status ?? "failed"} in ${execution.durationMs ?? 0}ms / ${execution.url}`
    ),
    score: scoreFindings(findings),
    findings,
    summary: summarizeFindings(findings)
  };
}

async function executeChecks(artifacts: ServiceArtifact[]): Promise<ServiceCheckExecution[]> {
  const executableChecks = artifacts.flatMap((artifact) =>
    artifact.profile?.checks.flatMap((check) => {
      if (!isExecutableCheck(check)) return [];
      return [{ artifactPath: artifact.path, check }];
    }) ?? []
  );

  return Promise.all(executableChecks.map(({ artifactPath, check }) => executeServiceCheck(artifactPath, check)));
}

function isExecutableCheck(value: unknown): value is ServiceCheck {
  return isRecord(value) && isKnownEndpoint(value.endpoint) && isRecord(value.request) && typeof value.request.url === "string";
}

function isKnownEndpoint(value: unknown): value is AutocompleteEndpoint {
  return value === "autocomplete" || value === "top_items" || value === "personalized_top_items" || value === "trending_queries";
}
