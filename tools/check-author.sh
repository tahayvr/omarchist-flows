#!/usr/bin/env bash
# A flow belongs to the person who published it: the pull request's author
# must be the flow's meta.author, for a new flow, a new version, and a
# removal alike. People listed in maintainers.txt may change any flow.
# Usage: PR_AUTHOR=<login> tools/check-author.sh <base ref>
set -euo pipefail
base="${1:?the base ref, such as origin/main}"
who="$(printf '%s' "${PR_AUTHOR:?}" | tr '[:upper:]' '[:lower:]')"

if grep -v '^#' maintainers.txt 2> /dev/null | tr '[:upper:]' '[:lower:]' | grep -qx "$who"; then
  echo "$PR_AUTHOR is a maintainer."
  exit 0
fi

author_of() {
  # Prints the lowercased meta.author of the flow file given on stdin.
  local file
  file="$(mktemp --suffix=.flow.toml)"
  cat > "$file"
  ./omarchist flow check --json "$file" | jq -r '.[0].author // ""' | tr '[:upper:]' '[:lower:]'
  rm -f "$file"
}

failed=0
while IFS=$'\t' read -r status path; do
  [ -n "$path" ] || continue
  case "$status" in
    D) owner="$(git show "$base:$path" | author_of)" ;;
    *)
      owner="$(author_of < "$path")"
      # A changed flow must also have been this person's before.
      if git cat-file -e "$base:$path" 2> /dev/null; then
        before="$(git show "$base:$path" | author_of)"
        if [ "$before" != "$who" ]; then owner="$before"; fi
      fi
      ;;
  esac
  if [ "$owner" != "$who" ]; then
    echo "::error file=$path::This flow belongs to '$owner', and the pull request is from '$PR_AUTHOR'."
    failed=1
  fi
done < <(git diff --name-status --diff-filter=AMD "$base"...HEAD -- 'flows/*.flow.toml')
exit "$failed"
