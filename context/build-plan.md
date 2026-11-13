# Sisu build plan (agreed Fri 13 Nov, 23:00 EET)

This replaces the scope in `sisu-project-specification.pdf` wherever they disagree. The spec is the long-term vision; this is what we build before **Sunday 15 Nov, 10:00 EET**.

## Decisions

| Decision | Why |
|---|---|
| One flow built end to end before anything else (below). | Peer judges get about 90 seconds. One complete flow beats six half-built pillars. |
| Tracks: **S-Pankki** (main), **Exa**, **Context.dev**, **NVIDIA**, **ElevenLabs**, **Verda**. Modal is dropped. | Each of these sits on the demo's critical path. Modal would add a logo, not a feature. |
| **Voice is required**, through ElevenLabs. Typing always works too. | Team decision. A noisy booth means voice cannot be the only way in. |
| **Nemotron 3.5 Super VL is the reasoning model**, self-hosted on Verda first. NVIDIA's hosted endpoint is fallback 2 and Gemini is fallback 3 (see `architecture.md`). | The NVIDIA track requires Super VL. Hosting on Verda is the "bank data stays in an EU cloud we control" story. |
| Every number comes from code in `lib/finance/`, never from the model. | Judges will check. The spec requires it. |
| One Next.js app with API routes. No FastAPI, no monorepo packages, no CI. | It is 36 hours. One deployable thing. |
| Cut: mortgage workflow, investment education beyond one "invest it" branch, vector memory, auth, encryption. | Stretch only, after the main flow works. |

## The demo flow

1. **Pick a customer.** Aino 23, Eetu 25 or Sanna 33. Names are invented; the profiles are real synthetic S-Pankki customers.
2. **X-ray.** Three baskets, safe-to-spend, a flagged recurring bill. Every figure opens its transactions.
3. **Ask by voice or text.** For example: "Can you find me a cheaper electricity deal?" ElevenLabs transcribes the question and Nemotron plans the tool calls.
4. **Live research.** Exa finds current Finnish offers. Context.dev turns each page into JSON (price, term, fees). Code computes the yearly saving.
5. **Teach.** A predict-before-reveal question appears before the futures chart moves.
6. **Approve.** Sisu drafts a switch checklist. The user approves a clearly labelled simulated action, and it is written to the audit log.
7. **Impact.** The futures chart recalculates, and Sisu says the result out loud.

## Who builds what

Each role edits only its own folders. Shared files (`lib/types.ts`, `package.json`, config) change on `main` only, and are announced in the team chat first.

### A: Product, screens and voice UI

- **Branch:** `feature/frontend`
- **Owns:** `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/`

| Priority | Task |
|---|---|
| Must | Ask Sisu box: text input and a streamed answer. Add a "how Sisu worked this out" drawer listing each tool call, why it ran and how long it took. |
| Must | Bill opportunity card: confirm the bill name, then a "Find a cheaper deal" button. Show the stages (searching, reading pages, comparing), then an offer table with source links and the retrieval time. |
| Must | Approval card: show the drafted checklist or email with Approve and Decline buttons. Label it visibly "Simulated, no real switch" and show the status after approval. |
| Must | Feed the approved saving into `FuturesCard` so the chart moves. |
| Must | Voice button: hold to talk, a recording state, the transcript on screen, and the spoken reply with a mute toggle. Typing always works too. |
| Must | Loading, error and empty states on every card. Add a reset button for the booth. |
| Should | A teaching moment at each step, covering why a bill is in its basket, fixed versus usage-based contracts, and why a cash buffer comes before investing. |
| Should | Large-screen mirror layout at 1024 px and wider. |
| Stretch | Styling closer to S-mobiili. |

**Done when** the whole flow runs at phone width with no console errors and every state has a design.

### B: Finance engine, actions and teaching

- **Branch:** `feature/financial-engine`
- **Owns:** `lib/finance/`, `data/`, `scripts/`, `app/api/customers/`, `app/api/scenarios/`, `app/api/actions/`, `app/api/demo/`

| Priority | Task |
|---|---|
| Must | Tool functions the agent calls, each with an endpoint: spending by category, merchant code or basket over a date range; list bills; safe-to-spend; run scenario. |
| Must | `compareOffers(bill, offers)`: yearly saving after setup and switching fees, months to break even, and the winning offer. Handle missing fields honestly. |
| Must | Actions: prepare (turn an offer into checklist or email text), approve (change the state and write an audit event), list the audit log. Nothing executes without an approval event. |
| Must | Remembered preferences: confirmed bill names and goals survive a page reload and a new session, stored in one small Postgres table. |
| Must | `POST /api/demo/reset` clears actions and preferences for the three demo customers. |
| Should | Reconciliation script: basket totals add up to all spending, and no endpoint returns another customer's rows. |
| Should | Teaching content: concept cards and comprehension questions, with answers computed from the customer's own numbers. |
| Stretch | "Can I afford to move out?" scenario, using rent figures from C's research. |
| Stretch | Mortgage readiness view for Sanna (CUST02003, whose mortgage was approved). |

**Done when** every number the agent says comes from these functions and all three profiles reconcile.

### C: Orchestration backend, from inference to speech (owner: Nicholas)

- **Branch:** `feature/agent-orchestration`
- **Owns:** `lib/agent/`, `app/api/agent/`, `app/api/research/`, `app/api/voice/`
- **Read:** the latency plan in `context/architecture.md`, which has measured numbers.
- **The sponsor API keys live only on this machine**, so A and B build against mock mode (first task below) and never need them.

| Priority | Task |
|---|---|
| Must | **Mock mode first.** `MODEL_PROVIDER=mock` returns fixed example answers, traces, offers and audio placeholders through the real endpoints. Teammates run the whole app without keys. |
| Must | Orchestrator `POST /api/agent/query`, **streamed** over server-sent events. It includes the system prompt, tool schemas for B's functions, and a tool loop capped at 4 steps. It returns tokens as they arrive, the tool-call trace with per-step timings, and citations. |
| Must | Call Nemotron with `chat_template_kwargs: {"enable_thinking": false}` for conversation turns (0.54 s to first token, against 3.1 s with thinking on). Turn thinking on only for slow "plan" tasks typed into the ask box. |
| Must | Research: Exa search (`type: "fast"`, 0.55 s) for current Finnish offers. The query holds only the bill type and city. Context.dev then reads the top 3 pages in parallel with a 2.5 s budget; use whatever came back and check each `success` flag. **Prefetch** this when the user confirms the bill, labelled with its real retrieval time. |
| Must | Voice: push-to-talk ElevenLabs speech to text, then the same agent stream, then ElevenLabs text to speech (`eleven_turbo_v2_5`, 0.24 s to first audio), sentence by sentence. Pre-generate short "checking that now" clips so a slow tool never leaves silence. |
| Must | Timeouts on every external call. Show the last good research result with its real retrieval time. When something cannot be checked, answer "I could not verify this" instead of guessing. |
| Should | Run 20 unexpected judge questions by voice and fix what breaks. Keep a latency log per stage. |
| Should | Sponsor write-ups: the NVIDIA model-role explanation, the Context.dev endpoints used and why, the Verda summary for their Discord, and how Exa is used. |
| Stretch | Self-host Nemotron on Verda. Switch the demo to it only if its time to first token is at or below NVIDIA Build's 0.54 s. |
| Stretch | Vision: the user photographs a bill, and Nemotron VL reads the provider and price. |

**Done when** a spoken question about the user's own numbers starts answering aloud within about 2 s, and a live-offer question within about 3 s (with prefetch) or 6 s (cold).

**Owners:** Nicholas owns C, the whole orchestration backend (decided 14 Nov), and the sponsor keys. Roles A and B still need names.

## Shared API contract

The types live in `lib/types.ts`. B and C first commit stubs that return fixed example data, so A never waits.

| Endpoint | Owner | Returns | Status |
|---|---|---|---|
| `GET /api/customers/demo` | B | The three demo customers | Live |
| `GET /api/customers/:id/overview` | B | Baskets, bills, safe-to-spend, insights, months, assumptions | Live |
| `GET /api/customers/:id/transactions?from&to&category&basket&mcc&negativeBalance` | B | Filtered rows behind any figure (newest 300) | Live |
| `POST /api/scenarios` | B | Three futures (`nothing`, `save`, `invest`) with a low and high band and assumptions | Live |
| `POST /api/agent/query` | C | Answer, tool-call trace, citations | To build |
| `POST /api/research` | C | Offers with sources and retrieval time | To build |
| `POST /api/actions/prepare` | B | Draft action awaiting approval | To build |
| `POST /api/actions/:id/approve` | B | New status plus an audit event | To build |
| `POST /api/voice/stt`, `POST /api/voice/tts` | C | Transcript; audio stream | To build |
| `POST /api/demo/reset` | B | Clean demo state | To build |

Responses carry `customerId`, `dataTimestamp`, `currency` and `assumptions` where relevant. Never expose API keys or raw tables to the browser.

## Timeline (Espoo time)

| When | Done means |
|---|---|
| Fri 24:00 | All three running this repo locally, API keys in everyone's `.env.local`. |
| Sat 09:00 | Every endpoint in the contract answers (stubs allowed). |
| Sat 10:00 | **Model gate.** Nemotron on Verda answers a tool call, or C switches to NVIDIA Build. |
| Sat 14:00 | Bill flow works end to end with live Exa and Context.dev and a computed saving. |
| Sat 19:00 | Voice works both ways; approval writes to the audit log; the chart updates. |
| Sat 23:00 | **Feature freeze.** Only fixes and hardening against judge questions after this. |
| Sun 07:00 | Backup video recorded; sponsor write-ups drafted. |
| Sun 09:30 | Submitted (deadline 10:00). |

## Rules judges will check

- Every number comes from `lib/finance/` and links to its transactions.
- No faked live calls. Cached results show when they were really fetched.
- Exa, Context.dev and hosted model fallbacks never receive transactions or customer IDs.
- Every action needs an approval click, is labelled simulated, and is logged.
- The data has no payee names, so bill names stay Sisu's guess until the user confirms them.
