# 05 · UI style

Status: v0.2, 2026-11-13 (colours now follow the S-mobiili app). Exact sizes are in [`06-specifications.md`](06-specifications.md). Reference screens are in [`references/ui/`](../references/ui/) and described in [`research/ui-references.md`](../research/ui-references.md). References show patterns to learn from. Never copy a screen, and never reproduce the Appllama watermark.

## The look in one paragraph

It starts from S-mobiili: pale green screens, white cards, dark green text. Then it turns the volume up: a dark green hero block with one very big mint number, one deep green button that presses down, thick rounded shapes and heavy type. Almost everything is green. A small amber flame for the streak is the warmest thing on screen. A grey flying squirrel shows up when something happens. It should feel like the S-Pankki app became a game you trust with your money.

## Principles

1. **One screen, one job.** One hero number, one primary button.
2. **Everything looks pressable.** Buttons, lesson nodes and option cards have a darker bottom edge and move down when pressed.
3. **Chunky, not delicate.** Heavy type, thick progress bars, 2 px outlines, filled icons. No hairlines, no thin weights.
4. **Flat, not glossy.** No gradients, no glass, no drop shadows. Depth comes from edges and overlap.
5. **Calm base, loud moments.** Daily screens are quiet. Celebrations are full-colour and full-screen.
6. **Trust shows.** Amounts are exact, sources are one tap away, and money actions use plain confirmations with no mascot.

## Layout

- Mobile first, 390 pt wide reference frame, 20 pt side margins, 4 pt grid.
- Content stacks in a single column of cards. No side-by-side cards narrower than 160 pt.
- A coloured header block (Dark green or Deep green) may sit behind the top of the first card, which overlaps it by 24 pt.
- The primary button sits in the thumb zone, pinned above the tab bar or the safe area.
- Bottom tab bar with 4 tabs: **Today**, **Chat**, **Jars**, **Path**. Profile and settings open from the avatar at the top right.

## Shape

| Thing | Shape |
|---|---|
| Buttons | 18 pt corners, 4 pt bottom edge |
| Cards | 24 pt corners, 2 pt outline |
| Sheets | 32 pt top corners |
| Chips and pills | Fully round |
| Progress bars | Fully round, 14 pt thick |
| Stickers | Round or blob, 4 pt white border, tilted 3 to 6 degrees |
| Nothing | Square corners |

## Type

Two families, both free on Google Fonts, both cover Finnish and Swedish letters.

- **Bricolage Grotesque** (ExtraBold 800, Bold 700): headlines, hero numbers, the wordmark. It has character without being childish.
- **Figtree** (Regular 400, SemiBold 600, Bold 700): body, labels, buttons, amounts in lists.

Rules: sentence case, left aligned, no all-caps headings, no italics, no weights under 400. Amounts in lists use tabular numerals so the columns line up. The hero number is the biggest thing on the screen.

S-Pankki's own fonts (S Bonus Display and S Bonus UX) are proprietary, so this kit does not use them.

## Components

### Primary button

Deep green face, Dark green bottom edge, white label in Figtree Bold. On a dark block: Mint face, S green edge, Dark green label. On press the face moves down 4 pt and the edge disappears. One per screen. The label says what happens ("Put €5 in the jar").

### Secondary and quiet buttons

- Secondary: white face, Soft green outline and edge, Dark green label. Same press behaviour.
- Quiet: text only in Deep green, for "Not now".
- Destructive actions use a white button with error-red text, never a red face.

### Cards

White on the Surface green background, 24 pt corners, 20 pt padding, no outline and no shadow, as in S-mobiili. On a white background a card gets a 2 pt Soft green outline. A tinted card uses Pale mint, or the amber or info background for a heads-up or a tip. A tappable card gets a 4 pt Soft green bottom edge.

### Hero number

A Dark green block with one figure in Mint, in Bricolage ExtraBold at 56 to 72 pt, a short label above, and one line of context below ("6 days to payday").

### Basket chip

A Pale mint pill with the basket's icon in the basket's green and its name in Dark green. Used on every transaction and in every chat reply about spending.

### Basket bar

One fully rounded bar split into Fixed, Curveballs, Leaks and Jars, running from Dark green to Mint, with 2 px white gaps. Under it, a row per basket: icon, name, amount, and change against the user's usual.

### Jar

A jam jar drawn flat: glass outline in Dark green, a lid, a label with the goal's name. The fill rises in S green with a flat top edge and two or three Mint berries floating in it. Shows the saved amount and target under it. A full jar gets a Mint lid and a sticker.

### Shelf

Jars side by side on a line, scrolling sideways. An empty slot with a dashed outline and a plus adds a goal.

### Streak

An amber flame (`#CF8300`) with the day count in Bricolage ExtraBold, and a seven-day strip of circles under it (filled Deep green with a check when done, outline when not, a small blanket icon for a protected day). The flame is the only amber on the screen.

### Daily action card

A checklist of up to three actions with thick progress on top. Done rows turn Pale mint with a Deep green check and a strike-through. Each row shows the berries it earns.

### Chat

- Liito's replies: white bubble, 24 pt corners with the bottom-left corner 6 pt. Liito's avatar (32 pt) beside the first bubble of a group.
- The user's messages: Deep green bubble, white text, bottom-right corner 6 pt.
- Data cards inside a reply: a white card with a number, a small chart or up to five rows, and a "From your card payments, 1 to 31 Oct" source line that opens the transactions.
- Suggested next steps: Pale mint pills with Dark green text under the reply.
- The input bar has a text field, a round Deep green send button, and three starter questions above it when the chat is empty.
- While thinking: Liito's "curious" pose with three bouncing dots. No spinner.

### Receipt (weekly recap)

A white card with a zigzag bottom edge, shown slightly tilted on a Dark green background. Monospaced-looking rows in Figtree with tabular numerals: the three baskets, the jar total, the streak, and one line from Liito at the bottom. It can be saved as an image and shared. Shared versions hide amounts by default and show percentages and the streak.

### Path (lessons)

A vertical winding path of round nodes with the 4 pt edge. Done nodes are S green with a check, the current node is Deep green with a bouncing "Start" bubble, locked nodes are Pale mint with a Soft green edge. A unit header card names the topic on Dark green. Liito stands beside the current node. Lessons take about two minutes and end with one action on the user's real data.

### Stickers and badges

Flat illustrations with a 4 pt white die-cut border, tilted. Earned for firsts and milestones ("First jar", "Leak plugged", "30 days"). Shown in a grid on the profile; unearned ones are grey outlines.

### Sheets and feedback

Feedback rises from the bottom as a sheet: Pale mint for success and findings, the amber background for a heads-up, the error background for a failed action. A sheet holds one line, an optional figure and one button.

## Icons

- Use **Phosphor Icons**, "fill" weight for navigation and basket icons, "bold" weight inside text and lists. One set only.
- 24 pt default, 28 pt in the tab bar, 20 pt inside chips.
- Icon colour follows the text colour next to it, or the green of its basket.
- Basket icons: Anchor (Fixed), Lightning (Curveballs), Drop (Leaks), Jar (Jars). Streak: Flame. Berries: a custom berry mark.

## Illustration

- Flat vector. No outlines, no gradients, no 3D renders, no stock photos, no AI-looking gloss.
- Two tones per colour at most: the colour and one darker shade for depth.
- Objects from the idea system only: jars, berries, receipts, branches, leaves, mugs, blankets, coins as plain discs.
- Liito follows [`02-identity.md`](02-identity.md). One Liito per screen.
- Backgrounds for celebrations: a full S green or Dark green field with large, simple confetti shapes (circles, leaves, berries) in Mint, Pale mint and white.

## Motion

Motion is part of the reward. It is quick and springy, and it always responds to something the user did.

| Moment | Motion |
|---|---|
| Button press | Face moves down 4 pt in 80 ms, springs back on release, light haptic |
| Progress | Bars and jars fill to the new value in 600 ms with a slight overshoot |
| Small win (an action done) | Check pops in, row turns mint, +berries floats up, light haptic. No full-screen takeover |
| Medium win (daily set done, streak day) | Bottom sheet rises, flame or number counts up, medium haptic |
| Big win (jar full, 7, 30 or 100 days, first of anything) | Full-screen colour field, Liito glides in, confetti for about 1.2 s, success haptic, then one button |
| Screen change | 250 ms slide with ease-out |
| Liito | Idles with a slow blink and breath; enters by gliding in from a top corner |

Rules:

- Celebrations are earned by the user's own action. Never by opening the app, and never to sell something.
- A big win appears at most once per session.
- With "Reduce motion" on, replace movement with fades and skip confetti.
- No sound by default.

## Gamification rules

1. **The daily action is tiny.** A check-in, one swipe to sort a transaction, a 2-minute lesson, or moving €1 to a jar. Any one keeps the streak.
2. **The streak never depends on not spending.** Buying something cannot break it.
3. **Tight-week mode protects the streak.** The user can turn it on, and Liito offers it before payday when money is short.
4. **Berries reward effort.** They are not euros, cannot be bought, and are never taken away.
5. **No leaderboards in euros.** Shared challenges count days and actions.
6. **No random rewards tied to money.** No prize draws, no loot boxes.
7. **Nothing is locked behind payment or energy.** The app is free for customers.
8. **Investing is taught before it is offered,** and it is offered only once a buffer jar is full.

## Screen blueprints

Each blueprint lists the order of things on the screen and the references to study.

### Today (home)

1. Top row: greeting, streak pill (amber), berries pill (Pale mint), avatar.
2. Hero block: "Safe to spend" figure, days to payday, a thin bar of the pay period.
3. Daily action card with up to three actions.
4. Basket bar for this pay period.
5. One finding from Liito ("Found something") with a small Liito.
6. Shelf preview with the nearest jar.

References: `everydollar/02-home-goal-dashboard`, `buddy/07-budget-home-gauge`, `bepresent/03-home-daily-quests`, `finch/04-home-pet-room`.

### Chat

Liito at the top with a status line, the conversation, data cards in replies, suggestion pills, input bar with starter questions. No good reference exists in the library for a money chat; build it from the Chat component above.

### Baskets (spending)

Basket bar as the hero, then a card per basket with its total, change against usual and the top three merchants. Tapping a basket lists its transactions, each with a basket chip that the user can change by swiping.

References: `everydollar/05-budget-remaining-donut`, `buddy/07-budget-home-gauge`, `spendee/`.

### Jars

The shelf, the total saved as the hero number, then a card per jar with pace and date. "New jar" as the primary button. The library has no good multi-goal list; use the Jar and Shelf components.

References: `everydollar/02-home-goal-dashboard`, `quit/01-savings-milestones`.

### Path

Unit header, the winding path, Liito at the current node, a lesson popup with "Start".

References: `duolingo/09-learning-path`, `munyun/05-learning-path-lesson-popup`.

### Streak celebration

Full Dark green screen, the amber flame, the day count in Mint at 96 pt or more, the seven-day strip, one line from Liito, one button.

References: `munyun/09-streak-celebration`, `rootd/01-streak-celebration-green`, `duolingo/07-first-word-learned`.

### Weekly receipt

Dark green background, the tilted receipt, "Share" and "Done". No library reference; use the Receipt component.

### Onboarding

1. Liito says hello (one screen).
2. "How does money feel right now?" on a slider.
3. "What do you want first?" with three options (get to payday, build a buffer, save for something).
4. Payday date.
5. Liito shows the first finding from the user's own data.
6. First jar, with €1.
7. Notification choice, asked by Liito with the reason.

At most seven steps, a progress bar on top, one question per screen, and the answer options are large pressable cards.

References: `munyun/02-onboarding-goal-quiz`, `buddy/02-quiz-stress-slider`.

## Never

- No red totals or red arrows as the first thing on a screen.
- No thin fonts, hairlines, glass effects or drop shadows.
- No body text in or on S green `#00AA46`.
- No colours outside the S-mobiili palette: no pink, violet, gold, cream or neon green.
- No more than one primary button, one Liito or one celebration on a screen.
- No dashboards with more than one chart above the fold.
- No stock photos of people.
- No mascot on payment confirmations, errors about money or legal text.
