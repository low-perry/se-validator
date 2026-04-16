import { readFile } from "node:fs/promises";
import { parse as parseJavaScript } from "acorn";
import { isRecord } from "../catalog/detect.js";
import type {
  AnalyticsArtifact,
  AnalyticsEvent,
  AnalyticsEventKind,
  CollectorScriptEvidence
} from "./types.js";

export async function parseAnalyticsArtifacts(paths: string[]): Promise<AnalyticsArtifact[]> {
  const artifacts: AnalyticsArtifact[] = [];

  for (const path of paths) {
    let raw = "";
    try {
      raw = await readAnalyticsInput(path);

      if (looksLikeDataLayerEvidence(raw)) {
        artifacts.push(parseDataLayerArtifact(path, raw));
        continue;
      }

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
        collectorScript: undefined,
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
        collectorScript: undefined,
        confidence: 0.98
      });
    }
  }

  return artifacts;
}

function parseDataLayerArtifact(path: string, raw: string): AnalyticsArtifact {
  const html = looksLikeHtml(raw);
  const scripts = html ? extractInlineScripts(raw) : [raw];
  const payloads: unknown[] = [];
  const errors: string[] = [];

  scripts.forEach((script, scriptIndex) => {
    try {
      payloads.push(...extractDataLayerPushPayloads(script));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Script ${scriptIndex}: ${message}`);
    }
  });

  if (payloads.length === 0) {
    errors.push("No window.dataLayer.push(...) calls with static object payloads were found.");
  }

  const events = payloads.map((payload, index) => normalizeDataLayerEvent(path, index, payload));

  return {
    path,
    raw,
    parsed: payloads,
    events,
    sourceKind: html ? "datalayer-html" : "datalayer-js",
    parseError: errors[0],
    collectorScript: html ? detectCollectorScript(raw) : undefined,
    confidence: events.length > 0 ? 0.9 : 0.4
  };
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
    integration: "events-api",
    method: "events-api",
    kind: eventKind(type)
  };
}

function normalizeDataLayerEvent(sourcePath: string, index: number, payload: unknown): AnalyticsEvent {
  const type = isRecord(payload) && typeof payload.event === "string" ? payload.event : undefined;

  return {
    sourcePath,
    index,
    payload,
    type,
    integration: "datalayer",
    method: "dataLayer.push",
    kind: dataLayerEventKind(type)
  };
}

function eventKind(type: string | undefined): AnalyticsEventKind {
  if (type === "pv" || type === "event" || type === "click" || type === "transaction") return type;
  return "unknown";
}

function dataLayerEventKind(type: string | undefined): AnalyticsEventKind {
  if (
    type === "view_item_list" ||
    type === "view_item" ||
    type === "select_item" ||
    type === "add_to_cart" ||
    type === "purchase"
  ) {
    return type;
  }

  if (type === "luigisbox.collector.customer_id") return "collector-customer-id";
  return "unknown";
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function looksLikeDataLayerEvidence(raw: string): boolean {
  return /\bdataLayer\.push\s*\(/.test(raw) || /\bwindow\.dataLayer\.push\s*\(/.test(raw);
}

function looksLikeHtml(raw: string): boolean {
  const sample = raw.slice(0, 1000).toLowerCase();
  return sample.includes("<!doctype html") || sample.includes("<html") || sample.includes("<head");
}

function extractInlineScripts(raw: string): string[] {
  const scripts: string[] = [];
  const scriptPattern = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(raw)) !== null) {
    scripts.push(match[1] ?? "");
  }

  return scripts;
}

function extractDataLayerPushPayloads(script: string): unknown[] {
  const ast = parseJavaScript(script, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowReturnOutsideFunction: true
  }) as unknown;
  const payloads: unknown[] = [];
  const unsupported: string[] = [];

  walkAst(ast, (node) => {
    if (!isDataLayerPushCall(node)) return;

    const firstArgument = Array.isArray(node.arguments) ? node.arguments[0] : undefined;
    const value = literalValue(firstArgument);
    if (!value.supported) {
      unsupported.push("dataLayer.push argument must be a static object literal.");
      return;
    }

    payloads.push(value.value);
  });

  if (payloads.length === 0 && unsupported.length > 0) {
    throw new Error(unsupported[0]);
  }

  return payloads;
}

interface LiteralValueResult {
  supported: boolean;
  value: unknown;
}

function literalValue(node: unknown): LiteralValueResult {
  if (!isRecord(node)) return { supported: false, value: undefined };

  if (node.type === "Literal") {
    return { supported: true, value: node.value };
  }

  if (node.type === "ArrayExpression" && Array.isArray(node.elements)) {
    const values: unknown[] = [];
    for (const element of node.elements) {
      if (element === null) {
        values.push(null);
        continue;
      }

      const value = literalValue(element);
      if (!value.supported) return { supported: false, value: undefined };
      values.push(value.value);
    }

    return { supported: true, value: values };
  }

  if (node.type === "ObjectExpression" && Array.isArray(node.properties)) {
    const object: Record<string, unknown> = {};

    for (const property of node.properties) {
      if (!isRecord(property) || property.type !== "Property") return { supported: false, value: undefined };

      const key = propertyKey(property.key);
      if (!key) return { supported: false, value: undefined };

      const value = literalValue(property.value);
      if (!value.supported) return { supported: false, value: undefined };
      object[key] = value.value;
    }

    return { supported: true, value: object };
  }

  if (node.type === "UnaryExpression" && node.operator === "-" && isRecord(node.argument)) {
    const argument = literalValue(node.argument);
    if (typeof argument.value === "number") return { supported: true, value: -argument.value };
  }

  return { supported: false, value: undefined };
}

function propertyKey(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  if (node.type === "Identifier" && typeof node.name === "string") return node.name;
  if (node.type === "Literal" && (typeof node.value === "string" || typeof node.value === "number")) {
    return String(node.value);
  }
  return undefined;
}

function isDataLayerPushCall(node: Record<string, unknown>): boolean {
  if (node.type !== "CallExpression" || !isRecord(node.callee)) return false;

  const callee = node.callee;
  if (callee.type !== "MemberExpression" || !propertyMatches(callee.property, "push")) return false;

  return isDataLayerObject(callee.object);
}

function isDataLayerObject(node: unknown): boolean {
  if (!isRecord(node)) return false;

  if (node.type === "Identifier" && node.name === "dataLayer") return true;

  return (
    node.type === "MemberExpression" &&
    propertyMatches(node.property, "dataLayer") &&
    isRecord(node.object) &&
    node.object.type === "Identifier" &&
    node.object.name === "window"
  );
}

function propertyMatches(node: unknown, name: string): boolean {
  return isRecord(node) && node.type === "Identifier" && node.name === name;
}

function walkAst(node: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (!isRecord(node)) return;
  visit(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === "start" || key === "end" || key === "loc") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        walkAst(item, visit);
      }
      continue;
    }

    if (isRecord(value)) {
      walkAst(value, visit);
    }
  }
}

function detectCollectorScript(raw: string): CollectorScriptEvidence {
  const headMatch = raw.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch?.[1] ?? "";
  const headScript = findCollectorScript(head, true);
  if (headScript) return headScript;

  const pageScript = findCollectorScript(raw, false);
  return pageScript ?? {
    present: false,
    inHead: false,
    async: false,
    src: undefined
  };
}

function findCollectorScript(fragment: string, inHead: boolean): CollectorScriptEvidence | undefined {
  const scriptPattern = /<script\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(fragment)) !== null) {
    const attributes = match[1] ?? "";
    const src = scriptSrc(attributes);
    if (!src || !/^https:\/\/scripts\.luigisbox\.tech\/LBX-\d+\.js$/.test(src)) continue;

    return {
      present: true,
      inHead,
      async: /\basync\b/i.test(attributes),
      src
    };
  }

  return undefined;
}

function scriptSrc(attributes: string): string | undefined {
  const match = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return match?.[1];
}
