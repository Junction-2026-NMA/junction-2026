# Independent judge QA — 14 November 2026

Base: `origin/main` at `aa39092`. Branch: `qa/independent-judge-audit`. No UI, shared configuration, credentials or infrastructure changed.

## Reproduced and fixed

| Severity | Judge scenario / failure on main | Fix and evidence |
|---|---|---|
| P1 | Compare 2,000 kWh/year: 8 c/kWh + €4/month + €120 setup versus 9 c/kWh + €4/month, no setup. Main recommends the first by omitting €120. | First-year monthly equivalent is €27.33 versus €19; the no-setup offer wins. |
| P1 | A page returns negative setup fees (mobile/internet) or negative electricity base fees. Invalid prices can inflate the saving beyond the entire current bill. | Reject negative/nonfinite fees and invalid base prices before ranking or estimating typical usage. |
| P2 | Electricity price is known but its base fee is missing. Main silently assumes free. | Keep the offer visible but unranked, with no claimed saving. Known setup fees included; unknown setup fees remain a disclosed zero assumption. |
| P2 | Twelve callers request the same uncached page simultaneously. Main makes 12 upstream reads, enough to overwhelm the documented 10/minute Context.dev allowance. | Share the pending read: 12 callers now make 1 request. Failed reads can be retried. |
| P2 | Reuse a page with unknown upstream cache age. Main converts unknown age into apparent freshness. | Preserve null rather than inventing an age. Known ages still advance. |
| P2 | Abort a plan before it begins. Main still creates one draft. | Cancellation checks prevent subsequent drafting. Regression also aborts after account scan and page results. Existing drafts are not rolled back; shared research may finish in background. |

Electricity fees and cancellation/cache concerns had also appeared in earlier independent review notes, but were still unfixed on main. This is an integrated patch, not a claim that every finding is new. Invalid fee ranking and the measured 12-caller amplification extend that evidence.

## Executed evidence

- Baseline `npm test`: **248/248**.
- First four new tests against main: **0/4**. Cancellation test separately failed (one unexpected draft).
- Final `npm test`: **253/253**, including scripted reasoning/tool selection, injected web text, approval guards, customer scoping, model fallback, and new judge cases.
- `npm run lint`: clean. `npm run build -- --webpack`: passed including TypeScript.
- Running isolated production server: `SISU_BASE=http://127.0.0.1:3348 node tests/gauntlet/judge-audit.mjs`: 12 concurrent scenario turns completed; foreign-customer approval 404; missing confirmation 400; three simultaneous approvals produced 200/409/409.
- Browser core flow: Aino → Sort out my money → four draft actions with warning and explicit simulation label → Approve all (see session evidence). Mock sources explicitly labelled as examples.
- Browser limitation: Turbopack dev preview did not hydrate the customer selector; webpack production flow was functional but lacked utility styling. No visual sign-off. Frontend/config owner must verify the actual demo build.
- No live credentials were found in available project checkouts. No fresh live Nemotron, Exa, Context.dev or ElevenLabs calls were executed. Scripted/mock passing tests do not certify live reasoning, Finnish speech, live price extraction or booth latency.

Reproduce: `npm test`; start an isolated server with `MODEL_PROVIDER=mock SISU_STATE_FILE=/tmp/sisu-qa/state.json npm run start -- --port 3348`, then run the HTTP script above. State-changing HTTP smoke explicitly refuses a non-mock server.

## Challenge alignment and lane handoff

Source: [Nicholas's concrete challenge brief](https://docs.google.com/document/d/1A0Rtb7WddaoytJldIhIOQ1m1YGD4eMTCqnGFKZYdzyY/edit). Reviewed build plan, orchestration, recent logs, merged PRs #2/#3 and open concept PR #1. Visible T3 inventory had no other running project agent at review time; this is a snapshot, not continuous monitoring of teammates' machines.

| Owner | Drift / evidence | Stay within the challenge |
|---|---|---|
| Frontend | `/plan` automates a fixed sequence but has no teaching question or arbitrary follow-up on that screen. S-Pankki scores financial literacy and mobile clarity at 20% each. | Demonstrate three baskets, one predict-before-reveal lesson and a typed/voice follow-up using personal transactions. Keep warnings, receipts and simulation labels. Do not spend the remaining time adding more galleries. |
| Orchestration | Plan selection is code-driven; Nemotron mainly words its summary. NVIDIA requires meaningful Super VL work, not just a logo or narration. | Include a live free-form chat/investigation with visible model-selected tools, exact served model and provider trace. A Gemini fallback is useful resilience, not proof of Nemotron participation in that turn. |
| Research | Exa fallback is useful, but an all-Exa run does not demonstrate Context.dev's core contribution. Cached reads are not evidence of reacting to a new web change. | Show at least one Context.dev extraction changing a compared price; show reader, source, retrieval time and freshness uncertainty. For Exa accept a judge's changed requirement and finish with a usable draft. |
| Finance/actions | Missing fees, uncertain bill identity, unknown current exit charges and plan equivalence can overstate savings. | Confirm the guessed bill, state consumption/fees assumptions, distinguish recurring savings from moving existing money, keep approval and audit. Never claim a contract actually switched. |
| Voice/compute/submission | Concept PR #1 says Gemini or ElevenLabs and makes Nemotron optional; housing monitoring is only proposed. | Use ElevenLabs audio and Super VL as committed in the build plan; show actual Verda inference, document provider fallback privacy honestly, prepare the required sponsor write-ups/Verda process summary. Present monitors as future work. |

Alignment guidance was posted directly on PR #1. Do not build new monitors, alternative model stacks or additional product surfaces before the core flow and live sponsor evidence are ready.

## Remaining demo risks

1. **Live service evidence missing in this audit.** Run an unfamiliar multi-step Finnish question and one cold offer search with the actual provider configuration before judging; record source, model and latency.
2. **Calculator provenance / grounding:** arithmetic is deterministic, but model-chosen operands are not validated against receipts. Units and multilingual numerals also need stronger checking. Existing grounding success rates are not a proof of financial correctness.
3. **Research fallback deadline:** Context.dev's 8-second timeout plus Exa fallback can exceed the tool's 8.5-second wait. Failed watched research can trigger another unreported search. Page coalescing fixes duplicate reads, not duplicate watched searches or that deadline.
4. **No authentication, single-file state:** customer-scoped functions and approval races pass within one process; this is not multi-user authorization or multi-instance persistence. Stay on synthetic data and one demo server.
5. **Incomplete pricing:** unlisted setup fees still assume zero (now explicit); current-contract exit fees, promotion expiry and like-for-like speed/coverage are not represented. Avoid presenting these estimates as guaranteed savings.
6. **UI/demo build:** dev hydration and webpack styling observations need the frontend/config owner. No UI files changed by this QA branch.


## Incremental audit — 14 November, 13:55 EET

Reviewed main `5da064c` (PR #5, head `3c48685`) against the previous `aa39092` baseline, plus the backend branch's challenge-text-only commit `3cfdfca`. Re-read the supplied challenge Doc. PR #5 improves S-Pankki alignment: basket teaching and conditional telecom savings are now explicit. Earlier alignment guidance is unchanged and was not reposted.

**New P1: category savings and futures disagreed above €500/month.** Eetu's Entertainment average is €632.33. A 100% category cut produced a €632.33 receipt but the generic bill-saving slider limit truncated the scenario to €500; the one-year cash improvement was €6,000 instead of €7,587.96. `runScenarioTool` now preserves the code-computed category saving after validating other scenario inputs. Model-supplied generic savings retain their existing limit. No shared types/config or UI were edited by this fix.

- Added regression failed before the fix (`500 !== 632.33`), then passed. The integrated baseline with PR #5 had 256 passing tests; final suite: **257/257**.
- Lint and webpack production build passed. HTTP mock judge audit: 12/12 concurrent turns, cross-customer approval 404, absent confirmation 400, simultaneous approvals 200/409/409.
- Playwright production smoke on isolated port 3351: Aino → Sort out my money → three-way savings split and four waiting actions → Approve all → four explicit simulated completions and futures. Screenshot: `.playwright-mcp/sisu-qa-nov14-approved.png` in the tool output directory. No automated e2e smoke spec exists in this checkout.
- Tests used scripted/mock providers only. Neither the QA nor shared checkout contains `.env.local`; no fresh live provider calls or voice checks were executed. Earlier live-service and presentation risks remain unverified.
