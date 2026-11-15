# Computers open the app with one button, no demo code

**Summary:** The desktop QR page no longer asks for the 1234 demo code: a "Use it on this computer" button under the QR code opens the app in the iPhone-sized frame.
**Author:** Aristé (Claude Code) · **Branch:** feat/desktop-open-button · **Lane:** frontend

## Done
- `web/gate/DesktopQr.tsx`: removed the code form, `DEMO_CODE` and its error state; added the button (`data-testid="desktop.open"`) under "No phone at hand?". The choice is still kept for the tab in sessionStorage, and "Back to the QR code" in `DesktopPhone.tsx` still clears it.
- `web/gate/gate.css`: the `.sisu-gate-code*` styles are replaced by `.sisu-gate-open*`.

## Decisions
- No code on a computer (it was a demo convenience, not security, and it slowed visitors at the booth). Affects: anyone whose script or test used `desktop.code`; there were none in the repo.

## Learned / gotchas
- `npm run build` and the 474 unit tests pass. `tsc` reports only the generated `.next/types/validator.ts` route-type errors, which are not from this change.

## Next / open questions
- Not checked in a browser yet.
