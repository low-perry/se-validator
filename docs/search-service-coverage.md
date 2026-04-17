# Search API Service Coverage

The service validator now covers Search API visibility checks in addition to autocomplete-related service checks.

## What It Validates

- The profile can declare `service: "search-api"` or `service: "search-visibility"`.
- Checks can use `endpoint: "search"` with `request.url: "https://live.luigisbox.com/search"`.
- Every Search check must send `tracker_id`.
- Search checks should send either `q` or filters (`f[]` / `f_must[]`).
- If `expect.resultTypes` is set, the validator compares it against `f[]=type:<type>` / `f_must[]=type:<type>`.
- Search response shape is validated as `results.hits[]`, not root `hits[]`.
- The response can be checked for expected identities, hit fields, attribute fields, `results.total_hits`, and `guid`.
- Analytics should map Search API rendering to `Search Results` views, click actions, and no-results events.

## Source Basis

- Search API reference: `search/api/v1/search`
- Search custom UI quickstart: `quickstart/search/building-custom-ui`
- Events API example: `public/examples/search/custom-search-ui.html`
- DataLayer example: `public/examples/search/custom-search-ui-datalayer.html`

These sources are also called out in the repo-local skills and agent adapter files so LLMs do not generate Search API snippets from memory.

## Demo Profiles

Passing profile:

```bash
yarn validate service fixtures/service/search-visibility-good.json \
  --report results/search-visibility-good-report.md
```

Intentional failure profile:

```bash
yarn validate service fixtures/service/search-visibility-bad.json \
  --report results/search-visibility-bad-report.md
```

The bad profile models the failure mode we saw during indexing validation: custom `digital_products` feed objects were searchable as `type:digital-products`, but a UI that keeps requesting `f[]=type:item` will not show them.
