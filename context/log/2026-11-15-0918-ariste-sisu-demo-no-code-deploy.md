# sisu-demo deployed without the access code (0fb80eb)

**Summary:** https://sisu-demo.vercel.app now runs `feat/web-port` at `0fb80eb`: computers see the QR page with a "Use it on this computer" button, no 1234 code.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- Deployed `0fb80eb` to `sisu-demo` (production) from a clean `git archive`, 15 Nov ~09:17 EET. Ready and aliased to sisu-demo.vercel.app.
- Checked the live `/app` HTML with a desktop user agent: "Use it on this computer" and "No phone at hand" are there, "demo code" is not.

## Learned / gotchas
- sisu-demo has no git connection: it only changes on a CLI deploy. Pushing to `feat/web-port` alone does not update the live site.
