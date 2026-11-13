#!/bin/sh
# Turn on Entire session capture for Claude Code + Codex in this repo, privately:
# no checkpoint uploads on git push, no telemetry. Safe to re-run.
# After it finishes, commit: .claude/settings.json .codex/hooks.json .entire/.gitignore .entire/settings.json
set -eu

if ! command -v entire >/dev/null 2>&1; then
  echo "entire-enable: Entire CLI not installed (brew install --cask entireio/tap/entire); skipping."
  exit 0
fi
if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "entire-enable: not inside a git repository." >&2
  exit 1
fi
cd "$(git rev-parse --show-toplevel)"

PRIVATE="--skip-push-sessions --telemetry=false"

# Local settings + git hooks + Claude Code hooks (non-interactive because --agent is given).
entire enable --agent claude-code $PRIVATE --absolute-git-hook-path --local </dev/null
entire agent add codex </dev/null
# Uploads only ever happen via an explicit `entire checkpoint push`.
entire configure --checkpoint-push-policy manual </dev/null
# Committed copy so T3 worktrees and fresh clones get the same private settings.
entire configure --project $PRIVATE </dev/null

echo
echo "entire-enable: done. Commit these files:"
echo "  .claude/settings.json .codex/hooks.json .entire/.gitignore .entire/settings.json"
echo "Codex only runs the hooks after you approve them once: run 'codex' here and type /hooks."
