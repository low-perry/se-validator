# SE Validator — Hackathon Demo

A 3–5 minute walk-through of the validator, aimed at someone who has never seen it before.

## Pitch

SE Validator is a CLI that reads Luigi's Box integration evidence (catalog feeds, frontend HTML/JS, service profiles) and tells you, in seconds, exactly which rules a client integration is breaking and where to look in the docs to fix it.

## Problem

Today, reviewing whether a new integration follows Luigi's Box conventions is a manual slog: someone opens the feed, squints at a Content Update payload, diffs it against the docs, then reads the client's HTML looking for the collector script, the autocomplete call shape, and the analytics wiring. It is slow, inconsistent between reviewers, and easy to miss subtle issues (wrong identity field, variants not consecutive, collector in `<body>` instead of `<head>`). The validator turns that review into a scored, cited, reproducible pass.

## What the validator covers today

- **Catalog** — XML feeds, JSON feeds, and Content Update payloads. Detects artifact type, normalizes objects, and checks required fields, identity uniqueness, category-feed flatness, category-pairing, availability values, variant-group consecutiveness, primary-category markers, nested variants, and pairing shapes.
- **Analytics** — Events API payloads and DataLayer pages. Checks event shape, identity wiring, and collector presence.
- **Service** — Live autocomplete service checks driven by a profile JSON (headers, response shape, response-time sanity).
- **Frontend autocomplete** — HTML/JS evidence against a `frontend` profile. Checks the autocomplete request parameters, analytics identity parity with `hit.url`, click/select tracking, Top Items and Trending Queries wiring, collector placement, and `dns-prefetch`.
- **`agent review-ui`** — Wraps the frontend validator, adds doc lookup from a local docs repo, renders a Markdown report with evidence snippets and cited doc sections, and can optionally launch Playwright to verify what a real browser sees.

## Demo commands

All commands below are defined in `package.json` scripts and `src/cli/command.ts`. Each one maps to a report already in `results/` that was produced by the same invocation — the short excerpts are copied from those files.

Before running the demo, load the shared path configuration:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

By default this expects the docs repo at `../docs`. If your local layout is different, set `SE_VALIDATOR_DOCS_ROOT` before evaluating the script:

```bash
export SE_VALIDATOR_DOCS_ROOT=/path/to/docs
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

### 1. Good catalog (XML feed + category feed)

```bash
yarn validate catalog fixtures/catalog/good-feed.xml fixtures/catalog/good-categories.xml
```

Clean pass, useful as a "nothing to panic about" baseline. Output (captured in `results/agent-catalog-review-good-feed-report.md` via the richer `agent review-catalog` variant):

```text
Score: 100/100
Findings: P0=0 P1=0 P2=0
Detected artifacts:
- fixtures/catalog/good-feed.xml: feed-xml / product-feed (95%)
- fixtures/catalog/good-feed-cat.xml: feed-xml / category-feed (95%)
```

### 2. Bad catalog (JSON feed + category feed with real issues)

```bash
yarn validate catalog fixtures/catalog/bad-json-feed.json fixtures/catalog/bad-json-categories.json
```

Excerpt from `results/bad-json-catalog-report.md`:

```text
Score: 32/100
Findings: P0=2 P1=5 P2=1

- [CATALOG_IDENTITY_DUPLICATE] Catalog identity is reused
  Evidence: fixtures/catalog/bad-json-feed.json:product-feed[3]
  Why: Identity "JSON-SKU-3" appears in both product "JSON-SKU-3" at
       fixtures/catalog/bad-json-feed.json[2] and product "JSON-SKU-3" at
       fixtures/catalog/bad-json-feed.json[3].
  Fix: Use a unique immutable identity across products, categories, brands, and articles.
  Docs: platform-foundations/identity.md, indexing/feeds.md, indexing/data-layout.md

- [VARIANT_GROUP_NOT_CONSECUTIVE] Variant group is not consecutive in feed
  Evidence: fixtures/catalog/bad-json-feed.json:item_group_id=JSON-SHIRT-1
  Why: item_group_id "JSON-SHIRT-1" appears at item positions 0, 2 in the feed.
```

That is the whole point: every finding carries the file, the object path, a plain-language *why*, a *fix*, and doc references.

### 3. Good UI (frontend autocomplete)

```bash
yarn agent review-ui \
  fixtures/frontend/autocomplete-events-api-good.html \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --report results/agent-ui-review-good-report.md
```

Excerpt from `results/agent-ui-review-good-report.md`:

```text
Score: 100/100
Findings: P0=0 P1=0 P2=0

## Detected Capabilities
- fixtures/frontend/autocomplete-events-api-good.html:
  endpoints=autocomplete, top_items, trending_queries;
  analytics=Autocomplete view, Recommendation view, click/select, no-results

## Docs Consulted
- Getting query suggestions via the Autocomplete API:
  $SE_VALIDATOR_DOCS_ROOT/src/content/docs/quickstart/autocomplete/query-suggestions.md:120
- Implementing top items with the API:
  $SE_VALIDATOR_DOCS_ROOT/src/content/docs/quickstart/autocomplete/top-items-api.md:23
- DataLayer collector:
  $SE_VALIDATOR_DOCS_ROOT/src/content/docs/analytics/collector.md:344
```

Even on a clean pass, the report lists the docs it consulted — so a reviewer can see *why* the validator is confident.

### 4. Bad UI (frontend autocomplete)

```bash
yarn agent review-ui \
  fixtures/frontend/autocomplete-bad.html \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --report results/agent-ui-review-bad-report.md
```

Excerpt from `results/agent-ui-review-bad-report.md`:

```text
Score: 0/100
Findings: P0=4 P1=7 P2=4

### P0 FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING
Evidence: fixtures/frontend/autocomplete-bad.html
Problem: does not show q in the autocomplete request.
Recommended fix: Send the current search input value as q for query autocomplete.
Likely code: fixtures/frontend/autocomplete-bad.html:20
Snippet: `search: query,`
Docs: autocomplete/api/v2/autocomplete, quickstart/autocomplete/query-suggestions

### P0 FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING
Problem: uses dataLayer.push but does not include the Luigi's Box collector script.
Recommended fix: Add <script async src="https://scripts.luigisbox.tech/LBX-1071971.js">
                 to the shared head.
```

### 4b. Optional — same bad UI with live browser verification

```bash
yarn agent review-ui \
  fixtures/frontend/autocomplete-bad.html \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --browser --browser-query "shirt" \
  --report results/agent-ui-review-browser-report.md
```

`results/agent-ui-review-browser-report.md` adds a `## Browser Evidence` section with what Playwright actually saw:

```text
## Browser Evidence
- fixtures/frontend/autocomplete-bad.html: passed
  Browser evidence was observed.
  - Observed 1 Autocomplete API request(s).
  - Observed 1 Top Items request(s).
  - Observed rendered output (5 candidate element(s)).
  - Analytics requests: 0
  - dataLayer events: 0
```

Reading `Analytics requests: 0` next to a `P0 FRONTEND_EXPECTED_EVENTS_API_ANALYTICS_MISSING` finding is the kind of independent corroboration that makes a reviewer trust the static check.

## What makes it agentic

1. **Docs lookup, not hand-rolled messages.** The `agent review-ui` and `agent review-catalog` commands load the real docs repo (`--docs "$SE_VALIDATOR_DOCS_ROOT"`), search for sections relevant to each detected capability and each finding, and cite them inline with file path and line number.
2. **Evidence plumbing.** Every finding carries `path:line` plus a code snippet, and the report lists the docs it pulled *and the reason* (`Referenced by FRONTEND_…`, `Quickstart guidance for implementation flow`, etc.). That traceability is what lets a reviewer accept or challenge a call.
3. **Profile awareness.** `--profile` files under `fixtures/frontend/` turn Top Items / Trending Queries into `required`, `optional`, or `disabled`. The same fixture file produces a different report depending on the contract the integration is actually signed up for.
4. **Optional browser verification.** `--browser` launches Playwright, types a query, and records network + DOM activity. Findings and browser evidence sit side by side so a human can validate the static call.
5. **LLM operator prompt.** [`docs/llm-operator-prompts.md`](./llm-operator-prompts.md) gives another LLM the repo paths, command contract, severity policy, and expected output format so it can operate the validator instead of guessing from raw evidence.

## Known limitations (honest list)

Pulled straight from `results/fixture-eval/EVALUATION.md`, a from-scratch fixture matrix run against the validator:

- **Regex detection is file-scoped.** `tracker_id` appearing in an HTML comment is enough to fool the "required param missing" check. Any string in a docstring, TODO, or commented-out block can silently pass a capability gate.
- **Setter-vs-reader confusion.** `button.dataset.itemId = item.url` in the renderer will mark `clickUsesRenderedIdentity` true even when the click handler reads `textContent` instead. Capability checks need to see a *read* from the correct identity, not just a mention.
- **Optional-feature noise.** `topItems=optional` and `trendingQueries=optional` still emit P2 `…_NOT_EVIDENCED` findings when those endpoints are not used. That dilutes the signal in minimal integrations.
- **Docs path is local by design.** Different developers may keep the docs repo in different places. `scripts/agent-env.sh` centralizes that setup and supports `SE_VALIDATOR_DOCS_ROOT` overrides.
- **Feed import parity is still manual.** The primary-category ordering mismatch between XML and Content Update catalogs (see `investigation-and-todos.md`) is a known open item that the validator flags but does not yet auto-diff against Search API results.

## Next steps

- Strip comments from raw files before running capability regexes; scope the remaining regexes to the reader context (click handler, render loop) rather than file-global.
- Fire `…_NOT_EVIDENCED` only when `expectation === "required"`; keep the `disabled` rule to catch unexpected endpoint use.
- Add a first-class config command that prints the resolved validator/docs roots and diagnoses missing local docs.
- Add an import-parity validator that pulls Search API responses for each catalog identity and diffs them across XML, JSON, and Content Update sources.
- Make the agent review surface its confidence (high / low) when a finding relies on a heuristic the evaluation flagged as brittle.
