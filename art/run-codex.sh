#!/bin/bash
# usage: art/run-codex.sh <label> "<full prompt>"
# Runs ONE Codex image-generation call inside art/raw, logs to art/raw/log-<label>.txt
# and appends the prompt to art/prompts.md. Never run two of these in parallel.
here="$(cd "$(dirname "$0")" && pwd)"
{ echo; echo "## $1"; echo; echo "$2" | sed 's/^/> /'; } >> "$here/prompts.md"
cd "$here/raw" && codex exec --skip-git-repo-check -s workspace-write "$2" > "log-$1.txt" 2>&1
