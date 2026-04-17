import { XMLParser, XMLValidator } from "fast-xml-parser";

export type CatalogSourceKind = "feed-xml" | "feed-json" | "content-update-json" | "unknown";

export type CatalogArtifactRole =
  | "product-feed"
  | "category-feed"
  | "brand-feed"
  | "article-feed"
  | "custom-feed"
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
    if (looksLikeHtmlDocument(trimmed)) {
      return {
        path,
        raw,
        parsed: {},
        rootKey: undefined,
        parseError: "Input appears to be an HTML document, not an XML or JSON catalog feed.",
        sourceKind: "unknown",
        role: "unknown",
        confidence: 0.98
      };
    }

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
    const role = roleFromParsedFeed(rootKey, parsed);
    return {
      path,
      raw,
      parsed,
      rootKey,
      parseError: undefined,
      sourceKind: "feed-xml",
      role,
      confidence: confidenceForRole(rootKey, role)
    };
  }

  const parsed = JSON.parse(raw) as unknown;
  const rootKey = firstObjectKey(parsed);

  if (Array.isArray(parsed)) {
    const role = roleFromJsonArray(path, parsed);
    return {
      path,
      raw,
      parsed,
      rootKey: undefined,
      parseError: undefined,
      sourceKind: "feed-json",
      role,
      confidence: role === "unknown" ? 0.35 : 0.82
    };
  }

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

  const role = roleFromParsedFeed(rootKey, parsed);
  return {
    path,
    raw,
    parsed,
    rootKey,
    parseError: undefined,
    sourceKind: rootKey ? "feed-json" : "unknown",
    role,
    confidence: confidenceForRole(rootKey, role)
  };
}

function roleFromParsedFeed(rootKey: string | undefined, parsed: unknown): CatalogArtifactRole {
  const knownRole = roleFromRootKey(rootKey);
  if (knownRole !== "unknown") return knownRole;
  if (!rootKey || !isRecord(parsed)) return "unknown";

  const root = parsed[rootKey];
  if (feedRecordCandidates(rootKey, root).length > 0) return "custom-feed";
  return "unknown";
}

function roleFromRootKey(rootKey: string | undefined): CatalogArtifactRole {
  if (rootKey === "items" || rootKey === "products") return "product-feed";
  if (rootKey === "categories") return "category-feed";
  if (rootKey === "brands") return "brand-feed";
  if (rootKey === "articles") return "article-feed";
  return "unknown";
}

function roleFromJsonArray(path: string, records: unknown[]): CatalogArtifactRole {
  const lowerPath = path.toLowerCase();

  if (lowerPath.includes("categor")) return "category-feed";
  if (lowerPath.includes("brand")) return "brand-feed";
  if (lowerPath.includes("article")) return "article-feed";

  const recordObjects = records.filter(isRecord);
  if (recordObjects.some((record) => "category" in record || "item_group_id" in record || "availability" in record)) {
    return "product-feed";
  }

  if (recordObjects.some((record) => "hierarchy" in record)) return "category-feed";
  if (lowerPath.includes("item") || lowerPath.includes("product") || lowerPath.includes("feed")) return "product-feed";
  if (recordObjects.some((record) => hasSearchableObjectFields(record) || typeof record.type === "string")) {
    return "custom-feed";
  }

  return "unknown";
}

function feedRecordCandidates(rootKey: string, root: unknown): string[] {
  if (Array.isArray(root)) return root.some(isRecord) ? [singularize(rootKey)] : [];
  if (!isRecord(root)) return [];

  const singularRoot = singularize(rootKey);
  const candidates: string[] = [];
  if (hasRecordValue(root[singularRoot])) candidates.push(singularRoot);

  for (const [key, value] of Object.entries(root)) {
    if (candidates.includes(key)) continue;
    if (hasRecordValue(value)) candidates.push(key);
  }

  return candidates;
}

function hasRecordValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isRecord);
  return isRecord(value);
}

function hasSearchableObjectFields(record: Record<string, unknown>): boolean {
  return ["identity", "title", "web_url"].some((field) => field in record);
}

function confidenceForRole(rootKey: string | undefined, role: CatalogArtifactRole): number {
  if (!rootKey) return 0.4;
  if (role === "custom-feed") return 0.86;
  if (role !== "unknown") return 0.95;
  return 0.4;
}

function singularize(value: string): string {
  if (value.endsWith("ies") && value.length > 3) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && value.length > 1) return value.slice(0, -1);
  return value;
}

function firstObjectKey(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return Object.keys(value)[0];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeHtmlDocument(value: string): boolean {
  const sample = value.slice(0, 1000).toLowerCase();
  return (
    sample.startsWith("<!doctype html") ||
    sample.startsWith("<html") ||
    sample.includes("<head") ||
    sample.includes("<body")
  );
}
