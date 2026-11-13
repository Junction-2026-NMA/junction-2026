<img src="assets/icon.svg" width="64" height="64" alt="">

# Junction 2026 — Sisu

"Your bank knows your past. Sisu helps change your future." Sisu is a mobile-first financial coach built on S-Pankki's synthetic banking data. It uses Exa for live research, Context.dev for structured extraction, NVIDIA Nemotron for reasoning, ElevenLabs for voice and Verda for EU hosting.

**Submission: Sunday 15 Nov, 10:00 EET.**

## Shared AI context (read this first)

Everything we've decided lives in [`context/`](context/). Point your Claude, ChatGPT, Cursor or Codex session at these files so it starts with the same picture.

| File | What it is |
|---|---|
| [`context/build-plan.md`](context/build-plan.md) | **Start here.** What we are actually building before Sunday: decisions, the demo flow, who builds what, the API contract and the timeline gates. It overrides the spec where they differ. |
| [`context/architecture.md`](context/architecture.md) | Layer stack, data boundary, the Nemotron → NVIDIA → Gemini fallback order, env vars, and what already exists in this repo. |
| [`context/dataset-notes.md`](context/dataset-notes.md) | What the S-Pankki data really contains, and why the hero bill is electricity rather than telecom. |
| [`context/sponsor-credits.md`](context/sponsor-credits.md) | Which credits are claimed, on whose account, and what each sponsor needs at submission. |
| [`context/sisu-project-specification.pdf`](context/sisu-project-specification.pdf) / [`.txt`](context/sisu-project-specification.txt) | The full original spec: the long-term vision. |
| [`context/chatgpt-ideation-chat.md`](context/chatgpt-ideation-chat.md) | The ChatGPT ideation chat that produced the spec. |

AI coding agents also read [`CLAUDE.md`](CLAUDE.md) (and [`AGENTS.md`](AGENTS.md), which points to it).

## Run it

```bash
npm install
cp .env.example .env.local   # then add the API keys
npm run dev
```

Open http://localhost:3000. The reduced demo data is already in `data/`, so no dataset download is needed.

**Working now:**
- three demo customers;
- safe-to-spend with the maths shown;
- three-basket breakdown with peer comparison;
- recurring bills with confidence;
- month-by-month cash flow;
- the futures simulator with a teaching question;
- the transactions behind every figure.

## Team workflow

| Role | Branch | Owns |
|---|---|---|
| A – Product, screens, voice UI | `feature/frontend` | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/` |
| B – Finance engine, actions, teaching | `feature/financial-engine` | `lib/finance/`, `data/`, `scripts/`, `app/api/customers/`, `app/api/scenarios/`, `app/api/actions/`, `app/api/demo/` |
| C – Agent, sponsor APIs, Verda | `feature/agent-orchestration` | `lib/agent/`, `app/api/agent/`, `app/api/research/`, `app/api/voice/` |

- Work on your branch and open PRs into `main`.
- Run `npm run build` before every PR.
- Change `lib/types.ts`, `package.json` and config only on `main`, and announce it first.
- **This repo is public:** never commit API keys, `.env*` files or promo codes.

## Key links

- Challenges: https://hackjunction.app/participate/45/challenges
- S-Pankki synthetic dataset: https://github.com/hackjunction/Junction-2026-S-pankki
