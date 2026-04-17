# SE Validator Agent Instructions

Use `docs/llm-operator-prompts.md` as the operating procedure for this repo.

Before running commands, evaluate the shared environment bootstrap:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

## Core Rules

- Do not judge Luigi's Box integration quality before running SE Validator.
- Run commands from `$SE_VALIDATOR_ROOT`.
- For doc-aware reviews, always pass `--docs "$SE_VALIDATOR_DOCS_ROOT"`.
- Before saying what the docs support, run `scripts/docs-search.sh '<term-or-rg-pattern>'` and open the relevant lines with `scripts/docs-context.sh '<absolute-docs-file-path>' <line> 8`.
- If docs and validator behavior disagree, label it a docs-validator mismatch instead of guessing.
- Source mentions must use absolute `https://docs.luigisbox.com/<source>` links. Direct docs quotes must use Markdown blockquotes.
- Treat P0 as blocking, P1 as important, and P2 as advisory.
- Keep API keys and secrets out of responses and report snippets.
- Do not invent corrected snippets. If the user asks for fixes, enter source-backed fix mode: open the docs/examples cited by the generated report first, then cite the exact local file path and line used for the snippet.
- For Search API/custom search UI work, verify against the Search API reference, the custom search UI quickstart, and both public examples before correcting snippets.

## Default Commands

Frontend autocomplete review:

```bash
yarn agent review-ui <file> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --service autocomplete \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --explain \
  --report results/llm-review.md
```

Frontend Search API review:

```bash
yarn agent review-ui <file> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --service search \
  --explain \
  --report results/llm-search-ui-review.md
```

When the expected indexed Search type is known, pass a profile such as `fixtures/frontend/search-profile-digital-products.json` so the validator can catch `f[]=type:item` vs `f[]=type:digital-products` mismatches.

Catalog review:

```bash
yarn agent review-catalog <files...> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile <catalog-profile.json> \
  --report results/llm-catalog-review.md
```

Search API visibility review:

```bash
yarn validate service fixtures/service/search-visibility-good.json \
  --report results/llm-search-service-review.md
```

Use this for the indexed-but-not-visible failure mode: validate that the UI's `f[]=type:<type>` filter matches the hit `type` returned by `/search`, and that Search Results analytics are declared for views, clicks, and no-results.

After running a review, read the report and summarize readiness as READY, RISKY, or BLOCKED with P0/P1/P2 findings, likely code lines, recommended fixes, and cited docs.

## Skills

Repo-local skills live under `skills/`:

- `skills/se-validator-review/SKILL.md` for validator-backed reviews.
- `skills/se-validator-docs-verify/SKILL.md` for docs-backed claims and corrected snippets.

## Pasted Evidence

If the user pastes raw XML/JSON/HTML/JS in chat, follow the Pasted Evidence Workflow in `docs/llm-operator-prompts.md`: save it under `tmp/agent-input/`, run the matching validator command, then summarize the generated `results/pasted-*.md` report. Do not inspect pasted evidence from memory.
