# sisu-demo now serves the three-tab web app; backend QA fixes are PR #17

**Summary:** https://sisu-demo.vercel.app runs `feat/web-port` d40d616 (Today, Talk, Path; Liito's six task moods); the backend fixes wait in PR #17 for Nicholas.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- Deployed d40d616 to the `sisu-demo` Vercel project (production, same settings: `/api` forwarded to sisu-api). Checked live: three tabs, Liito loads, a typed "Can I afford a €200 jacket?" went thinking → calculating → writing → idle with a correct answer, 0 console errors; the desktop QR page still shows.
- A final QA pass on the fixed build passed on mock and live: 2 spoken questions were heard, answered and spoken, and Liito went listening → calculating/searching/comparing → presenting while speaking → listening.
- Pushed `feat/web-port` and `fix/backend-qa`; PR #17 (fix/backend-qa → main) is open, not merged.

## Next / open questions
- Nicholas: review and merge PR #17, then redeploy sisu-api (the hosted backend does not have the fixes yet).
- Known small limits: a one-word answer as the very first sound after Start in a perfectly silent room can be missed; with many tasks inside one second, Liito shows only the newest two (stays ≤ 2 s behind).
