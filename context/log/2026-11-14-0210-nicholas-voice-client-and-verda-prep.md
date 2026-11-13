# Browser voice client, live test page and Verda hosting files

**Summary:** You can now talk to Sisu in a browser at `/dev/agent`. The frontend adds it with one hook, `useSisu`; see `context/frontend-integration.md`.
**Author:** Nicholas (Claude Code) · **Branch:** backend (merged to main) · **Lane:** agent

## Done
- `lib/agent/client.ts`: event stream reader, push-to-talk recorder, in-order speech player, warm-up and prefetch helpers.
- `lib/agent/useSisu.ts`: one React hook for typing, talking, streamed answers, spoken replies and interruption.
- `app/dev/agent/`: a test bench showing every step and its timing. Checked in a browser with the real services (typed questions and spoken replies).
- `deploy/verda/`: a vLLM start script for Nemotron 3.5 Super VL and the hosting steps.

## Decisions
- Frontend (lane A) uses the hook and does not edit `lib/agent/`. Missing fields: ask Nicholas.
- Verda plan: 1x H200 on demand for the model (about $6.64 an hour, roughly 30 hours on our credit), plus a small CPU instance for the app.

## Learned / gotchas
- The microphone works only on `localhost` or HTTPS, so phone testing needs a deployed URL.
- A cold offer search took 3.8 to 6.1 s for the first page across runs. Prefetch when the user confirms a bill.
- With a cold search the answer uses whichever page arrives first, so the "best" offer can differ from a prefetched run that read all three pages.

## Next / open questions
- Not yet tested with a real microphone by a person. Nicholas to try `/dev/agent`.
- Verda files are prepared but not run; starting the GPU spends credits.
- Still missing: backup model for stalls, and the approve-an-action step.
