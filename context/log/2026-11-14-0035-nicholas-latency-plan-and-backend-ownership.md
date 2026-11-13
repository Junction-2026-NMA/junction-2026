# Nicholas owns the orchestration backend; latency measured and planned

**Summary:** Nicholas builds all of lane C (inference to speech) and holds the sponsor keys. A and B build against `MODEL_PROVIDER=mock`. With Nemotron's thinking off, a voice answer can start in about 2 s.
**Author:** Nicholas (Claude Code) · **Branch:** main · **Lane:** agent

## Decisions
- Keys stay off GitHub. The repo is public and scanned by bots, so the keys would be stolen within minutes. Teammates use mock mode; ask Nicholas for real keys in person if ever needed. Affects: A, B.
- Conversation turns call Nemotron with `chat_template_kwargs: {"enable_thinking": false}`.
- Text to speech uses `eleven_turbo_v2_5`. Exa uses `type: "fast"`. Context.dev reads pages in parallel with a 2.5 s budget, prefetched when the user confirms the bill.
- Voice is push to talk, because automatic voice detection fails in a noisy booth.

## Learned / gotchas (measured, single runs)
- Nemotron: 0.54 s to first token with thinking off, 3.10 s with it on. Tool choice took 0.88 s with thinking off, same answer as with it on.
- `/no_think` in the system prompt does not turn thinking off; only `chat_template_kwargs` does.
- Context.dev: `maxAgeMs` goes at the **top level** of the body, not inside `sharedParams` (that returns HTTP 400). Fresh reads took 1–4.3 s; cached reads about 0.4 s.
- ElevenLabs first audio: turbo_v2_5 0.24 s, v4_turbo 0.34 s, flash_v2_5 0.46 s, v4 0.76 s. `optimize_streaming_latency` is rejected for v4 models.

## Next
- Build mock mode first so A and B are unblocked. Then the streamed orchestrator, research with prefetch, and the voice loop. Full plan: `context/architecture.md` (latency section) and `context/build-plan.md` (role C).
