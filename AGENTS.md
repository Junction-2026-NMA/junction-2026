<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# Agent instructions

This repo's instructions live in `CLAUDE.md` (stack, commands, priorities, lane ownership, done criteria).
Read it before starting and follow it exactly; it applies to Codex and every other agent too.

**Shared team context is mandatory:** at session start run `sh scripts/context-digest.sh` and read the newest entries in `context/log/`. Before committing a working chunk and at session end, add your own entry (template: `context/log/README.md`). Full protocol: "Shared context" in `CLAUDE.md`.
