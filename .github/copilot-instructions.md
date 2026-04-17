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
- Do not provide corrected snippets from memory. Open the docs/examples cited in the generated report first.
- If a source-backed snippet is not available, explain the fix without fabricating code.

## Common Commands

Frontend autocomplete:

```bash
yarn agent review-ui <file> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --explain \
  --report results/llm-review.md
```

Catalog:

```bash
yarn agent review-catalog <files...> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile <catalog-profile.json> \
  --report results/llm-catalog-review.md
```

Summaries should classify the integration as READY, RISKY, or BLOCKED and include P0/P1/P2 findings, file/line evidence, recommended fixes, and docs cited by the report.
