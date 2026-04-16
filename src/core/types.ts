export type Severity = "P0" | "P1" | "P2";

export type FindingState = "failed" | "unknown";

export type ValidationArea = "catalog" | "identity" | "analytics" | "service" | "frontend";

export interface ValidationFinding {
  id: string;
  severity: Severity;
  state: FindingState;
  area: ValidationArea;
  title: string;
  message: string;
  evidencePath: string;
  remediation: string;
  docs: string[];
  confidence: number;
}

export interface ValidationReport {
  title: string;
  score: number;
  findings: ValidationFinding[];
  summary: Record<Severity, number>;
}
