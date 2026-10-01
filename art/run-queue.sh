#!/bin/bash
# Runs the queued Codex image calls one at a time (art/queue/NN-label.txt, built by scripts/art/queue.mjs).
# A call is skipped when all of its output files already exist in art/raw. Stops at the first sign of a usage limit.
here="$(cd "$(dirname "$0")" && pwd)"
for q in "$here"/queue/*.txt; do
  label="$(basename "$q" .txt)"
  label="${label#*-}"
  # outputs named in the prompt: "N) file.png:"
  files=$(grep -oE '[0-9]\) [A-Za-z0-9_-]+\.png:' "$q" | sed -E 's/^[0-9]\) //; s/:$//')
  missing=0
  for f in $files; do [ -f "$here/raw/$f" ] || missing=1; done
  if [ $missing -eq 0 ]; then echo "skip $label (outputs exist)"; continue; fi
  echo "$(date +%H:%M:%S) running $label"
  bash "$here/run-codex.sh" "$label" "$(cat "$q")"
  if grep -qiE 'usage limit|rate limit|quota|try again at|upgrade to' "$here/raw/log-$label.txt"; then
    echo "$(date +%H:%M:%S) USAGE LIMIT HIT on $label - stopping"
    echo "USAGE LIMIT HIT on $label at $(date)" >> "$here/queue-status.txt"
    exit 3
  fi
  for f in $files; do [ -f "$here/raw/$f" ] || echo "WARNING: $f missing after $label"; done
  echo "$(date +%H:%M:%S) done $label" >> "$here/queue-status.txt"
done
echo "queue finished" >> "$here/queue-status.txt"
