import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { FrontendValidationProfile } from "../frontend/types.js";
import type { BrowserReviewResult } from "./types.js";

export interface BrowserReviewOptions {
  query: string;
  timeoutMs: number;
  profile: FrontendValidationProfile;
}

type PlaywrightModule = typeof import("playwright");

export async function runBrowserReview(paths: string[], options: BrowserReviewOptions): Promise<BrowserReviewResult[]> {
  let playwright: PlaywrightModule;

  try {
    playwright = await import("playwright");
  } catch {
    return paths.map((path) =>
      skippedBrowserResult(
        path,
        "Browser mode requires Playwright. Install it with `yarn add -D playwright` and `yarn playwright install chromium`."
      )
    );
  }

  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const results: BrowserReviewResult[] = [];
    for (const path of paths) {
      results.push(await reviewPathInBrowser(browser, path, options));
    }
    return results;
  } finally {
    await browser.close();
  }
}

async function reviewPathInBrowser(
  browser: Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>>,
  path: string,
  options: BrowserReviewOptions
): Promise<BrowserReviewResult> {
  if (!isBrowserLoadable(path)) {
    return skippedBrowserResult(path, "Browser mode currently supports local or remote HTML pages.");
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = {
    autocomplete: [] as string[],
    topItems: [] as string[],
    trendingQueries: [] as string[],
    analytics: [] as string[]
  };

  page.on("request", (request) => {
    recordRequest(request.url(), requests);
  });

  await page.addInitScript(() => {
    const globalWindow = window as Window & {
      __lbxObservedDataLayerPushes?: unknown[];
      __lbxObservedFetches?: string[];
      dataLayer?: unknown[] & { __lbxWrapped?: boolean };
    };

    globalWindow.__lbxObservedDataLayerPushes = [];
    globalWindow.__lbxObservedFetches = [];

    const wrapDataLayer = (value: unknown): unknown[] & { __lbxWrapped?: boolean } => {
      const layer = Array.isArray(value) ? (value as unknown[] & { __lbxWrapped?: boolean }) : [];
      if (layer.__lbxWrapped) return layer;

      const originalPush = layer.push.bind(layer);
      layer.push = (...items: unknown[]) => {
        globalWindow.__lbxObservedDataLayerPushes?.push(...items);
        return originalPush(...items);
      };
      layer.__lbxWrapped = true;
      return layer;
    };

    let currentDataLayer = wrapDataLayer(globalWindow.dataLayer);
    Object.defineProperty(globalWindow, "dataLayer", {
      configurable: true,
      get() {
        return currentDataLayer;
      },
      set(value) {
        currentDataLayer = wrapDataLayer(value);
      }
    });

    const originalFetch = globalWindow.fetch?.bind(globalWindow);
    if (originalFetch) {
      globalWindow.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        globalWindow.__lbxObservedFetches?.push(url);
        return originalFetch(input, init);
      }) as typeof globalWindow.fetch;
    }
  });

  try {
    await page.goto(toBrowserUrl(path), { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    await driveAutocomplete(page, options.query, options.timeoutMs);
    await page.waitForTimeout(Math.min(options.timeoutMs, 1500));

    const dataLayerEvents = await page.evaluate(() => {
      const globalWindow = window as Window & { __lbxObservedDataLayerPushes?: unknown[] };
      return globalWindow.__lbxObservedDataLayerPushes ?? [];
    });

    const renderedText = await visibleText(page);
    const resultElementCount = await page.locator("a,button,[role='option'],li,.result-item").count().catch(() => undefined);
    const observations = buildBrowserObservations(requests, dataLayerEvents, renderedText, resultElementCount, options.profile);
    const status = observations.some((observation) => observation.startsWith("Missing")) ? "failed" : "passed";

    return {
      path,
      status,
      message: status === "passed" ? "Browser evidence was observed." : "Browser evidence has gaps.",
      requests,
      dataLayerEvents,
      renderedText,
      resultElementCount,
      observations
    };
  } catch (error) {
    return {
      path,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
      requests,
      dataLayerEvents: [],
      renderedText: undefined,
      resultElementCount: undefined,
      observations: ["Browser execution failed before the full evidence flow could be observed."]
    };
  } finally {
    await context.close();
  }
}

async function driveAutocomplete(page: Awaited<ReturnType<Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>>["newPage"]>>, query: string, timeoutMs: number): Promise<void> {
  const input = page.locator('input[type="search"], input#search-input, input[autocomplete], input').first();
  if ((await input.count()) === 0) return;

  await input.click({ timeout: timeoutMs }).catch(() => undefined);
  await page.waitForTimeout(250);
  await input.fill(query, { timeout: timeoutMs }).catch(() => undefined);
  await page.waitForTimeout(timeoutMs);

  const clickableResult = page.locator("a,button,[role='option'],li,.result-item").first();
  if ((await clickableResult.count()) > 0) {
    await clickableResult.click({ timeout: 1000 }).catch(() => undefined);
  }
}

function buildBrowserObservations(
  requests: BrowserReviewResult["requests"],
  dataLayerEvents: unknown[],
  renderedText: string | undefined,
  resultElementCount: number | undefined,
  profile: FrontendValidationProfile
): string[] {
  const observations: string[] = [];

  if (profile.features.autocomplete !== "disabled" && requests.autocomplete.length === 0) {
    observations.push("Missing Autocomplete API request after typing.");
  } else if (requests.autocomplete.length > 0) {
    observations.push(`Observed ${requests.autocomplete.length} Autocomplete API request(s).`);
  }

  if (profile.features.topItems === "required" && requests.topItems.length === 0) {
    observations.push("Missing Top Items request even though profile requires it.");
  } else if (requests.topItems.length > 0) {
    observations.push(`Observed ${requests.topItems.length} Top Items request(s).`);
  }

  if (profile.features.trendingQueries === "required" && requests.trendingQueries.length === 0) {
    observations.push("Missing Trending Queries request even though profile requires it.");
  } else if (requests.trendingQueries.length > 0) {
    observations.push(`Observed ${requests.trendingQueries.length} Trending Queries request(s).`);
  }

  if (profile.analyticsMode === "datalayer" && dataLayerEvents.length === 0) {
    observations.push("Missing dataLayer.push events during browser execution.");
  } else if (dataLayerEvents.length > 0) {
    observations.push(`Observed ${dataLayerEvents.length} dataLayer.push event(s).`);
  }

  if (profile.analyticsMode === "events-api" && requests.analytics.length === 0) {
    observations.push("Missing Events API request during browser execution.");
  } else if (requests.analytics.length > 0) {
    observations.push(`Observed ${requests.analytics.length} Events API request(s).`);
  }

  if (!renderedText?.trim() && !resultElementCount) {
    observations.push("Missing visible rendered autocomplete output.");
  } else {
    observations.push(`Observed rendered output (${resultElementCount ?? 0} candidate element(s)).`);
  }

  return observations;
}

function recordRequest(url: string, requests: BrowserReviewResult["requests"]): void {
  if (url.includes("live.luigisbox.com/autocomplete/v2")) requests.autocomplete.push(url);
  if (url.includes("live.luigisbox.com/v1/top_items")) requests.topItems.push(url);
  if (url.includes("live.luigisbox.com/v2/trending_queries")) requests.trendingQueries.push(url);
  if (url.includes("api.luigisbox.com")) requests.analytics.push(url);
}

async function visibleText(page: Awaited<ReturnType<Awaited<ReturnType<PlaywrightModule["chromium"]["launch"]>>["newPage"]>>): Promise<string | undefined> {
  const selectors = ["#autocomplete-results", "[role='listbox']", ".autocomplete-results", ".results", "body"];

  for (const selector of selectors) {
    const text = await page.locator(selector).first().innerText({ timeout: 500 }).catch(() => undefined);
    if (text?.trim()) return text.trim().slice(0, 500);
  }

  return undefined;
}

function isBrowserLoadable(path: string): boolean {
  return /^https?:\/\//i.test(path) || path.endsWith(".html") || path.endsWith(".htm");
}

function toBrowserUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) return path;
  return pathToFileURL(absolutePath).href;
}

function skippedBrowserResult(path: string, message: string): BrowserReviewResult {
  return {
    path,
    status: "skipped",
    message,
    requests: {
      autocomplete: [],
      topItems: [],
      trendingQueries: [],
      analytics: []
    },
    dataLayerEvents: [],
    renderedText: undefined,
    resultElementCount: undefined,
    observations: [message]
  };
}
