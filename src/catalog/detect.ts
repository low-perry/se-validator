import { XMLParser, XMLValidator } from "fast-xml-parser";

export type CatalogSourceKind = "feed-xml" | "feed-json" | "content-update-json" | "unknown";

export type CatalogArtifactRole =
  | "product-feed"
  | "category-feed"
  | "brand-feed"
  | "article-feed"
  | "content-update"
  | "unknown";

export interface CatalogArtifact {
  path: string;
  raw: string;
  parsed: unknown;
  sourceKind: CatalogSourceKind;
  role: CatalogArtifactRole;
  rootKey: string | undefined;
  parseError: string | undefined;
  confidence: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  ignoreDeclaration: true
});

export function detectCatalogArtifact(path: string, raw: string): CatalogArtifact {
  const trimmed = raw.trim();

  if (trimmed.startsWith("<")) {
    const validation = XMLValidator.validate(raw);
    if (validation !== true) {
      return {
        path,
        raw,
        parsed: {},
        rootKey: undefined,
        parseError: `Invalid XML at ${validation.err.line}:${validation.err.col} - ${validation.err.msg}`,
        sourceKind: "unknown",
        role: "unknown",
        confidence: 0.98
      };
    }

    const parsed = xmlParser.parse(raw) as unknown;
    const rootKey = firstObjectKey(parsed);
    return {
      path,
      raw,
      parsed,
      rootKey,
      parseError: undefined,
      sourceKind: "feed-xml",
      role: roleFromRootKey(rootKey),
      confidence: rootKey ? 0.95 : 0.4
    };
  }

  const parsed = JSON.parse(raw) as unknown;
  const rootKey = firstObjectKey(parsed);

  if (isRecord(parsed) && Array.isArray(parsed.objects)) {
    return {
      path,
      raw,
      parsed,
      rootKey: "objects",
      parseError: undefined,
      sourceKind: "content-update-json",
      role: "content-update",
      confidence: 0.96
    };
  }

  return {
    path,
    raw,
    parsed,
    rootKey,
    parseError: undefined,
    sourceKind: rootKey ? "feed-json" : "unknown",
    role: roleFromRootKey(rootKey),
    confidence: rootKey ? 0.9 : 0.2
  };
}

function roleFromRootKey(rootKey: string | undefined): CatalogArtifactRole {
  if (rootKey === "items" || rootKey === "products") return "product-feed";
  if (rootKey === "categories") return "category-feed";
  if (rootKey === "brands") return "brand-feed";
  if (rootKey === "articles") return "article-feed";
  return "unknown";
}

function firstObjectKey(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return Object.keys(value)[0];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
