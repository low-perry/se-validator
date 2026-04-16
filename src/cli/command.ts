import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import type { ValidationFinding } from "../core/types.js";
import { validateCatalog } from "../catalog/validate.js";

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
        console.log(JSON.stringify(report, null, 2));
        if (options.report) {
          await writeReport(options.report, JSON.stringify(report, null, 2));
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

  await program.parseAsync(argv);
}

async function writeReport(path: string, content: string): Promise<void> {
  const absolutePath = resolve(process.cwd(), path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${content.trimEnd()}\n`, "utf8");
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
