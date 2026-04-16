import { scoreFindings, summarizeFindings } from "../core/findings.js";
import type { ValidationReport } from "../core/types.js";
import { normalizeCatalog } from "./normalize.js";
import { parseCatalogArtifacts } from "./parse.js";
import { catalogRules } from "./rules.js";

export async function validateCatalog(paths: string[]): Promise<ValidationReport & { artifacts: string[] }> {
  const artifacts = await parseCatalogArtifacts(paths);
  const catalog = normalizeCatalog(artifacts);
  const findings = catalogRules.flatMap((rule) => rule(catalog));

  return {
    title: "Catalog Validation Report",
    artifacts: artifacts.map(
      (artifact) => `${artifact.path}: ${artifact.sourceKind} / ${artifact.role} (${Math.round(artifact.confidence * 100)}%)`
    ),
    score: scoreFindings(findings),
    findings,
    summary: summarizeFindings(findings)
  };
}
