# Answers final round: a monthly saving leads with the month, figures only when they match in kind, no empty card

**Summary:** "What would spending 20% less at restaurants save?" now leads with "Cutting Restaurants by 20% frees €55.30 a month / €663.60 a year", and the 5-year projection is a closed "Optional: if you keep the saving for 5 years" section (Estimate tag, no invest line).
**Author:** Ariste (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/core/AnswerPresentation.ts` and `web/core/AnswerWorking.ts`: a run_scenario impact stage leads with its monthly figure unless the question asks about years or investing, or the monthly amount is the person's own (`What if I save €50 a month?`). How shows what the saving is worked out from (the category's monthly average with See the transactions, the cut asked for). The invest line shows only when investing is asked about. When the years lead, the chart's sentence is dropped if it only repeats the card.
- "Figures behind this answer" lists a fact only when the text says it as the same kind of figure (euros, percent, count, months, kWh, c/kWh) and to the cent, or rounded when the grounding receipt names it. Bare numbers, ages ("ages 18 to 24") and years never match, so the old backend's coincidental receipts (18% share, €24.83 bill) are gone. Two labels for one amount are listed once.
- No match: "No matching options found (…)" is removed from What Sisu did, and a bracketed requirement that the card already says is removed from the assumptions. The futures legend no longer repeats the totals on the bars.
- `web/core/CoachSession.ts`: a stream that ends with nothing (no text, no done, no error) gives "Stopped before Sisu answered." with Try again.
- `web/core/ChartPresentation.ts`: past tense for Drawing, Scanning, Going through, Opening, Saving that, Researching and Running.
- Checks: `answers.check.ts` (84) and `sisutab.check.ts` (81) pass.

## Next / open questions
- The old live backend's model text can still talk about investing; only the card and details are fixed on the client.
