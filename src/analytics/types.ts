export type AnalyticsSourceKind = "events-api-json" | "datalayer-html" | "datalayer-js" | "unknown";

export type AnalyticsIntegrationKind = "events-api" | "datalayer" | "unknown";

export type AnalyticsEventKind =
  | "pv"
  | "event"
  | "click"
  | "transaction"
  | "view_item_list"
  | "view_item"
  | "select_item"
  | "add_to_cart"
  | "purchase"
  | "collector-customer-id"
  | "unknown";

export interface CollectorScriptEvidence {
  present: boolean;
  inHead: boolean;
  async: boolean;
  src: string | undefined;
}

export interface AnalyticsArtifact {
  path: string;
  raw: string;
  parsed: unknown;
  events: AnalyticsEvent[];
  sourceKind: AnalyticsSourceKind;
  parseError: string | undefined;
  collectorScript: CollectorScriptEvidence | undefined;
  confidence: number;
}

export interface AnalyticsEvent {
  sourcePath: string;
  index: number;
  payload: unknown;
  type: string | undefined;
  integration: AnalyticsIntegrationKind;
  method: "events-api" | "dataLayer.push" | "unknown";
  kind: AnalyticsEventKind;
}
