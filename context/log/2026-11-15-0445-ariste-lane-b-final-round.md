# Final fix round, lane B: buffer cap, sheet Tab trap, project errors, basket labels, lesson feedback

**Summary:** Every buffer field now stops at €100,000 (the server's limit), Tab no longer sticks on a closed "Demo controls", and project failures show where the person is looking.
**Author:** Ariste (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- One buffer rule and message for Settings and Today's buffer sheet: `WeeklyBudget.parseBuffer`, `maxBufferEur`, `bufferInputError` (web/core/AppLogic/WeeklyBudget.ts). Settings used to accept up to 1,000,000, which made every Sisu question fail with a 400 error.
- `web/shared/sheetFocus.ts`: `tabbables()` leaves out what a closed `<details>` hides (its summary stays). `openerOf()` prefers a fresh tap on another control, so WebKit returns focus to Settings and not to the control an earlier sheet left focused. A key press forgets the last tap.
- Projects: a failed Check now is kept as the watch's notice, under the buttons and scrolled above the tab bar (`ProjectStore.checkNow`, `ProjectScreen`). A failed `GET /api/watch` sets `listFailed`. The drawer then says "Sisu could not load your projects.", shows Retry and keeps the hint.
- Today: basket labels wrap between words only (no `hyphens: auto`). Their type follows the row width through container units, from 17 px down to 12 px.
- Path: the opening "Not quite:" is removed from the backend's whyWrong texts, and the follow-up hint no longer says "Not quite" (`LessonFollowUps.withoutOpener`).
- Checks: today.check.ts (buffer rule), projects.check.ts (Check now notice, list failure and Retry), lessons.check.ts (one "Not quite", closed-details rule).

## Next / open questions
- A buffer above €100,000 that was already stored still goes out with questions. Settings now shows the error, but CoachSession.validBuffer (in another lane) should also drop or clamp an out-of-range value.
