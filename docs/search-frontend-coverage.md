# Search Frontend Coverage

The frontend validator can now review custom Search API HTML/JS evidence.

## What It Accepts

- Local `.html` / `.js` files.
- Pasted snippets saved under `tmp/agent-input/`.
- Agent reviews through `yarn agent review-ui --service search`.
- Plain frontend validation through `yarn validate frontend`.

When no profile is passed, the validator auto-detects Search UI evidence if the artifact calls `/search` and does not call Autocomplete. For custom indexed types, pass a profile so the validator knows which `f[]=type:<type>` should appear.

## What It Validates

- Search API endpoint usage.
- `tracker_id` and `q` or filter evidence.
- `f[]=type:<indexed-type>` when expected result types are declared.
- `hit_fields` use.
- Search response shape: `data.results`, `data.results.hits`, `data.results.facets`, and `data.results.total_hits`.
- Rendering from `results.hits`.
- Rendered identity and analytics identity based on `hit.url`.
- DataLayer collector script presence and head placement when `dataLayer.push` is used.
- Search Results view analytics.
- Search Results query analytics.
- Analytics items mapped from the same hits array.
- Click/select analytics.
- No-results analytics with an empty `items` array.

## Example Commands

Auto-detected Search UI:

```bash
yarn validate frontend fixtures/frontend/search-datalayer-good.html \
  --report results/search-ui-good-report.md
```

Search UI with expected custom type:

```bash
yarn validate frontend fixtures/frontend/search-bad.html \
  --profile fixtures/frontend/search-profile-digital-products.json \
  --report results/search-ui-bad-report.md
```

Doc-aware agent review:

```bash
yarn agent review-ui fixtures/frontend/search-bad.html \
  --service search \
  --profile fixtures/frontend/search-profile-digital-products.json \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --explain \
  --report results/agent-ui-search-bad-report.md
```

## Pasted Snippets

For chat-based snippets, save the pasted HTML/JS exactly first, then run the same command:

```bash
mkdir -p tmp/agent-input
# save pasted content as tmp/agent-input/search-ui.html
yarn agent review-ui tmp/agent-input/search-ui.html \
  --service search \
  --docs "$SE_VALIDATOR_DOCS_ROOT" \
  --explain \
  --report results/pasted-search-ui-review.md
```

If the client uses a custom indexed type, add a profile similar to `fixtures/frontend/search-profile-digital-products.json`.
