<img src="assets/icon.svg" width="64" height="64" alt="">

# Junction 2026 — Sisu

Team repo for Junction 2026 (Espoo, 13–15 Nov). Working idea: **Sisu**, an agentic financial coach built on S-Pankki's synthetic banking data, with Exa live research, Context.dev structured extraction, NVIDIA Nemotron reasoning, ElevenLabs voice and Verda hosting.

## Shared AI context (read this first)

Everything we've worked out with AI so far lives in [`context/`](context/). Paste these into your own Claude / ChatGPT / Cursor session so it starts with the same picture.

| File | What it is |
|---|---|
| [`context/sisu-project-specification.pdf`](context/sisu-project-specification.pdf) | The full project spec: product, architecture, datasets, sponsor tracks, 3-person team split, Git workflow. **Start here.** |
| [`context/sisu-project-specification.txt`](context/sisu-project-specification.txt) | Same spec as plain text (easiest to paste into an AI chat). |
| [`context/chatgpt-ideation-chat.md`](context/chatgpt-ideation-chat.md) | The full ChatGPT ideation chat that produced the spec, including the raw challenge briefs pasted from Discord. |

## Key links

- Challenges: https://hackjunction.app/participate/45/challenges
- S-Pankki synthetic dataset: https://github.com/hackjunction/Junction-2026-S-pankki

## Team split (from the spec)

| Role | Branch |
|---|---|
| Frontend / product experience | `feature/frontend` |
| Banking data / financial engine | `feature/financial-engine` |
| Agent / AI / sponsor APIs / cloud | `feature/agent-orchestration` |

Work on your branch, open PRs into `main`. Never commit API keys or `.env` files.
