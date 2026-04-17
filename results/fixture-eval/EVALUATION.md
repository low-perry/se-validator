# `agent review-ui` — Usefulness Evaluation

Ran the tool against 9 new frontend fixtures, 2 "good" and 7 "bad" (6 targeted + 1 sneaky hybrid). The goal: probe the deterministic rule engine, not the LLM/docs layer.

## Fixtures built

Good (clean pass expected):
- `autocomplete-datalayer-styled.html` — full DataLayer, Top Items on focus, Trending placeholder
- `autocomplete-events-api-styled.html` — full Events API, client_id + event id

Targeted bad (each isolates one failure mode):
- `autocomplete-missing-tracker.html`
- `autocomplete-wrong-click-identity.html`
- `autocomplete-no-debounce.html`
- `autocomplete-hardcoded-items.html`
- `autocomplete-no-results-untracked.html`
- `autocomplete-collector-in-body.html`

Sneaky hybrid (multiple subtle bugs):
- `autocomplete-sneaky-hybrid.html`

Reports: `results/fixture-eval/*.md`.

## Results

| Fixture | Score | P0/P1/P2 | Key finding expected | Caught? |
|---|---|---|---|---|
| datalayer-styled | 100 | 0/0/0 | clean pass | yes |
| events-api-styled (profile=full) | 100 | 0/0/0 | clean pass | yes |
| missing-tracker (after comment fix*) | 79 | 1/0/2 | `REQUIRED_PARAM_MISSING` | yes |
| wrong-click-identity | 94 | 0/0/2 | `CLICK_DOES_NOT_USE_RENDERED_IDENTITY` | **no** |
| no-debounce | 91 | 0/0/3 | `AUTOCOMPLETE_DEBOUNCE_MISSING` | yes |
| hardcoded-items | 77 | 0/2/3 | `ITEMS_NOT_FROM_HITS` + `IDENTITY_NOT_HIT_URL` | yes |
| no-results-untracked | 87 | 0/1/2 | `NO_RESULTS_NOT_TRACKED` | yes |
| collector-in-body | 72 | 1/1/2 | `NOT_IN_HEAD` + `NOT_ASYNC` | yes |
| sneaky-hybrid | 65 | 1/2/2 | `REQUIRED_PARAM_MISSING`, `IDENTITY_NOT_HIT_URL`, `TRENDING_QUERY_TITLES_NOT_MAPPED`, `TOP_ITEMS_FOCUS_LISTENER_MISSING` | yes (4/5) |

(*) initial run missed this — see finding #1 below.

## What the tool does well

1. **Fast** — each run is ~1–2 s, suitable for a pre-PR hook.
2. **Sensible severity tiering** — P0 collector-not-in-head and missing-tracker correctly block, P1 identity/analytics issues flag, P2 minor UX.
3. **Line-level evidence** — every finding in the report is paired with a `path:line` + snippet, making triage quick.
4. **Profile awareness** — `--profile ...profile-full.json` correctly turns `topItems/trendingQueries` noise off on the clean fixture.
5. **Docs routing is strong** (when pointed at the real docs repo) — the styled-datalayer report surfaces `quickstart/autocomplete/query-suggestions.md:120`, `trending-queries-datalayer.html:614`, `analytics/collector.md:344`, etc.
6. **Catches the mechanical bugs reliably**: debounce omission, no-results branch untracked, analytics items array decoupled from hits, collector script placement/async, Top Items without focus listener, Trending Queries not mapped to titles.

## What doesn't work — three real defects I hit

### 1. Raw-file regex matches HTML/JS comments (false negative on missing-tracker)

`src/frontend/parse.ts:84` is `trackerId: /\btracker_id\b/.test(raw)`. My original fixture had the word `tracker_id` in the header comment ("BAD: URLSearchParams omits tracker_id"). That alone fooled the detector into believing the parameter was present, so the P0 didn't fire.

I scrubbed the comment ("omits the mandatory tracker param") and the P0 re-appeared. A real integration is unlikely to carry that comment, but any file containing `tracker_id` in a docstring, a TODO, or a disabled code block would silently pass this check.

**Fix suggestion**: strip HTML/JS comments before running the capability regexes (or check inside URLSearchParams literally).

### 2. File-scoped capability detection misses setter-vs-reader bugs (false negative on wrong-click-identity)

`src/frontend/parse.ts:106` is `clickUsesRenderedIdentity: /dataset\.itemId.../.test(raw)`. My wrong-click-identity fixture does `button.dataset.itemId = item.url` in the renderer (setter), but the click handler reads `resultItem.textContent` (wrong identity). The regex matches `dataset.itemId` anywhere in the file, so the finding never fires — even though the click path is demonstrably broken.

**Fix suggestion**: require a *read* context (e.g., match `= *.dataset.itemId`, or `itemId: *.dataset.itemId`), or co-locate the match with a click handler scope.

### 3. Noisy P2s for "optional" features (clutters every minimal report)

With the default profile, `topItems=optional` and `trendingQueries=optional`. But `FRONTEND_TOP_ITEMS_ENDPOINT_NOT_EVIDENCED` and `FRONTEND_TRENDING_QUERIES_ENDPOINT_NOT_EVIDENCED` *still fire as P2* when those endpoints are absent. Every fixture in my matrix that doesn't use them ships with two P2 findings that are pure speculation ("if the UX uses …, provide evidence…"). This drops scores and dilutes the signal in the report.

Look at `src/frontend/rules.ts:499-520`: the rule fires unless `expectation === "disabled"`. With `optional`, severity downgrades to P2 but it still emits. For a reviewer, a P2 that reads "if you use this, provide evidence" is advice, not a finding.

**Fix suggestion**: fire `NOT_EVIDENCED` only when `expectation === "required"`. Keep the "unexpected by profile" rule for the `disabled` case.

## Secondary observations

- **Default docs path is fragile.** `src/cli/command.ts:408` resolves `../docs` from CWD; running from a worktree it fell back to `se-validator/docs` which is coverage notes, not the real docs. Either document the `SE_VALIDATOR_DOCS_ROOT` env var in `--help`, or walk up until a docs-looking repo is found.
- **Sneaky-hybrid caught 4 of 5 expected issues.** It missed only `FRONTEND_RENDERED_IDENTITY_NOT_HIT_URL` — likely the same setter-vs-reader issue as finding #2 (the check presumably inspects the presence of `dataset.itemId = item.url` but my fixture uses `item.attributes.title`, which means the regex *shouldn't* match… worth a follow-up trace).
- **The clean-pass styled fixtures produced 100/100 with zero findings.** That's a good signal that the rule engine doesn't panic on realistic polished code (CSS/ARIA/event delegation didn't create noise).

## Overall rating: **7/10**

**Great for what it is**: a fast, deterministic, first-pass linter that catches mechanical misuse of the Autocomplete + Analytics contract and cites line-level evidence. The report format is genuinely useful — I'd pipe this into PR comments.

**Where it falls short** for gating shipping code: regex detection is file-scoped, so two of the most interesting bugs (tracker_id missing in URL params, click handler using wrong identity) slip past when the file contains distractor strings. Those gaps are fixable with 10–30 lines of parser work (strip comments, scope-aware matching) and a rule-policy tweak (don't fire NOT_EVIDENCED for optional features).

With those three fixes, I'd move it to a strong 9/10.
