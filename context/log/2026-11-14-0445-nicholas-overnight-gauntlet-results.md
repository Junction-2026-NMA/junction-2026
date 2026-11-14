# Overnight backend gauntlet finished: 12 tools, receipts, actions, memory, vision, 179 tests

**Summary:** Branch `overnight/fable-lead` (local, not pushed) holds a backend that can carry the whole Sisu flow, with no UI file changed and no existing type changed. Frontend: read `docs/FRONTEND_INTEGRATION_CONTRACT.md`. Everyone: read `docs/SISU_MORNING_HANDOFF.md`.
**Author:** Nicholas (Claude Code, unattended overnight run) · **Branch:** `overnight/fable-lead` · **Lane:** agent, plus the unowned finance and actions lane

## Done
- 12 tools the model chooses from (`lib/agent/tools/`), an autonomous investigation (`POST /api/agent/investigate`) that streams seven typed stages, and a bill-photo reader using Nemotron's vision (`POST /api/agent/bill-photo`).
- Every number is checked against receipts before it is shown or spoken (`lib/agent/grounding.ts`). Closing live run: 0 of 142 numbers without a source.
- Approval-gated simulated actions with a hash-chained audit log (`lib/actions/`, `lib/store/`), and consent-based memory (`lib/memory/`).
- Circuit breaker for model failover, a two-at-a-time queue for speech, research kept across restarts.
- `useSisu` gained `investigate`, `approve`, `decline`, `confirmBill`, `actions`, `memory`; each message carries `stages`, `action`, `teaching`, `grounding`, `facts`. Mock mode covers all of it.
- 179 deterministic tests (`npm test`), a 54-check live evaluation and latency, failover, vision, voice and soak scripts (`tests/gauntlet/`, `npm run gauntlet`).
- Five documents in `docs/`: architecture, frontend contract, gauntlet results, sponsor evidence, morning handoff.

## Decisions
- Approval is outside the model: only `POST /api/actions/:id/approve` with `confirm: true` carries an action out, and it is a simulation. Affects: frontend (the Approve button calls `sisu.approve`).
- State is one JSON file (`.sisu/state.json`) behind `lib/store/state.ts`, not Postgres. Affects: any deployment with more than one server.
- `POST /api/demo/reset` needs `SISU_RESET_TOKEN` when deployed; open in development.
- Bill photos go only to our own GPU, never to the hosted backup.
- `lib/types.ts`, `package.json` and `context/build-plan.md` were changed on this branch (additively). They are shared files, so merge through a pull request.

## Learned / gotchas
- First-token time grows about 10 ms per 1,000 prompt characters on our GPU, and the server's prompt cache does not help (257 ms repeated, 282 ms with the cache defeated). Priming per customer makes no measurable difference. Prompt length is the speed lever.
- ElevenLabs allows only two requests at once on this plan. A long spoken answer used to be rejected and go silent; requests now queue.
- Nemotron sometimes copies a figure with a slipped digit (1,059.49 for 1,059.47), misspells a provider it just read, or does small sums itself. The verifier corrects the first two and flags the third; the fix for the third is always to provide the figure in code.
- A pasted fake tool result was believed until user text dressed up that way was labelled as untrusted.
- Live offers change between cold searches because Exa returns different pages: Aino's best electricity saving was €67 a year in one search and €48 in another.
- The synthetic data has no real subscriptions, so none are claimed.
- Each server start speaks three filler lines (about 135 characters of ElevenLabs credit).

## Next / open questions
- Nicholas: push the branch and open a pull request? Stop the Verda GPU when idle (€2.58 an hour)? More ElevenLabs credit?
- Untested tonight: a real microphone in a browser, a real paper bill under a phone camera, Finnish speech.
- Lane B still has no named owner; this branch built its endpoints.
