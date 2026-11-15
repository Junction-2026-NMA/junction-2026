<img src="assets/icon.svg" width="64" height="64" alt="">

# Sisu — a money coach that talks, explains and acts

> "Your bank knows your past. Sisu helps change your future."

Sisu is a mobile-first financial coach for S-Pankki customers. You talk to Liito, a flying squirrel, by voice or text. Sisu reads your transactions, explains where the money went with the maths shown, tests what-ifs, and then **does the work**: it researches cheaper deals on the live web, prepares the switch or the standing order, and waits for one "Approve". Every figure links back to the transactions behind it. All money movements are a labelled simulation in a demo bank; no real money moves.

## Try it

| What | Link |
|---|---|
| **Live app** (open on a phone; on desktop it shows a QR code) | https://sisu-demo.vercel.app |
| Hosted backend (agent, voice, plans, watches) | https://sisu-api.vercel.app |
| Landing page | https://sisu-money-coach.vercel.app |

Good first questions: *"Why do I run out of money before payday?"*, *"What if I ate out a third less?"*, *"Is it safe to spend this week?"*, *"Find me a three-room flat in Helsinki under 680 euros."* It also answers in Finnish and 40+ other languages.

## What it does

- **Explains your money:** safe-to-spend with the maths shown, the three baskets (needs, wants, savings) with peer comparison, recurring bills with a confidence score, month-by-month cash flow, any month in the two-year history.
- **Simulates futures:** what-ifs ("cut dining out by 20%", "can I afford a 300-euro bike?") with a teaching question, plus short Path lessons it points you to.
- **Acts, with your approval:** a live money plan shows Sisu scanning the account, searching and reading pages, then one "Approve all" carries out switches and transfers in the demo bank. It refuses transfers the account cannot cover.
- **Keeps watching:** price watches on flats or any product; it re-checks the pages and tells you when something fits.

## How each sponsor is used

| Sponsor | Role in Sisu | Where in the code |
|---|---|---|
| **S-Pankki** | Synthetic customer data is the ground truth for every answer; the finance engine computes all figures in code, never the model | `lib/finance/`, `data/` |
| **NVIDIA Nemotron** | The reasoning model that plans, picks tools and writes answers; NVIDIA Build is the hot backup | `lib/agent/model.ts`, `lib/agent/` |
| **Verda** | Self-hosts Nemotron on a GPU in the EU, so bank data stays in Europe | `deploy/verda/` |
| **Exa** | Live web search, a second page reader and multi-source research for cheaper deals | `lib/agent/research/` |
| **Context.dev** | Reads deal pages into typed data, and runs monitors that re-check pages for price watches | `lib/agent/research/`, `lib/watch/` |
| **ElevenLabs** | Speech-to-text and text-to-speech for the voice conversation, many languages | `app/api/voice/`, `lib/agent/languages.ts` |

Model fallback order: Nemotron on Verda → NVIDIA Build → Gemini. If research services are down, Sisu says so rather than claiming it checked.

## Run it locally

```bash
npm install
cp .env.example .env.local   # mock mode: no API keys needed
npm run dev
```

Open http://localhost:3000. The reduced demo data is already in `data/`. Run the unit tests with `npm test`.

## Repo map

| Path | What |
|---|---|
| `web/`, `app/`, `components/` | Next.js web app (the live app) and API routes |
| `ios/` | Native SwiftUI app and `SisuCore` client library |
| `lib/agent/` | Orchestration: model, tools, voice, plans, research |
| `lib/finance/` | Finance engine: baskets, safe-to-spend, scenarios |
| `lib/actions/`, `lib/watch/` | Demo bank for approved actions; price watches |
| `deploy/` | Verda GPU hosting and Supabase session store |
| `tests/` | Unit tests and live "gauntlet" checks |
| `context/` | Team decisions, architecture and the build log |

---

## For the team

### Shared AI context

Everything we've decided lives in [`context/`](context/). Point your Claude, ChatGPT, Cursor or Codex session at these files so it starts with the same picture.

| File | What it is |
|---|---|
| [`context/log/`](context/log/) | **Shared team memory.** Every person's AI agent reads it at the start and adds an entry before committing ([how](context/log/README.md)). Run `sh scripts/context-digest.sh` to see the latest. |
| [`context/build-plan.md`](context/build-plan.md) | **Start here.** What we are actually building before Sunday: decisions, the demo flow, who builds what, the API contract and the timeline gates. It overrides the spec where they differ. |
| [`context/frontend-integration.md`](context/frontend-integration.md) | **Frontend: read this.** How to add talking and typing to Sisu with one hook, in mock mode. Live test page at `/dev/agent`. |
| [`deploy/verda/`](deploy/verda/) | How Nemotron is hosted on Verda in the EU. |
| [`context/orchestration.md`](context/orchestration.md) | How one voice turn runs: what starts in parallel, who waits for whom, measured speeds, endpoints and mock mode. |
| [`context/architecture.md`](context/architecture.md) | Layer stack, data boundary, the Nemotron → NVIDIA → Gemini fallback order, env vars, and what already exists in this repo. |
| [`context/dataset-notes.md`](context/dataset-notes.md) | What the S-Pankki data really contains, and why the hero bill is electricity rather than telecom. |
| [`context/sponsor-credits.md`](context/sponsor-credits.md) | Which credits are claimed, on whose account, and what each sponsor needs at submission. |
| [`context/sisu-project-specification.pdf`](context/sisu-project-specification.pdf) / [`.txt`](context/sisu-project-specification.txt) | The full original spec: the long-term vision. |
| [`context/chatgpt-ideation-chat.md`](context/chatgpt-ideation-chat.md) | The ChatGPT ideation chat that produced the spec. |

AI coding agents also read [`CLAUDE.md`](CLAUDE.md) (and [`AGENTS.md`](AGENTS.md), which points to it).

### Team workflow

| Role | Branch | Owns |
|---|---|---|
| A – Product, screens, voice UI | `feature/frontend` | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/` |
| B – Finance engine, actions, teaching | `feature/financial-engine` | `lib/finance/`, `data/`, `scripts/`, `app/api/customers/`, `app/api/scenarios/`, `app/api/actions/`, `app/api/demo/` |
| C – Orchestration backend: inference, research, speech (Nicholas) | `backend` | `lib/agent/`, `app/api/agent/`, `app/api/research/`, `app/api/voice/` |

- Work on your branch and open PRs into `main`.
- Run `npm run build` before every PR.
- Change `lib/types.ts`, `package.json` and config only on `main`, and announce it first.
- **This repo is public:** never commit API keys, `.env*` files or promo codes.

### Key links

- Challenges: https://hackjunction.app/participate/45/challenges
- S-Pankki synthetic dataset: https://github.com/hackjunction/Junction-2026-S-pankki
