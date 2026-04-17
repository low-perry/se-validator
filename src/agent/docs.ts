import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import type { DocsHit, DocsSearchInput } from "./types.js";

const DOCS_BASE_URL = "https://docs.luigisbox.com";

const DIRECT_DOCS_BY_SERVICE: Record<DocsSearchInput["service"], string[]> = {
  autocomplete: [
    "autocomplete/api/v2/autocomplete",
    "quickstart/autocomplete/query-suggestions",
    "autocomplete/api/v1/top-items",
    "quickstart/autocomplete/top-items-api",
    "autocomplete/api/v2/trending-queries",
    "quickstart/autocomplete/trending-queries",
    "analytics/collector",
    "analytics/api/events",
    "analytics/api_guides/search-and-discovery",
    "platform-foundations/lbx-script",
    "autocomplete/guides/integration-best-practices"
  ],
  catalog: [
    "indexing/feeds",
    "indexing/data-layout",
    "indexing/api/v1/content-update",
    "indexing/feeds-to-api",
    "platform-foundations/identity",
    "product-listing/guides/pairing",
    "search/guides/variants",
    "quickstart/indexing",
    "quickstart/indexing/data-layout",
    "quickstart/indexing/indexing-api"
  ]
};

const EXAMPLES_BY_SERVICE: Record<DocsSearchInput["service"], string[]> = {
  autocomplete: [
    "public/examples/autocomplete/query-suggestions.html",
    "public/examples/autocomplete/query-suggestions-datalayer.html",
    "public/examples/autocomplete/top-items.html",
    "public/examples/autocomplete/top-items-datalayer.html",
    "public/examples/autocomplete/trending-queries.html",
    "public/examples/autocomplete/trending-queries-datalayer.html"
  ],
  catalog: []
};

const SEARCHABLE_EXTENSIONS = new Set([".md", ".mdx", ".html", ".js", ".ts"]);

export async function findRelevantDocs(input: DocsSearchInput): Promise<DocsHit[]> {
  const docsRoot = resolve(input.docsRoot);
  const terms = buildSearchTerms(input);
  const directPaths = await resolveDirectPaths(docsRoot, [
    ...DIRECT_DOCS_BY_SERVICE[input.service],
    ...input.findings.flatMap((finding) => finding.docs),
    ...EXAMPLES_BY_SERVICE[input.service]
  ]);
  const scannedPaths = (await listSearchableFiles(docsRoot)).filter((path) => isServiceRelevantPath(path, input.service));
  const candidatePaths = unique([...directPaths, ...scannedPaths]);
  const scored: DocsHit[] = [];

  for (const path of candidatePaths) {
    const raw = await safeRead(path);
    if (!raw) continue;

    const hit = scoreDocument(path, raw, terms, input.findings);
    if (hit.score > 0) {
      scored.push(hit);
    }
  }

  return scored
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.path.localeCompare(right.path);
    })
    .slice(0, input.maxDocs);
}

function buildSearchTerms(input: DocsSearchInput): string[] {
  if (input.service === "catalog") {
    return buildCatalogSearchTerms(input);
  }

  const terms = new Set<string>([
    "autocomplete",
    "autocomplete api",
    "tracker_id",
    "`q`",
    "`type`",
    "hit_fields",
    "hits",
    "hit.url",
    "analytics",
    "Autocomplete",
    "view_item_list",
    "click",
    "no results"
  ]);

  if (input.capabilities.some((capability) => capability.includes("top_items"))) {
    terms.add("top_items");
    terms.add("Recommendation");
    terms.add("autocomplete_popup");
  }

  if (input.capabilities.some((capability) => capability.includes("trending_queries"))) {
    terms.add("trending_queries");
    terms.add("Trending Queries");
  }

  for (const finding of input.findings) {
    for (const token of finding.id.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length >= 4) terms.add(token);
    }

    for (const doc of finding.docs) {
      for (const token of doc.split(/[/-]/)) {
        if (token.length >= 4) terms.add(token);
      }
    }
  }

  return [...terms];
}

function buildCatalogSearchTerms(input: DocsSearchInput): string[] {
  const terms = new Set<string>([
    "feed",
    "feeds",
    "content update",
    "objects",
    "identity",
    "title",
    "web_url",
    "category",
    "hierarchy",
    "nested",
    "variant",
    "item_group_id",
    "category_id",
    "availability",
    "availability_rank",
    "ancestors"
  ]);

  for (const finding of input.findings) {
    for (const token of finding.id.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length >= 4) terms.add(token);
    }

    for (const doc of finding.docs) {
      for (const token of doc.split(/[/-]/)) {
        if (token.length >= 4) terms.add(token);
      }
    }
  }

  return [...terms];
}

async function resolveDirectPaths(docsRoot: string, docs: string[]): Promise<string[]> {
  const paths: string[] = [];

  for (const doc of unique(docs)) {
    const normalized = doc.replace(/^\/+/, "").replace(/\/+$/, "");
    const candidates = normalized.startsWith("public/")
      ? [join(docsRoot, normalized)]
      : [
          join(docsRoot, "src/content/docs", `${normalized}.md`),
          join(docsRoot, "src/content/docs", `${normalized}.mdx`),
          join(docsRoot, "src/content/docs", normalized, "index.md"),
          join(docsRoot, "src/content/docs", normalized, "index.mdx")
        ];

    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        paths.push(candidate);
        break;
      }
    }
  }

  return paths;
}

async function listSearchableFiles(docsRoot: string): Promise<string[]> {
  const roots = [join(docsRoot, "src/content/docs"), join(docsRoot, "public/examples")];
  const files: string[] = [];

  for (const root of roots) {
    if (await pathExists(root)) {
      files.push(...(await walk(root)));
    }
  }

  return files.filter((path) => SEARCHABLE_EXTENSIONS.has(extname(path)));
}

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function safeRead(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function scoreDocument(
  path: string,
  raw: string,
  terms: string[],
  findings: DocsSearchInput["findings"]
): DocsHit {
  const metadata = extractMetadata(raw, path);
  const normalizedPath = path.toLowerCase();
  const normalizedRaw = raw.toLowerCase();
  const matchedTerms: string[] = [];
  let score = 0;

  for (const term of terms) {
    const normalizedTerm = term.toLowerCase();
    if (!normalizedTerm.trim()) continue;

    const pathMatch = normalizedPath.includes(normalizedTerm.replace(/\s+/g, "-"));
    const rawMatch = normalizedRaw.includes(normalizedTerm);
    if (!pathMatch && !rawMatch) continue;

    matchedTerms.push(term);
    score += pathMatch ? 8 : 2;
    score += countOccurrences(normalizedRaw, normalizedTerm);
  }

  let referencedByFinding = false;
  for (const finding of findings) {
    if (finding.docs.some((doc) => docMatchesPath(path, doc))) {
      score += finding.severity === "P0" ? 60 : finding.severity === "P1" ? 40 : 24;
      referencedByFinding = true;
    }
  }

  if (referencedByFinding) score += 300;
  if (normalizedPath.includes("/public/examples/")) score += 8;
  if (normalizedPath.includes("/quickstart/")) score += 6;
  if (normalizedPath.includes("/api/")) score += 4;

  const excerpt = extractExcerpt(raw, terms);

  return {
    path,
    url: docsUrlFromPath(path, metadata.slug),
    title: metadata.title,
    slug: metadata.slug,
    heading: excerpt.heading,
    line: excerpt.line,
    reason: reasonForPath(path, findings),
    excerpt: excerpt.text,
    score,
    matchedTerms: unique(matchedTerms).slice(0, 8)
  };
}

export function docsUrlFromReference(reference: string): string {
  const normalized = reference
    .replace(/^\/+/, "")
    .replace(/\.(md|mdx)$/i, "")
    .replace(/\/index$/i, "")
    .replace(/^public\//, "");
  return `${DOCS_BASE_URL}/${normalized}`;
}

export function docsMarkdownLink(reference: string): string {
  const label = reference.replace(/\.(md|mdx)$/i, "");
  return `[${label}](${docsUrlFromReference(reference)})`;
}

function docsUrlFromPath(path: string, slug: string | undefined): string {
  if (slug) return `${DOCS_BASE_URL}/${slug.replace(/^\/+/, "").replace(/\/+$/, "")}`;

  const normalized = path.replace(/\\/g, "/");
  const docsMarker = "/src/content/docs/";
  const docsIndex = normalized.indexOf(docsMarker);
  if (docsIndex !== -1) {
    const sourcePath = normalized.slice(docsIndex + docsMarker.length);
    return docsUrlFromReference(sourcePath);
  }

  const publicMarker = "/public/";
  const publicIndex = normalized.indexOf(publicMarker);
  if (publicIndex !== -1) {
    const publicPath = normalized.slice(publicIndex + publicMarker.length);
    return `${DOCS_BASE_URL}/${publicPath.replace(/^\/+/, "")}`;
  }

  return DOCS_BASE_URL;
}

function extractMetadata(raw: string, path: string): { title: string; slug: string | undefined } {
  const title = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? raw.match(/^#\s+(.+)$/m)?.[1] ?? relative(process.cwd(), path);
  const slug = raw.match(/^slug:\s*["']?(.+?)["']?\s*$/m)?.[1];

  return {
    title: title.replace(/^["']|["']$/g, ""),
    slug
  };
}

function extractExcerpt(raw: string, terms: string[]): { text: string; line: number; heading: string | undefined } {
  const lines = raw.split(/\r?\n/);
  let heading: string | undefined;
  let inFrontmatter = lines[0]?.trim() === "---";
  let best:
    | {
        score: number;
        line: number;
        heading: string | undefined;
        text: string;
      }
    | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (inFrontmatter) {
      if (index > 0 && line.trim() === "---") {
        inFrontmatter = false;
      }
      continue;
    }

    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch?.[1]) {
      heading = cleanLine(headingMatch[1]);
    }

    const normalizedLine = line.toLowerCase();
    const score = scoreExcerptLine(normalizedLine, terms);
    if (score === 0) continue;

    const context = lines
      .slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
      .map(cleanLine)
      .filter(Boolean)
      .join(" ");

    if (!best || score > best.score) {
      best = {
        score,
        text: truncateWords(context || cleanLine(line), 24),
        line: index + 1,
        heading
      };
    }
  }

  if (best) {
    return {
      text: best.text,
      line: best.line,
      heading: best.heading
    };
  }

  return {
    text: truncateWords(cleanLine(lines.find((line) => line.trim() && !line.startsWith("---")) ?? ""), 24),
    line: 1,
    heading: undefined
  };
}

function scoreExcerptLine(normalizedLine: string, terms: string[]): number {
  return terms.reduce((score, term) => {
    const normalizedTerm = term.toLowerCase();
    if (!normalizedLine.includes(normalizedTerm)) return score;

    if (["autocomplete", "analytics", "hits"].includes(normalizedTerm)) return score + 1;
    if (normalizedTerm.length >= 10) return score + 10;
    if (normalizedTerm.length >= 5) return score + 5;
    return score + 2;
  }, 0);
}

function isServiceRelevantPath(path: string, service: DocsSearchInput["service"]): boolean {
  const normalized = path.replace(/\\/g, "/");

  if (service === "autocomplete") {
    return (
      normalized.includes("/autocomplete/") ||
      normalized.includes("/analytics/") ||
      normalized.includes("/platform-foundations/") ||
      normalized.endsWith("/src/content/docs/autocomplete/index.md") ||
      normalized.endsWith("/src/content/docs/tutorials/autocomplete.md") ||
      normalized.includes("/public/examples/autocomplete/")
    );
  }

  if (service === "catalog") {
    return (
      normalized.includes("/indexing/") ||
      normalized.includes("/platform-foundations/identity") ||
      normalized.includes("/product-listing/guides/pairing") ||
      normalized.includes("/search/guides/variants") ||
      normalized.includes("/quickstart/indexing")
    );
  }

  return true;
}

function reasonForPath(path: string, findings: DocsSearchInput["findings"]): string {
  const directFinding = findings.find((finding) => finding.docs.some((doc) => docMatchesPath(path, doc)));
  if (directFinding) return `Referenced by ${directFinding.id}`;
  if (path.includes("/public/examples/")) return "Runnable public example for this service";
  if (path.includes("/quickstart/")) return "Quickstart guidance for implementation flow";
  if (path.includes("/api/")) return "API reference for request or payload contract";
  return "Related docs search match";
}

function docMatchesPath(path: string, doc: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedDoc = doc.replace(/^\/+/, "").replace(/\/+$/, "");
  return (
    normalizedPath.endsWith(`/src/content/docs/${normalizedDoc}.md`) ||
    normalizedPath.endsWith(`/src/content/docs/${normalizedDoc}.mdx`) ||
    normalizedPath.endsWith(`/src/content/docs/${normalizedDoc}/index.md`) ||
    normalizedPath.endsWith(`/src/content/docs/${normalizedDoc}/index.mdx`)
  );
}

function countOccurrences(raw: string, term: string): number {
  if (term.length < 2) return 0;
  let count = 0;
  let index = raw.indexOf(term);

  while (index !== -1) {
    count += 1;
    index = raw.indexOf(term, index + term.length);
  }

  return Math.min(count, 20);
}

function cleanLine(line: string): string {
  return line
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateWords(value: string, maxWords: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
