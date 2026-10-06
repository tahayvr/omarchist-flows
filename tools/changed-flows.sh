#!/usr/bin/env bash
# Prints the flow files a pull request adds or changes, one per line.
# Usage: tools/changed-flows.sh <base ref>
set -euo pipefail
base="${1:?the base ref, such as origin/main}"
git diff --name-only --diff-filter=AMR "$base"...HEAD -- 'flows/*.flow.toml'
