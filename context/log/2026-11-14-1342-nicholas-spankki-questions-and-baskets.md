# S-Pankki's own example questions now answer correctly, and the three baskets are drawn

**Summary:** Asked the brief's example questions of the live agent. Two were wrong and are fixed; the three baskets now have a chart and appear in advice, the lesson and the money plan; the plan's total is split three ways.
**Author:** Nicholas (Claude Code) · **Branch:** `agent/spankki-questions` (from `main` after pull request 3) · **Lane:** agent, plus `app/visuals/` and `app/plan/`

## Done
- `run_scenario` takes `category` and `categoryCutPct`: code takes the percentage of the 12-month average (`lib/finance/categories.ts`). "Reduce dining out by 20%" is €55 a month for Aino; the model had said €252 from one unusual month.
- New chart `basket_bar` (`basketsVisual`, `app/visuals/Baskets.tsx`): `show_chart` with `baskets`, attached to advice, and revealed after the three-baskets lesson is answered (`TeachingCard.revealVisual`).
- `find_patterns` gives the model the three baskets, so "what kind of spender am I?" starts from them.
- Money plan: `scan.baskets`; `PlanItem.needs` gained `check-plan`; `checkPlanYearlyEur` on the plan and the `calc` event. Only electricity switches are "needs nothing".
- 251 unit tests pass.

## Decisions
- A cheaper internet or mobile plan is not counted as free money: Sisu cannot see the customer's current speed or data. Affects: frontend shows three parts of the total, not two.
- The three-baskets lesson still asks before it tells; the chart is held back until the customer has guessed.

## Learned / gotchas
- Asked for "20% of dining out", the model reached for last month. The fix was a tool input, not a prompt line: the euros are now worked out in code from the average.
- Judging criteria are in `context/junction-challenges-verbatim.md` on the `backend` branch (not yet on `main`).

## Next / open
- Still to do from the gap list: a ready-for-demo check page, starting the plan by voice with narration, price changes over time (Context.dev scores "reacts to change"), and a real decision for Nemotron inside the plan.
- The three baskets on the plan's scanning step were not seen on screen (the in-app preview pauses timers); check it in a normal browser.
