# sisu-demo now runs every beUI component and the new dock (bc67b74)

**Summary:** https://sisu-demo.vercel.app runs `feat/web-port` at `bc67b74`, and all 16 beUI chat components show on the live site with the hosted backend.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- Deployed `bc67b74` to the `sisu-demo` project (production) from a clean `git archive`, 15 Nov 09:01 EET. It is Ready and aliased to sisu-demo.vercel.app. The previous live build was round 1 only (`f84cd54`-level).
- Checked on the live site: the same Playwright pass as `2026-11-15-0859` (typed question, "Look into my finances", voice clip) saw all 16 components with no console errors. That includes the real Exa pages in the search rows and citations, a real switch in ToolApproval, the quiz, Copy, the timer, the orb and the dock.
- Before deploying: the live site had no v3 code and none of main's newer desktop-gate changes ("No phone at hand?"), so this deploy removed nothing that was live.
- `feat/web-port` pushed; PR #28 includes everything.

## Learned / gotchas
- `vercel link` writes a `.env.local` with the project's env into the folder it links. Delete it before `vercel deploy` from an archive folder, and never commit it.
- `main` is 11 commits ahead (PRs #23 to #26, desktop gate). They reach sisu-demo only after `main` is merged into `feat/web-port` or PR #28 is merged and `main` is deployed.
