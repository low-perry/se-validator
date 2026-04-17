# Claude Instructions For SE Validator

Use `docs/llm-operator-prompts.md` as your operating procedure.

Before running commands, evaluate the shared environment bootstrap:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

Hard rules:

- Do not review integration evidence from memory. Run SE Validator first.
- For doc-aware commands, pass `--docs "$SE_VALIDATOR_DOCS_ROOT"`.
- If asked for corrected snippets, open the docs/examples cited by the report before writing code.
- Do not invent API fields, event names, payload shapes, or script tags.
- If no docs-backed snippet exists, say so and provide a plain-English fix only.

Default frontend review:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
yarn agent review-ui <file> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile fixtures/frontend/autocomplete-profile-full.json \
  --explain \
  --report results/llm-review.md
```

Default catalog review:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
yarn agent review-catalog <files...> \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --profile <catalog-profile.json> \
  --report results/llm-catalog-review.md
```

Final summaries should say whether the integration is READY, RISKY, or BLOCKED and list the P0/P1/P2 findings with evidence lines and cited docs.

## Pasted Evidence

If the user pastes raw XML/JSON/HTML/JS in chat, follow the Pasted Evidence Workflow in `docs/llm-operator-prompts.md`: save it under `tmp/agent-input/`, run the matching validator command, then summarize the generated `results/pasted-*.md` report. Do not inspect pasted evidence from memory.
