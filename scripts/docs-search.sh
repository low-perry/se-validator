#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"

if [[ $# -eq 0 ]]; then
  echo "Usage: scripts/docs-search.sh <rg-pattern>" >&2
  echo "Example: scripts/docs-search.sh 'item_group_id|consecutive'" >&2
  exit 2
fi

eval "$("$repo_root/scripts/agent-env.sh")"

search_roots=()
for candidate in \
  "$SE_VALIDATOR_DOCS_ROOT/src/content/docs" \
  "$SE_VALIDATOR_DOCS_ROOT/public/examples" \
  "$SE_VALIDATOR_DOCS_ROOT/public/assets/openapi"; do
  if [[ -d "$candidate" ]]; then
    search_roots+=("$candidate")
  fi
done

if [[ ${#search_roots[@]} -eq 0 ]]; then
  echo "No searchable docs directories found under: $SE_VALIDATOR_DOCS_ROOT" >&2
  exit 1
fi

pattern="$*"

echo "Docs root: $SE_VALIDATOR_DOCS_ROOT"
echo "Search pattern: $pattern"
echo

if ! rg \
  --line-number \
  --ignore-case \
  --glob '*.md' \
  --glob '*.mdx' \
  --glob '*.html' \
  --glob '*.js' \
  --glob '*.ts' \
  --glob '*.json' \
  -- "$pattern" "${search_roots[@]}"; then
  echo "No local docs or examples matched the search pattern." >&2
  exit 1
fi
