import { readFile } from "node:fs/promises";
import { detectCatalogArtifact, type CatalogArtifact } from "./detect.js";

export async function parseCatalogArtifacts(paths: string[]): Promise<CatalogArtifact[]> {
  const artifacts: CatalogArtifact[] = [];

  for (const path of paths) {
    const raw = await readFile(path, "utf8");
    try {
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
