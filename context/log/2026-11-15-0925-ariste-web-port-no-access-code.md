# feat/web-port: no more access code on computers

**Summary:** `feat/web-port` (what sisu-demo runs) still asked computers for the 1234 demo code; it now has main's gate: a "Use it on this computer" button under the QR code, shown on every visit.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- Copied `web/gate/DesktopQr.tsx`, `DesktopPhone.tsx` and `gate.css` from `main` (commits cce8a61 and 483a9d6). `feat/web-port` had never touched these files, so nothing of its own was lost.
- `npm run build` passes.

## Next
- sisu-demo keeps showing the code until this commit is deployed.
