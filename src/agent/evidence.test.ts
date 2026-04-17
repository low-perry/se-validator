import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ValidationFinding } from "../core/types.js";
import { validateCatalog } from "../catalog/validate.js";
import { formatAgentCatalogReview, reviewCatalog } from "./review-catalog.js";
import { formatAgentUiReview, reviewUi } from "./review-ui.js";
import { locateCatalogEvidence, locateFindingEvidence } from "./evidence.js";

async function writeTemp(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(resolve(tmpdir(), "evidence-test-"));
  const path = resolve(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

function finding(partial: Partial<ValidationFinding>): ValidationFinding {
  return {
    id: "TEST",
    severity: "P1",
    state: "failed",
    area: "catalog",
    title: "t",
    message: "m",
    evidencePath: "p",
    remediation: "r",
    docs: [],
    confidence: 1,
    ...partial
  };
}

describe("locateCatalogEvidence", () => {
  it("targets the correct nested[N] inside objects[N] for a deep-nesting finding", async () => {
    const json = [
      "{",
      '  "objects": [',
      "    {",
      '      "identity": "a",',
      '      "type": "category",',
      '      "nested": [',
      "        { \"type\": \"variant\", \"identity\": \"x\" }",
      "      ]",
      "    },",
      "    {",
      '      "identity": "b",',
      '      "type": "item",',
      '      "nested": [',
      "        { \"type\": \"variant\", \"identity\": \"y\" },",
      "        { \"type\": \"variant\", \"identity\": \"z\", \"nested\": [] }",
      "      ]",
      "    }",
      "  ]",
      "}",
      ""
    ].join("\n");
    const path = await writeTemp("deep-nesting.json", json);

    const evidence = await locateCatalogEvidence(
      [path],
      [
        finding({
          id: "CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING",
          evidencePath: `${path}:objects[1].nested[1].nested`,
          message: "objects[1].nested[1] contains nested children."
        })
      ]
    );

    expect(evidence).toHaveLength(1);
    // The line that contains `"nested": []` inside the right variant.
    expect(evidence[0]!.snippet).toContain('"nested"');
    expect(evidence[0]!.line).toBe(15);
  });

  it("stays inside the correct <item> block for an XML feed finding", async () => {
    const xml = [
      "<?xml version=\"1.0\"?>",
      "<items>",
      "  <item>",
      "    <identity>SKU-1</identity>",
      "    <availability>1</availability>",
      "  </item>",
      "  <item>",
      "    <identity>SKU-2</identity>",
      "    <availability>yes</availability>",
      "  </item>",
      "</items>",
      ""
    ].join("\n");
    const path = await writeTemp("feed.xml", xml);

    const evidence = await locateCatalogEvidence(
      [path],
      [
        finding({
          id: "AVAILABILITY_INVALID",
          evidencePath: `${path}:product-feed[1].availability`,
          message: 'product "SKU-2" at ' + path + '[1] has availability "yes". Expected 0 or 1.'
        })
      ]
    );

    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.line).toBe(9);
    expect(evidence[0]!.snippet).toContain("yes");
  });
});

describe.skipIf(!process.env.SE_VALIDATOR_REGENERATE_REPORTS)("regenerate reports", () => {
  const resultsDir = "/Users/lowperry/projects/se-validator/.claude/worktrees/agent-a280abbb/results";

  it("regenerates improved bad catalog review", async () => {
    const fixture = "/Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json";
    const review = await reviewCatalog([fixture], {
      docsRoot: "/Users/lowperry/projects/docs",
      maxDocs: 0
    });
    const out = formatAgentCatalogReview(review);
    await mkdir(resultsDir, { recursive: true });
    await writeFile(
      resolve(resultsDir, "improved-bad-catalog-report.md"),
      `${out.trimEnd()}\n`,
      "utf8"
    );
  });

  it("regenerates improved bad UI review (autocomplete-sneaky-hybrid.html — multi-fetch + comment distractor)", async () => {
    const fixture = "/Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-sneaky-hybrid.html";
    const review = await reviewUi([fixture], {
      docsRoot: "/Users/lowperry/projects/docs",
      service: "autocomplete",
      maxDocs: 0,
      browser: { enabled: false, query: "shirt", timeoutMs: 0 }
    });
    const out = formatAgentUiReview(review);
    await mkdir(resultsDir, { recursive: true });
    await writeFile(
      resolve(resultsDir, "improved-bad-ui-report.md"),
      `${out.trimEnd()}\n`,
      "utf8"
    );
  });
});

describe("real fixture — catalog", () => {
  it("validates digital_products/digital_product XML as a custom feed type", async () => {
    const xml = [
      "<?xml version=\"1.0\"?>",
      "<digital_products>",
      "  <digital_product>",
      "    <identity>DIGI-1</identity>",
      "    <title>Downloadable Course</title>",
      "    <web_url>https://shop.example.com/digital/course</web_url>",
      "    <availability>yes</availability>",
      "  </digital_product>",
      "</digital_products>",
      ""
    ].join("\n");
    const path = await writeTemp("digital-products.xml", xml);

    const report = await validateCatalog([path]);

    expect(report.artifacts[0]).toContain("feed-xml / custom-feed");
    expect(report.findings.some((entry) => entry.id === "CATALOG_ARTIFACT_UNRECOGNIZED")).toBe(false);
    const availability = report.findings.find((entry) => entry.id === "AVAILABILITY_INVALID");
    expect(availability).toBeDefined();
    expect(availability!.evidencePath).toBe(`${path}:digital_product[0].availability`);
  });

  it("validates custom JSON feed wrappers without hardcoded object types", async () => {
    const json = JSON.stringify(
      {
        venues: [
          {
            identity: "venue-1",
            title: "Main Store",
            web_url: "https://shop.example.com/stores/main",
            availability_rank: 99
          }
        ]
      },
      null,
      2
    );
    const path = await writeTemp("venues.json", json);

    const report = await validateCatalog([path]);

    expect(report.artifacts[0]).toContain("feed-json / custom-feed");
    expect(report.findings.some((entry) => entry.id === "CATALOG_ARTIFACT_UNRECOGNIZED")).toBe(false);
    const rank = report.findings.find((entry) => entry.id === "AVAILABILITY_RANK_INVALID");
    expect(rank).toBeDefined();
    expect(rank!.evidencePath).toBe(`${path}:venue[0].availability_rank`);
  });

  it("allows Content Update custom product-like types to own nested variants", async () => {
    const json = JSON.stringify(
      {
        objects: [
          {
            type: "digital_product",
            identity: "content-digi-1",
            fields: {
              title: "Content Digital Course",
              web_url: "https://shop.example.com/digital/content-course"
            },
            nested: [
              {
                type: "variant",
                identity: "content-digi-1-video",
                fields: {
                  title: "Video Edition",
                  web_url: "https://shop.example.com/digital/content-course-video",
                  format: "video"
                }
              }
            ]
          }
        ]
      },
      null,
      2
    );
    const path = await writeTemp("content-digital-product.json", json);

    const report = await validateCatalog([path]);

    expect(report.findings.some((entry) => entry.id === "CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE")).toBe(false);
    expect(report.findings.some((entry) => entry.id === "CATALOG_REQUIRED_FIELDS")).toBe(false);
  });

  it("locates deep-nesting at the correct objects[1].nested[2] in bad-content-update-nested-variants.json", async () => {
    const fixture = "/Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json";
    const report = await validateCatalog([fixture]);
    const evidence = await locateCatalogEvidence([fixture], report.findings);
    const deep = evidence.find((entry) => entry.findingId === "CONTENT_UPDATE_NESTED_VARIANT_DEEP_NESTING");
    expect(deep).toBeDefined();
    // The `"nested": []` we care about is on line 53.
    expect(deep!.line).toBe(53);
    expect(deep!.snippet).toContain('"nested"');
  });

  it("locates the correct variant type line for parent-type mismatch", async () => {
    const fixture = "/Users/lowperry/projects/se-validator/fixtures/catalog/bad-content-update-nested-variants.json";
    const report = await validateCatalog([fixture]);
    const evidence = await locateCatalogEvidence([fixture], report.findings);
    const parent = evidence.find((entry) => entry.findingId === "CONTENT_UPDATE_NESTED_VARIANT_PARENT_TYPE");
    expect(parent).toBeDefined();
    // The nested variant sits at objects[0].nested[0] line 12: `"type": "variant",`
    expect(parent!.line).toBe(12);
    expect(parent!.snippet).toContain("variant");
  });

  it("locates the correct per-item availability line in bad-feed.xml", async () => {
    const fixture = "/Users/lowperry/projects/se-validator/fixtures/catalog/bad-feed.xml";
    const report = await validateCatalog([fixture]);
    const evidence = await locateCatalogEvidence([fixture], report.findings);
    const invalid = evidence.find((entry) => entry.findingId === "AVAILABILITY_INVALID");
    expect(invalid).toBeDefined();
    expect(invalid!.snippet).toContain("yes");
    // The `yes` availability is on line 25 for SKU-3.
    expect(invalid!.line).toBe(25);
  });
});

describe("real fixture — frontend", () => {
  it("points at the autocomplete fetch parameters, not a comment with 'tracker' in it", async () => {
    const fixture = "/Users/lowperry/projects/se-validator/fixtures/frontend/autocomplete-missing-tracker.html";
    const review = await reviewUi([fixture], {
      docsRoot: "/Users/lowperry/projects/docs",
      service: "autocomplete",
      maxDocs: 0,
      browser: { enabled: false, query: "", timeoutMs: 0 }
    });
    const missing = review.evidence.find((entry) => entry.findingId === "FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING");
    expect(missing).toBeDefined();
    // The fetch block spans roughly lines 32-36; the winner must be inside it, not in the header comment.
    expect(missing!.line).toBeGreaterThanOrEqual(30);
    expect(missing!.line).toBeLessThanOrEqual(36);
  });
});

describe("locateFindingEvidence", () => {
  it("prefers lines inside a fetch block matching the endpoint over comment distractors", async () => {
    const html = [
      "<!doctype html>",
      "<!--",
      "  BAD: URLSearchParams omits tracker_id.",
      "-->",
      "<html>",
      "  <body>",
      "    <script>",
      "      const AUTOCOMPLETE_API_URL = \"https://live.luigisbox.com/autocomplete/v2\";",
      "      async function go(q) {",
      "        return fetch(`${AUTOCOMPLETE_API_URL}?${new URLSearchParams({",
      "          q,",
      "          type: \"item:6\",",
      "        })}`);",
      "      }",
      "    </script>",
      "  </body>",
      "</html>",
      ""
    ].join("\n");
    const path = await writeTemp("missing-tracker.html", html);

    const evidence = await locateFindingEvidence(
      [path],
      [
        finding({
          id: "FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING",
          area: "frontend",
          evidencePath: path,
          message: `${path} does not show tracker_id in the autocomplete request.`,
          title: "Frontend autocomplete request is missing a required parameter"
        })
      ]
    );

    expect(evidence).toHaveLength(1);
    // Must land inside the fetch block (lines 10-13), never in the <!-- comment --> on lines 2-4.
    expect(evidence[0]!.line).toBeGreaterThanOrEqual(10);
    expect(evidence[0]!.line).toBeLessThanOrEqual(13);
  });
});
