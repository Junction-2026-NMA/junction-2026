# Housing and Exa recording questions

**Summary:** Housing approval/findings and supported electricity comparisons are fixed in source; the backend deployment is blocked by missing access.
**Author:** Codex · **Branch:** feat/web-port · **Lane:** frontend + agent + financial engine (user's demo brief)

## Done
- Clear demo intents run their first tool in code; rent affordability and saved findings answer from financial/session data. Aino's break-even rent is €649.53; her chosen €700 search limit stays separate.
- Housing simulation respects saved requirements, is repeatable and labelled “Simulated monitoring update”; source-only watches remain honest when extraction fails. Approval refresh, project findings and an in-app finding banner are fixed.
- Electricity needs customer-stated yearly kWh/current energy tariff/fee before savings or approval; answer and action use the same calculation. Official-source tenancy research stays conditional. Both existing lessons retain Path progression.
- Checks: 492 unit tests, 1,420 web assertions, TypeScript and build passed; lint has zero errors and two existing unused-parameter warnings. Local HTTP flow passed approval → project → trigger → saved answer and supported simulated switch.

## Learned / gotchas
- Live Exa/Context calls returned 36 flats (none fit), 15 electricity offers and official rental sources. These are actual retrieved results, separate from mock HTTP proof.
- Both sequences were run on sisu-demo with Aino. Its older backend contradicts affordability access, omits the finding source and returns conflicting electricity savings after tariff input. No recording-ready claim.
- sisu-demo forwards /api to sisu-api. This account can deploy only the frontend; the secure backend credential request was declined. Backend fixes remain unapplied there.

## Next / open questions
- Backend owner deploys this source to sisu-api; then repeat both live sequences. Phone push was deliberately left out; no new scheduling/editing options.
