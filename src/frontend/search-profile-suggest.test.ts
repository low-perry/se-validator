import { afterEach, describe, expect, it, vi } from "vitest";
import { suggestSearchFrontendProfile } from "./search-profile-suggest.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("suggestSearchFrontendProfile", () => {
  it("infers expected Search result types from live Search API hits", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: {
            total_hits: 3,
            hits: [
              {
                url: "digSKU-1001",
                type: "digital-products",
                attributes: { title: "Digital Shirt Blue" }
              },
              {
                url: "digSKU-1002",
                type: "digital-products",
                attributes: { title: "Digital Shirt Red" }
              },
              {
                url: "category-shirts",
                type: "category",
                attributes: { title: "Shirts" }
              }
            ]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as typeof fetch;

    const suggestion = await suggestSearchFrontendProfile({
      trackerId: "757876-1071971",
      query: "shirt",
      size: 3,
      analyticsMode: "datalayer"
    });

    expect(suggestion.profile).toMatchObject({
      service: "search",
      trackerId: "757876-1071971",
      analyticsMode: "datalayer",
      features: {
        autocomplete: "disabled",
        search: "required",
        topItems: "disabled",
        trendingQueries: "disabled"
      },
      search: {
        expectedResultTypes: ["digital-products", "category"]
      }
    });
    expect(suggestion.totalHits).toBe(3);
    expect(suggestion.observedTypes[0]).toMatchObject({
      type: "digital-products",
      count: 2,
      sampleIdentities: ["digSKU-1001", "digSKU-1002"]
    });
    expect(suggestion.warnings).toContain(
      "Multiple hit types were observed. Keep all expectedResultTypes only if this UI intentionally renders mixed result types."
    );
  });
});
