---
name: se-validator-docs-verify
description: "Verify Luigi's Box documentation claims with local docs-search and docs-context tools before answering. Use when the user asks if docs support something, challenges a docs claim, asks 'are you sure', requests corrected snippets, or when validator output appears to conflict with documentation."
---

# SE Validator Docs Verify

Use this skill to prevent unsupported documentation claims and hallucinated fixes.

## Required Workflow

Always start from the validator repo root:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
```

Before saying "the docs say", "the docs do not mention", "this is supported", or "this is not supported", run a docs search:

```bash
scripts/docs-search.sh '<term-or-rg-pattern>'
```

Then open the most relevant lines:

```bash
scripts/docs-context.sh "$SE_VALIDATOR_DOCS_ROOT/src/content/docs/<path>.md" <line> 8
```

Use `yarn docs:search` and `yarn docs:context` if an agent can run Yarn scripts more reliably than shell scripts.

## Answer Format

Use this structure for docs-claim answers:

```text
Docs evidence:
- [<source>](https://docs.luigisbox.com/<source>) — <file>:<line>
> <short docs quote>

Validator evidence:
- <command/report> says ...

Conclusion:
- Supported / not supported / ambiguous / docs-validator mismatch.

Next action:
- The concrete thing to change or verify next.
```

## Hard Rules

- Never make a docs claim from memory.
- Never rely on `rg` snippets alone when the answer depends on wording; open context lines with `scripts/docs-context.sh`.
- Source mentions must use absolute docs links in the form `https://docs.luigisbox.com/<source>`.
- When quoting docs, put the quote in a Markdown blockquote under the source link.
- If search returns no match, say no local docs evidence was found for the searched terms. Do not convert absence into certainty unless the validator also proves it.
- If docs and validator disagree, label it `docs-validator mismatch` and do not guess which source is right.
- Corrected snippets must be backed by exact local docs or examples paths and line numbers.
- Prefer examples under `$SE_VALIDATOR_DOCS_ROOT/public/examples/` for frontend snippets.
- For Search API or custom search UI claims, check the Search API reference, the custom search UI quickstart, and both public examples before writing snippets:
  - `$SE_VALIDATOR_DOCS_ROOT/src/content/docs/search/api/v1/search.mdx`
  - `$SE_VALIDATOR_DOCS_ROOT/src/content/docs/quickstart/search/building-custom-ui.md`
  - `$SE_VALIDATOR_DOCS_ROOT/public/examples/search/custom-search-ui.html`
  - `$SE_VALIDATOR_DOCS_ROOT/public/examples/search/custom-search-ui-datalayer.html`
- For Search API type visibility, treat the indexed hit `type` returned by `/search` as the type the UI must request with `f[]=type:<type>` unless the client intentionally mixes result types.
