#!/bin/sh
# T3 Code runs this after creating a worktree for a new thread (see t3.json).
# Copies the gitignored files listed in .worktreeinclude from the main checkout,
# then installs dependencies so the agent can run/build straight away.
set -eu

SRC="${T3CODE_PROJECT_ROOT:-}"
DST="${T3CODE_WORKTREE_PATH:-$(pwd)}"

if [ -z "$SRC" ] || [ "$SRC" = "$DST" ]; then
  echo "t3-setup-worktree: not a new worktree (or T3CODE_PROJECT_ROOT unset); nothing to copy."
else
  if [ -f "$DST/.worktreeinclude" ]; then
    grep -vE '^[[:space:]]*(#|$)' "$DST/.worktreeinclude" | while IFS= read -r rel; do
      if [ -f "$SRC/$rel" ] && [ ! -e "$DST/$rel" ]; then
        mkdir -p "$(dirname "$DST/$rel")"
        cp -p "$SRC/$rel" "$DST/$rel"
        echo "t3-setup-worktree: copied $rel"
      fi
    done
  fi
fi

cd "$DST"
if [ -f package.json ] && [ ! -d node_modules ]; then
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
fi
echo "t3-setup-worktree: done"
