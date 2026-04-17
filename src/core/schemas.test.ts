import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reviewCatalog } from "../agent/review-catalog.js";
import { reviewUi } from "../agent/review-ui.js";
import { validateCatalog } from "../catalog/validate.js";
import {
  agentCatalogReviewSchema,
  agentUiReviewSchema,
  catalogValidationReportSchema
} from "./schemas.js";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");
const fixture = (relative: string) => resolve(repoRoot, relative);
const docsRoot = fixture("../docs");

describe("report schemas", () => {
  it("parses validateCatalog output for a good feed", async () => {
    const report = await validateCatalog([fixture("fixtures/catalog/good-feed.xml")]);

    const parsed = catalogValidationReportSchema.parse(report);

    // The schema should round-trip the payload without dropping fields it
    // knows about, so the parsed copy must equal the raw report.
    expect(parsed).toEqual(report);
    expect(parsed.title).toBe("Catalog Validation Report");
    expect(parsed.artifacts.length).toBeGreaterThan(0);
    expect(parsed.summary).toEqual({
      P0: expect.any(Number),
      P1: expect.any(Number),
      P2: expect.any(Number)
    });
  });

  it("parses validateCatalog output for a bad feed (findings present)", async () => {
    const report = await validateCatalog([fixture("fixtures/catalog/bad-feed.xml")]);
    const parsed = catalogValidationReportSchema.parse(report);

    expect(parsed.findings.length).toBeGreaterThan(0);
    for (const finding of parsed.findings) {
      expect(["P0", "P1", "P2"]).toContain(finding.severity);
      expect(["failed", "unknown"]).toContain(finding.state);
      expect(typeof finding.confidence).toBe("number");
    }
  });

  it("parses reviewUi output against the agent UI review schema", async () => {
    const review = await reviewUi([fixture("fixtures/frontend/autocomplete-events-api-good.html")], {
      docsRoot,
      service: "autocomplete",
      maxDocs: 4,
      browser: { enabled: false, query: "shirt", timeoutMs: 500 }
    });

    const parsed = agentUiReviewSchema.parse(review);

    expect(parsed).toEqual(review);
    expect(parsed.service).toBe("autocomplete");
    expect(parsed.title).toBe("Agent UI Review Report");
    // browser is disabled in this test, so the array should be empty.
    expect(parsed.browser).toEqual([]);
    expect(Array.isArray(parsed.docsHits)).toBe(true);
    expect(Array.isArray(parsed.nextActions)).toBe(true);
  });

  it("parses reviewCatalog output against the agent catalog review schema", async () => {
    const review = await reviewCatalog([fixture("fixtures/catalog/good-feed.xml")], {
      docsRoot,
      maxDocs: 4
    });

    const parsed = agentCatalogReviewSchema.parse(review);

    expect(parsed).toEqual(review);
    expect(parsed.title).toBe("Agent Catalog Review Report");
    expect(parsed.structures.length).toBeGreaterThan(0);
    for (const structure of parsed.structures) {
      expect(typeof structure.recordCount).toBe("number");
      expect(structure.requiredCoverage.identity).toEqual(expect.any(String));
      expect(structure.requiredCoverage.title).toEqual(expect.any(String));
      expect(structure.requiredCoverage.webUrl).toEqual(expect.any(String));
    }
  });

  it("rejects payloads that drop a required field", () => {
    const { severity: _severity, ...missingSeverity } = {
      id: "SOME_ID",
      severity: "P0" as const,
      state: "failed" as const,
      area: "catalog" as const,
      title: "t",
      message: "m",
      evidencePath: "p",
      remediation: "r",
      docs: [],
      confidence: 0
    };

    const result = catalogValidationReportSchema.safeParse({
      title: "x",
      score: 100,
      findings: [missingSeverity],
      summary: { P0: 0, P1: 0, P2: 0 },
      artifacts: []
    });

    expect(result.success).toBe(false);
  });
});
