# iOS app: Ask screen, voice, teaching path, and the 2D Rive animation pass

**Summary:** The native app now runs the whole demo flow against the backend of PR #2 (mock mode tested): X-ray, ask or investigate, live-offer table, quiz, approval, impact. Voice works end to end with a test clip; a real microphone is not verified yet.
**Author:** Ariste (Claude Code) · **Branch:** feature/frontend · **Lane:** frontend

## Done
- Ask (`ios/Sisu/Features/Ask`, `ios/Sisu/Coach`): streamed answers, one card per stage, the offer table with the server's own savings, the quiz, the approval card labelled "Simulated, no real switch", the celebration, the grounding line and the tool trace. Approving feeds `approvedMonthlySaving` into the Jars tab.
- Voice (`ios/Sisu/Voice`): hold to talk records AAC, posts it to `/api/voice/turn`, and plays the `filler` and `sentence` clips from `/api/voice/tts` strictly in order. Typed questions stay silent, so they spend no speech credit.
- Path (`ios/Sisu/Features/Path`): the seven teaching cards from `/api/coach/teaching` as a learning path with predict-then-reveal.
- Rive (`rive/sisu-ui`): the mascot has ten animated moods; value changes ease; new 2D `Baskets` and `Berries` illustrations. 3D is removed everywhere.
- Checks: 155 logic tests, 20 hosted tests (Rive contract 129 of 129), UI tests with screenshots for every screen.

## Decisions
- The app calls `POST /api/research` with `wait: false` when the user confirms a bill name, `GET /api/agent/warm` on open, and shows "Mock data" when the server says `mock: true`. Affects: nobody; it follows `context/frontend-integration.md`.

## Learned / gotchas (for the backend)
- The "Recurring bills" evidence stage sends a filter with dates only and no basket, so "Show transactions" lists every payment of the year, salary included.
- The typed electricity answer carries no teaching card; the quiz only arrives in the investigation.
- The speech endpoint returns raw PCM when no format is asked for; the app wraps it in a WAV header.

## Next / open questions
- Verify a real microphone, real ElevenLabs audio and a real phone. The app needs the backend's address at the booth (settings sheet).
- Remaining Rive work: icon button, lesson node, typing dots.
