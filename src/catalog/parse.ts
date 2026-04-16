import { readFile } from "node:fs/promises";
import { detectCatalogArtifact, type CatalogArtifact } from "./detect.js";

export async function parseCatalogArtifacts(paths: string[]): Promise<CatalogArtifact[]> {
  const artifacts: CatalogArtifact[] = [];

  for (const path of paths) {
    let raw = "";
    try {
      raw = await readCatalogInput(path);
      artifacts.push(detectCatalogArtifact(path, raw));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      artifacts.push({
        path,
        raw,
        parsed: {},
        sourceKind: "unknown",
        role: "unknown",
        rootKey: undefined,
        parseError: message,
        confidence: 0.98
      });
    }
  }

  return artifacts;
}

async function readCatalogInput(pathOrUrl: string): Promise<string> {
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

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
