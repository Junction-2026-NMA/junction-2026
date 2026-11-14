# Web port of the iOS app at /app, with a desktop QR page and an add-to-home-screen gate

**Summary:** A phone opening `/app` now gets the iOS app (same screens, flow and `sisu_ui.riv`) in the browser; a computer gets only a QR code; it is live at https://sisu-demo.vercel.app.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/`: TypeScript port of `ios/SisuCore` (`web/core`, same file and type names), the Rive layer on `@rive-app/react-canvas` 4.37.1 with data binding (`web/rive`), theme and shared UI with the glass tab bar (`web/theme`, `web/shared`), app model, coach store and voice (`web/app`, `web/voice`), every screen (`web/features`). Conventions in `web/README.md`.
- `/app` (`app/app/`): computer = "Scan this QR code with your phone to use the demo." + QR; phone in a browser tab = add-to-home-screen steps (iOS Share sheet, Android install prompt) and a small "Continue in the browser"; launched from the home screen = the app. Test overrides: `?device=phone|desktop`, `?standalone=1`. Manifest `public/app.webmanifest`, icons `public/app-icons/`. `/app/lab` shows every Rive artboard.
- Visitor sessions (contract section 16): every request sends `X-Sisu-Session` and keeps the id the server hands out (`web/core/VisitorSession.ts`), on top of the cookie.
- Checked locally (`next start`, `SISU_STORE=file SISU_SESSIONS=visitor`, mock model): typecheck, eslint, `npm run build`, both core check scripts; two headless phone visitors with real taps: A approves, B unchanged; B approves; A "Start the demo over" clears only A.

## Decisions
- No change to `app/page.tsx`, `lib/`, `components/` or the API. Affects: nobody.
- Hosted on Vercel at Wiktor's request (14 Nov, 20:23): project `sisu-demo` in Aristé's personal Vercel team, deployed from a clean `git archive` of this branch, no Git link. `SISU_API_ORIGIN=https://sisu-api.vercel.app` forwards every `/api` call to Nicholas's hosted backend (per-visitor state, his keys), and `SISU_HOME=/app` sends the root there (`next.config.ts`; both unset changes nothing). `sisu-api` itself was not touched. Affects: Nicholas (his backend now also serves the phone demo).
- Checked on the live site (18:24 UTC): `/api/health` mock false, Exa/Context.dev/ElevenLabs on, Supabase per-visitor; `/api/health/ready` ready, voice ready; the two-visitor test with real taps passed there too.

## Learned / gotchas
- After a tap the browser sends compatibility mouse events to whatever is under the finger by then; a card that moved could press Decline right after Approve. `web/rive/RiveCanvas.tsx` cancels `touchend` on every Rive canvas; `ActionCard` takes one decision at a time.
- The Ask screen keeps following the bottom while an investigation still streams, so buttons move for a few seconds after they appear.

## Next / open questions
- Not tried on a real phone yet: home-screen launch, microphone, keyboard, press-and-hold voice.
- Compare against the iOS screenshots (`sh ios/scripts/screenshots.sh`) and fix differences (charts are SVG approximations of Swift Charts).
