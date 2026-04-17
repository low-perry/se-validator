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
- Before making docs/support claims, run `scripts/docs-search.sh '<term-or-rg-pattern>'` and open relevant lines with `scripts/docs-context.sh '<absolute-docs-file-path>' <line> 8`.
- If docs and validator behavior disagree, call it a docs-validator mismatch.
- Source mentions must use absolute `https://docs.luigisbox.com/<source>` links. Direct docs quotes must use Markdown blockquotes.
- If asked for corrected snippets, open the docs/examples cited by the report before writing code.
- Do not invent API fields, event names, payload shapes, or script tags.
- If no docs-backed snippet exists, say so and provide a plain-English fix only.
- For Search API/custom search UI work, verify against `search/api/v1/search`, `quickstart/search/building-custom-ui`, `public/examples/search/custom-search-ui.html`, and `public/examples/search/custom-search-ui-datalayer.html` before giving snippets.

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

Default Search API visibility review:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
yarn validate service fixtures/service/search-visibility-good.json \
  --report results/llm-search-service-review.md
```

Use Search API service validation to catch cases where objects are indexed but the UI filters a different hit type, for example asking for `type:item` when `/search` returns the objects as `type:digital-products`.

Final summaries should say whether the integration is READY, RISKY, or BLOCKED and list the P0/P1/P2 findings with evidence lines and cited docs.

## Skills

Use repo-local skills when the tool supports them:

- `skills/se-validator-review/SKILL.md` for validator-backed reviews.
- `skills/se-validator-docs-verify/SKILL.md` for docs-backed claims and corrected snippets.

## Pasted Evidence

If the user pastes raw XML/JSON/HTML/JS in chat, follow the Pasted Evidence Workflow in `docs/llm-operator-prompts.md`: save it under `tmp/agent-input/`, run the matching validator command, then summarize the generated `results/pasted-*.md` report. Do not inspect pasted evidence from memory.
