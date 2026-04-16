import { readFile } from "node:fs/promises";
import { isRecord } from "../catalog/detect.js";
import type { AnalyticsArtifact, AnalyticsEvent, AnalyticsEventKind } from "./types.js";

export async function parseAnalyticsArtifacts(paths: string[]): Promise<AnalyticsArtifact[]> {
  const artifacts: AnalyticsArtifact[] = [];

  for (const path of paths) {
    let raw = "";
    try {
      raw = await readAnalyticsInput(path);
      const parsed = JSON.parse(raw) as unknown;
      const payloads = eventPayloadsFromParsed(parsed);
      const events = payloads.map((payload, index) => normalizeEvent(path, index, payload));

      artifacts.push({
        path,
        raw,
        parsed,
        events,
        sourceKind: "events-api-json",
        parseError: undefined,
        confidence: events.length > 0 ? 0.95 : 0.45
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      artifacts.push({
        path,
        raw,
        parsed: {},
        events: [],
        sourceKind: "unknown",
        parseError: message,
        confidence: 0.98
      });
    }
  }

  return artifacts;
}

async function readAnalyticsInput(pathOrUrl: string): Promise<string> {
  if (isHttpUrl(pathOrUrl)) {
    const response = await fetch(pathOrUrl, {
      headers: {
        "user-agent": "se-validator/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${pathOrUrl}: HTTP ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  return readFile(pathOrUrl, "utf8");
}

function eventPayloadsFromParsed(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.events)) return parsed.events;
  return [parsed];
}

function normalizeEvent(sourcePath: string, index: number, payload: unknown): AnalyticsEvent {
  const type = isRecord(payload) && typeof payload.type === "string" ? payload.type : undefined;

  return {
    sourcePath,
    index,
    payload,
    type,
    kind: eventKind(type)
  };
}

function eventKind(type: string | undefined): AnalyticsEventKind {
  if (type === "pv" || type === "event" || type === "click" || type === "transaction") return type;
  return "unknown";
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
