# Overnight backend build, part 1: receipts, approval-gated actions, memory and autonomous investigation

**Summary:** The agent now has 11 tools, every number it says is checked against receipts, actions need an approval call, and `POST /api/agent/investigate` runs a whole case on its own. All additive: nothing in `lib/types.ts` changed shape and no UI file was touched.
**Author:** Nicholas (Claude Code, overnight) · **Branch:** `overnight/fable-lead` (local only, not pushed) · **Lane:** agent (plus the unowned finance/actions lane, see Decisions)

## Done
- Baseline measured before any change: `tests/gauntlet/results/baseline-latency.json` (36 turns, 0 errors; first sentence 0.40 s from the summary, 1.2–1.4 s with one tool).
- New tools in `lib/agent/tools/`: `list_bills`, `get_cash_flow`, `find_patterns`, `check_affordability`, `explain_concept`, `prepare_action`, `remember` (plus the existing four).
- New finance code: `lib/finance/patterns.ts`, `cashflow.ts`, `affordability.ts`, `teaching.ts`, `facts.ts`.
- Receipts and the number verifier: `lib/agent/grounding.ts`. Each turn ends with a `grounding` event listing every number said and its source.
- Actions, audit and memory: `lib/actions/`, `lib/store/`, `lib/memory/`, with routes under `app/api/actions`, `app/api/memory`, `app/api/audit`, `app/api/demo/reset`.
- `GET /api/health` asks the model server which model it serves (for judges). `GET /api/coach/*` gives patterns, cash flow, teaching cards and affordability without the model.

## Decisions
- Lane B (finance engine, actions) has no owner yet, so this branch built `app/api/actions`, `app/api/demo` and new files in `lib/finance/`. Existing finance files are unchanged except `transactions.ts` (one new exported function). Affects: whoever takes lane B.
- State is one JSON file (`.sisu/state.json`, gitignored) behind three functions in `lib/store/state.ts`. The build plan names Postgres; swap there if needed. On a read-only host it falls back to memory and `/api/health` says so.
- The model has no tool that approves anything. Approval is only `POST /api/actions/:id/approve` with `confirm: true`.
- `lib/types.ts` gained types at the bottom (additive). `package.json` gained `tsx` (dev) and `npm test`.

## Learned / gotchas
- The synthetic data has no real subscriptions (merchant IDs do not repeat monthly), so "hidden subscription" detection would find nothing honest. Real patterns that do exist: bills up about 10% on a year ago, a category growing fast, below zero in 6 of 12 months, spending bunched after payday.
- The number verifier caught the model adding two findings into a wrong total on its first run. Tool output now says not to add findings up.
- Log entries before this one carry times about two hours ahead of the commit clock. This one uses the real Helsinki time.

## Next / open questions
- Unit tests, live evaluation set, latency p50/p95 after the change, docs in `docs/`.
- Not pushed: needs Nicholas's OK.
