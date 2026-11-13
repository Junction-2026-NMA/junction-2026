# API keys verified; Nemotron model gate passed early

**Summary:** Nemotron 3.5 Super VL on NVIDIA Build picked the right tool with correct arguments in 1.5 s, so the Sat 10:00 model gate passes on fallback 2. Self-hosting on Verda is now an upgrade, not a blocker.
**Author:** Nicholas (Claude Code) · **Branch:** main · **Lane:** agent

## Done
- Nicholas's local `.env.local` has Nemotron (NVIDIA Build), Exa, Context.dev and ElevenLabs keys. Each passed one real call (HTTP 200).
- `MODEL_PROVIDER=nvidia`, base URL `https://integrate.api.nvidia.com/v1`, model `nvidia/nemotron-3.5-super-vl-120b-a12b`.

## Learned / gotchas
- Nemotron used OpenAI-style `tools` with `tool_choice: auto` and returned `get_safe_to_spend {"customerId":"CUST04974"}`. Use the standard OpenAI SDK.
- Exa query "electricity contract price Helsinki" returns real Finnish comparison sites (vertaa-kilpailuttajat.fi, sopimusvahti.fi, oomi.fi). These are good Context.dev extraction targets.
- Context.dev `POST /v1/web/scrape` answers in under 1 s. Each format comes back as its own output with a `success` flag, so check it per format.
- The ElevenLabs key is restricted (text to speech, speech to text, voices read, models).

## Next / open questions
- C lane: build `lib/agent/` on the OpenAI SDK with B's tools. Self-host on Verda once the main flow works.
- Teammates: create your own keys (see `context/sponsor-credits.md`).
