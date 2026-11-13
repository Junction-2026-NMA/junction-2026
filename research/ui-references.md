# UI references (Appllama)

Collected 2026-11-13 for the S-Pankki "Personal Economic Trainer" app (Junction 2026).

## How to read this

- **Source.** Every screen here comes from the Appllama design library (real iOS apps, captured as screenshots). 90 screens were kept out of about 190 downloaded and looked at.
- **Reference only.** Study the pattern, never copy a screen. No layout, illustration, mascot, copy or icon may be reproduced. Each image carries a small Appllama watermark in the top-left corner: it is provenance, not design, and must never appear in anything we make.
- **How they were chosen.** Twelve apps were walked in depth: seven money apps (budgeting, spending insight, finance lessons) and five gamification benchmarks (Duolingo, a pet app, streak-driven apps). Thirteen single screens from other apps fill gaps the walks left (streak repair, badges, level-up, AI coach, green dashboards). A screen was kept only if it shows a pattern this product needs: onboarding quiz, home, spending insight, budgets, goals, streaks, lessons, celebrations, mascot moments, achievements, notifications.
- **Paths** are relative to the project root. All files are `.webp`, 1170 x 2532 px (iPhone, 3x).
- **Figures** are the library's estimates: revenue is USD per month as of 2026-10-01; the library does not state the period for its download figure. "n/a" means the library resolved no number.
- **Sizes in points** are estimates measured from the screenshots (1170 px wide = 390 pt), not values from a spec.

Gaps worth knowing: the library had no strong savings-goal list (several goals with progress), no weekly "spending recap" story, and no beginner investing flow in a playful style. Those screens must be designed from the patterns below, not from a reference.

---

## Money apps

### MunYun: Trading Lessons (`munyun`)

Duolingo-style lessons for trading and investing: a coin mascot with a top hat, a lesson path, streaks, gems, daily and monthly missions, leagues.
Figures: revenue n/a, downloads 1K, rating 4.75 (170 ratings), launched 2025-10-21.
Why it is here: the closest thing to "Duolingo for money" in the library. It shows the whole loop (quiz, path, lesson, feedback, reward, streak, mission, league) applied to finance content.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/munyun/01-welcome.webp` | Welcome | Mascot with floating money objects above the name, one promise line, a filled primary button and an outlined "I already have an account" button. | "Achieve financial freedom" is an over-promise; ours should promise something small and true. |
| `references/ui/munyun/02-onboarding-goal-quiz.webp` | Onboarding quiz | The mascot's speech bubble reacts to the chosen answer ("Smart move!"), and the selected card turns mint with a green outline. | Options about trading as income; ours are saving, cutting costs, first investment. |
| `references/ui/munyun/03-daily-practice-commitment.webp` | Goal setting | Four time options, each tagged with an intensity word (casual, regular, serious, intense) on the right. | |
| `references/ui/munyun/04-notification-priming.webp` | Notification opt-in | A mock of the system dialog with an arrow on "Allow", shown before the real prompt, with the mascot explaining why. | |
| `references/ui/munyun/05-learning-path-lesson-popup.webp` | Lesson path | Winding path of square 3D tiles; tapping one opens a popup with lesson title, "Lesson 1 of 7" and a Start button; a status row (course, streak, gems) sits on top. | Grey human characters beside the path add noise. |
| `references/ui/munyun/06-quiz-correct-feedback.webp` | Lesson feedback | The bottom sheet turns pale green with a check, a one-line reason, and a green button. | |
| `references/ui/munyun/07-quiz-incorrect-feedback.webp` | Lesson feedback | Same sheet in pale red; it explains the right answer instead of only saying "wrong". | |
| `references/ui/munyun/08-lesson-complete.webp` | Celebration | Proud mascot, coloured headline, three stat tiles (accuracy, time, XP), and the button names the reward ("Claim 27 XP"). | |
| `references/ui/munyun/09-streak-celebration.webp` | Streak | Large flame, a huge number, "day streak", a seven-day strip with today ticked. | |
| `references/ui/munyun/10-daily-missions-update.webp` | Missions | Three missions with thick progress bars and a chest per mission; the button says "Open chest". | |
| `references/ui/munyun/11-monthly-mission-dashboard.webp` | Missions hub | Coloured month header with countdown, one monthly goal, a friend mission, then daily missions. | Three mission layers at once is heavy for a first version. |
| `references/ui/munyun/12-league-leaderboard.webp` | Leaderboard | Own row highlighted in mint, a "Promotion zone" divider, league medals on top. | Never rank people by money; rank by XP or streak only. |
| `references/ui/munyun/13-paywall-super-benefits.webp` | Paywall (example 1 of 1) | Mascot in a cape on a dark background, three benefit rows, one button. Useful as a layout for a "linked to your S-Pankki account" benefits page. | We have no paywall. |

### Buddy: Budget Planner App (`buddy`)

Swedish budgeting app (Buddy Budgeting AB): monthly plan, "left to spend", shared budgets.
Figures: revenue $50K, downloads 5K, rating 4.71 (9,607), Finance rank 79.
Why it is here: the best emotional onboarding quiz of the money apps, and a clear "what is left" budget view.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/buddy/01-welcome.webp` | Welcome | A warm hero (a dog photo on pink), a three-line promise, two proof badges, one dark pill button. | Stock photo in place of a mascot; emoji inside headlines. |
| `references/ui/buddy/02-quiz-stress-slider.webp` | Onboarding quiz | "How stressed do you feel about money?" as a slider whose emoji and caption change as it moves. | |
| `references/ui/buddy/03-quiz-social-proof.webp` | Onboarding quiz | Right after a hard question, a "You're not alone" screen with a crowd pictogram and two statistics. | US statistics; ours need Finnish sources. |
| `references/ui/buddy/04-spending-clarity-donut.webp` | Onboarding preview | Shows the result before asking for work: a sample spending ring with categories under "From now on it will be crystal clear". | |
| `references/ui/buddy/05-quiz-subscription-tip.webp` | Onboarding quiz | A question about unused subscriptions with a dashed tip card at the bottom giving one fact. | |
| `references/ui/buddy/06-budget-setup-complete.webp` | Celebration | Confetti over the finished budget summary with "You're all set up!", so the reward is the thing the user just built. | |
| `references/ui/buddy/07-budget-home-gauge.webp` | Budget home | One large arc with an icon and "left to spend" in the middle, on a full-colour header. | The widget promo directly under the gauge competes with it. |
| `references/ui/buddy/08-budget-overview-donut.webp` | Budget plan | Small ring plus "left to budget", then category rows with percentages and dotted leaders. | |
| `references/ui/buddy/09-budget-remaining-by-category.webp` | Category view | Each category as a round icon with a thin progress ring and "$10 left" under it. | Tiny uppercase labels are hard to read. |

### EveryDollar: Budget Management (`everydollar`)

Zero-based monthly budget from Ramsey Solutions, with one savings goal on the home screen.
Figures: revenue $100K, downloads 50K, rating 4.73 (84,192), Finance rank 95.
Why it is here: a green-led finance app. It shows how a strong green header, white cards and navy text hold together.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/everydollar/01-money-goals-quiz.webp` | Onboarding quiz | "Let's set your money goals" as a grid of icon tiles with checkboxes, multi-select, plus "Add custom goal". | Thin outlined tiles look like a form. |
| `references/ui/everydollar/02-home-goal-dashboard.webp` | Home | Green header with a greeting; the first card is the goal: amount saved, a bar, and two tiles ("$365 monthly toward goal", "11 months to completion"). | The premium upsell card as second item. |
| `references/ui/everydollar/03-home-budget-summary.webp` | Home / insight | One stacked bar for the whole month with a short legend of the top categories and their share. | |
| `references/ui/everydollar/04-budget-planned.webp` | Budget | Planned / Spent / Remaining as three tabs over the same list, with a status banner on top. | Dense rows; too bank-like for our tone. |
| `references/ui/everydollar/05-budget-remaining-donut.webp` | Spending insight | Ring with "Remaining $950" in the centre and the same three tabs under it. | |
| `references/ui/everydollar/06-savings-goal-edit.webp` | Savings goal | Goal sheet: illustration, name, saved amount, bar from current to target, three plain fields. | |
| `references/ui/everydollar/07-month-close.webp` | Review | A "month close" card that invites a review of the month and what to learn for the next one. | |

### Spendee (`spendee`)

Expense tracker with wallets, category budgets and analytics.
Figures: revenue $5K, downloads 5K, rating 4.61 (6,262), Finance rank 124.
Why it is here: clean chart screens with a green action colour.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/spendee/01-goal-success-proof.webp` | Onboarding proof | One simple chart ("with" versus "without") and one number, then a green button. | Unsourced success rates. |
| `references/ui/spendee/02-expense-breakdown.webp` | Spending insight | Ring with category icons sitting on the segments and percentages beside them; week / month / year switch under it. | |
| `references/ui/spendee/03-budgets-list.webp` | Budgets | Active budgets show spent of limit with a thin bar; categories without a budget show a "Set" pill. | |
| `references/ui/spendee/04-category-budget-detail.webp` | Budget detail | A dashed limit line and a projected line: "at this pace you end here". | Small grey axis text. |

### Subpilot (`subpilot`)

Finds and cancels subscriptions, with a simple spending view.
Figures: revenue $50K, downloads 5K, rating 4.56 (5,871), Finance rank 21, launched 2025-09-14.
Why it is here: it is about cutting avoidable spending, which is our core promise.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/subpilot/01-spending-intro.webp` | Feature intro | Headline as a question with one highlighted word ("Where does your money actually go?"). | Bank logos as decoration. |
| `references/ui/subpilot/02-category-breakdown.webp` | Spending insight | Three bars on top (income, expenses, left), then a ring, then expandable categories. | Dark theme; floating plus and minus buttons over content. |
| `references/ui/subpilot/03-home-overview.webp` | Home | Count of subscriptions with cost per month and per year, then "Up next" cards with a Cancel button on each. | |

### Finrise (`finrise`)

Stock-market lessons as a 28-day challenge with quizzes and a simulator.
Figures: revenue $50K, downloads 5K, rating 4.75 (1,723), Education rank 84, launched 2026-06-16.
Why it is here: the lesson format (read, question, hint, why, reward) is more explanatory than Duolingo's and suits money topics.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/finrise/01-what-you-learned.webp` | Lesson recap | A "What you learned" list in plain sentences at the end of a block. | A long text block with no icons. |
| `references/ui/finrise/02-learning-path.webp` | Lesson path | A named challenge with day dividers ("Day 2, 0/5") and the reward shown beside the next node. | Blue as lead colour. |
| `references/ui/finrise/03-lesson-article.webp` | Lesson | Short lesson: one illustration, a five-word title, five lines of text, a top progress bar and a coin counter. | Realistic illustration style. |
| `references/ui/finrise/04-quiz-hint.webp` | Lesson | "Give me a hint" opens an orange sheet with one sentence. | |
| `references/ui/finrise/05-quiz-explanation.webp` | Lesson feedback | After a correct answer, a "Why?" card explains the reasoning in two sentences. | |
| `references/ui/finrise/06-lesson-complete.webp` | Celebration | A check badge, the reward in a card, "Continue learning" and "Done" as two clear exits. | Generic check icon; a mascot would do more. |

### Copilot (`copilot`)

Premium budgeting app; the library holds only its onboarding.
Figures: revenue $100K, downloads 1K, rating 4.75 (30,821), Finance rank 7.
Why it is here: one screen, for how it asks for notifications.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/copilot/01-notification-preferences.webp` | Notification opt-in | Each notification type is a card with a sample alert and its own switch, so the user chooses what to receive. | Grey-on-grey, quiet style. |

Fleur (pink planner-style budget app, revenue $50K) was also walked; nothing was kept because its pastel, script-type look pulls away from our direction.

---

## Gamification benchmarks

### Duolingo (`duolingo`)

Language lessons; the reference for streaks, mascot and lesson path.
Figures: revenue $10M, downloads 1M, rating 4.72 (5.5M ratings), Education rank 1.
Why it is here: the interaction model the brief names. Its brand green is the best-known green in apps, so ours has to be clearly different in shade and pairing.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/duolingo/01-splash.webp` | Splash | Full-bleed brand green with only the mascot's face and the wordmark. | |
| `references/ui/duolingo/02-welcome.webp` | Welcome | Mascot, wordmark, five-word promise, two buttons; nothing else. | |
| `references/ui/duolingo/03-mascot-intro.webp` | Mascot moment | The mascot introduces itself in a speech bubble on an empty screen with one button. | |
| `references/ui/duolingo/04-motivation-quiz.webp` | Onboarding quiz | Rows with a colour icon, a label and a checkbox; the selected row turns blue; a progress bar on top; the mascot comments. | |
| `references/ui/duolingo/05-daily-goal-commitment.webp` | Goal setting | The button says "I'm committed" instead of "Continue". | |
| `references/ui/duolingo/06-notification-priming.webp` | Notification opt-in | A faded copy of the system dialog with an arrow on "Allow"; the button says "Remind me to practice". | |
| `references/ui/duolingo/07-first-word-learned.webp` | Celebration | A large outlined sticker ("First word learned") over the task, with the green feedback sheet. | |
| `references/ui/duolingo/08-lesson-complete.webp` | Celebration | "Way to go!" and a jumping mascot, nothing else on the screen. | |
| `references/ui/duolingo/09-learning-path.webp` | Lesson path / home | Round 3D nodes with a progress ring on the current one, a "Continue" tag, a unit header card, a status row (streak, gems, energy), and the mascot beside the path. | Energy as a paid limit on learning. |
| `references/ui/duolingo/10-streak-overview.webp` | Streak | Orange streak header, a month calendar, "days practiced" and "freezes used" tiles, Personal and Friends tabs. | |
| `references/ui/duolingo/11-quests.webp` | Missions | A friends quest and a daily quest with bars and chests; upcoming quests shown as locked. | |

### Finch: Self-Care Pet (`finch`)

A habit app where daily goals feed a small bird that grows and goes on adventures.
Figures: revenue $1M, downloads 100K, rating 4.95 (770,035), Health & Fitness rank 14.
Why it is here: the best example of a mascot the user cares for. The pet has a name, a room, energy and traits.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/finch/01-egg-selection.webp` | Onboarding | The user picks an egg before anything else, so the mascot is theirs. | |
| `references/ui/finch/02-hatch-success.webp` | Mascot moment | A light burst behind the new pet and one line of text. | |
| `references/ui/finch/03-trait-quiz.webp` | Onboarding quiz | "Choose a trait" for the pet: the quiz is about the mascot, which lowers the pressure. | |
| `references/ui/finch/04-home-pet-room.webp` | Home | Top third is the pet in its room; under it an energy bar ("0 / 15") and today's goals as rows with a tick button. | Dark teal background makes it feel like a game, not a bank product. |
| `references/ui/finch/05-goals-list.webp` | Daily check-in | Each row shows the reward (5 energy) beside the tick button. | |
| `references/ui/finch/06-task-complete-confetti.webp` | Celebration | Confetti in place and a short toast from the pet ("Hooray! First time completion!"); the user stays on the list. | |
| `references/ui/finch/07-goal-reward-popup.webp` | Check-in detail | A focused card for one goal with Skip, Complete and Snooze. | |
| `references/ui/finch/08-daily-quests.webp` | Missions | Daily quests on a vertical timeline with icon tiles and small bars. | |
| `references/ui/finch/09-pet-profile.webp` | Profile | The pet has a passport-style card: name, streak, collection, traits. | |

### Airlearn (`airlearn`)

Language lessons with a cat mascot, streaks, leagues and a shared "Buddy Streak".
Figures: revenue $100K, downloads 100K, rating 4.82 (47,542), Education rank 124.
Why it is here: a recent Duolingo-like app with its own streak ideas.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/airlearn/01-streak-celebration.webp` | Streak | The number sits inside the flame; under it a week strip, a widget prompt with the mascot, and Share / Next lesson. | Four calls to action on one screen. |
| `references/ui/airlearn/02-streak-calendar.webp` | Streak | Calendar where streak days carry the flame and frozen days carry a different mark. | |
| `references/ui/airlearn/03-league-leaderboard.webp` | Leaderboard | A small "this week versus last week" chart above the ranking; own row outlined in green. | |
| `references/ui/airlearn/04-buddy-streak-intro.webp` | Social | Intro to a streak shared with one friend, shown as two example notifications on a phone. | |
| `references/ui/airlearn/05-buddy-streak-profile.webp` | Profile | The mascot in costume as the profile hero, with the streak above it. | |

### BePresent (`bepresent`)

Screen-time app: focus sessions earn XP, streaks, leagues and real-world rewards.
Figures: revenue $500K, downloads 100K, rating 4.84 (71,181), Productivity rank 57.
Why it is here: it gamifies cutting a bad habit (not learning), which is closer to "spend less" than a language app is. Its rewards are real partner offers, which maps onto S Group bonus.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/bepresent/01-streak-celebration.webp` | Streak | The streak is tied to a concrete promise ("1 day streak of keeping your Instagram intention"). | |
| `references/ui/bepresent/02-home-dashboard.webp` | Home | A week strip of day bubbles with ticks, streak and XP pills on top, one big number and one action button. | A "50% off forever" promo badge on home. |
| `references/ui/bepresent/03-home-daily-quests.webp` | Daily check-in | "Daily Quest 2/3 complete" with a bar; done rows turn pale green with strike-through text. | |
| `references/ui/bepresent/04-focus-session-xp.webp` | Session | A live bar shows XP being earned during the session. | A red "Give up" button shames the user. |
| `references/ui/bepresent/05-tip-of-the-day.webp` | Lesson | A tip as one bold headline and three short paragraphs with "Got it". | |
| `references/ui/bepresent/06-rewards-shop.webp` | Rewards | Coins buy real partner offers shown as brand tiles with a coin price. | "Sponsored" clutter. |
| `references/ui/bepresent/07-league-leaderboard.webp` | Leaderboard | A league card with trophies and one rule ("Top 20 get promoted") above the list. | |

### Stimuler (`stimuler`)

English speaking practice with AI.
Figures: revenue $100K, downloads 100K, rating 4.81 (8,625), Education rank 129.
Why it is here: two streak screens with a different idea each.

| File | Screen type | What to borrow | What to avoid |
|---|---|---|---|
| `references/ui/stimuler/01-streak-reward.webp` | Streak | A 3D number in front of the flame with rays behind it: the most dramatic "day 1". | Dark, fiery look. |
| `references/ui/stimuler/02-streak-goal-commitment.webp` | Goal setting | The user picks a streak goal (7, 15, 30 days) under a chart of "keep going" versus "streak reset"; the button repeats the choice ("Commit to 30 day streak"). | |

---

## Single screens from other apps

One screen each, found by searching for a specific pattern. Figures were not retrieved unless given.

| File | App | Screen type | What to borrow | What to avoid |
|---|---|---|---|---|
| `references/ui/rootd/01-streak-celebration-green.webp` | Rootd (anxiety relief) | Streak | A streak celebration on a full green scene with a cheering mascot and fireworks, week dots under it. | |
| `references/ui/gococo/01-streak-commitment.webp` | GoCoCo (food scanner) | Streak | A flame, a week strip, one line about tomorrow, and a dark green "I'm committed" button. | |
| `references/ui/iq-masters/01-streak-dashboard-freeze.webp` | IQ Masters (brain games) | Streak | A "Streak Freeze" card with three drops showing how many are left, and a Refill button. | Selling freezes. |
| `references/ui/lingodeer/01-streak-shields-restore.webp` | LingoDeer (languages) | Streak repair | Shields protect missed days automatically and a "Restore" brings a streak back; each is explained in two lines. | |
| `references/ui/monoboost/01-goal-quiz-feedback.webp` | MonoBoost (cancel subscriptions) | Onboarding quiz | After the user picks "Save more money", a small green note answers: "Great goal, even small savings add up." | |
| `references/ui/fidelity/01-goal-selection-grid.webp` | Fidelity (revenue n/a, downloads 100K) | Goal selection | Goals as a two-column grid of green line icons with short labels. | Corporate tone. |
| `references/ui/quit/01-savings-milestones.webp` | Quit (stop smoking) | Savings / progress | The saved amount shown per week, per month and per year, then "next up" milestones. Direct model for "you skipped X, that is Y a year". | |
| `references/ui/knowt/01-badge-unlocked.webp` | Knowt (flashcards) | Achievement | A badge moment with the mascot holding the badge, why it was earned, the date, and the next tier. | |
| `references/ui/impulse/01-badges-progress-list.webp` | Impulse (brain training) | Achievements | "1/20 badges unlocked", then each badge with its rule and a bar (6/10). | Identical grey shields. |
| `references/ui/genk/01-level-up-reward.webp` | GenK (daily quiz) | Level-up | A giant coin with the level number on a full yellow screen, rewards listed, a black button. | |
| `references/ui/coopah/01-coach-chat-hub.webp` | Coopah (run coaching) | AI coach | A hub that offers a human or an AI coach, then "Pick an expert" tiles by topic. Model for budget, savings and investing coaches. | |
| `references/ui/reflectly/01-today-dashboard-green.webp` | Reflectly (journal) | Home | A green gradient "Today" header with a week strip and a small face character; white card overlapping the header. | Soft gradients are calmer than our brand. |
| `references/ui/monefy/01-saving-intro-green.webp` | Monefy (revenue $5K, downloads 50K) | Onboarding | A full green screen with a piggy bank, one sentence, and a white pill button with a playful label ("Amazing"). | Flat, dated illustration. |

---

## Pattern library

### Onboarding

Best files: `duolingo/04-motivation-quiz.webp`, `munyun/02-onboarding-goal-quiz.webp`, `buddy/02-quiz-stress-slider.webp`, `buddy/03-quiz-social-proof.webp`.
Also: `finch/01-egg-selection.webp`, `everydollar/01-money-goals-quiz.webp`, `monoboost/01-goal-quiz-feedback.webp`.

Rules:
- One question per screen, a progress bar on top, four to six large tappable rows with an icon, the button fixed at the bottom.
- The mascot reacts to every answer in a speech bubble. This is what makes a form feel like a conversation.
- Ask how money feels (stress, running out before payday) before asking for numbers, and follow a hard question with reassurance and a fact.
- Let the user make the mascot theirs (pick, name) in the first minute.
- Show a sample of the result (a spending ring) before asking for bank access or manual entry.

### Home

Best files: `everydollar/02-home-goal-dashboard.webp`, `finch/04-home-pet-room.webp`, `bepresent/03-home-daily-quests.webp`, `duolingo/09-learning-path.webp`.

Rules:
- Home answers three questions in order: how am I doing (one number or one goal bar), what do I do today (one to three actions), what is my streak.
- A status row at the very top holds streak and points as small pills.
- The mascot is on home every day and its state reflects the user's state.
- One primary action on the screen. Promotions and secondary features go below the fold.

### Spending insights

Best files: `spendee/02-expense-breakdown.webp`, `everydollar/05-budget-remaining-donut.webp`, `subpilot/02-category-breakdown.webp`, `everydollar/03-home-budget-summary.webp`.

Rules:
- One chart per screen with the key number inside or beside it. A ring for share by category; a single stacked bar when space is short.
- Category icons sit on the chart, and the list under the chart uses the same colours.
- Offer the three views Planned, Spent, Remaining as tabs, not three screens.
- Put the insight in words above the chart ("Food is 34% of this month"). None of the references do this well; it is where a coach can beat them.

### Budgets

Best files: `buddy/07-budget-home-gauge.webp`, `buddy/09-budget-remaining-by-category.webp`, `spendee/03-budgets-list.webp`, `spendee/04-category-budget-detail.webp`.

Rules:
- Lead with "left to spend", not "spent".
- A category is an icon with a ring or bar and the amount left.
- Show pace: a limit line and a projection tells the user early whether the month will hold.
- Setting a budget is one tap from the list (a "Set" pill), not a separate setup flow.

### Goals

Best files: `everydollar/02-home-goal-dashboard.webp`, `everydollar/06-savings-goal-edit.webp`, `quit/01-savings-milestones.webp`, `stimuler/02-streak-goal-commitment.webp`.

Rules:
- A goal card shows four things: the name with an illustration, the amount saved, a bar from now to target, and the date it will be reached at the current pace.
- Translate small savings into week, month and year amounts.
- Ask for a commitment in the button label ("I'm committed", "Commit to 30 days").
- For someone on under €2,000 a month, default goals must be small and near (first €100, one month's buffer).

### Streaks and check-ins

Best files: `munyun/09-streak-celebration.webp`, `duolingo/10-streak-overview.webp`, `airlearn/02-streak-calendar.webp`, `lingodeer/01-streak-shields-restore.webp`.
Also: `rootd/01-streak-celebration-green.webp`, `bepresent/01-streak-celebration.webp`, `iq-masters/01-streak-dashboard-freeze.webp`.

Rules:
- The streak moment has a fixed anatomy: flame (or our own symbol), a very large number, the words "day streak", a seven-day strip with today ticked, one button.
- Tie the streak to a real action (checked the budget, logged spending, did a lesson), and say which.
- Flame orange is the convention for streaks in every reference. Keeping streaks orange leaves green free to mean money and progress.
- Offer protection for missed days (a freeze or shield) and explain it in two lines. Earn it by activity; do not sell it.
- A streak calendar belongs one tap away from the streak pill.

### Lessons

Best files: `duolingo/09-learning-path.webp`, `munyun/05-learning-path-lesson-popup.webp`, `finrise/05-quiz-explanation.webp`, `munyun/06-quiz-correct-feedback.webp`.
Also: `finrise/03-lesson-article.webp`, `finrise/04-quiz-hint.webp`, `bepresent/05-tip-of-the-day.webp`.

Rules:
- A vertical path of chunky nodes: done nodes in colour, the current node with a ring and a "Start" tag, the rest grey. A header card names the unit.
- A lesson is two to three minutes: a short read or a scenario, then questions. A thin bar on top shows progress.
- Feedback is a bottom sheet in pale green or pale red with one sentence of reason; the button takes the sheet's colour.
- For money topics add "Why?" and "Give me a hint". Understanding matters more than speed.
- Scenarios with a named character ("Leo opens...") make abstract finance concrete.

### Celebrations

Best files: `munyun/08-lesson-complete.webp`, `duolingo/07-first-word-learned.webp`, `finch/06-task-complete-confetti.webp`, `buddy/06-budget-setup-complete.webp`.
Also: `genk/01-level-up-reward.webp`, `duolingo/08-lesson-complete.webp`.

Rules:
- Three sizes of celebration. Small: confetti in place and a toast, the user stays where they are. Medium: a sticker or headline over the content. Large: a full screen with the mascot, a headline, stats and a "Claim" button.
- The large one shows what was earned as two or three tiles and the button names the reward.
- Celebrate firsts loudly (first lesson, first budget, first week under budget, first €100 saved).
- Where possible the reward is the user's own result (their finished budget), not only points.

### Mascot use

Best files: `duolingo/03-mascot-intro.webp`, `munyun/02-onboarding-goal-quiz.webp`, `finch/04-home-pet-room.webp`, `knowt/01-badge-unlocked.webp`.
Also: `finch/02-hatch-success.webp`, `airlearn/05-buddy-streak-profile.webp`, `rootd/01-streak-celebration-green.webp`.

Rules:
- The mascot speaks in short speech bubbles in the first person and is the one who asks for things (notifications, a commitment).
- It needs a small set of fixed poses used in fixed places: greeting, thinking (quiz), proud (lesson done), cheering (streak), holding an object (badge, clipboard), sleeping or worried (missed day).
- Build it from simple shapes with flat colour and almost no outline, so it reads at 40 pt in a list and at 200 pt in a celebration.
- It appears small beside content (quiz header) and large and alone in moments.
- Mood follows the user's behaviour. Finch shows care works better than guilt.

### Achievements and social

Best files: `munyun/12-league-leaderboard.webp`, `knowt/01-badge-unlocked.webp`, `impulse/01-badges-progress-list.webp`, `airlearn/04-buddy-streak-intro.webp`.
Also: `bepresent/06-rewards-shop.webp`, `finch/09-pet-profile.webp`, `duolingo/11-quests.webp`.

Rules:
- Badges show their rule and progress (6/10) while locked, and the date when earned.
- Leagues: own row highlighted, a promotion line, a countdown. Compare effort (XP, streak), never balances or amounts.
- A streak shared with one friend is a lighter social feature than a leaderboard and fits a money app better.
- Rewards with real value (partner offers) fit a bank owned by a retail group.

### Notifications

Best files: `duolingo/06-notification-priming.webp`, `munyun/04-notification-priming.webp`, `copilot/01-notification-preferences.webp`.

Rules:
- Prime before the system prompt: the mascot says why, a mock dialog with an arrow shows what to tap, and the button states the benefit ("Remind me").
- Let the user choose types (streak reminder, large purchase alert, weekly summary) and show a sample of each.
- Ask after the first small win, not on the first screen.

---

## Observed visual language

### Greens and their pairings

| App | Green(s) | Role | Paired with |
|---|---|---|---|
| Duolingo | `#58CC02` main, `#89E219` light, `#78C800`, `#D7FFB8` success panel | Brand, primary button, correct | Blue `#1CB0F6`, orange `#FF9600`, yellow `#FFC800`, purple `#CE82FF`, pink `#FF4B8B`; text `#4B4B4B`, lines `#E5E5E5`, muted `#AFAFAF` |
| EveryDollar | `#35BD59` main, `#2A7440` dark | Header, bars, pills | Navy `#003561` for text and active tab, orange `#FAAB19`, cyan `#00D6E6`, page `#F5F7F8`, grey-blue `#93A9BB` |
| MunYun | `#00C850` correct, `#00D49A` selected outline, `#E8FDF4` selected fill, `#03C78C` reward | Feedback and selection only | Brand yellow `#FEC000`, blue `#50A2FF` / `#2B7FFE`, orange `#FF9600`, red `#FB2C35`, dark navy `#1C1B49` |
| Spendee | `#14C78F`, `#17B984`, `#02BB81` | Action button, positive values | Yellow `#FCCE00`, orange `#FEA800`, red `#FB6566`, page `#F7F7F7` |
| Finrise | `#00B679`, `#04D592` | Correct, continue | Blue `#0050FE`, orange `#E77400` |
| Finch | `#4CAF50` button; scene greens `#79B35F`, `#5AB447`, `#2E9B52` | Primary button, nature scenes | Teal `#0E748C` / `#2D9B8E`, orange `#F5A623`, purple `#615CE0`, cream `#F6ECCD`, sky `#8EDBFF` |
| BePresent | `#57C92E`, fill `#ECFAE5` | Done state | Blue `#003BFF`, sky `#4CB2FF`, orange `#FE7B0F`, yellow `#FCD009`, black |
| Airlearn | `#41BE94`, fills `#CAF7EB`, `#E6F8F2` | XP, own row | Blue `#30B6FA`, orange `#FF810E`, pink `#F26687` |
| Subpilot | `#7ABF4C`, `#9CCC65` on `#09081B` | Income, chart | Blue `#64B5F2`, orange |
| Stimuler | `#26D777` on black | Selected goal | Orange `#F66B25` |
| Buddy | Teal `#30BEA8`, `#19B9A0` | Budget section | Purple `#A943EE`, near-black button `#2D2D2D` |
| Rootd, Reflectly, Monefy | `#57C596`, `#69DFA0`, `#6CC08A` | Full-screen backgrounds | White text and white buttons |

What this means for us:
- Two families exist: yellow-leaning "lime" greens (Duolingo `#58CC02`, BePresent `#57C92E`) and blue-leaning "emerald" greens (Spendee `#14C78F`, Finrise `#00B679`, MunYun `#00C850`). EveryDollar `#35BD59` sits between them. S-Pankki's green should be checked against these; if it lands near `#58CC02`, the pairing has to do the work of not looking like Duolingo.
- Green carries three jobs in these apps: brand, "correct", and "money in / on track". Where green is the brand, the apps still keep it for success and use another colour for selection (Duolingo selects in blue).
- The most distinctive green pairing is EveryDollar's green with navy text. Black with green (BePresent buttons, GoCoCo) reads younger. Green with yellow and orange accents is the Duolingo look.
- Every playful app uses a pale tint of its green (about 10 to 15% strength: `#D7FFB8`, `#E8FDF4`, `#ECFAE5`, `#E6F8F2`) for selected rows and success sheets.
- Fixed meanings repeat across apps: orange or flame for streaks, yellow or gold for coins and XP, blue or cyan for gems and freezes, red or pink for hearts and errors, purple for premium.
- Backgrounds are white or a very light grey (`#F5F7F8`, `#F7F7F7`). Dark themes appear only in Subpilot and Stimuler and feel less friendly.

### Type

- Rounded, heavy sans faces lead: Duolingo's custom rounded face and MunYun's (similar, rounded terminals, wide letters). Finch, Airlearn and Rootd use rounded or soft geometric faces too. The money apps use neutral geometric sans (EveryDollar, Buddy, Spendee) and look more serious for it.
- Weights are heavy: headlines and numbers bold to extra bold, body medium. Thin weights do not appear in the playful set.
- Button labels are bold. Duolingo and MunYun set them in capitals with letter spacing; Airlearn and BePresent use sentence case.
- Approximate sizes: greeting or page title 28 to 34 pt; card title 20 to 24 pt; body 15 to 17 pt; labels 12 to 13 pt (often capitals with spacing); button label 15 to 17 pt; streak or level number 80 to 120 pt; key money figure 32 to 40 pt.
- Numbers are treated as graphics: the streak count, the level and the amount left are the largest things on their screens.
- Speech-bubble copy is short (under 12 words) and set in regular or medium weight.

### Corner radii

- Buttons: 12 to 16 pt on Duolingo-style block buttons; fully rounded pills on Buddy, Airlearn, BePresent and Spendee.
- Cards: 16 to 24 pt. Bottom sheets: 24 to 32 pt on the top corners.
- Option rows in quizzes: 12 to 16 pt with a 2 pt outline.
- Small tiles and stat boxes: 8 to 12 pt. Chips and pills: fully rounded.
- Progress bars: fully rounded, 12 to 16 pt tall, which is thicker than in standard finance apps.
- Nothing in the playful set has square corners.

### Button shapes

- Duolingo and MunYun use a "pressable" block: a flat face with a 4 pt darker edge along the bottom in a deeper shade of the same colour, no blur. Pressed, the face moves down onto the edge. Height about 48 to 50 pt, full width with 16 pt margins. Secondary buttons are white with a 2 pt grey outline and the same bottom edge. The same edge is used on lesson nodes, option cards and header cards, so the whole interface looks tappable.
- Buddy uses a near-black pill about 56 pt tall with a soft shadow and an arrow. BePresent uses black and blue pills. Finrise and Spendee use flat coloured pills.
- Disabled buttons are light grey with grey text, same shape.
- The button label often carries the meaning: "I'm committed", "Claim 27 XP", "Open chest", "Remind me to practice".

### Cards

- Three styles appear. Outlined: white with a 2 pt light grey line and no shadow (Duolingo, MunYun); the flattest and most playful. Elevated: white on light grey with a soft wide shadow (Buddy, EveryDollar, Spendee). Filled: a solid colour block with white text (unit headers, promo cards, streak headers).
- A coloured header that the first white card overlaps is common on home screens (EveryDollar, Buddy, Reflectly, BePresent).
- Selected state is a tinted fill plus a coloured outline, sometimes with a check on the right.
- List rows inside cards are tall (56 to 64 pt) with a round or rounded-square icon on the left.

### Illustration and mascot

- Flat vector, solid fills, no gradients or very soft ones, little or no outline, two or three shades per colour. Shapes are round and thick.
- Mascots are simple bodies with large eyes: an owl (Duolingo), a coin with a hat and moustache (MunYun), a bird (Finch), a cat (Airlearn), a blob monster (Rootd), a dragon (Knowt). Emotion is carried by eyes, brows and arms.
- Objects are chunky and toy-like: chests, gems, flames, coins, trophies, shields. They are drawn in the same style as the mascot.
- Icons in lists are full-colour mini illustrations, not line icons, in the playful apps. The money apps use line icons or one-colour glyphs in tinted circles.
- Tab bars in Duolingo and MunYun use colour illustrations with a rounded-square outline on the active tab.
- Photos appear only in Buddy's onboarding. Emoji appear in the quizzes of Buddy and Finch; they are cheap but dilute a brand with its own mascot.

### Motion hints

Still images only, so these are read from the frames:
- Confetti is drawn as scattered rectangles and dots in the full accent palette (Finch, Buddy).
- Light bursts and rays behind a hero object mark a reveal (Finch hatch, Stimuler streak).
- Sparkles and small stars around the mascot or flame mark a celebration.
- The 3D button edge implies a press-down animation; progress rings around the current lesson node imply a fill animation.
- Bars that just changed are shown mid-fill with the new value (missions update), which implies animating the gain in front of the user.
- Feedback sheets rise from the bottom and take the screen's lower third.
- Welcome screens are videos in the library for most apps (mascot idle animation), so an animated mascot on first launch is the norm.

---

## Top 15

| # | File | Why |
|---|---|---|
| 1 | `references/ui/duolingo/09-learning-path.webp` | The model for a lesson path: 3D nodes, one clear next step, status row, mascot beside the path. |
| 2 | `references/ui/munyun/05-learning-path-lesson-popup.webp` | The same path applied to finance, with the lesson popup that starts a session. |
| 3 | `references/ui/everydollar/02-home-goal-dashboard.webp` | Closest to our home: green header, greeting, and the savings goal as the first card with pace and date. |
| 4 | `references/ui/munyun/09-streak-celebration.webp` | The cleanest streak moment: flame, huge number, week strip, one button. |
| 5 | `references/ui/finch/04-home-pet-room.webp` | A mascot that lives on home, with energy earned from today's actions. |
| 6 | `references/ui/bepresent/03-home-daily-quests.webp` | Streak and XP pills plus a daily checklist with progress, for a "cut a habit" product. |
| 7 | `references/ui/buddy/07-budget-home-gauge.webp` | "Left to spend" as one large gauge. |
| 8 | `references/ui/duolingo/07-first-word-learned.webp` | Correct-answer sheet combined with a "first time" sticker. |
| 9 | `references/ui/munyun/02-onboarding-goal-quiz.webp` | Quiz where the mascot answers back. |
| 10 | `references/ui/buddy/02-quiz-stress-slider.webp` | Asks how money feels; the right first question for our persona. |
| 11 | `references/ui/munyun/10-daily-missions-update.webp` | Missions with thick bars and chests; shows progress gained in the session. |
| 12 | `references/ui/rootd/01-streak-celebration-green.webp` | A celebration on a full green screen with a mascot: closest to our colour direction. |
| 13 | `references/ui/finch/06-task-complete-confetti.webp` | The small celebration that does not interrupt. |
| 14 | `references/ui/quit/01-savings-milestones.webp` | Money saved per week, month and year with milestones: the model for "avoidable spending" wins. |
| 15 | `references/ui/everydollar/05-budget-remaining-donut.webp` | A spending ring that leads with what remains, with Planned / Spent / Remaining tabs. |

Close behind: `munyun/12-league-leaderboard.webp` (leagues), `lingodeer/01-streak-shields-restore.webp` (streak repair), `finrise/05-quiz-explanation.webp` (the "Why?" card), `knowt/01-badge-unlocked.webp` (badge moment).
