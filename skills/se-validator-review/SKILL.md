---
name: se-validator-review
description: "Run the local SE Validator on Luigi's Box catalog feeds, Content Update JSON, autocomplete HTML/JS, analytics payloads, and service profiles. Use when the user asks whether integration evidence is correct, good, bad, ready, risky, blocked, or pastes raw XML, JSON, HTML, or JavaScript for review."
---

# SE Validator Review

Use this skill to review Luigi's Box integration evidence with the local validator CLI before judging quality.

## Setup

Always start from the validator repo root:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

The bootstrap exports `SE_VALIDATOR_ROOT` and `SE_VALIDATOR_DOCS_ROOT`; do not hardcode local absolute paths.

## Evidence Routing

- XML or JSON catalog feed: run `yarn validate catalog <files...>` for quick validation, or `yarn agent review-catalog <files...> --docs "$SE_VALIDATOR_DOCS_ROOT" --report results/llm-catalog-review.md` for doc-aware review.
- Content Update JSON payload: review as catalog evidence with `yarn agent review-catalog`.
- Frontend autocomplete HTML/JS: run `yarn agent review-ui <files...> --docs "$SE_VALIDATOR_DOCS_ROOT" --profile fixtures/frontend/autocomplete-profile-full.json --explain --report results/llm-review.md`.
- Analytics event payload JSON: run `yarn validate analytics <files...>`.
- Service profile JSON: run `yarn validate service <files...>`.

If the user pastes raw evidence in chat, save it exactly under `tmp/agent-input/` before running the matching command. Do not review pasted content from memory.

## Output Rules

- Classify as `READY` when there are no P0/P1 findings.
- Classify as `RISKY` when there are no P0 findings but one or more P1 findings.
- Classify as `BLOCKED` when there is one or more P0 finding.
- Report score and P0/P1/P2 counts.
- Lead with P0 findings, then P1, then P2.
- Include validator evidence lines and cited docs when present.
- Source mentions must use absolute `https://docs.luigisbox.com/<source>` links. Direct docs quotes must use Markdown blockquotes.
- Keep API keys and secrets out of the response.

## Fixes

When asked for corrected snippets, switch to source-backed fix mode from `docs/llm-operator-prompts.md` and use the `se-validator-docs-verify` skill. Do not invent API fields, payload shapes, event names, script tags, or XML/JSON structures from memory.
