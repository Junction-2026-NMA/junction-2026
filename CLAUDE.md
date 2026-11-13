# Sisu — hackathon project (Junction 2026)

One line: a mobile-first financial coach on S-Pankki's synthetic data. It finds a costly pattern in a customer's transactions, researches live alternatives, shows the effect on their future, teaches one concept and prepares an action they approve. For young Finnish adults; judged by peer reviewers at a booth.

## Read first
- `context/build-plan.md`: decisions, demo flow, roles, API contract, timeline. It overrides the original spec where they differ.
- `context/architecture.md`: layer stack, data boundary, model fallback order, env vars.
- `context/dataset-notes.md`: what the data really contains (no payee names, no telecom MCC, three Utilities payments a month).
- `context/sponsor-credits.md`: credit status and what each sponsor requires at submission.
- This repo is **public**. Never commit keys, `.env*` files, promo codes or personal emails.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind 4. One app, API routes, no separate backend.
- Data: small JSON files in `data/`, produced once from the 346 MB official CSV by `scripts/reduce.sh` (needs DuckDB; raw CSVs are NOT in git).
- Hosting: Vercel (deploy only after Nicholas OKs).
- Sponsor APIs (server-side only, keys in `.env.local`):
  - NVIDIA Nemotron 3.5 Super VL, self-hosted on Verda. Fallbacks are NVIDIA Build and then Gemini; `MODEL_PROVIDER` switches between them.
  - Exa, Context.dev, and ElevenLabs (speech to text and text to speech).

## Commands
- Dev: `npm run dev` (http://localhost:3000)
- Build check: `npm run build`
- Rebuild data: `sh scripts/reduce.sh /path/to/raw-csv-folder`

## Priorities (in order)
1. One flow end to end: pick customer → X-ray (three baskets) → flagged bill → live Exa search → Context.dev extraction → saving computed in code → futures chart → teaching question → approve simulated action.
2. Free-text ask box plus voice (ElevenLabs, required): Nemotron calls deterministic tools; visible tool trace and sources.
3. Hardening for arbitrary judge queries, then polish. Stretch: move-out scenario, mortgage readiness.

## Rules that matter for judging
- Every number comes from code in `lib/finance/`, never from the model. Show the transactions behind each claim.
- Never fake a live call. Cached results must be labelled with their retrieval time.
- Web tools get the smallest query needed; never send transaction history or customer IDs to Exa/Context.dev.
- Simulated actions are labelled as simulated and need an approval click. Log them.
- The dataset has no merchant or payee names: bill names are guesses the user confirms.

## Code rules
- Simplest thing that works. Small files (<300 lines), clear names, early returns, no mutation.
- Validate input at API routes; friendly error messages in the UI.
- Secrets only in `.env.local` (gitignored). `.env.example` has empty values.
- Commit after each working step (`feat:`, `fix:`, `chore:`).

## Lanes (three-person team; one branch each, merge to main after build passes)
| Lane | Owns |
|---|---|
| frontend | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/` |
| financial engine | `lib/finance/`, `data/`, `scripts/`, `app/api/customers/`, `app/api/scenarios/`, `app/api/actions/`, `app/api/demo/` |
| agent + sponsor APIs | `lib/agent/`, `app/api/agent/`, `app/api/research/`, `app/api/voice/` |

- The API contract is `lib/types.ts`. Change it on `main` only and tell the team.
- Shared files (`package.json`, lockfile, config): one person at a time.

## Session capture (Entire)
- Enabled with `sh scripts/entire-enable.sh`. Private: no upload on push, no telemetry. Never run `entire checkpoint push` without Nicholas's OK.
