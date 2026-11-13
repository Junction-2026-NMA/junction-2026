# Sponsor credits claimed, app and build context merged into main

**Summary:** Verda (€200), Context.dev (51k), Exa and Codex credits are live and NVIDIA Build is signed in. Next blocker: API keys in `.env.local`, then the Nemotron tool-call gate.
**Author:** Nicholas (Claude Code) · **Branch:** main · **Lane:** shared

## Done
- Merged the working Sisu app into `main`: X-ray, baskets, bills, futures simulator, evidence sheet (`app/`, `components/`, `lib/finance/`, `data/`).
- Added `context/build-plan.md`, `architecture.md`, `dataset-notes.md` and `sponsor-credits.md`.
- Credits: Verda €200 is in the "Cloud Project" project, Context.dev has 51,000 credits (team code used), Exa has a $120 balance, and the NVIDIA Build account is signed in. Status is in `context/sponsor-credits.md`.

## Decisions
- Voice through ElevenLabs is required.
- Model order: Nemotron 3.5 Super VL self-hosted on Verda, then NVIDIA Build hosted, then Gemini (voice path only).

## Learned / gotchas
- Verda refuses the coupon until a payment method is on the account. Each teammate can claim their own €200 into the shared project.
- Verda's hosted inference list does not include Nemotron, so we must self-host it on a Verda GPU.
- The NVIDIA Build model page lists function calling and structured output as supported, with a 262K context.
- The ElevenLabs MLH code gives 1 free month of Creator (not 3) and needs a card; the free plan already includes the API.

## Next / open questions
- Generate the NVIDIA API key into `.env.local`, then test one real Nemotron tool call (the Sat 10:00 gate).
- A teammate aged 18 or over submits the Gemini form.
- Invite teammates to the Verda project.
