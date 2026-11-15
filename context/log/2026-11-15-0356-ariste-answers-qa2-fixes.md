# Answers QA round 2: requirements from the question, one result per bill, transfers worded as transfers, each number once

**Summary:** When the backend sends no requirements (the hosted old backend), the web app reads "N months or less / at most / up to / max N months" from the question and judges each offer itself, so a 24-month contract is never "Best match" after "12 months or less" and the answer shows "No matching options found".
**Author:** Ariste (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/core/AnswerRequirements.ts`: the question's contract limit, offers judged like `lib/agent/research/requirements.ts` (length not stated = a miss), best chosen like `compare.ts`. Only used when the research has no `requirements`/`requirementsText`. `OfferPresenter.textSaysNoMatch` also knows the live sentences ("are all 24-month contracts, not…", "None of the offers I found have…", "There are no … contracts of…"); offers judged against stated requirements outweigh the words.
- `web/core/AnswerOffers.ts`: stages grouped per bill (tool call id). The result's value and "With …" come from one bill (the largest saving when several); "Offers compared" has one section per bill with its own bill now (`Offers.tsx`).
- `web/core/AnswerWorking.ts`: a step, summary or tool line that only repeats a number already said is left out; an answer without a calculation gets "Figures behind this answer" from the grounding facts the text uses.
- `web/core/AnswerText.ts` (split from AnswerPresentation, re-exported): `€2010.63` → `€2,010.63`, `1220.35 euros` → `€1,220.35`, `2026-09` → `Sep 2026`; LessonWording applied to titles, steps, assumptions; peer facts or "people your age" add the "Synthetic demo data comparison" tag.
- Actions: a one-off transfer reads `€50 to your savings`, "Simulated, no money moved", "What a real transfer takes"; a switch's 5-year bars sit behind a closed "If you keep the saving for 5 years" without the invest line.
- Steps: finished labels in the past tense; a reused search shows "reused results from HH:MM" instead of two durations. Fees: without the backend's flag, an electricity saving is incomplete only when the base fee is missing (setup fee still shown as unknown). Badge: "1 number has a source". Send, field and "See the transactions" are 44 px tall.
- Checks: `web/core/__checks__/answers.check.ts` (live sentences and streams), `core-b.check.ts` (transfer tag).

## Next / open questions
- The real fix for item 1 is still the backend redeploy (requirements on the tool and offers); the client inference only covers contract length.
