# Computers always start on the QR page; the app opens only from the button

**Summary:** "Use it on this computer" is no longer remembered for the tab, so a reload or a return visit on a computer shows the QR page again instead of jumping into the phone frame.
**Author:** Aristé (Claude Code) · **Branch:** fix/desktop-button-every-visit · **Lane:** frontend

## Done
- `web/gate/DesktopQr.tsx`: removed the `sisu.gate.desktopUnlocked` sessionStorage key and the effect that reopened the frame on load. The button is the only way in; "Back to the QR code" still returns.

## Decisions
- Every computer visit needs the click (asked for by Aristé). Affects: the booth flow on a laptop (a reload returns to the QR page).

## Learned / gotchas
- Vercel `sisu-demo` is not connected to GitHub: merging to `main` does not deploy. Deploy `main` by hand (CLI, or a Vercel deployment from the GitHub source).

## Next / open questions
- None.
