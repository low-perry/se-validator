import { readFile } from "node:fs/promises";
import type { CollectorScriptEvidence } from "../analytics/types.js";
import type { FrontendAnalyticsMode, FrontendArtifact, FrontendCapabilities, FrontendSourceKind } from "./types.js";

export async function parseFrontendArtifacts(paths: string[]): Promise<FrontendArtifact[]> {
  return Promise.all(paths.map(parseFrontendArtifact));
}

async function parseFrontendArtifact(path: string): Promise<FrontendArtifact> {
  let raw = "";

  try {
    raw = await readText(path);
    const sourceKind = detectSourceKind(path, raw);
    const analyticsMode = detectAnalyticsMode(raw);

    return {
      path,
      raw,
      sourceKind,
      analyticsMode,
      collectorScript: sourceKind === "html" ? detectCollectorScript(raw) : undefined,
      capabilities: detectCapabilities(raw),
      parseError: undefined,
      confidence: sourceKind === "unknown" ? 0.3 : 0.9
    };
  } catch (error) {
    return {
      path,
      raw,
      sourceKind: "unknown",
      analyticsMode: "unknown",
      collectorScript: undefined,
      capabilities: emptyCapabilities(),
      parseError: error instanceof Error ? error.message : String(error),
      confidence: 0.98
    };
  }
}

async function readText(path: string): Promise<string> {
  if (/^https?:\/\//i.test(path)) {
    const response = await fetch(path, {
      headers: {
        "user-agent": "se-validator/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${path}: HTTP ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  return readFile(path, "utf8");
}

function detectSourceKind(path: string, raw: string): FrontendSourceKind {
  const sample = raw.slice(0, 1000).toLowerCase();
  if (sample.includes("<!doctype html") || sample.includes("<html") || sample.includes("<head")) return "html";
  if (path.endsWith(".js") || path.endsWith(".ts") || /\b(fetch|axios\.get|dataLayer\.push)\s*\(/.test(raw)) return "javascript";
  return "unknown";
}

function detectAnalyticsMode(raw: string): FrontendAnalyticsMode {
  const dataLayer = /\b(?:window\.)?dataLayer\.push\s*\(/.test(raw);
  const eventsApi = /api\.luigisbox\.com/.test(raw) || /\baxios\.post\s*\(|\bfetch\s*\([^)]*method\s*:\s*["']POST["']/.test(raw);

  if (dataLayer && eventsApi) return "mixed";
  if (dataLayer) return "datalayer";
  if (eventsApi) return "events-api";
  return "unknown";
}

function detectCapabilities(raw: string): FrontendCapabilities {
  return {
    endpoints: {
      autocomplete: /live\.luigisbox\.com\/autocomplete\/v2/.test(raw),
      search: /live\.luigisbox\.com\/search\b|["'`]\/search["'`]/.test(raw),
      topItems: /live\.luigisbox\.com\/v1\/top_items/.test(raw),
      trendingQueries: /live\.luigisbox\.com\/v2\/trending_queries/.test(raw)
    },
    requestParams: {
      trackerId: /\btracker_id\b/.test(raw),
      query: /(?:^|[,{(\s])q\s*[:=]\s*query\b|["']q["']\s*,\s*query\b|urlParams\.set\s*\(\s*["']q["']|params\.q\s*=/.test(raw),
      typeCounts: /\btype\s*[:=]\s*["'][^"']+:[1-9][0-9]*[^"']*["']|["']type["']\s*,\s*["'][^"']+:[1-9][0-9]*[^"']*["']/.test(raw),
      searchTypeFilter: extractSearchTypeFilters(raw).length > 0,
      searchTypeFilters: extractSearchTypeFilters(raw),
      hitFields: /\bhit_fields\b/.test(raw),
      facets: /\bfacets\b/.test(raw),
      page: /(?:^|[,{(\s])page\s*[:=]\s*page\b|\bcurrentPage\b|urlParams\.set\s*\(\s*["']page["']/.test(raw),
      size: /(?:^|[,{(\s])size\s*[:=]|RESULTS_PER_PAGE|resultsPerPage/i.test(raw)
    },
    browser: {
      dnsPrefetch: /<link\b[^>]*rel\s*=\s*["']dns-prefetch["'][^>]*live\.luigisbox\.com|<link\b[^>]*live\.luigisbox\.com[^>]*rel\s*=\s*["']dns-prefetch["']/i.test(raw),
      debounce: /\bdebounce\s*\(/.test(raw) || /setTimeout\s*\([^)]*getSuggestions|clearTimeout\s*\(/.test(raw),
      inputListener: /addEventListener\s*\(\s*["']input["']/.test(raw),
      focusListener: /addEventListener\s*\(\s*["']focus["']/.test(raw)
    },
    responseFlow: {
      readsHits: /response\.data\.hits|\bdata\.hits\b|const\s*\{\s*hits\s*\}\s*=\s*await\s+response\.json\s*\(\s*\)|\bjson\.hits\b/.test(raw),
      readsSearchResults: /response\.data\.results|\bdata\.results\b|renderResults\s*\(\s*data\.results\s*\)/.test(raw),
      readsSearchHits: /response\.data\.results\.hits|\bdata\.results\.hits\b|\bresultsData\.hits\b/.test(raw),
      rendersHits: /\brenderResults\s*\(\s*hits\b|hits\.forEach\s*\(|hits\.map\s*\(/.test(raw),
      rendersSearchHits: /resultsData\.hits\.map\s*\(|resultsData\.hits\.forEach\s*\(|data\.results\.hits\.map\s*\(|renderResults\s*\(\s*data\.results\s*\)/.test(raw),
      rendersFacets: /renderFacets\s*\(|results\.facets|data\.results\.facets|\bfacetsData\b/.test(raw),
      rendersPagination: /renderPagination\s*\(|data\.results\.total_hits|resultsData\.total_hits|\bpagination\b/i.test(raw),
      handlesNoResults: /!\s*hits\s*\|\|\s*hits\.length\s*={2,3}\s*0|hits\.length\s*={2,3}\s*0|No results|no-results/i.test(raw),
      tracksNoResults: /\b(?:trackAutocompleteView|sendAutocompleteViewAnalytics|sendViewEvent)\s*\(\s*query\s*,\s*\[\s*\]\s*\)|items\s*:\s*\[\s*\]|hits\.length\s*={2,3}\s*0\s*\?\s*\[\s*\]/.test(raw),
      skipsNoResultsTracking: /if\s*\(\s*!\s*hits\s*\|\|\s*hits\.length\s*={2,3}\s*0\s*\)\s*return\b|if\s*\(\s*hits\.length\s*={2,3}\s*0\s*\)\s*return\b/.test(raw),
      mapsTrendingTitles: /response\.data\.map\s*\(\s*\(?\s*item\s*\)?\s*=>\s*item\.title|\.map\s*\(\s*\(?\s*item\s*\)?\s*=>\s*item\.title/.test(raw),
      usesTrendingAsPlaceholder: /placeholderAnimator|searchInput\.placeholder|animatePlaceholder/.test(raw)
    },
    identityFlow: {
      renderedIdentityUsesHitUrl: /dataset\.(?:itemId|productUrl)\s*=\s*(?:item|hit|result)\.url|data-(?:item-id|product-url)[^>]*(?:item\.url|hit\.url|\$\{url\})|itemId\s*:\s*item\.url/.test(raw),
      analyticsItemsUseHitUrl: /item_id\s*:\s*hit\.url|url\s*:\s*hit\.url|resource_identifier\s*:\s*hit\.url/.test(raw),
      clickUsesRenderedIdentity: /dataset\.(?:itemId|itemid|productUrl)|getAttribute\s*\(\s*["']data-(?:item-id|product-url)["']/.test(raw)
    },
    analytics: {
      dataLayerPush: /\b(?:window\.)?dataLayer\.push\s*\(/.test(raw),
      eventsApiPost: /api\.luigisbox\.com/.test(raw) && /\b(?:axios\.post|fetch)\s*\(/.test(raw),
      clientId: /\bclient_id\b|\bCLIENT_ID\b/.test(raw),
      eventId: /\bid\s*:\s*(?:generateUUID|crypto\.randomUUID|uuid\.v4)|\bgenerateUUID\s*\(|\bcrypto\.randomUUID\s*\(/.test(raw),
      autocompleteView: /item_list_name\s*:\s*["']Autocomplete["']|\bAutocomplete\s*:\s*\{/.test(raw),
      autocompleteSearchTerm: /search_term\s*:\s*query|string\s*:\s*query|string\s*:\s*query\s*\|\|\s*["']/.test(raw),
      searchResultsQuery: /search_term\s*:\s*query|query\s*:\s*\{\s*string\s*:\s*query/.test(raw),
      analyticsItemsFromHits: /items\s*:\s*hits\.map|items\s*=\s*hits[\s\S]{0,100}hits\.map/.test(raw),
      itemPosition: /\bindex\s*:\s*index\s*\+\s*1|\bposition\s*:\s*index\s*\+\s*1/.test(raw),
      clickEvent: /event\s*:\s*["']select_item["']|type\s*:\s*["']click["'][\s\S]{0,300}resource_identifier/.test(raw),
      addToCartEvent: /event\s*:\s*["']add_to_cart["']|type\s*:\s*["']add-to-cart["']/.test(raw),
      recommendationView: /item_list_name\s*:\s*["']Recommendation["']|\bRecommendation\s*:\s*\{/.test(raw),
      autocompletePopupPlacement: /RecommenderClientId\s*:\s*["']autocomplete_popup["']|Recommender\s*:\s*["']autocomplete_popup["']/.test(raw),
      searchResultsView: /item_list_name\s*:\s*["']Search Results["']|["']Search Results["']\s*:\s*\{/.test(raw)
    }
  };
}

function extractSearchTypeFilters(raw: string): string[] {
  const filters = new Set<string>();
  const patterns = [
    /["']f\[\]["']\s*:\s*\[[^\]]*["']type:([^"'\]]+)["']/g,
    /params\[['"]f\[\]["']\]\.push\s*\(\s*["']type:([^"']+)["']\s*\)/g,
    /(?:append|set)\s*\(\s*["']f\[\]["']\s*,\s*["']type:([^"']+)["']\s*\)/g,
    /[?&]f(?:%5B%5D|\[\])=type(?::|%3A)([^&"'\s]+)/gi
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw)) !== null) {
      if (match[1]) {
        filters.add(decodeURIComponent(match[1]).trim());
      }
    }
  }

  return [...filters].filter(Boolean);
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

function emptyCapabilities(): FrontendCapabilities {
  return {
    endpoints: {
      autocomplete: false,
      search: false,
      topItems: false,
      trendingQueries: false
    },
    requestParams: {
      trackerId: false,
      query: false,
      typeCounts: false,
      searchTypeFilter: false,
      searchTypeFilters: [],
      hitFields: false,
      facets: false,
      page: false,
      size: false
    },
    browser: {
      dnsPrefetch: false,
      debounce: false,
      inputListener: false,
      focusListener: false
    },
    responseFlow: {
      readsHits: false,
      readsSearchResults: false,
      readsSearchHits: false,
      rendersHits: false,
      rendersSearchHits: false,
      rendersFacets: false,
      rendersPagination: false,
      handlesNoResults: false,
      tracksNoResults: false,
      skipsNoResultsTracking: false,
      mapsTrendingTitles: false,
      usesTrendingAsPlaceholder: false
    },
    identityFlow: {
      renderedIdentityUsesHitUrl: false,
      analyticsItemsUseHitUrl: false,
      clickUsesRenderedIdentity: false
    },
    analytics: {
      dataLayerPush: false,
      eventsApiPost: false,
      clientId: false,
      eventId: false,
      autocompleteView: false,
      autocompleteSearchTerm: false,
      searchResultsQuery: false,
      analyticsItemsFromHits: false,
      itemPosition: false,
      clickEvent: false,
      addToCartEvent: false,
      recommendationView: false,
      autocompletePopupPlacement: false,
      searchResultsView: false
    }
  };
}
