# Today QA round 2: honest transaction totals, a credible weekly budget headline, 44 px targets

**Summary:** Today no longer shows a net figure as "payments", and a weekly budget more than 3x the usual pace now reads "Bills before payday are covered" (the full figure stays in the maths sheet).
**Author:** Ariste (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/core/AppLogic/AppPresenters.ts` `transactionsTotal` now returns `{ headline, detail }`, split by sign: only spending gives "€X in N payments", a mix gives "Spent €X · received €Y" plus "N transactions", and a cut list (fewer rows than `count`) gives only "N transactions". It never uses the API's net `total`. Used by `web/features/Sheets/TransactionsSheet.tsx`.
- `web/core/AppLogic/WeeklyBudget.ts`: added `WeeklyBudget.covered` (weekly > 3x usual weekly everyday spending, money left) and `WeeklyBudgetText.headline`. `MoneyOverview.tsx` renders the result. Sanna: "About €25,964 left after bills and the assumed buffer · you usually spend about €24 a week on everyday things". Eetu is covered too; Aino still gets a weekly figure.
- How this is worked out: the weeks row value is now "÷ 2.1 weeks", with the caption "15 days to 15 Oct 2026 (15 ÷ 7)".
- Buffer sheet: Save now sits directly under the field, and the sheet opens at the large detent when the window is under 740 px tall. The preset chips, the "How this is worked out" link and the buffer chip are now 44 px tall.
- Today scroller: a 16 px top mask fade (`.sisu-today-screen`), so text fades out under "Hei <name>" instead of being cut off.

## Next / open questions
- The backend's weekly-budget wording (`lib/finance/budget.ts`) can adopt the same "covered" rule later.
