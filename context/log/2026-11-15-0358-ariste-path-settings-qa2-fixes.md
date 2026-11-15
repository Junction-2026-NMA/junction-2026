# Path, Settings and sheet QA round 2: one name per figure, shuffled follow-ups, modal sheets

**Summary:** The averages lesson is now "Weekly room in an average month" ("Estimated weekly budget" stays Today's payday figure), local follow-ups no longer put the right answer first, and every BottomSheet traps focus, makes the app behind it inert and rides up with the keyboard.
**Author:** Ariste (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/core/AppLogic/LessonPath.ts` `LessonWording`: the `safe-to-spend` card (old "Safe to spend" or new "Estimated weekly budget" from `lib/finance/teaching.ts`) is renamed to "Weekly room in an average month", including its facts, `whyWrong` and `followUp`, and its explanation ends with a note that Today's estimated weekly budget is a different figure. Figures unchanged.
- `web/core/AppLogic/LessonFollowUps.ts`: local follow-ups are shuffled by `stableOrder(n, "follow-up/<concept>")` (FNV-1a + mulberry32). The order is stable across reloads and kept attempts, and `correctIndex` and `whyWrong` move with their options. Checks: `web/core/__checks__/lessons.check.ts`.
- `web/shared/BottomSheet.tsx` + new `web/shared/sheetFocus.ts`: Tab and Shift+Tab wrap inside the topmost sheet (handled in code because Safari's Tab skips buttons). Siblings in `.sisu-root` are `inert` while the sheet is open. Focus returns to the opener, or to the last pointer press when Safari left focus on the body. Escape closes only the top sheet. With `visualViewport` showing a keyboard, the sheet lifts by the keyboard height, pads the body, and scrolls the focused field and the next primary button into view.
- `web/rive/RiveCanvas.tsx`: the canvas gets `tabIndex -1` (a runtime option too), so Rive controls have one named tab stop each.
- `--sisu-color-outline` is now green-700 (#007841, 5.2:1 on #F6F8F7). Green-filled controls (New chat, Send, the interrupt button) get a white 2 px gap.
- Lesson feedback sits in a persistent `role=status` region (`lesson.result`). After each answer the sheet scrolls no further than the top of the feedback.
- Settings: the Speak replies caption follows the switch, Play and the switches have a 44 px hit area, "Sisu answers in" stays on one line, and headings line up with the title. Onboarding: an HTML basket chip with one text size, and the voice step's Continue is full width. Gate: a wrong code gets an amber focus ring.

## Next / open questions
- `lib/finance/teaching.ts` could adopt the averages name itself, so the web rename becomes a no-op.
