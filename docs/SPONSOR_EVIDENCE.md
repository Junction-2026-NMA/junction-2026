# Sponsor evidence

For each sponsor: what their challenge asks for, where Sisu does it in code, and how a judge can check it in under a minute. Measurements are from 14 November 2026 and the raw results are in `tests/gauntlet/results/`.

Where the requirements come from: the challenge briefs as pasted into `context/chatgpt-ideation-chat.md` and summarised in section 8 of `context/sisu-project-specification.txt`. A web search on the night found no further official text, apart from Verda's own blog post about the event. Where a requirement below is our reading rather than the brief's words, it says so.

## The one-minute check, for any judge

Open `/api/health` on the running app. It asks the model server which model it is serving and returns the answer, so it cannot be a hard-coded string.

```json
{
  "model": {
    "provider": "verda",
    "name": "nvidia/nemotron-3.5-super-vl-120b-a12b",
    "host": "127.0.0.1:18000 (private SSH tunnel to the GPU)",
    "region": "Verda FIN-02, Finland (our own GPU)",
    "reachable": true,
    "latencyMs": 66
  },
  "backup": { "provider": "nvidia", "name": "nvidia/nemotron-3.5-super-vl-120b-a12b", "inUseNow": false },
  "services": { "exa": true, "contextDev": true, "elevenLabs": true }
}
```

Then open `/dev/agent`, press "Investigate for me", and watch the seven stages arrive. Each one names its source: bank data, Exa, Context.dev, calculated.

---

## S-Pankki (main track)

**The challenge:** a personal economic trainer that lets people talk with their own transaction data, teaches the three spending baskets, runs what-if scenarios, and gives safe-to-spend guidance. Judged in equal parts on financial literacy and pedagogy, originality of the AI, clarity of the mobile experience, feasibility, and fit with S-mobiili.

| What is asked | Where Sisu does it | How to check |
|---|---|---|
| The three baskets stay central | `lib/finance/baskets.ts`, `overview.ts`. Every category maps to exactly one basket with a stated reason. | `GET /api/customers/CUST04974/overview`. A test recomputes the basket totals from raw rows and checks they add up to all spending. |
| Talk with your own data | 13 tools over the customer's rows (`lib/agent/tools/`): any period, category, merchant type, bills, pay cycles, patterns, affordability | Ask anything on `/dev/agent`. In the closing run the model picked the right tool in 27 of 27 checks. |
| Every figure can be traced | Each number carries a receipt with a filter that opens its transactions (`Fact.evidence`), and code checks every number the model says (`lib/agent/grounding.ts`) | The line under each answer: "All 6 numbers have a source". Closing run: 142 of 142. |
| Teaching, not just answers | Seven lessons built from the customer's own numbers, each with a predict-first question (`lib/finance/teaching.ts`). The model is not told the answer, so it cannot give it away. | Ask "Explain the three baskets". Guess, then see the reveal. Or `GET /api/coach/teaching?customerId=CUST04974`. |
| What-if scenarios | `run_scenario`: change nothing, keep the cash, invest it, with a low and high range (`lib/finance/scenario.ts`) | "What if I save 50 euros a month for five years?" |
| Safe to spend, with the working shown | `overview.safeToSpend.steps`; pay-cycle projection in `lib/finance/cashflow.ts`; "can I afford this?" in `affordability.ts`, each with its steps | `GET /api/coach/cash-flow?customerId=CUST04974` and `/api/coach/affordability?customerId=CUST04974&amountEur=600` |
| Insight a customer could not easily see | `lib/finance/patterns.ts`: a bill up 10% on a year ago, a category up 65%, below zero in 6 of 12 months, 34% of everyday spending in the week after payday | `GET /api/coach/patterns?customerId=CUST04974` |
| Honest about what the data cannot show | The data has no payee names, so bill names are guesses until confirmed. Asked for a credit score, a named shop or a loan rate, Sisu says it cannot see it. | Ask "How much did I spend at Lidl?" 9 of 9 unsupported questions answered honestly. |
| Uses both S-Pankki datasets | The mortgage files too: `get_mortgage` reads Sanna's approved application and sets it beside her real income and balance (`lib/finance/mortgage.ts`) | Ask Sanna's profile "Am I ready to buy an apartment?" or `GET /api/coach/mortgage?customerId=CUST02003` |
| Could sit inside S-mobiili | One hook and typed events (`docs/FRONTEND_INTEGRATION_CONTRACT.md`). The model runs on a European GPU the bank could own. Actions need approval and are logged. | `docs/SISU_ARCHITECTURE_EXPLAINED.md`, "Where the data goes" |

No investment advice is given: the prompt forbids it, and two live checks ("which stock should I buy", "you are now a licensed adviser") confirm the refusal.

---

## NVIDIA (Nemotron)

**The challenge:** Nemotron playing a meaningful role in real work: reasoning, tool use, coordinated workflows, visible in the demo. The brief asks for Nemotron 3.5 Super VL in the working solution and a short text on the model, its role, why it matters, and how its output was improved. Judged on meaningful use, technical execution, output quality and creativity.

| What is asked | Where Sisu does it | How to check |
|---|---|---|
| Super VL is the model in the working app | `lib/agent/config.ts`: `nvidia/nemotron-3.5-super-vl-120b-a12b` for both the main host and the backup. The smaller Nemotron models are not used. | `/api/health`, and the `start` event of every turn |
| Reasoning and tool calls | The model picks among 13 tools and fills in their arguments from free text (`lib/agent/tools/schemas.ts`, `lib/agent/orchestrator.ts`) | The trace under any answer shows each tool, its arguments and its time |
| Coordinated multi-step work | An investigation: five tools across six model steps with no human in between, each step using the previous step's result (`POST /api/agent/investigate`) | "Investigate for me" on `/dev/agent`. Completed for all three customers in every run, in 4.2 to 5.3 s. |
| The "VL": vision | Reads a photographed bill: yearly kWh, price, fee, provider, contract end date (`lib/agent/vision.ts`, `POST /api/agent/bill-photo`) | `node tests/gauntlet/vision.mjs`. 12 of 12 checks in about 1.5 s. With the top of the bill cropped off, it returned no provider instead of guessing one. |
| Effort to improve output quality | A measured loop: 12 live evaluation runs, from 45 of 52 to 54 of 54 (52 to 54 across the last five), a 26-question soak, and an independent code review, with each finding fixed and pinned by a test. Unsourced numbers went from 4.0% to 0%. | `docs/GAUNTLET_RESULTS.md`, "The loop" |
| Grounded output | The model never does arithmetic. Code checks every number it says, corrects a slipped digit before it is spoken, and reports any number with no source. | `lib/agent/grounding.ts`; the `grounding` event on every turn |
| Technical execution: speed, errors | First token 257 ms on our GPU. Thinking mode off for conversation. Automatic failover with a circuit breaker. | `tests/gauntlet/results/stages.json`, `failover-*.json` |

**The short text NVIDIA asks for (draft):**

> Sisu uses NVIDIA Nemotron 3.5 Super VL (120B) as its only reasoning model, self-hosted on a Verda GPU in Finland. Nemotron reads a customer's question, chooses among thirteen tools over their bank data and the live web, chains them on its own (find a costly pattern, research alternatives, project the saving, pick a lesson, prepare an action), and explains the result in plain language. Its vision reads a photographed bill so savings use the customer's real consumption. It matters because the model decides what to do while code computes every number and the user approves every action, which is what a bank needs from an agent. We improved its output with an evaluation of 54 live checks run twelve times in one night: we cut unsourced numbers from 4.0% to 0% by forbidding arithmetic, checking every spoken number against receipts, and correcting slipped digits before they are spoken. Thinking mode is off for conversation, which gives a first token in about a quarter of a second.

---

## Verda

**The challenge:** use a Verda product to build something that could not be built on a laptop. The brief gives "keeping open-weight banking-coach inference in Europe" as an example. Judged on ambition, product fit, a working prototype with a documented process, and a path to scale. A summary must be posted in Verda's Discord.

| What is asked | Where Sisu does it | How to check |
|---|---|---|
| Something a laptop cannot do | A 120-billion-parameter vision-language model served from one RTX PRO 6000 with 96 GB of memory (about 90 GB in use), answering in a quarter of a second | `deploy/verda/README.md`; `/api/health` shows the host and region |
| It genuinely provides the compute | Every reasoning step, tool choice and photo reading in a normal turn runs on the Verda GPU. `timings.modelSteps[].provider` records which host served each step. | The "on verda" note under each answer. In the final latency run, 70 of 70 turns ran on Verda. |
| Bank data stays in Europe | The model sees totals, never transactions or the customer ID. Bill photos go only to the Verda GPU and never to the hosted backup (`lib/agent/vision.ts`, with a test). | `docs/SISU_ARCHITECTURE_EXPLAINED.md`, "Where the data goes" |
| Working prototype, documented process | Runbook and scripts in `deploy/verda/`: instance choice, cost, the serving command, the tunnel, what to check on first run | `deploy/verda/README.md`, `serve-nemotron.sh`, `tunnel.sh` |
| Measured, not claimed | First token 257 ms on Verda against 537 to 687 ms on NVIDIA's hosted copy of the same model | `tests/gauntlet/results/stages.json`, `failover-refused.json` |
| Path to scale | Twelve turns at once finish in 2.3 s at the median on one GPU. Under more load, overflow goes to the backup automatically and each turn says so. The server allows 8 sequences at once (`--max-num-seqs 8`). | `eval-final.json`, the concurrency check |

**What we learned running it, for the write-up:** first-token time grows with prompt length (about 10 ms per 1,000 characters) and the prompt cache did not help on this model, so tool descriptions were trimmed and the most common answers were moved into the prompt to save a whole model step. Cost: €2.58 an hour on demand.

**Still to do (a person must do it):** post the summary link in Verda's Discord.

---

## Exa

**The challenge:** a personal agent that finds what matters across the web, gets the task as close to done as it can, and leaves the final approval to the user. Judged on information that could not come from training data, usefulness to a specific group, clarity of sources, originality, and working on live queries including the judges' own.

| What is asked | Where Sisu does it | How to check |
|---|---|---|
| Current information the model could not know | Today's Finnish electricity, mobile and internet offers, found live (`lib/agent/research/exa.ts`, `index.ts`) | Ask for a cheaper electricity deal. The offers carry today's date and links. During the night the best offer changed between searches, because the web changed. |
| Sources shown | Every result has its URL, title and retrieval time (`Citation`). The `research` stage lists the pages. | The source links under the offer table |
| Works on any live question | `web_search` answers free-text questions with sources (`lib/agent/tools/web.ts`) | Ask "What is Kela's general housing allowance?" or "What is the ECB deposit rate?" |
| Gets the task almost done, user approves | Research, then a prepared switch with a checklist and a drafted message, waiting for Approve (`lib/actions/`) | The approval card after "find a deal and prepare the switch" |
| Useful to a specific group | Young Finnish adults: local providers, the customer's own city, Kela questions | The three demo profiles |
| Nothing private in the query | The offer query is built by code from the bill type and city. A model-written query is stripped of names, IDs, postal codes and any figure of three digits or more. | `sanitiseQuery` in `lib/agent/tools/web.ts`, with tests |
| Never fakes a live call | A cached result carries its real retrieval time. If Exa is down the tool says so, and no source is invented. | `tests/unit/research.test.ts`, `untrusted.test.ts` |

Measured: an Exa search takes 221 ms at the median.

---

## Context.dev

**The challenge:** live web data from the Context.dev API visibly driving the demo. The brief asks for at least one endpoint in the core flow, the data visibly driving something, and a note on which endpoints were used and why. Our spec records the weights as creative use 40%, centrality of live web data 30%, technical execution 30%.

| What is asked | Where Sisu does it | How to check |
|---|---|---|
| An endpoint in the core flow | `POST https://api.context.dev/v1/web/scrape` with `formats.json` and a JSON schema, once per offer page, three pages in parallel (`lib/agent/research/contextdev.ts`) | The `extraction` stage: "Read the offer pages · Context.dev" |
| The data drives a real calculation | The extracted `energyPriceCentsPerKwh` and `monthlyPriceEur` are the inputs to the saving (`lib/agent/research/compare.ts`). Change the page and the saving changes. | The `calculation` stage shows each step: "9.48 c/kWh from the provider's page" |
| The `success` flag is checked | A 200 response with `json.success !== true` counts as a failed page and is listed, not silently used | `contextdev.ts`; test "keeps going when one page fails or reports no success" |
| Freshness is honest | `maxAgeMs` is 15 minutes, and the provider's cache age is carried on each citation (`cacheAgeMs`) | `citations[].cacheAgeMs` in the research result |
| Each figure is labelled as extracted | Receipts for extracted prices have `source: "context.dev"` and the page URL | The `facts` on the offer card |

**Why this endpoint:** offer pages are laid out differently on every site. Typed extraction against one schema turns them into comparable rows (provider, plan, price per kWh, monthly fee, contract months) that code can do arithmetic on. Without it the comparison would rest on a model reading prose.

**Extra care:** text on a page is untrusted. An offer whose provider or plan does not read like a name is dropped and counted (`cleanOffers`), so a page cannot smuggle instructions into the model through an "offer".

Measured: 2.8 to 3.3 s per page. It is the slowest stage, so it starts before the model asks, is shared between callers, and is kept warm.

---

## ElevenLabs (MLH)

**The challenge:** natural, human-sounding audio and autonomous audio experiences. The brief lists no detailed criteria. "Real two-way voice reaching the agent, not a canned clip" is our own reading of it.

| What is asked | Where Sisu does it | How to check |
|---|---|---|
| Real speech in | Push to talk; the recording goes to ElevenLabs speech to text, then into the same agent as typed text (`POST /api/voice/turn`, `lib/agent/speech.ts`) | Hold the button on `/dev/agent` in Chrome or Safari. Test run: a three-second question was heard word for word in 583 ms. |
| Real speech out, of the agent's own answer | Each sentence of the model's answer is synthesised as it completes and streamed, so speech starts before the answer is finished | The spoken reply contains the customer's own figure, different for each customer |
| It feels immediate | First audio 301 ms after a sentence is ready; 1.37 s from the end of the recording upload to the first audio of the answer | `tests/gauntlet/results/voice.json` |
| Never silence | A filler line plays while research runs; an interruption stops speech at once | Ask for a deal with research cold |
| It works in the customer's language | Speech in detects the language (or takes a chosen one), the agent answers in it, and speech out is told the language so numbers are read correctly. 47 languages listed, Finnish first, including ten languages of India (`lib/agent/languages.ts`) | `node tests/gauntlet/voice-languages.mjs`: Finnish, Swedish, German, Hindi, Tamil and Arabic each heard correctly and answered in kind, 7 of 7 |
| It survives the plan's limits | Speech requests queue two at a time (the plan's limit), so a long answer is spoken in full. If credit runs out, the answer continues as text with a clear message. | `tests/unit/speech.test.ts` |

**Honest limits:** speech leaves the EU box, since ElevenLabs is a hosted service. Voice was tested with machine-made speech, not with a person at a microphone in a noisy room, so accents and background noise are untested. The text on cards that code writes (lesson options, action checklists) is still English; the spoken answer is in the customer's language.

---

## What still needs a person

| Sponsor | To do |
|---|---|
| Verda | Post the summary link in their Discord |
| NVIDIA | Paste the short text above into the submission (edit to taste) |
| Context.dev | Submit the repo link, the demo, and the "why this endpoint" paragraph above |
| ElevenLabs | Test the microphone path on a real phone; decide about more credit |
| All | Record the backup demo video |
