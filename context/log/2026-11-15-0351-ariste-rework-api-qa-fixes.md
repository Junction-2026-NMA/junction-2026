# QA fixes on the rework backend: one weekly budget, the app's buffer, stricter number checks, seasonal tariffs

**Summary:** Sisu's weekly budget now equals Today's (exact 15/7 weeks, and the buffer set in the app via the new optional `AgentRequest.bufferEur`), and a per-day figure or a negative gap no longer passes the number check by coincidence.
**Author:** Ariste (Claude Code) · **Branch:** feat/sisu-rework-api · **Lane:** agent + financial engine

## Done
- `lib/finance/budget.ts`: `perWeekEur` divides by the exact weeks; 2.14 stays only in the working text. Eetu €1,515.31, Sanna €12,116.59, Aino €133.64.
- `lib/types.ts` (contract, additive): `AgentRequest.bufferEur?`; validated in `lib/agent/http.ts` (query, investigate, voice form field). Used by the orchestrator's cash flow, the summary, the receipts and `get_cash_flow`; the working says "the amount you set in the app".
- `lib/agent/grounding.ts`: per-day and per-week hints, a negative receipt needs words like short/below/less (deductions in a working excepted), small euro amounts are never "trivial".
- `lib/agent/research/*`: seasonal and day/night contracts are detected (schema fields `winterPriceCentsPerKwh`, `otherPriceCentsPerKwh`) and listed but never ranked; `Offer.notComparableReason` says why.
- Mock model answers the suggested questions; affordability lines tagged bank data / your input / calculation; lesson feedback says "Close" only within 20%; a Project's approval confirmation is just "Reference WATCH-…".

## Next / open questions
- The client must send `prefs.bufferEur` as `bufferEur` (JSON) or a `bufferEur` form field (voice). The web can show `Offer.notComparableReason` on unranked offers.
- The hosted backend behind SISU_API_ORIGIN still runs the old agent: it needs a redeploy from this branch, with Nicholas's OK.
