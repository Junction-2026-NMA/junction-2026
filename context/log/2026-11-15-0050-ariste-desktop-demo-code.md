# A computer can now use the demo: code under the QR, app in an iPhone-sized frame

**Summary:** On https://sisu-demo.vercel.app/app a computer still sees the QR code, and under it a demo-code field; the code 1234 opens the app in an iPhone frame (402 x 874 viewport).
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/gate/DesktopQr.tsx` (the code form), `web/gate/DesktopPhone.tsx` (the app in an iframe of exactly 402 x 874, scaled down to fit, never up), styles in `web/gate/gate.css`. The unlock lasts for the tab (sessionStorage).
- Deployed 3bd2a12; checked live: wrong code refused, 1234 opens the app, inner viewport 402 x 874.

## Learned / gotchas
- The code is checked in the browser: a demo convenience, not security.
