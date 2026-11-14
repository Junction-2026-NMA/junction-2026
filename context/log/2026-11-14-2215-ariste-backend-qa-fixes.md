# Backend fixes from an automated QA pass: no overdraft on simultaneous approvals, no coincidental number receipts

**Summary:** Two approvals at the same moment on the hosted site could both go through and overdraw the demo bank; that and five smaller bugs found by an automated QA pass are fixed on `fix/backend-qa`, and sisu-api must be redeployed for the hosted demo to get them.
**Author:** Aristé (Claude Code, automated QA pass, fixes for Nicholas's lanes) · **Branch:** fix/backend-qa (from main 0e37d22) · **Lane:** financial engine + agent

## Done
- Simultaneous approvals: the decision now runs inside the stored change (`lib/actions/index.ts`, `decideOn`), so a replay on top of another instance's save checks status and balance again. Approve, decline and approve-all wait for the store and answer with what was stored (409 for the loser; nothing logged twice). `tests/unit/race.test.ts` (5 tests, all fail without the fix).
- Number check: a number followed by what it counts ("25 largest companies", "40 countries") only matches a count, never a euro figure that rounds to it; Finnish period words read as time (`lib/agent/grounding.ts`). Re-checked on the saved answers: only coincidental receipts changed.
- `/api/actions/prepare` refuses amounts that are not JSON numbers (`"100"`, `[100]`, `"1e2"`).
- Standing-transfer warning subtracts the figure it prints (`lib/actions/drafts.ts`): "€100 over €80" now says €20, also on the money plan's card.
- Transactions filter refuses impossible dates such as 2026-02-31 (`lib/finance/transactions.ts`).
- A bill type (electricity, mobile, internet) can only be confirmed for a Utilities bill, not the rent (`lib/memory/index.ts`).
- Tests: 334 → 349, all pass. No type or API shape changed.

## Next / open questions
- Nicholas: review, merge and redeploy sisu-api (the phone demo forwards /api there).
- Not done (needs a live eval run): a scope rule in `lib/agent/prompt.ts` for off-topic questions (it wrote a World Cup poem), the repeated sentence after a rejected one, speech rate limits per address instead of per visitor.
