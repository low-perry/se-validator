import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadFrontendValidationProfile } from "./profile.js";
import { validateFrontend } from "./validate.js";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");
const fixture = (relative: string) => resolve(repoRoot, relative);

describe("search frontend validation", () => {
  it("accepts a Search UI that renders results.hits and tracks Search Results", async () => {
    const profile = await loadFrontendValidationProfile(fixture("fixtures/frontend/search-profile-digital-products.json"));
    const report = await validateFrontend([fixture("fixtures/frontend/search-datalayer-good.html")], { profile });

    expect(report.score).toBe(100);
    expect(report.findings).toEqual([]);
  });

  it("flags wrong Search type filters and analytics payload shape", async () => {
    const profile = await loadFrontendValidationProfile(fixture("fixtures/frontend/search-profile-digital-products.json"));
    const report = await validateFrontend([fixture("fixtures/frontend/search-bad.html")], { profile });

    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "FRONTEND_SEARCH_TYPE_FILTER_MISMATCH",
        "FRONTEND_SEARCH_HITS_WRONG_RESPONSE_SHAPE",
        "FRONTEND_SEARCH_RESULTS_VIEW_ANALYTICS_MISSING",
        "FRONTEND_SEARCH_NO_RESULTS_NOT_TRACKED",
        "FRONTEND_SEARCH_CLICK_ANALYTICS_MISSING"
      ])
    );
  });
});
