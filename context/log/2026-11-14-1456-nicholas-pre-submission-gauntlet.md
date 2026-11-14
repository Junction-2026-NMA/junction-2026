# Pre-submission backend gauntlet: no double-counted savings, a readiness check, and what the frontend should call

**Summary:** Call `POST /api/demo/reset` when a new visitor starts, and read the freed amount from `approvedMonthlySavingEur` on `GET /api/actions`; a new `GET /api/health/ready` says whether every sponsor service really answers.
**Author:** Nicholas (Claude Code) · **Branch:** gauntlet/pre-submission · **Lane:** agent

## Done
- A bill is switched once. Running the money plan twice and approving twice used to set up and count the same switches again. Now the approved action is handed back (`lib/actions/index.ts`, `lib/agent/plan.ts`, `lib/agent/tools/act.ts`).
- `GET /api/actions` gained `approvedMonthlySavingEur` (one switch per bill, `lib/actions/freed.ts`). `useSisu().approvedMonthlySaving` uses the same sum.
- The plan no longer counts every purchase under €10 as money found (Sanna: €590 a year became €445). It is a notice now.
- `GET /api/health/ready` (`lib/agent/readiness.ts`, type `ReadinessReport`): one real call each to the model on our GPU, its backup, Exa, Context.dev and ElevenLabs. Page: `/dev/ready`.
- `deploy/verda/keep-tunnel.sh` reopens the tunnel to the GPU after a network drop. A closed tab mid-answer is no longer logged as a failure (`lib/agent/http.ts`).
- New live scripts: `tests/gauntlet/journey.mjs` (the whole judged journey, three customers) and `tests/gauntlet/reliability.mjs` (two taps at once, approval race, closed tab, reset mid-plan).
- Measured: 264 unit tests pass; live evaluation 54 of 54 with 0 of 170 numbers unsourced; journey and reliability scripts clean against Nemotron on Verda.

## Decisions
- No existing type or event changed shape; `ActionList` and `lib/types.ts` only gained fields. Affects: nobody has to change code to keep working.
- A second plan can now return already-approved actions in `plan.actions`. Web `/plan` and iOS `PlanSession.waitingActions` already filter on `awaiting_approval`, so both keep working. Affects: frontend, iOS.

## Learned / gotchas
- The venue network dropped for a few minutes during the run. The SSH tunnel to Verda died and stayed down; the NVIDIA backup answered. Start the demo server with `deploy/verda/dev-with-tunnel.sh`, or run `keep-tunnel.sh` beside it.
- iOS `CoachSession.approvedMonthlySaving` adds every approved switch on the client. It agrees with the server now; prefer the server field.
- This branch merges cleanly with PR #4 (`qa/independent-judge-audit`); 270 tests pass with both.

## Next / open questions
- Frontend and iOS: wire the reset on "new visitor", and optionally a status light from `/api/health/ready` (`ready`, `voiceReady`, `headline`). Details: section 15 of `docs/FRONTEND_INTEGRATION_CONTRACT.md`.
- PR #4 is still open and worth merging: setup fees in offer ranking, one upstream call for many page readers, cancelled plans.
