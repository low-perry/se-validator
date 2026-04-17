import { describe, expect, it } from "vitest";
import { serviceRules } from "./rules.js";
import type { ServiceArtifact, ServiceCheckExecution, ServiceProfile } from "./types.js";

describe("service search rules", () => {
  it("accepts a source-backed Search API visibility profile", () => {
    const profile: ServiceProfile = {
      service: "search-api",
      checks: [
        {
          name: "Digital products are visible in Search API",
          endpoint: "search",
          request: {
            url: "https://live.luigisbox.com/search",
            params: {
              tracker_id: "757876-1071971",
              q: "shirt",
              "f[]": ["type:digital-products"],
              hit_fields: "title,url,price_amount,image_link,brand,nested,id",
              size: 5
            }
          },
          expect: {
            status: 200,
            minResults: 1,
            resultTypes: ["digital-products"],
            containsIdentities: ["digSKU-1001"],
            requiredResultsFields: ["total_hits"],
            requiredHitFields: ["url", "type"],
            requiredAttributeFields: ["title"],
            requireGuid: true
          },
          analytics: {
            viewListName: "Search Results",
            clickAction: "click",
            noResultsEventRequired: true
          }
        }
      ]
    };

    const findings = runRules(profile, [
      {
        artifactPath: "search-good.json",
        checkName: "Digital products are visible in Search API",
        endpoint: "search",
        url: "https://live.luigisbox.com/search?tracker_id=757876-1071971&q=shirt&f%5B%5D=type%3Adigital-products",
        status: 200,
        durationMs: 25,
        error: undefined,
        data: {
          guid: "search-guid",
          results: {
            query: "shirt",
            filters: ["type:digital-products"],
            total_hits: 1,
            hits: [
              {
                url: "digSKU-1001",
                type: "digital-products",
                attributes: {
                  title: "Classic Cotton T-Shirt Blue M"
                }
              }
            ]
          }
        }
      }
    ]);

    expect(findings).toEqual([]);
  });

  it("flags Search API type-filter mismatches", () => {
    const profile: ServiceProfile = {
      service: "search-visibility",
      checks: [
        {
          name: "Digital products queried with item filter",
          endpoint: "search",
          request: {
            url: "https://live.luigisbox.com/search",
            params: {
              tracker_id: "757876-1071971",
              q: "shirt",
              "f[]": ["type:item"],
              hit_fields: "title,url"
            }
          },
          expect: {
            status: 200,
            minResults: 1,
            resultTypes: ["digital-products"],
            containsIdentities: ["digSKU-1001"]
          },
          analytics: {
            viewListName: "Autocomplete"
          }
        }
      ]
    };

    const findings = runRules(profile, [
      {
        artifactPath: "search-bad.json",
        checkName: "Digital products queried with item filter",
        endpoint: "search",
        url: "https://live.luigisbox.com/search?tracker_id=757876-1071971&q=shirt&f%5B%5D=type%3Aitem",
        status: 200,
        durationMs: 25,
        error: undefined,
        data: {
          results: {
            query: "shirt",
            filters: ["type:item"],
            total_hits: 1,
            hits: [
              {
                url: "SKU-1001",
                type: "item",
                attributes: {
                  title: "Classic Cotton T-Shirt Blue M"
                }
              }
            ]
          }
        }
      }
    ]);

    expect(findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "SERVICE_SEARCH_TYPE_FILTER_MISMATCH",
        "SERVICE_ANALYTICS_LIST_MISMATCH",
        "SERVICE_SEARCH_CLICK_TRACKING_MISSING",
        "SERVICE_SEARCH_NO_RESULTS_EVENT_MISSING",
        "SERVICE_RESULT_TYPE_MISSING",
        "SERVICE_EXPECTED_IDENTITY_MISSING"
      ])
    );
  });
});

function runRules(profile: ServiceProfile, executions: ServiceCheckExecution[]) {
  const artifact: ServiceArtifact = {
    path: executions[0]?.artifactPath ?? "service-profile.json",
    raw: JSON.stringify(profile),
    parsed: profile,
    profile,
    parseError: undefined,
    confidence: 0.95
  };

  return serviceRules.flatMap((rule) => rule([artifact], executions));
}
