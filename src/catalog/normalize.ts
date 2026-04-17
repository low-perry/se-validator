import { isRecord, type CatalogArtifact } from "./detect.js";

export interface NormalizedCatalog {
  artifacts: CatalogArtifact[];
  objects: NormalizedCatalogObject[];
}

export interface NormalizedCatalogObject {
  sourcePath: string;
  sourceKind: string;
  role: string;
  objectType: string;
  recordKey: string | undefined;
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

  const itemKeys = itemKeysForArtifact(artifact);
  if (itemKeys.length === 0) return [];

  const records = Array.isArray(artifact.parsed)
    ? recordsFromArrayFeed(artifact)
    : recordsFromWrappedFeed(artifact, itemKeys);

  return records.filter(isFeedRecordObjectEntry).map((entry, index) => {
    const { record, recordKey } = entry;
    const fields = flattenFeedRecord(record);
    const objectType = objectTypeFromFeedRecord(record, artifact.role, recordKey);

    return {
      sourcePath: artifact.path,
      sourceKind: artifact.sourceKind,
      role: artifact.role,
      objectType,
      recordKey,
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

function recordsFromWrappedFeed(artifact: CatalogArtifact, itemKeys: readonly string[]): FeedRecordEntry[] {
  if (!isRecord(artifact.parsed) || !artifact.rootKey) return [];

  const root = artifact.parsed[artifact.rootKey];
  if (Array.isArray(root)) {
    const recordKey = objectTypeFromRootKey(artifact.rootKey);
    return root.map((record) => ({ record, recordKey }));
  }

  return itemKeys.flatMap((key) => {
    if (!isRecord(root)) return [];
    return toArray(root[key]).map((record) => ({ record, recordKey: key }));
  });
}

interface FeedRecordEntry {
  record: unknown;
  recordKey: string | undefined;
}

interface FeedRecordObjectEntry extends FeedRecordEntry {
  record: Record<string, unknown>;
}

function isFeedRecordObjectEntry(entry: FeedRecordEntry): entry is FeedRecordObjectEntry {
  return isRecord(entry.record);
}

function recordsFromArrayFeed(artifact: CatalogArtifact): FeedRecordEntry[] {
  if (!Array.isArray(artifact.parsed)) return [];
  return artifact.parsed.map((record) => ({
    record,
    recordKey: isRecord(record) ? normalizeObjectType(stringValue(record.type)) : objectTypeFromRole(artifact.role)
  }));
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
      recordKey: contentType,
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

function itemKeysForArtifact(artifact: CatalogArtifact): string[] {
  const knownKeys = roleItemKey[artifact.role as keyof typeof roleItemKey];
  if (knownKeys) return [...knownKeys];

  if (artifact.role !== "custom-feed" || !artifact.rootKey || !isRecord(artifact.parsed)) return [];
  const root = artifact.parsed[artifact.rootKey];
  if (Array.isArray(root)) return [objectTypeFromRootKey(artifact.rootKey)];
  if (!isRecord(root)) return [];

  const singularRoot = objectTypeFromRootKey(artifact.rootKey);
  const keys = new Set<string>();
  if (hasRecordValue(root[singularRoot])) keys.add(singularRoot);

  for (const [key, value] of Object.entries(root)) {
    if (hasRecordValue(value)) keys.add(key);
  }

  return [...keys];
}

function hasRecordValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isRecord);
  return isRecord(value);
}

function objectTypeFromRole(role: string): string {
  if (role === "category-feed") return "category";
  if (role === "brand-feed") return "brand";
  if (role === "article-feed") return "article";
  return "product";
}

function objectTypeFromFeedRecord(record: Record<string, unknown>, role: string, recordKey: string | undefined): string {
  const explicitType = normalizeObjectType(stringValue(record.type));
  if (explicitType !== "content-object") return objectTypeFromContentType(explicitType);
  if (role === "custom-feed" && recordKey) return normalizeObjectType(recordKey);
  return objectTypeFromRole(role);
}

function objectTypeFromContentType(type: string | undefined): string {
  const normalizedType = normalizeObjectType(type);
  if (normalizedType === "item" || normalizedType === "product") return "product";
  if (normalizedType === "category") return "category";
  if (normalizedType === "brand") return "brand";
  if (normalizedType === "article") return "article";
  return normalizedType;
}

function objectTypeFromRootKey(rootKey: string): string {
  return normalizeObjectType(singularize(rootKey));
}

function normalizeObjectType(type: string | undefined): string {
  const normalized = type?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "content-object";
}

function singularize(value: string): string {
  if (value.endsWith("ies") && value.length > 3) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && value.length > 1) return value.slice(0, -1);
  return value;
}

export function isCategoryObject(object: NormalizedCatalogObject): boolean {
  return object.objectType === "category";
}

export function isProductLikeObject(object: NormalizedCatalogObject): boolean {
  return !["category", "brand", "article"].includes(object.objectType);
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
