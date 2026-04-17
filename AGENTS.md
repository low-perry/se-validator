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
- Treat P0 as blocking, P1 as important, and P2 as advisory.
- Keep API keys and secrets out of responses and report snippets.
- Do not invent corrected snippets. If the user asks for fixes, enter source-backed fix mode: open the docs/examples cited by the generated report first, then cite the exact local file path and line used for the snippet.

## Default Commands

Frontend autocomplete review:

```bash
yarn agent review-ui <file> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --explain \
  --report results/llm-review.md
```

Catalog review:

```bash
yarn agent review-catalog <files...> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile <catalog-profile.json> \
  --report results/llm-catalog-review.md
```

After running a review, read the report and summarize readiness as READY, RISKY, or BLOCKED with P0/P1/P2 findings, likely code lines, recommended fixes, and cited docs.

## Skills

Repo-local skills live under `skills/`:

- `skills/se-validator-review/SKILL.md` for validator-backed reviews.
- `skills/se-validator-docs-verify/SKILL.md` for docs-backed claims and corrected snippets.

## Pasted Evidence

If the user pastes raw XML/JSON/HTML/JS in chat, follow the Pasted Evidence Workflow in `docs/llm-operator-prompts.md`: save it under `tmp/agent-input/`, run the matching validator command, then summarize the generated `results/pasted-*.md` report. Do not inspect pasted evidence from memory.
