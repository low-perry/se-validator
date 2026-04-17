# GitHub Copilot Instructions For SE Validator

This repo contains a CLI-backed SE Validation Agent for Luigi's Box integrations.

Before reviewing integration evidence, read `docs/llm-operator-prompts.md` and follow it.

Before running commands, evaluate the shared environment bootstrap:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

## Operating Rules

- Run validator commands from `$SE_VALIDATOR_ROOT`.
- Always pass `--docs "$SE_VALIDATOR_DOCS_ROOT"` for `yarn agent ...` reviews.
- Do not invent integration requirements. Use validator findings and cited docs.
- Before making docs/support claims, run `scripts/docs-search.sh '<term-or-rg-pattern>'` and open relevant lines with `scripts/docs-context.sh '<absolute-docs-file-path>' <line> 8`.
- If docs and validator behavior disagree, call it a docs-validator mismatch.
- Source mentions must use absolute `https://docs.luigisbox.com/<source>` links. Direct docs quotes must use Markdown blockquotes.
- Do not provide corrected snippets from memory. Open the docs/examples cited in the generated report first.
- If a source-backed snippet is not available, explain the fix without fabricating code.
- For Search API/custom search UI work, verify against `search/api/v1/search`, `quickstart/search/building-custom-ui`, `public/examples/search/custom-search-ui.html`, and `public/examples/search/custom-search-ui-datalayer.html` before giving snippets.

## Common Commands

Frontend autocomplete:

```bash
yarn suggest autocomplete-profile \
  --tracker-id <tracker-id> \
  --query <sample-query> \
  --out results/autocomplete-profile-suggested.json

yarn agent review-ui <file> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --service autocomplete \
  --profile results/autocomplete-profile-suggested.json \
  --explain \
  --report results/llm-review.md
```

If the intended autocomplete features are already specified, use that explicit profile. In generated profiles, `topItems=optional` and `trendingQueries=optional` only prove live endpoint availability, not mandatory UI intent.

Frontend Search API:

```bash
yarn agent review-ui <file> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --service search \
  --explain \
  --report results/llm-search-ui-review.md
```

When the expected indexed type is known, pass a profile such as `fixtures/frontend/search-profile-digital-products.json`.

When the expected Search type is unknown, generate a profile from live Search API hits:

```bash
yarn suggest search-profile \
  --tracker-id <tracker-id> \
  --query <sample-query> \
  --out results/search-profile-suggested.json
```

Catalog:

```bash
yarn agent review-catalog <files...> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile <catalog-profile.json> \
  --report results/llm-catalog-review.md
```

Search API visibility:

```bash
yarn validate service fixtures/service/search-visibility-good.json \
  --report results/llm-search-service-review.md
```

Use Search API service validation when the issue is "indexed but not visible"; it checks that the request type filter matches the hit type returned by `/search`, and that Search Results analytics are declared.

Summaries should classify the integration as READY, RISKY, or BLOCKED and include P0/P1/P2 findings, file/line evidence, recommended fixes, and docs cited by the report.

## Skills

Repo-local skills:

- `skills/se-validator-review/SKILL.md` for validator-backed reviews.
- `skills/se-validator-docs-verify/SKILL.md` for docs-backed claims and corrected snippets.

## Pasted Evidence

If the user pastes raw XML/JSON/HTML/JS in chat, follow the Pasted Evidence Workflow in `docs/llm-operator-prompts.md`: save it under `tmp/agent-input/`, run the matching validator command, then summarize the generated `results/pasted-*.md` report. Do not inspect pasted evidence from memory.
