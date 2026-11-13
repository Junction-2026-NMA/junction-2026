# Shared context log set up for all agents

**Summary:** Every agent session now reads `context/log/` at start and adds an entry before committing. See `context/log/README.md` for the template.
**Author:** Nicholas (Claude Code) · **Branch:** main · **Lane:** shared

## Done
- `context/log/` added: one file per entry, append-only, so there are no merge conflicts.
- `scripts/context-digest.sh` prints the latest entries, plus entries on teammates' pushed branches you haven't merged. Claude Code runs it automatically at session start.
- The "Shared context" protocol is now in `CLAUDE.md`. `AGENTS.md`, `GEMINI.md` and `.cursor/rules/` point to it, so Codex, Gemini CLI and Cursor follow it too.

## Decisions
- The repo moved to the `Junction-2026-NMA` GitHub organisation. It is public, and members have admin access.

## Next / open questions
- Teammates: accept the org invite, pull `main`, and add a log entry for whatever you've already done in your own AI chats.
