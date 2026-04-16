import type { Severity, ValidationArea, ValidationFinding } from "./types.js";

export interface FindingInput {
  id: string;
  severity: Severity;
  state?: "failed" | "unknown";
  area?: ValidationArea;
  title: string;
  message: string;
  evidencePath: string;
  remediation: string;
  docs: string[];
  confidence?: number;
}

export function createFinding(input: FindingInput): ValidationFinding {
  return {
    state: "failed",
    area: "catalog",
    confidence: 0.85,
    ...input
  };
}

export function scoreFindings(findings: ValidationFinding[]): number {
  const penalty = findings.reduce((total, finding) => {
    if (finding.state === "unknown") {
      return total + (finding.severity === "P0" ? 5 : finding.severity === "P1" ? 2 : 1);
    }

    if (finding.severity === "P0") return total + 15;
    if (finding.severity === "P1") return total + 7;
    return total + 3;
  }, 0);

  return Math.max(0, 100 - penalty);
}

export function summarizeFindings(findings: ValidationFinding[]): Record<Severity, number> {
  return {
    P0: findings.filter((finding) => finding.severity === "P0").length,
    P1: findings.filter((finding) => finding.severity === "P1").length,
    P2: findings.filter((finding) => finding.severity === "P2").length
  };
}
