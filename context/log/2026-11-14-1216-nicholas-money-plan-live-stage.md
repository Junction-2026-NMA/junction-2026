# The money plan: one tap, Sisu works on screen, one approval

**Summary:** A new page, `/plan`, shows Sisu reading the account, searching the web with Exa, reading pages with Context.dev and adding it up, live, then one "Approve all". It is the demo's wow moment and uses only real steps.
**Author:** Nicholas (Claude Code) · **Branch:** `overnight/fable-lead` (pull request 2) · **Lane:** agent, plus a new page in `app/plan/` (no existing screen was changed)

## Done
- `lib/agent/plan.ts` and `POST /api/agent/plan`: a stream of `PlanEvent`s, one per real step. Types at the bottom of `lib/types.ts`.
- `POST /api/actions/approve-all`: approves a list of actions with `confirm: true`; each is logged on its own.
- `app/plan/`: `page.tsx`, `Stage.tsx` (three acts: account, web, sums), `PlanCard.tsx`, `usePlan.ts` (plays events in order with short pauses), `plan.css`.
- Research: `startWatchedResearch` reports pages as they are found and read; a 10-minute page cache in `contextdev.ts`.
- Live: Aino €1,622 a year (€108 needs nothing from her), Eetu €5,608 (€853), Sanna €485 (€312). 5.7 to 7.6 s with fresh searches. 235 unit tests pass.

## Decisions
- The total is split everywhere into "needs nothing from you" (switches) and "needs spending to come down" (habits). Affects: frontend must keep that split visible; do not show the total alone.
- Habits become one payday transfer to savings, with the existing warning when the month has no room for it.
- Two patterns about the same category count once, at the smaller figure.
- The summary is worded by Nemotron and checked by code; if a number does not match, code words it.

## Learned / gotchas
- **Context.dev allows our key 10 page reads a minute.** Nine at once got 429s. A plan now reads at most 7 pages and reuses any page read in the last 10 minutes (shown as "read N min ago").
- A new export in a module the dev server already had loaded was "not a function" until the server was restarted.
- Geist Mono spaces the thousands comma wide; big totals use the sans face with tabular figures.

## Next / open
- Start the plan by voice ("Sisu, sort out my money") from the main screen.
- For internet and mobile the cheapest plan may be smaller than the customer's; Sisu says so but cannot compare like for like.
- The best customer to demo is Eetu: the largest "needs nothing from you" figure.
