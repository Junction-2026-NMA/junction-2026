# Newest ElevenLabs voice, streamed playback, warm offers and a primed model

**Summary:** Sisu now speaks with `eleven_v4_turbo`, starts playing audio as it arrives, keeps electricity offers warm and primes the model per customer. Voice credit is the new risk: about 100 spoken answers are left on the free plan.
**Author:** Nicholas (Claude Code) · **Branch:** backend (pushed to main) · **Lane:** agent

## Done
- `lib/agent/speech.ts`, `client.ts`: raw-sample (PCM) streaming, sentence continuity through `previous_text`, a model and voice picker on `/dev/agent`, `GET /api/voice/tts` lists voices.
- `lib/agent/research/index.ts`: results under 10 minutes old are used as is; up to an hour old they are served at once while a fresh copy loads. The warm-up starts electricity research for the demo cities.
- `lib/agent/warm.ts`: primes each demo customer's prompt on the model, so the first question does not pay about 2 s of prompt reading.
- `deploy/verda/dev-with-tunnel.sh`: runs the app with a tunnel to Verda that reconnects by itself.

## Decisions
- Research now waits for every page before answering (limit 8.5 s). Answering from the first page gave unstable "best offer" results, once even "none are cheaper".
- If a question is clearly about a better deal and the model replies without searching, the orchestrator makes it call `search_offers`.
- Stall limit raised from 2 s to 3 s, so an uncached prompt does not trip the backup.

## Learned / gotchas
- A tunnel started from a one-off command dies with that command. Use `dev-with-tunnel.sh`.
- The microphone is blocked inside the Claude desktop app's built-in browser. Test voice input in Chrome or Safari.
- Measured first audio: v4 turbo 0.26–0.43 s, v3 conversational 0.29 s, v4 1.1 s, v3 0.66 s, turbo v2.5 0.27 s. `previous_text` is rejected by `eleven_v3_conversational`.

## Next / open questions
- Voice credit: apply the MLH Creator code before demo day, or voice will run out.
- Host the app itself on the Verda instance for HTTPS (phones) and the full "data stays in the EU" claim.
