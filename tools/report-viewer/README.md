# Report Viewer

A zero-dependency static UI for inspecting `se-validator` reports in a browser.

## Usage

Open `tools/report-viewer/index.html` directly in any modern browser:

```sh
open tools/report-viewer/index.html          # macOS
xdg-open tools/report-viewer/index.html      # Linux
```

Or serve the repo root with any static server so `fetch` can resolve sample
files from `../../results/`:

```sh
npx serve .
# then visit http://localhost:3000/tools/report-viewer/
```

## Inputs

The viewer accepts three input modes:

1. **Sample buttons** - click one of the preset reports. These fetch existing
   Markdown files from `results/*.md` relative to the page. Most browsers allow
   this over `file://` for same-origin sibling files; if your browser blocks
   it, use one of the other modes.
2. **File picker** - open a local `.md`, `.markdown`, `.json`, or `.txt` file
   produced by `yarn validate ...` or `yarn agent review-*`.
3. **Paste area** - paste the raw report text (Markdown or JSON).

The CLI already supports both output formats, e.g.:

```sh
yarn agent review-catalog fixtures/catalog/... --report results/my.md
yarn agent review-catalog fixtures/catalog/... --json > results/my.json
```

## Tabs

- **Catalog Review** - high-level summary for catalog reports (title, inputs,
  detected artifacts, top findings, next actions).
- **UI Review** - high-level summary for frontend/UI reports, including
  detected capability chips (endpoints and analytics tracks).
- **Findings** - all findings grouped by severity (**P0**, **P1**, **P2**) with
  problem, recommended fix, evidence path, snippet, docs, and confidence.
- **Docs Consulted** - the doc links and excerpts the reviewer cited.
- **Structure Summary** - inferred catalog structures (format, role, record
  counts, object counts, required-field coverage, category/variant/pairing
  models, examples).
- **Raw Report** - the original Markdown or JSON text.

## Files

- `index.html` - layout, tabs, loader controls.
- `style.css` - plain CSS variables, no framework.
- `app.js` - ES module, vanilla JS. Parses Markdown reports by walking
  `## Section` / `### Finding` headings and falls back to JSON parsing when the
  input starts with `{` or `[`.

No build step. No network calls other than same-origin `fetch` of sample files.
