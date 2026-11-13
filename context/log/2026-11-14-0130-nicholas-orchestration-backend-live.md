# Orchestration backend is live: agent, research, voice and mock mode

**Summary:** `POST /api/agent/query` and `/api/voice/turn` stream real answers from Nemotron with tools, live Exa and Context.dev research and ElevenLabs speech. Run with `MODEL_PROVIDER=mock` to use every endpoint with no keys.
**Author:** Nicholas (Claude Code) · **Branch:** backend (merged to main) · **Lane:** agent

## Done
- `lib/agent/`: streamed orchestrator, model client, tools, research with a shared in-flight cache, speech, mock mode.
- Routes: `/api/agent/query`, `/api/agent/warm`, `/api/research`, `/api/voice/turn`, `/api/voice/stt`, `/api/voice/tts`.
- Contract types added to `lib/types.ts`: `AgentEvent`, `AgentRequest`, `ResearchResult`, `Offer`, `ToolTrace`, `Citation`.
- Design and measured numbers: `context/orchestration.md`. Test: `node tests/agent-latency.mjs http://localhost:3000`.

## Decisions
- Branch for lane C is `backend`, not `feature/agent-orchestration`. Affects: README, build plan.
- Offer savings are computed in `lib/agent/research/compare.ts` for now. Lane B may move it into `lib/finance/`.
- Spot-price electricity contracts are listed but never ranked; their listed price is only a margin.

## For the frontend lane (A)
- Call `GET /api/agent/warm` when the app opens. If it says `mock: true`, show a "mock data" label.
- Call `POST /api/research` with `{ customerId, billType, wait: false }` when the user confirms a bill name.
- Read the event stream; speak each `filler` and `sentence` event through `POST /api/voice/tts`, in order. Show `tool_end` traces and `research` results.
- Send `focusBill` when a bill card is open, and abort the request if the user starts talking again.

## Learned / gotchas
- Exa `lite` is the current name; `fast` and `instant` are legacy. Context.dev JSON needs `formats.json: true` plus `jsonParams.schema`.
- Nemotron sometimes says "I can run that" without calling the tool. The orchestrator now makes it follow through once.
- The first call to each service is slow, so `/api/agent/warm` pre-opens connections and pre-generates the filler audio.

## Next / open questions
- Hedged requests for NVIDIA tail latency (one 7 s stall in 16 runs). Browser mic client and an action/approval tool. Self-hosting on Verda.
