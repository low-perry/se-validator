export type AnalyticsSourceKind = "events-api-json" | "unknown";

export type AnalyticsEventKind = "pv" | "event" | "click" | "transaction" | "unknown";

export interface AnalyticsArtifact {
  path: string;
  raw: string;
  parsed: unknown;
  events: AnalyticsEvent[];
  sourceKind: AnalyticsSourceKind;
  parseError: string | undefined;
  confidence: number;
}

export interface AnalyticsEvent {
  sourcePath: string;
  index: number;
  payload: unknown;
  type: string | undefined;
  kind: AnalyticsEventKind;
}
