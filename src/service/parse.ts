import { readFile } from "node:fs/promises";
import { isRecord } from "../catalog/detect.js";
import type { ServiceArtifact, ServiceProfile } from "./types.js";

export async function parseServiceProfiles(paths: string[]): Promise<ServiceArtifact[]> {
  return Promise.all(paths.map(parseServiceProfile));
}

async function parseServiceProfile(path: string): Promise<ServiceArtifact> {
  let raw = "";

  try {
    raw = await readText(path);
    const parsed = JSON.parse(raw) as unknown;
    const profile = detectProfile(parsed);

    return {
      path,
      raw,
      parsed,
      profile,
      parseError: profile ? undefined : "JSON is not an autocomplete-api service profile with a checks[] array.",
      confidence: profile ? 0.95 : 0.25
    };
  } catch (error) {
    return {
      path,
      raw,
      parsed: {},
      profile: undefined,
      parseError: error instanceof Error ? error.message : "Service profile could not be parsed as JSON.",
      confidence: 0.98
    };
  }
}

async function readText(path: string): Promise<string> {
  if (/^https?:\/\//i.test(path)) {
    const response = await fetch(path);
    return response.text();
  }

  return readFile(path, "utf8");
}

function detectProfile(value: unknown): ServiceProfile | undefined {
  if (!isRecord(value)) return undefined;
  if (value.service !== "autocomplete-api") return undefined;
  if (!Array.isArray(value.checks)) return undefined;
  return value as unknown as ServiceProfile;
}
