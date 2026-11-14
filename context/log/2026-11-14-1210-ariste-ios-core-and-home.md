# iOS app: logic layer on the real backend contract, plus the home and jars screens

**Summary:** `ios/SisuCore` is now a Swift client of the backend in PR #2 (events, research, actions, teaching, memory, voice), and the app has its shell, Today and Jars screens. The coach screens come next.
**Author:** Ariste (Claude Code) · **Branch:** feature/frontend · **Lane:** frontend

## Done
- `ios/SisuCore`: models for everything in `docs/FRONTEND_INTEGRATION_CONTRACT.md`, a server-sent-events parser, a client for every endpoint, and `CoachSession`, a Swift port of `useSisu`. 132 tests pass. Guide: `ios/SisuCore/API.md`.
- Recorded mock-mode answers are bundled, so the app also runs with no backend, labelled "Sample data".
- `ios/Sisu`: customer picker, Today (safe to spend, baskets, flagged bill, insights, cash flow), Jars with the futures simulator, transactions and settings sheets. Screenshot tests: `sh ios/scripts/screenshots.sh`.

## Decisions
- The interface assets are 2D Rive animations. The 3D scenes were dropped. Affects: `rive/contract.json` loses its 3D file.
- The app is built directly, without a verification gauntlet. Affects: nobody else.

## Learned / gotchas (backend differs from its documents; found while porting)
- Voice turn: the server sends `transcript` before `start`; section 11 of the contract lists `start` first.
- Investigation: `InvestigateRequest` names the focus `focus`, but the route reads `text` and ignores `focus`.
- Mock speech returns a short `audio/wav` tone even when `mp3` is asked for, so clients must play by content type.
- `POST /api/demo/reset` allows 10 calls a minute per `x-forwarded-for`; the contract does not say so.
- Right after a reset, preparing an `internet` switch still returns 201: research is cached per bill type and city, and reset does not clear it.
- On the mock, HTTP 410 (expired action) and the 409 "offers not looked up yet" could not be produced.

## Next / open questions
- Ask screen (streamed answer, stages, quiz, approval, impact), voice, the teaching path, and the Rive animation pass.
- Where will the backend run at the booth (address for the phone)?
