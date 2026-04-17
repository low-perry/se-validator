#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: scripts/docs-context.sh <docs-file-path> <line> [radius]" >&2
  echo "Example: scripts/docs-context.sh \"\$SE_VALIDATOR_DOCS_ROOT/src/content/docs/indexing/feeds.md\" 338 8" >&2
  exit 2
fi

eval "$("$repo_root/scripts/agent-env.sh")"

file="$1"
line="$2"
radius="${3:-8}"

case "$line" in
  ''|*[!0-9]*)
    echo "Line must be a positive integer: $line" >&2
    exit 2
    ;;
esac

if [[ "$line" -eq 0 ]]; then
  echo "Line must be a positive integer: $line" >&2
  exit 2
fi

case "$radius" in
  ''|*[!0-9]*)
    echo "Radius must be a non-negative integer: $radius" >&2
    exit 2
    ;;
esac

if [[ ! -f "$file" ]]; then
  echo "Docs file not found: $file" >&2
  exit 1
fi

docs_root_real="$(cd "$SE_VALIDATOR_DOCS_ROOT" && pwd -P)"
file_dir="$(cd "$(dirname "$file")" && pwd -P)"
file_real="$file_dir/$(basename "$file")"

case "$file_real" in
  "$docs_root_real"/*) ;;
  *)
    echo "Refusing to open a file outside SE_VALIDATOR_DOCS_ROOT." >&2
    echo "Docs root: $docs_root_real" >&2
    echo "File: $file_real" >&2
    exit 1
    ;;
esac

start=$(( line > radius ? line - radius : 1 ))
end=$(( line + radius ))

echo "Docs root: $SE_VALIDATOR_DOCS_ROOT"
echo "File: $file_real"
echo "Lines: $start-$end"
echo

nl -ba "$file_real" | sed -n "${start},${end}p"
