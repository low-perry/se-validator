# Presenter Script — SE Validator (3 min)

Run before the demo:

```bash
eval "$(scripts/agent-env.sh)"
cd "$SE_VALIDATOR_ROOT"
npx serve .
# open http://localhost:3000/tools/presentation/
```

Keyboard: `←` / `→` to move, `1`–`8` to jump, `#3` in the URL deep-links a slide.

---

## Slide 1 — Why this exists (25s)

> "Reviewing whether a client-led integration follows Luigi's Box conventions
> is a manual slog. Someone opens the feed, squints at a Content Update
> payload, diffs it against the docs, then reads the client's HTML looking
> for the collector script and the autocomplete call shape."

> "It's slow, inconsistent between reviewers, and easy to miss subtle things —
> wrong identity field, variants not consecutive, collector in `<body>` instead
> of `<head>`. SE Validator turns that into one command that produces a
> scored, cited, reproducible report."

Transition: "Here's the pipeline."

## Slide 2 — How it works (25s)

Walk left to right:

> "Evidence goes in — catalog feeds, analytics payloads, live service probes,
> frontend HTML. Deterministic rules check shape, identity, collector
> placement, analytics parity. The doc-aware agent then opens the local docs
> repo and cites the sections that matter. Out comes a scored report with
> P0 / P1 / P2 findings. The readiness traffic light — **READY**, **RISKY**,
> **BLOCKED** — is a deterministic function of those findings."

Transition: "Let's run it on a real catalog."

## Slide 3 — Catalog demo (50s)

Point at the **bad** column first. Highlight one P0:

> "This Content Update payload reuses a nested variant identity — the same
> `duplicate-nested-variant` string appears at two positions. The validator
> tells the client exactly which line and exactly what to fix."

Then the **good** column:

> "Same command, clean feed. 100 out of 100. No P0, no P1, no P2. Boring —
> which is exactly what a reviewer wants before signing off."

Emphasize: every finding carries a `path`, plain-language *why*, recommended
fix, and docs references — the pattern clients paste straight back into
their own review.

Transition: "Same story on the frontend side."

## Slide 4 — Frontend demo (40s)

Bad autocomplete HTML vs a clean one. Point at:

- `FRONTEND_AUTOCOMPLETE_REQUIRED_PARAM_MISSING` — the fetch sends
  `search:` instead of `q:`.
- `FRONTEND_DATALAYER_COLLECTOR_SCRIPT_MISSING` — the page calls
  `dataLayer.push` but never loads the collector.
- `FRONTEND_ANALYTICS_IDENTITY_NOT_HIT_URL` — analytics items use
  `hit.attributes.title` as `item_id`, breaking identity parity.

Call out the **capability chips** — endpoints and analytics detected in the
input. The profile states which of those are required; the review compares.

## Slide 5 — What makes it agentic (25s)

Walk through the four loop steps. Then point at the real citation card:

> "This is pulled live from the clean-run report. The validator didn't invent
> the `analytics/collector` reference — it searched the real docs repo, found
> the matching section, and recorded the excerpt. A reviewer can click
> through to `docs.luigisbox.com` or open the local `path:line`."

## Slide 6 — Profile generators (25s)

> "Sometimes the UI intent isn't obvious from the HTML alone. `yarn suggest
> search-profile` hits the live Search API with the client's tracker ID,
> discovers which hit type their indexed objects actually are, and writes a
> profile JSON. Feed that back into `review-ui` and the validator catches the
> classic `type:item` versus `type:digital-products` mismatch before a
> reviewer even opens the file."

## Slide 7 — Browser verification (20s)

> "The static finding says `FRONTEND_EXPECTED_EVENTS_API_ANALYTICS_MISSING`.
> The browser capture says `Analytics requests: 0`. Independent
> corroboration — and enough to ship a finding back to the client with
> confidence."

## Slide 8 — Status (25s)

Three columns. Don't linger.

> "Works today across catalog, analytics, services, and frontend. Known
> limits are real — regex detection is file-scoped, setter/reader confusion
> on identity fields, optional-feature noise. Next: comment-stripped regex
> scope, import-parity diffs against Search API, confidence scoring on
> heuristic-reliant findings."

End with: *"One command in. A report clients can act on, out."*
