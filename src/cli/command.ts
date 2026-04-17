import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { z } from "zod";
import type { ValidationFinding } from "../core/types.js";
import {
  agentCatalogReviewSchema,
  agentUiReviewSchema,
  catalogValidationReportSchema,
  frontendValidationReportSchema
} from "../core/schemas.js";
import { validateCatalog } from "../catalog/validate.js";
import { validateAnalytics } from "../analytics/validate.js";
import { validateService } from "../service/validate.js";
import { validateFrontend } from "../frontend/validate.js";
import { loadFrontendValidationProfile } from "../frontend/profile.js";
import { formatAgentCatalogReview, reviewCatalog } from "../agent/review-catalog.js";
import { formatAgentUiReview, reviewUi } from "../agent/review-ui.js";
import type { AgentReviewService } from "../agent/types.js";

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("se-validator")
    .description("Validate Luigi's Box integration evidence")
    .version("0.1.0");

  const validate = program.command("validate").description("Run validation checks");

  validate
    .command("catalog")
    .description("Validate catalog feeds or Content Update payloads")
    .argument("<paths...>", "Catalog artifact path(s)")
    .option("--json", "Print machine-readable JSON")
    .option("--report <path>", "Write a human-readable report file")
    .action(async (paths: string[], options: { json?: boolean; report?: string }) => {
      const report = await validateCatalog(paths);

      if (options.json) {
        const json = serializeJsonReport(catalogValidationReportSchema, "catalogValidationReport", report);
        console.log(json);
        if (options.report) {
          await writeReport(options.report, json);
          console.error(`Report written to ${options.report}`);
        }
        return;
      }

      const output = formatCatalogReport(report);
      console.log(output);

      if (options.report) {
        await writeReport(options.report, output);
        console.log(`\nReport written to ${options.report}`);
      }

      if (report.summary.P0 > 0) {
        process.exitCode = 2;
      }
    });

  validate
    .command("analytics")
    .description("Validate analytics Events API payload evidence")
    .argument("<paths...>", "Analytics event payload path(s)")
    .option("--json", "Print machine-readable JSON")
    .option("--report <path>", "Write a human-readable report file")
    .action(async (paths: string[], options: { json?: boolean; report?: string }) => {
      const report = await validateAnalytics(paths);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        if (options.report) {
          await writeReport(options.report, JSON.stringify(report, null, 2));
          console.error(`Report written to ${options.report}`);
        }
        return;
      }

      const output = formatAnalyticsReport(report);
      console.log(output);

      if (options.report) {
        await writeReport(options.report, output);
        console.log(`\nReport written to ${options.report}`);
      }

      if (report.summary.P0 > 0) {
        process.exitCode = 2;
      }
    });

  validate
    .command("service")
    .description("Validate live service API checks, starting with Autocomplete API")
    .argument("<paths...>", "Service profile path(s)")
    .option("--json", "Print machine-readable JSON")
    .option("--report <path>", "Write a human-readable report file")
    .action(async (paths: string[], options: { json?: boolean; report?: string }) => {
      const report = await validateService(paths);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        if (options.report) {
          await writeReport(options.report, JSON.stringify(report, null, 2));
          console.error(`Report written to ${options.report}`);
        }
        return;
      }

      const output = formatServiceReport(report);
      console.log(output);

      if (options.report) {
        await writeReport(options.report, output);
        console.log(`\nReport written to ${options.report}`);
      }

      if (report.summary.P0 > 0) {
        process.exitCode = 2;
      }
    });

  validate
    .command("frontend")
    .description("Validate frontend autocomplete API and analytics evidence")
    .argument("<paths...>", "Frontend HTML/JS evidence path(s)")
    .option("--profile <path>", "Frontend validation profile JSON")
    .option("--json", "Print machine-readable JSON")
    .option("--report <path>", "Write a human-readable report file")
    .action(async (paths: string[], options: { profile?: string; json?: boolean; report?: string }) => {
      const profile = options.profile ? await loadFrontendValidationProfile(options.profile) : undefined;
      const report = await validateFrontend(paths, profile ? { profile } : {});

      if (options.json) {
        const json = serializeJsonReport(frontendValidationReportSchema, "frontendValidationReport", report);
        console.log(json);
        if (options.report) {
          await writeReport(options.report, json);
          console.error(`Report written to ${options.report}`);
        }
        return;
      }

      const output = formatFrontendReport(report);
      console.log(output);

      if (options.report) {
        await writeReport(options.report, output);
        console.log(`\nReport written to ${options.report}`);
      }

      if (report.summary.P0 > 0) {
        process.exitCode = 2;
      }
    });

  const agent = program.command("agent").description("Run doc-aware agent reviews");

  agent
    .command("review-ui")
    .description("Review frontend UI evidence against validator rules plus local docs")
    .argument("<paths...>", "Frontend HTML/JS evidence path(s)")
    .option("--docs <path>", "Local docs repository path")
    .option("--service <service>", "Service being reviewed, currently autocomplete", "autocomplete")
    .option("--profile <path>", "Frontend validation profile JSON")
    .option("--max-docs <count>", "Maximum docs/examples to include", parsePositiveInteger, 12)
    .option("--browser", "Run optional browser/live evidence capture")
    .option("--browser-query <query>", "Query to type during browser/live capture", "shirt")
    .option("--browser-timeout <ms>", "Browser/live wait timeout in milliseconds", parsePositiveInteger, 2500)
    .option("--json", "Print machine-readable JSON")
    .option("--report <path>", "Write a Markdown report file")
    .action(
      async (
        paths: string[],
        options: {
          docs?: string;
          service: string;
          profile?: string;
          maxDocs: number;
          browser?: boolean;
          browserQuery: string;
          browserTimeout: number;
          json?: boolean;
          report?: string;
        }
      ) => {
        const service = normalizeAgentReviewService(options.service);
        const profile = options.profile ? await loadFrontendValidationProfile(options.profile) : undefined;
        const review = await reviewUi(paths, {
          docsRoot: options.docs ?? defaultDocsRoot(),
          service,
          ...(profile ? { profile } : {}),
          maxDocs: options.maxDocs,
          browser: {
            enabled: options.browser === true,
            query: options.browserQuery,
            timeoutMs: options.browserTimeout
          }
        });

        if (options.json) {
          const json = serializeJsonReport(agentUiReviewSchema, "agentUiReview", review);
          console.log(json);
          if (options.report) {
            await writeReport(options.report, json);
            console.error(`Report written to ${options.report}`);
          }
          return;
        }

        const output = formatAgentUiReview(review);
        console.log(output);

        if (options.report) {
          await writeReport(options.report, output);
          console.log(`\nReport written to ${options.report}`);
        }

        if (review.validation.summary.P0 > 0) {
          process.exitCode = 2;
        }
      }
    );

  agent
    .command("review-catalog")
    .description("Review catalog feeds or Content Update payloads with structure summaries and docs")
    .argument("<paths...>", "Catalog artifact path(s)")
    .option("--docs <path>", "Local docs repository path")
    .option("--max-docs <count>", "Maximum docs to include", parsePositiveInteger, 12)
    .option("--json", "Print machine-readable JSON")
    .option("--report <path>", "Write a Markdown report file")
    .action(async (paths: string[], options: { docs?: string; maxDocs: number; json?: boolean; report?: string }) => {
      const review = await reviewCatalog(paths, {
        docsRoot: options.docs ?? defaultDocsRoot(),
        maxDocs: options.maxDocs
      });

      if (options.json) {
        const json = serializeJsonReport(agentCatalogReviewSchema, "agentCatalogReview", review);
        console.log(json);
        if (options.report) {
          await writeReport(options.report, json);
          console.error(`Report written to ${options.report}`);
        }
        return;
      }

      const output = formatAgentCatalogReview(review);
      console.log(output);

      if (options.report) {
        await writeReport(options.report, output);
        console.log(`\nReport written to ${options.report}`);
      }

      if (review.validation.summary.P0 > 0) {
        process.exitCode = 2;
      }
    });

  await program.parseAsync(argv);
}

async function writeReport(path: string, content: string): Promise<void> {
  const absolutePath = resolve(process.cwd(), path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${content.trimEnd()}\n`, "utf8");
}

/**
 * Parse a report object through a Zod schema and return the pretty-printed
 * JSON. If validation fails we surface a helpful error that names the schema
 * and lists each offending path, so CLI consumers learn about contract drift
 * before downstream tooling chokes on a malformed payload.
 */
function serializeJsonReport<Schema extends z.ZodTypeAny>(
  schema: Schema,
  schemaName: string,
  report: unknown
): string {
  const result = schema.safeParse(report);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Report failed ${schemaName} schema validation. This usually means a field was added or renamed without updating src/core/schemas.ts.\n${issues}`
    );
  }
  return JSON.stringify(result.data, null, 2);
}

function formatAnalyticsReport(report: Awaited<ReturnType<typeof validateAnalytics>>): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(report.title);
  lines.push(`Score: ${report.score}/100`);
  lines.push(`Findings: P0=${report.summary.P0} P1=${report.summary.P1} P2=${report.summary.P2}`);

  lines.push("");
  lines.push("Detected artifacts:");
  for (const artifact of report.artifacts) {
    lines.push(`- ${artifact}`);
  }

  if (report.events.length > 0) {
    lines.push("");
    lines.push("Detected events:");
    for (const event of report.events) {
      lines.push(`- ${event}`);
    }
  }

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("No findings. Analytics evidence passes the current rule set.");
    return lines.join("\n");
  }

  for (const severity of ["P0", "P1", "P2"] as const) {
    const findings = report.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) continue;

    lines.push("");
    lines.push(`${severity} Findings`);
    for (const finding of findings) {
      lines.push(...formatFinding(finding));
    }
  }

  return lines.join("\n");
}

function formatCatalogReport(report: Awaited<ReturnType<typeof validateCatalog>>): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(report.title);
  lines.push(`Score: ${report.score}/100`);
  lines.push(`Findings: P0=${report.summary.P0} P1=${report.summary.P1} P2=${report.summary.P2}`);

  lines.push("");
  lines.push("Detected artifacts:");
  for (const artifact of report.artifacts) {
    lines.push(`- ${artifact}`);
  }

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("No findings. Catalog evidence passes the current rule set.");
    return lines.join("\n");
  }

  for (const severity of ["P0", "P1", "P2"] as const) {
    const findings = report.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) continue;

    lines.push("");
    lines.push(`${severity} Findings`);
    for (const finding of findings) {
      lines.push(...formatFinding(finding));
    }
  }

  return lines.join("\n");
}

function formatServiceReport(report: Awaited<ReturnType<typeof validateService>>): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(report.title);
  lines.push(`Score: ${report.score}/100`);
  lines.push(`Findings: P0=${report.summary.P0} P1=${report.summary.P1} P2=${report.summary.P2}`);

  lines.push("");
  lines.push("Detected artifacts:");
  for (const artifact of report.artifacts) {
    lines.push(`- ${artifact}`);
  }

  if (report.checks.length > 0) {
    lines.push("");
    lines.push("Detected checks:");
    for (const check of report.checks) {
      lines.push(`- ${check}`);
    }
  }

  if (report.requests.length > 0) {
    lines.push("");
    lines.push("Live requests:");
    for (const request of report.requests) {
      lines.push(`- ${request}`);
    }
  }

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("No findings. Autocomplete service checks pass the current rule set.");
    return lines.join("\n");
  }

  for (const severity of ["P0", "P1", "P2"] as const) {
    const findings = report.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) continue;

    lines.push("");
    lines.push(`${severity} Findings`);
    for (const finding of findings) {
      lines.push(...formatFinding(finding));
    }
  }

  return lines.join("\n");
}

function formatFrontendReport(report: Awaited<ReturnType<typeof validateFrontend>>): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(report.title);
  lines.push(`Profile: ${report.profile}`);
  lines.push(`Score: ${report.score}/100`);
  lines.push(`Findings: P0=${report.summary.P0} P1=${report.summary.P1} P2=${report.summary.P2}`);

  lines.push("");
  lines.push("Detected artifacts:");
  for (const artifact of report.artifacts) {
    lines.push(`- ${artifact}`);
  }

  if (report.capabilities.length > 0) {
    lines.push("");
    lines.push("Detected capabilities:");
    for (const capability of report.capabilities) {
      lines.push(`- ${capability}`);
    }
  }

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("No findings. Autocomplete frontend evidence passes the current rule set.");
    return lines.join("\n");
  }

  for (const severity of ["P0", "P1", "P2"] as const) {
    const findings = report.findings.filter((finding) => finding.severity === severity);
    if (findings.length === 0) continue;

    lines.push("");
    lines.push(`${severity} Findings`);
    for (const finding of findings) {
      lines.push(...formatFinding(finding));
    }
  }

  return lines.join("\n");
}

function formatFinding(finding: ValidationFinding): string[] {
  const state = finding.state === "unknown" ? "UNKNOWN " : "";
  return [
    "",
    `- ${state}[${finding.id}] ${finding.title}`,
    `  Evidence: ${finding.evidencePath}`,
    `  Why: ${finding.message}`,
    `  Fix: ${finding.remediation}`,
    `  Docs: ${finding.docs.join(", ")}`,
    `  Confidence: ${finding.confidence}`
  ];
}

function defaultDocsRoot(): string {
  return process.env.SE_VALIDATOR_DOCS_ROOT ?? resolve(process.cwd(), "../docs");
}

function normalizeAgentReviewService(service: string): AgentReviewService {
  if (service === "autocomplete") return service;
  throw new Error(`Unsupported agent review service: ${service}`);
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}
