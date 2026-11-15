# Rework API final fixes: seasonal check, category cuts, covered weekly budget, project edits

**Summary:** A category cut is now answered per month and per year with no 5-year projection unless the question asks about the years. A weekly figure more than 3x the usual week now reads "bills before payday are covered". Editing a project's requirements recomputes its findings.
**Author:** Ariste (Claude Code) · **Branch:** feat/sisu-rework-api · **Lane:** agent + financial engine

## Done
- `lib/agent/research/requirements.ts`: "kausi" only counts at the start of a word, so "kuukausimaksua" and "kuukausihinta" plans are ranked again. `compare.ts` adds the seasonal assumption only when a non-spot seasonal offer exists. Tests are in `tests/unit/research.test.ts`.
- `lib/agent/tools/category-cut.ts` (new): `run_scenario` with category + categoryCutPct gives one calculation card (average, freed per month, freed per year) with no impact stage and no futures chart. The projection still runs when the question mentions years, the future or investing (en/fi/sv), when a horizon other than 5 is passed, or for a lump sum or target. The mock passes any years named in the question. The prompt and schema are updated.
- `lib/finance/budget.ts` `billsCovered` / `coveredText` use the same rule as Today (`left > 0 && perWeek > 3 x usual week`). For Eetu and Sanna, get_cash_flow, the customer summary, the chart and the mock now say "Bills before payday … are covered: about €X is left after them and the buffer". The card shows "Left for spending until payday", and the weekly figure stays in the working.
- `lib/watch/project.ts` `updateWatch` recomputes this watch's stored flat findings with the new requirements: housing effect and summary. The price, the limit and detectedAt stay as they were (`withCurrentRequirements` in `lib/watch/detect.ts`).

## Decisions
- `lib/types.ts` is unchanged: the covered flag is computed in the backend and is not a new contract field.

## Next / open questions
- The real model's run_scenario calls should be checked against the live backend after the redeploy.
