# Claude Instructions For SE Validator

Use `docs/llm-operator-prompts.md` as your operating procedure.

Hard rules:

- Do not review integration evidence from memory. Run SE Validator first.
- For doc-aware commands, pass `--docs /Users/lowperry/projects/docs`.
- If asked for corrected snippets, open the docs/examples cited by the report before writing code.
- Do not invent API fields, event names, payload shapes, or script tags.
- If no docs-backed snippet exists, say so and provide a plain-English fix only.

Default frontend review:

```bash
cd /Users/lowperry/projects/se-validator
yarn agent review-ui <file> \
  --docs /Users/lowperry/projects/docs \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --explain \
  --report results/llm-review.md
```

Default catalog review:

```bash
cd /Users/lowperry/projects/se-validator
yarn agent review-catalog <files...> \
  --docs /Users/lowperry/projects/docs \
  --profile <catalog-profile.json> \
  --report results/llm-catalog-review.md
```

Final summaries should say whether the integration is READY, RISKY, or BLOCKED and list the P0/P1/P2 findings with evidence lines and cited docs.
