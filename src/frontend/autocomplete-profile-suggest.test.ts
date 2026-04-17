import { afterEach, describe, expect, it, vi } from "vitest";
import { suggestAutocompleteFrontendProfile } from "./autocomplete-profile-suggest.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("suggestAutocompleteFrontendProfile", () => {
  it("suggests feature expectations from live Autocomplete endpoint samples", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);

      if (url.includes("/autocomplete/v2")) {
        return new Response(
          JSON.stringify({
            hits: [
              {
                url: "SKU-1",
                type: "item",
                attributes: { title: "Blue <em>Shirt</em>" }
              },
              {
                url: "cat-shirts",
                type: "category",
                attributes: { title: "Shirts" }
              }
            ],
            guid: "guid-1"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/v1/top_items")) {
        return new Response(
          JSON.stringify({
            hits: [
              {
                url: "SKU-2",
                type: "item",
                attributes: { title: "Black Hoodie" }
              }
            ],
            recommendation_id: "default"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify([{ title: "blue shirt" }, { title: "black hoodie" }]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    const suggestion = await suggestAutocompleteFrontendProfile({
      trackerId: "757876-1071971",
      query: "shirt",
      analyticsMode: "events-api"
    });

    expect(suggestion.profile).toMatchObject({
      service: "autocomplete",
      trackerId: "757876-1071971",
      analyticsMode: "events-api",
      features: {
        autocomplete: "required",
        search: "disabled",
        topItems: "optional",
        trendingQueries: "optional"
      }
    });
    expect(suggestion.endpoints).toHaveLength(3);
    expect(suggestion.endpoints[0]).toMatchObject({
      endpoint: "autocomplete",
      hitCount: 2,
      observedTypes: [
        { type: "category", count: 1 },
        { type: "item", count: 1 }
      ],
      sampleIdentities: ["SKU-1", "cat-shirts"],
      sampleTitles: ["Blue Shirt", "Shirts"]
    });
    expect(suggestion.warnings).toContain(
      "Top Items returned data, so the generated profile marks topItems=optional. Change it to required only if the UI must show Top Items on empty search focus."
    );
    expect(suggestion.warnings).toContain(
      "Trending Queries returned data, so the generated profile marks trendingQueries=optional. Change it to required only if the UI must expose configured trending queries."
    );
  });

  it("honors explicit feature policies", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ hits: [] }), { status: 200 })) as typeof fetch;

    const suggestion = await suggestAutocompleteFrontendProfile({
      trackerId: "757876-1071971",
      topItems: "required",
      trendingQueries: "disabled"
    });

    expect(suggestion.profile.features.topItems).toBe("required");
    expect(suggestion.profile.features.trendingQueries).toBe("disabled");
  });
});
