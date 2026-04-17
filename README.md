# SE Validator

SE Validator is a TypeScript CLI for reviewing Luigi's Box client-led integrations.

It reads integration evidence such as catalog feeds, Content Update payloads, analytics payloads, service profiles, and frontend HTML/JS, then produces a scored report with findings, evidence paths, recommended fixes, and docs references.

The goal is simple: catch integration gaps early and give clients a clear feedback loop before review turns into back-and-forth.

## Contents

- [What It Validates](#what-it-validates)
- [Severity Model](#severity-model)
- [Requirements](#requirements)
- [Setup](#setup)
- [Quick Start](#quick-start)
- [Profile Generators](#profile-generators)
- [Pasted Evidence Workflow](#pasted-evidence-workflow)
- [Report Viewer](#report-viewer)
- [LLM And Agent Usage](#llm-and-agent-usage)
- [Main Commands](#main-commands)
- [Useful Fixtures](#useful-fixtures)
- [Project Map](#project-map)
- [Current Limitations](#current-limitations)

## What It Validates

- **Catalog indexing**: XML feeds, JSON feeds, and Content Update payloads.
- **Catalog modeling**: required fields, immutable and unique identities, category shape, primary categories, category/item pairing, availability values, nested variants, and consecutive variant groups.
- **Analytics**: Events API JSON payloads and DataLayer Collector examples.
- **Services**: live Autocomplete and Search API checks through service profile JSON.
- **Frontend UI**: custom Autocomplete and Search API HTML/JS evidence, including request shape, rendering flow, analytics wiring, no-results behavior, and identity flow from API hit to rendered item to analytics event.
- **Agent reviews**: doc-aware Markdown reports that combine validator output with local Luigi's Box docs context.

## Severity Model

- **P0**: blocking issue. The integration is likely broken or cannot be trusted.
- **P1**: important issue. The integration may work partially, but the setup is risky or incomplete.
- **P2**: advisory issue. The setup can improve, or the validator cannot fully prove something from the supplied evidence.

Suggested readiness labels:

- **READY**: no P0 or P1 findings.
- **RISKY**: no P0 findings, but at least one P1.
- **BLOCKED**: at least one P0.

## Requirements

- Node.js 20 or newer.
- Corepack enabled, so the repo can use the pinned Yarn version from `package.json`.
- Network access for live service checks and profile generators.
- A local Luigi's Box docs repo for doc-aware agent reports. By default, this repo expects the docs repo next to it at `../docs`.

Optional:

- Playwright browser dependencies if you use `yarn agent review-ui --browser`.

## Setup

```bash
cd /path/to/se-validator
corepack enable
yarn install
```

Load shared paths before running agent reviews:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

If your docs repo is not at `../docs`, set it once before loading the environment:

```bash
export SE_VALIDATOR_DOCS_ROOT=/path/to/docs
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

Check that the project is healthy:

```bash
yarn typecheck
yarn test
```

## Quick Start

Run a catalog validation:

```bash
yarn validate catalog fixtures/catalog/good-feed.xml fixtures/catalog/good-categories.xml
```

Run a failing catalog validation:

```bash
yarn validate catalog fixtures/catalog/bad-json-feed.json fixtures/catalog/bad-json-categories.json
```

Write a Markdown report:

```bash
yarn validate catalog \
  fixtures/catalog/bad-json-feed.json \
  fixtures/catalog/bad-json-categories.json \
  --report results/bad-json-catalog-report.md
```

Run a doc-aware catalog review:

```bash
yarn agent review-catalog \
  fixtures/catalog/bad-json-feed.json \
  fixtures/catalog/bad-json-categories.json \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --report results/agent-catalog-review.md
```

Run a doc-aware frontend Autocomplete review:

```bash
yarn agent review-ui \
  fixtures/frontend/autocomplete-bad.html \
  --service autocomplete \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --explain \
  --report results/agent-ui-review.md
```

Run a doc-aware frontend Search review:

```bash
yarn agent review-ui \
  fixtures/frontend/search-bad.html \
  --service search \
  --profile fixtures/frontend/search-profile-digital-products.json \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --explain \
  --report results/agent-ui-search-review.md
```

## Profile Generators

Profiles tell the validator what an integration is supposed to do. Use generators when the UI intent is unclear and you want live API evidence before reviewing frontend code.

Generate an Autocomplete frontend profile:

```bash
yarn suggest autocomplete-profile \
  --tracker-id 757876-1071971 \
  --query shirt \
  --analytics-mode datalayer \
  --out results/autocomplete-profile-suggested.json
```

Generate a Search frontend profile from live Search API hit types:

```bash
yarn suggest search-profile \
  --tracker-id 757876-1071971 \
  --query shirt \
  --analytics-mode datalayer \
  --out results/search-profile-suggested.json
```

Generate a Search profile for one expected custom type:

```bash
yarn suggest search-profile \
  --tracker-id 757876-1071971 \
  --query shirt \
  --filter type:digital-products \
  --analytics-mode datalayer \
  --out results/search-profile-digital-products-suggested.json
```

## Pasted Evidence Workflow

When an LLM or reviewer receives raw XML, JSON, HTML, or JavaScript in chat, save it exactly first, then run the validator.

```bash
mkdir -p tmp/agent-input
# save pasted content as tmp/agent-input/client-evidence.html

yarn agent review-ui \
  tmp/agent-input/client-evidence.html \
  --service autocomplete \
  --profile results/autocomplete-profile-suggested.json \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --explain \
  --report results/pasted-ui-review.md
```

Do not judge pasted evidence from memory. The report is the source of truth.

## Report Viewer

The repo includes a zero-build static viewer for Markdown and JSON reports:

```bash
open tools/report-viewer/index.html
```

For browsers that block local `fetch`, serve the repo root:

```bash
npx serve .
# then open http://localhost:3000/tools/report-viewer/
```

The viewer can load sample reports, open local report files, or accept pasted report text.

## LLM And Agent Usage

Use [`docs/llm-operator-prompts.md`](docs/llm-operator-prompts.md) when another LLM should operate the validator.

Important rules for agents:

- Run SE Validator before making integration quality claims.
- Use `eval "$(scripts/agent-env.sh)"` instead of hardcoding local paths.
- Always pass `--docs "$SE_VALIDATOR_DOCS_ROOT"` for doc-aware reviews.
- Verify docs claims with `scripts/docs-search.sh` and `scripts/docs-context.sh`.
- Do not invent corrected snippets. Open the cited docs or examples first.
- Use absolute docs links in explanations: `https://docs.luigisbox.com/<source>`.

Repo-local skills live in:

- [`skills/se-validator-review/SKILL.md`](skills/se-validator-review/SKILL.md)
- [`skills/se-validator-docs-verify/SKILL.md`](skills/se-validator-docs-verify/SKILL.md)

## Main Commands

```bash
yarn validate catalog <paths...>
yarn validate analytics <paths...>
yarn validate service <paths...>
yarn validate frontend <paths...>
yarn agent review-catalog <paths...>
yarn agent review-ui <paths...>
yarn suggest autocomplete-profile --tracker-id <tracker-id>
yarn suggest search-profile --tracker-id <tracker-id>
yarn typecheck
yarn test
```

Most validation commands support:

```bash
--report results/name.md
--json
```

## Useful Fixtures

- Catalog: [`fixtures/catalog/`](fixtures/catalog/)
- Analytics: [`fixtures/analytics/`](fixtures/analytics/)
- Service profiles: [`fixtures/service/`](fixtures/service/)
- Frontend UI: [`fixtures/frontend/`](fixtures/frontend/)
- Existing reports: [`results/`](results/)

Catalog fixture guides start at [`fixtures/catalog/README.md`](fixtures/catalog/README.md).

## Project Map

- `src/catalog/`: catalog feed and Content Update detection, normalization, and rules.
- `src/analytics/`: Events API and DataLayer validation.
- `src/service/`: live service profile validation.
- `src/frontend/`: frontend HTML/JS parsing, rules, and profile generators.
- `src/agent/`: doc-aware report generation and browser evidence.
- `src/cli/`: command-line interface.
- `docs/`: project coverage notes, demo script, and LLM prompts.
- `tools/report-viewer/`: static presentation UI for reports.

## Current Limitations

- Static frontend checks are heuristic. Browser evidence helps, but it does not prove every runtime path.
- Optional frontend features can be hard to infer from HTML alone; use profiles to state intent.
- Docs-backed fixes require the local docs repo.
- Live API profile generators sample current API behavior. They should guide a review, not replace product intent.
