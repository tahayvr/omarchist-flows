#!/usr/bin/env bash
# Prints what the given flow files do, as Markdown for a reviewer: every
# step as the app shows it, what the flow needs, and what the checks
# flagged. Usage: tools/summarize.sh flows/a.flow.toml flows/b.flow.toml
set -euo pipefail
[ "$#" -gt 0 ] || { echo "No flow files changed."; exit 0; }

# The check fails on an invalid flow and still prints its report.
report="$(./omarchist flow check --catalog --json "$@" || true)"

printf '%s' "$report" | jq -r '
  .[] |
  if .ok then
    "### \(.name)\n",
    "`\(.file)` · by **\(.author)** · version \(.version) · \(.category)" +
      (if (.tags | length) > 0 then " · " + (.tags | join(", ")) else "" end),
    "",
    "> \(.description)",
    "",
    "**Steps**",
    "",
    "```",
    (.summary | join("\n")),
    "```",
    "",
    (if (.requires | length) > 0 then "**Needs:** " + (.requires | join(", ")) + "\n" else empty end),
    (if (.risks | length) > 0 then
      "**Worth knowing**\n\n" +
        (.risks | map("- " + (if .level == "danger" then ":warning: " else "" end) +
          "Step \(.step): \(.what)") | join("\n")) + "\n"
     else "No step was flagged.\n" end)
  else
    "### :x: `\(.file)`\n",
    (.errors | map("- " + .) | join("\n")),
    ""
  end
'
