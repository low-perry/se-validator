# SE Validator Agent Instructions

Use `docs/llm-operator-prompts.md` as the operating procedure for this repo.

## Core Rules

- Do not judge Luigi's Box integration quality before running SE Validator.
- Run commands from `/Users/lowperry/projects/se-validator`.
- For doc-aware reviews, always pass `--docs /Users/lowperry/projects/docs`.
- Treat P0 as blocking, P1 as important, and P2 as advisory.
- Keep API keys and secrets out of responses and report snippets.
- Do not invent corrected snippets. If the user asks for fixes, enter source-backed fix mode: open the docs/examples cited by the generated report first, then cite the exact local file path and line used for the snippet.

## Default Commands

Frontend autocomplete review:

```bash
yarn agent review-ui <file> \
  --docs /Users/lowperry/projects/docs \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --explain \
  --report results/llm-review.md
```

Catalog review:

```bash
yarn agent review-catalog <files...> \
  --docs /Users/lowperry/projects/docs \
  --profile <catalog-profile.json> \
  --report results/llm-catalog-review.md
```

After running a review, read the report and summarize readiness as READY, RISKY, or BLOCKED with P0/P1/P2 findings, likely code lines, recommended fixes, and cited docs.
