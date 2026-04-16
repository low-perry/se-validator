import { isRecord, type CatalogArtifact } from "./detect.js";

export interface NormalizedCatalog {
  artifacts: CatalogArtifact[];
  objects: NormalizedCatalogObject[];
}

export interface NormalizedCatalogObject {
  sourcePath: string;
  sourceKind: string;
  role: string;
  objectType: "product" | "category" | "brand" | "article" | "content-object";
  index: number;
  identity: string | undefined;
  title: string | undefined;
  webUrl: string | undefined;
  fields: Record<string, unknown>;
  categoryPaths: string[];
  itemGroupId: string | undefined;
  raw: unknown;
}

const roleItemKey = {
  "product-feed": ["item", "product"],
  "category-feed": ["category"],
  "brand-feed": ["brand"],
  "article-feed": ["article"]
} as const;

export function normalizeCatalog(artifacts: CatalogArtifact[]): NormalizedCatalog {
  return {
    artifacts,
    objects: artifacts.flatMap(normalizeArtifact)
  };
}

function normalizeArtifact(artifact: CatalogArtifact): NormalizedCatalogObject[] {
  if (artifact.role === "content-update") {
    return normalizeContentUpdate(artifact);
  }

  const itemKeys = roleItemKey[artifact.role as keyof typeof roleItemKey];
  if (!itemKeys) return [];

  const records = Array.isArray(artifact.parsed)
    ? artifact.parsed
    : recordsFromWrappedFeed(artifact, itemKeys);

  return records.filter(isRecord).map((record, index) => {
    const fields = flattenFeedRecord(record);
    const objectType = objectTypeFromRole(artifact.role);

    return {
      sourcePath: artifact.path,
      sourceKind: artifact.sourceKind,
      role: artifact.role,
      objectType,
      index,
      identity: stringValue(fields.identity),
      title: stringValue(fields.title),
      webUrl: stringValue(fields.web_url),
      fields,
      categoryPaths: categoryPathsFromFeedField(record.category),
      itemGroupId: stringValue(fields.item_group_id),
      raw: record
    };
  });
}

function recordsFromWrappedFeed(artifact: CatalogArtifact, itemKeys: readonly string[]): unknown[] {
  if (!isRecord(artifact.parsed) || !artifact.rootKey) return [];

  const root = artifact.parsed[artifact.rootKey];
  if (Array.isArray(root)) return root;

  return itemKeys.flatMap((key) => {
    if (!isRecord(root)) return [];
    return toArray(root[key]);
  });
}

function normalizeContentUpdate(artifact: CatalogArtifact): NormalizedCatalogObject[] {
  if (!isRecord(artifact.parsed) || !Array.isArray(artifact.parsed.objects)) return [];

  return artifact.parsed.objects.map((record, index) => {
    const fields = isRecord(record) && isRecord(record.fields) ? record.fields : {};
    const contentType = isRecord(record) ? stringValue(record.type) : undefined;

    return {
      sourcePath: artifact.path,
      sourceKind: artifact.sourceKind,
      role: artifact.role,
      objectType: objectTypeFromContentType(contentType),
      index,
      identity: isRecord(record) ? stringValue(record.identity) : undefined,
      title: stringValue(fields.title),
      webUrl: stringValue(fields.web_url),
      fields,
      categoryPaths: categoryPathsFromContentUpdate(record),
      itemGroupId: stringValue(fields.item_group_id),
      raw: record
    };
  });
}

function categoryPathsFromContentUpdate(record: unknown): string[] {
  if (!isRecord(record) || !Array.isArray(record.nested)) return [];

  return record.nested
    .filter(isRecord)
    .filter((nested) => stringValue(nested.type)?.toLowerCase() === "category")
    .map(categoryPathFromNestedCategory)
    .filter((path): path is string => Boolean(path));
}

function categoryPathFromNestedCategory(category: Record<string, unknown>): string | undefined {
  if (!isRecord(category.fields)) return undefined;

  const ancestorTitles = Array.isArray(category.fields.ancestors)
    ? category.fields.ancestors
        .map((ancestor) => (isRecord(ancestor) && isRecord(ancestor.fields) ? stringValue(ancestor.fields.title) : undefined))
        .filter((title): title is string => Boolean(title))
    : [];
  const leafTitle = stringValue(category.fields.title);
  if (!leafTitle) return undefined;

  return normalizeCategoryPath([...ancestorTitles, leafTitle].join(" | "));
}

function flattenFeedRecord(record: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("@_")) continue;
    if (isRecord(value) && "#text" in value) {
      fields[key] = value["#text"];
      continue;
    }
    fields[key] = value;
  }

  return fields;
}

function categoryPathsFromFeedField(value: unknown): string[] {
  return toArray(value)
    .map((category) => {
      if (isRecord(category) && typeof category["#text"] === "string") return category["#text"];
      if (Array.isArray(category)) return category.map(String).join(" | ");
      if (typeof category === "string") return category;
      return undefined;
    })
    .filter((path): path is string => Boolean(path))
    .map(normalizeCategoryPath);
}

function objectTypeFromRole(role: string): NormalizedCatalogObject["objectType"] {
  if (role === "category-feed") return "category";
  if (role === "brand-feed") return "brand";
  if (role === "article-feed") return "article";
  return "product";
}

function objectTypeFromContentType(type: string | undefined): NormalizedCatalogObject["objectType"] {
  const normalizedType = type?.toLowerCase();
  if (normalizedType === "item" || normalizedType === "product") return "product";
  if (normalizedType === "category") return "category";
  if (normalizedType === "brand") return "brand";
  if (normalizedType === "article") return "article";
  return "content-object";
}

export function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isRecord(value) && typeof value["#text"] === "string") return value["#text"].trim() || undefined;
  return undefined;
}

export function normalizeCategoryPath(value: string): string {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" | ");
}
