# Competitor research completion

Source: <t3-thread://v2/699bd055-6afa-4ddf-9c94-4b70358a24dd/thread:provider:claudeAgent:native-thread:provider-thread%3Aprovider%3AclaudeAgent%3Anative-thread%3Apending%253Arun%253Athread%253A9bd03a63-a893-442d-9b8e-8004ddd29fa7%253Aordinal%253A1%3Aabbf9ef61af10ea7b>

Source updated: 2026-11-13T20:12:26.121Z. Coverage: completion handoff. Tool traces are omitted.

Historical record. Later user corrections and current repository instructions take precedence. Local project links point at the verified asset commit; personal emails are redacted. Older completion claims are preserved as history, not independent proof.

## Assistant · 2026-11-13T20:12:26.111Z

<tools-used-before-summary>Edit, WebFetch, WebSearch, Write, mcp__claude_ai_Appllama__get_app, mcp__claude_ai_Appllama__list_app_screens, mcp__claude_ai_Appllama__search_apps, mcp__claude_ai_Appllama__search_screens</tools-used-before-summary>

The report is written to `https://github.com/Junction-2026-NMA/junction-2026/blob/0b58ea220fb93bd1dc0f19178afb23567ef57065/research/competitor-analysis.md` (about 9,800 words, 99 source links). It profiles 18 finance products, covers bunq briefly, and treats Duolingo, Finch and Headspace as mechanics benchmarks.

All were confirmed live through the App Store API on 2026-11-13, which also gave Finnish-store availability. UI descriptions come from current store screenshots I looked at; I did not install any app. Duolingo and Finch were also checked against in-app screens from Appllama (8 credits used).

## Comparison table

Gamification depth runs 0–3 (0 none, 3 the core loop is a game) and is my judgement.

| Product | Target | Core mechanic | Visual style | Tone | Mascot | Gamif. | Price | In Finland |
|---|---|---|---|---|---|---|---|---|
| Cleo | Young US adults short on cash | AI chat coach, cash advance | Maroon and cream, no illustration | Sassy friend (roast or hype) | n | 1 | Free; $5.99–14.99/mo | n |
| Emma | UK adults with many accounts | Aggregation, subscription tracking | Indigo and purple, cyan accents | Practical | n | 0 | Free; about £5–15/mo | n |
| Copilot Money | Design-minded US iPhone users | Dashboard, AI findings to approve | Light blue glass, emoji icons | Calm expert | n | 0 | $109/yr | n |
| YNAB | Committed budgeters | Zero-based budget method | Blurple and lime | Honest, warm teacher | n | 1 | $14.99/mo or $109/yr | partly |
| Plum | UK and EU savers | Automatic saving rules, investing | Purple, green, yellow, 3D goal art | Cheerful wordplay | n | 2 | Free; £3.99–14.99/mo | n |
| Zogo | US youth via credit unions | Lessons and quizzes for rewards | White, blue, green | Encouraging | n | 3 | Free (institution pays) | n |
| Qapital | US savers | Rule-based saving, paycheck split | Deep green, photo goal cards | Reassuring | n | 2 | $3–12/mo | n |
| Dreams | Swedish adults | Goal saving with named "tricks" | Aubergine and cream, serif | Soft, aspirational | partly | 2 | SEK 29/mo | n |
| Fortune City | Casual trackers | Log expenses to grow a city | Pastel gradients, isometric city | Cute | y | 3 | Free; optional sub | y (English, manual) |
| Acorns | US first-time investors | Round-ups into portfolios | Green and black | Simple, optimistic | marketing only | 1 | about $3–12/mo | n |
| Monzo | UK 18–40 | Pots, round-ups, seasonal challenge | Hot coral and navy | Warm, witty, plain | n | 2 | Free; paid plans | n |
| Revolut | Mobile-first Europeans | All-in-one finance app | Black, glassy | Confident, short | n | 1 | Free; paid plans | y |
| Lunar | Nordic 18–35, small firms | Neobank with custom home | Black and vivid green | Upbeat | n | 0 | Free; paid plans | n (consumer launch unconfirmed) |
| Klarna | Online shoppers | Pay later, cashback, card | Pink on aubergine | Shopping-positive | n | 1 | Free; fees on credit | y |
| bunq | EU digital natives | Neobank with AI chat | Rainbow, lifestyle photos | Breezy | n | 1 | Free; paid plans | y |
| MobilePay | Everyone in Finland | Person-to-person payments | Flat blue, avatars | Light, social | n | 0 | Free | y |
| OP-mobiili | All OP customers | Bank app, needs/wants split, AI assistant | White, orange line icons | Functional | n | 1 | Free | y |
| Nordea Mobile | All Nordea customers | Bank app, insights, budget | Nordea blue | Corporate calm | n | 0 | Free | y |
| Anyfin | Nordic adults with consumer debt | Refinance and pay off faster | Yellow and cream, cartoon character | On-your-side | partly | 1 | Free app; loan interest | y |
| S-mobiili (baseline) | S Group members | Bank, Bonus, receipts, benefits | S green and white | Helpful, retail | n | 1 | Free | y |
| Duolingo | Everyone | Daily lesson, streak, quests | White, saturated flats, 3D-edge buttons | Playful, cheeky | y | 3 | Free; about $84–120/yr | y |
| Finch | Teens, young adults | Self-care goals grow a pet | Teal, soft, cosy | Gentle | y | 3 | Free; about $40–70/yr | y (English) |
| Headspace | Stressed adults | Short daily sessions | Orange and yellow, blob characters | Calm, kind | characters | 1 | about $70/yr | y (English) |

## White space

> A playful, daily, mascot-led coach that works on the user's real transactions, is available in Finnish, is free, and never earns money from the user's debt.

No product meets all five conditions:
- **Cleo** is not in Finland, has no mascot, and earns about 62% of its revenue from cash-advance fees.
- **Zogo** is not in Finland and is not connected to real money.
- **Dreams** is Sweden only, paid, and sells loan consolidation.
- **Finnish bank apps** have the data and the trust but no play.

There is also a visual gap: nothing available in Finland uses a mascot with moods. Lunar already owns "black + bright green", so S green needs a different partner palette.

## Top patterns to borrow

1. **One tiny daily action keeps the streak (Duolingo).** Letting one lesson count raised day-14 retention 3.3% and put 40% more people on a 7+ day streak. Never tie the streak to not spending.
2. **Streak protection and repair (Duolingo freeze, Finch repair icon).** Add a "tight week" mode before payday.
3. **A companion whose mood follows effort, not balance (Finch, rated 4.95).**
4. **Named automatic saving rules (Dreams, Plum, Qapital).** These can be a skin over S-Pankki's existing Säästäjä options.
5. **Findings first, then one-tap approve (Copilot), with one hero number, "left to spend".**
6. **A time-boxed shared challenge (Monzo 1p Saving Challenge).** Over a million people joined in 2025.
7. **Written tone rules (Monzo, YNAB).** YNAB's "You're bad at money (but not a bad person)" is the model for removing shame.

## Top patterns to avoid

1. **Guilt and fear in push notifications.** 48% of Finns under 30 already worry about money weekly.
2. **Earning from the user's shortfall.** Cleo paid $17M to settle with the FTC. The Finnish Consumer Ombudsman says credit must not be marketed as everyday, fast, or a route to dreams.
3. **Gambling-like random rewards with real money,** such as prize draws. This needs a legal check.
4. **Pushing investments before a buffer exists, or gamifying trading.** ESMA has warned on this; route investing through Säästäjä's suitability flow and celebrate the habit, not the transaction.
5. **Paywalls and energy systems that block use.**
6. **Roast by default.**
7. **Overclaimed savings.** Anyfin was reprimanded in Finland in June 2024 for this.
8. **Leaderboards in euros.**

## Finding that matters most for "our angle"

S-Pankki's Säästäjä already saves from every card purchase, routes Bonus to savings, and includes a suitability check. It has 130,000 users, but only 11% are 18–25. The rails exist; the motivation layer for young people is missing.

## Could not verify

- **User numbers** for OP-mobiili, Nordea Mobile, S-mobiili, Dreams, Copilot, YNAB and Finch; store rating counts are given instead.
- **Prices** for Emma, Cleo, bunq and Headspace come from third-party pages. Acorns' reported rise to $4/$8 is unconfirmed, and Revolut's Finnish plan prices were not checked because revolut.com blocked the fetch.
- **Lunar in Finland:** no evidence of a consumer launch. **YNAB:** sync with individual Finnish banks not checked.
- **Cleo's roast copy:** not traced to a primary source, so I used store copy.
- **Acquisition channels** for most products; only Duolingo's and Anyfin's are sourced.
- **Finnish law** on prize draws, and the final date the new consumer-credit rules apply.
- **Omat ostot user count:** the only figure found is from 2020.
- **The Junction challenge brief** was not found online.
- **Snippet-only sources:** claims marked *(snippet)* in the report were seen only in search summaries, not on the opened page.

## Housekeeping

- I did not update the Obsidian vault, because the instruction was to touch no other file.
- My screenshot contact sheets went into the session scratchpad's `sheets/` folder, which another session is also writing to. Nothing of theirs appears overwritten, but I can't rule it out for the same-named `duolingo.jpg`.
