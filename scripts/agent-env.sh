#!/usr/bin/env bash
# Evaluate this file before asking an agent to run SE Validator commands:
#
#   eval "$(scripts/agent-env.sh)"
#
# Optional overrides:
#
#   export SE_VALIDATOR_ROOT=/path/to/se-validator
#   export SE_VALIDATOR_DOCS_ROOT=/path/to/docs
#   eval "$("${SE_VALIDATOR_ROOT}/scripts/agent-env.sh")"

set -euo pipefail

agent_env_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
agent_env_repo_root="$(cd "$agent_env_script_dir/.." && pwd -P)"

export SE_VALIDATOR_ROOT="${SE_VALIDATOR_ROOT:-$agent_env_repo_root}"

if [[ -z "${SE_VALIDATOR_DOCS_ROOT:-}" ]]; then
  if [[ -d "$SE_VALIDATOR_ROOT/../docs/src/content/docs" ]]; then
    export SE_VALIDATOR_DOCS_ROOT="$(cd "$SE_VALIDATOR_ROOT/../docs" && pwd -P)"
  elif [[ -d "$PWD/../docs/src/content/docs" ]]; then
    export SE_VALIDATOR_DOCS_ROOT="$(cd "$PWD/../docs" && pwd -P)"
  else
    echo "SE_VALIDATOR_DOCS_ROOT is not set and ../docs/src/content/docs was not found." >&2
    echo "Set it before running this file, for example:" >&2
    echo "  export SE_VALIDATOR_DOCS_ROOT=/path/to/docs" >&2
    exit 1
  fi
fi

if [[ ! -d "$SE_VALIDATOR_ROOT" ]]; then
  echo "SE_VALIDATOR_ROOT does not exist: $SE_VALIDATOR_ROOT" >&2
  exit 1
fi

if [[ ! -d "$SE_VALIDATOR_DOCS_ROOT/src/content/docs" ]]; then
  echo "SE_VALIDATOR_DOCS_ROOT does not look like the docs repo: $SE_VALIDATOR_DOCS_ROOT" >&2
  echo "Expected: $SE_VALIDATOR_DOCS_ROOT/src/content/docs" >&2
  exit 1
fi

printf "export SE_VALIDATOR_ROOT=%q\n" "$SE_VALIDATOR_ROOT"
printf "export SE_VALIDATOR_DOCS_ROOT=%q\n" "$SE_VALIDATOR_DOCS_ROOT"
