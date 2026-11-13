# UI reference research completion

Source: <t3-thread://v2/699bd055-6afa-4ddf-9c94-4b70358a24dd/thread:provider:claudeAgent:native-thread:provider-thread%3Aprovider%3AclaudeAgent%3Anative-thread%3Apending%253Arun%253Athread%253A9bd03a63-a893-442d-9b8e-8004ddd29fa7%253Aordinal%253A1%3Aaf90024968b6a6ccb>

Source updated: 2026-11-13T20:11:11.283Z. Coverage: completion handoff. Tool traces are omitted.

Historical record. Later user corrections and current repository instructions take precedence. Local project links point at the verified asset commit; personal emails are redacted. Older completion claims are preserved as history, not independent proof.

## Assistant · 2026-11-13T20:11:11.280Z

<tools-used-before-summary>Write, mcp__claude_ai_Appllama__get_app, mcp__claude_ai_Appllama__list_app_screens, mcp__claude_ai_Appllama__search_apps, mcp__claude_ai_Appllama__search_screens</tools-used-before-summary>

The references are collected and written up: 90 screens kept out of about 190 downloaded and viewed. All 90 paths in the document resolve to files on disk.

## Files written

- `https://github.com/Junction-2026-NMA/junction-2026/blob/0b58ea220fb93bd1dc0f19178afb23567ef57065/research/ui-references.md`
- `https://github.com/Junction-2026-NMA/junction-2026/blob/0b58ea220fb93bd1dc0f19178afb23567ef57065/references/ui/<app-slug>/NN-name.webp` — 90 images in 25 app folders, 40 MB, all 1170 x 2532 px.

Three things to know:
- **Git:** I ran one `git status --short` by mistake at the end of a check, against your instruction. It is read-only and changed nothing.
- **Vault:** I did not update the Obsidian note `Projects/s-banking.md`, because you said to touch no other file. It should get a line saying the UI references are done and where they live.
- **No videos saved:** the only videos offered were welcome and onboarding recordings; I did not download any.

## Apps and screens kept

| Group | App (slug) | Kept |
|---|---|---|
| Money | MunYun (`munyun`) | 13 |
| Money | Buddy (`buddy`) | 9 |
| Money | EveryDollar (`everydollar`) | 7 |
| Money | Finrise (`finrise`) | 6 |
| Money | Spendee (`spendee`) | 4 |
| Money | Subpilot (`subpilot`) | 3 |
| Money | Copilot (`copilot`) | 1 |
| Gamification | Duolingo (`duolingo`) | 11 |
| Gamification | Finch (`finch`) | 9 |
| Gamification | BePresent (`bepresent`) | 7 |
| Gamification | Airlearn (`airlearn`) | 5 |
| Gamification | Stimuler (`stimuler`) | 2 |
| Single screens | `rootd`, `gococo`, `iq-masters`, `lingodeer`, `monoboost`, `fidelity`, `quit`, `knowt`, `impulse`, `genk`, `coopah`, `reflectly`, `monefy` | 1 each (13) |

- **Fleur** was walked and dropped: its pastel, script-type look pulls away from the brand direction.
- **Paywall:** only one example kept (`munyun/13-paywall-super-benefits.webp`).
- **Gaps in the library:** no good savings-goal list with several goals, no weekly spending recap, and no playful beginner-investing flow. Those screens have to be designed from the patterns, not from a reference.

## Top 15

All paths are under `https://github.com/Junction-2026-NMA/junction-2026/blob/0b58ea220fb93bd1dc0f19178afb23567ef57065/references/ui/`.

1. `duolingo/09-learning-path.webp` — the model lesson path: 3D nodes, one next step, status row, mascot beside it.
2. `munyun/05-learning-path-lesson-popup.webp` — the same path applied to finance, with the popup that starts a lesson.
3. `everydollar/02-home-goal-dashboard.webp` — closest to our home: green header, greeting, savings goal as first card with pace and date.
4. `munyun/09-streak-celebration.webp` — the cleanest streak moment: flame, huge number, week strip, one button.
5. `finch/04-home-pet-room.webp` — a mascot that lives on home, with energy earned from today's actions.
6. `bepresent/03-home-daily-quests.webp` — streak and XP pills plus a daily checklist, in a "cut a habit" product.
7. `buddy/07-budget-home-gauge.webp` — "left to spend" as one large gauge.
8. `duolingo/07-first-word-learned.webp` — correct-answer sheet combined with a "first time" sticker.
9. `munyun/02-onboarding-goal-quiz.webp` — a quiz where the mascot answers back.
10. `buddy/02-quiz-stress-slider.webp` — asks how money feels; the right first question for this persona.
11. `munyun/10-daily-missions-update.webp` — missions with thick bars and chests.
12. `rootd/01-streak-celebration-green.webp` — a celebration on a full green screen with a mascot.
13. `finch/06-task-complete-confetti.webp` — the small celebration that does not interrupt.
14. `quit/01-savings-milestones.webp` — money saved per week, month and year with milestones.
15. `everydollar/05-budget-remaining-donut.webp` — a spending ring that leads with what remains.

## Main visual-language findings

- **Two green families.**
  - Lime: Duolingo `#58CC02`, BePresent `#57C92E`.
  - Emerald: Spendee `#14C78F`, Finrise `#00B679`, MunYun `#00C850`.
  - In between: EveryDollar `#35BD59`, Finch `#4CAF50`.
  - If S-Pankki's green lands near `#58CC02`, the pairing has to do the work of not looking like Duolingo.
- **Pairings.** EveryDollar's green with navy `#003561` is the most distinctive. Green with black buttons reads younger. Green with yellow `#FFC800` and orange `#FF9600` is the Duolingo look.
- **Pale green tint.** Every playful app uses a pale tint of its green for selected rows and success sheets (`#D7FFB8`, `#E8FDF4`, `#ECFAE5`).
- **Fixed colour meanings.** Orange flame for streaks, gold for coins and XP, blue for gems and freezes, red or pink for errors and hearts, purple for premium. Keeping streaks orange leaves green free to mean money and progress.
- **Type.** Rounded, heavy sans faces; bold to extra-bold headlines; no thin weights. Numbers are the largest element on their screens: streak count about 80–120 pt, key money figure about 32–40 pt. These sizes are my estimates from the screenshots.
- **Buttons.** Duolingo and MunYun use a flat face with a 4 pt darker bottom edge, about 48–50 pt tall. The same edge is on lesson nodes, option cards and header cards, so everything looks pressable. The alternative is a full pill (Buddy, BePresent, Airlearn). Labels carry meaning: "I'm committed", "Claim 27 XP".
- **Radii.** Buttons 12–16 pt or full pill, cards 16–24 pt, sheets 24–32 pt, progress bars fully rounded and 12–16 pt thick. Nothing is square.
- **Cards.** Three styles: white with a 2 pt grey outline and no shadow (most playful), white with a soft shadow on light grey, or a solid colour block. A coloured header overlapped by the first white card is common on home screens.
- **Mascots.** Flat vector, simple body, large eyes, almost no outline; emotion comes from eyes, brows and arms. They speak in short first-person speech bubbles and are the ones who ask for notifications and commitment.
- **Motion.** Read from stills: confetti, light rays behind a reveal, sparkles, press-down buttons, bars filling to the new value, feedback sheets rising from the bottom.

## Credits

- **Start:** 1,500 remaining (0 used).
- **End:** 1,433 remaining (67 used on the account).
- **My calls:** 60, against the 220 budget. The other 7 credits left the shared balance early in the session without a matching call from me, probably another session on the same account.
