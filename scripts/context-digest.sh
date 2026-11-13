#!/bin/sh
# Prints what the team (and their AI agents) have logged in context/log/.
# Run at the start of every agent session. Read-only: fetches, never pulls or merges.
# Claude Code runs it automatically (SessionStart hook in .claude/settings.json).

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0
LOG_DIR="context/log"
MAX_ENTRIES=15

# Best-effort fetch so we can see teammates' unmerged work. Never blocks the session for long.
( git fetch --quiet origin 2>/dev/null & pid=$!; sleep 8; kill "$pid" 2>/dev/null ) >/dev/null 2>&1

echo "=== Sisu shared team context ==="
echo "Protocol: see 'Shared context' in CLAUDE.md. Read the entries below before starting."

behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
if [ "$behind" -gt 0 ]; then
  echo "WARNING: origin/main has $behind commit(s) you do not have. Run: git pull --rebase origin main"
fi

# Entries on any remote branch (teammates' work in progress) that are not in this checkout.
remote_only=$(for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin 2>/dev/null); do
  git ls-tree --name-only "$ref" "$LOG_DIR/" 2>/dev/null | sed "s|^|$ref |"
done | while read -r ref path; do
  [ -f "$path" ] || echo "$ref:$path"
done | sort -u -t: -k2,2)

if [ -n "$remote_only" ]; then
  echo
  echo "--- Entries on teammates' branches, not in your checkout (read with: git show <ref:path>) ---"
  echo "$remote_only" | tail -n "$MAX_ENTRIES"
fi

echo
echo "--- Latest $MAX_ENTRIES entries in $LOG_DIR/ (newest last) ---"
ls "$LOG_DIR"/*.md 2>/dev/null | grep -v '/README.md$' | sort | tail -n "$MAX_ENTRIES" | while read -r f; do
  title=$(grep -m1 '^# ' "$f" | sed 's/^# //')
  summary=$(grep -m1 -i '^\*\*summary' "$f" | sed 's/^\*\*[Ss]ummary:\*\* *//')
  echo "* $f — $title"
  [ -n "$summary" ] && echo "    $summary"
done
exit 0
