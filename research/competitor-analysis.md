# Competitor analysis: UI and brand strategy

**Project:** S-Pankki "Personal Economic Trainer", Junction 2026
**Researched:** 2026-11-13
**Scope:** 18 money products a Finnish 18–35 year old could use or be inspired by, plus 3 interaction benchmarks from outside finance. Banks are included only where their app competes for the same daily attention.

## Short version

- **Nobody in Finland sits in the "playful + active coach" corner.** The products that do (Cleo, Zogo, Dreams, Fortune City) are not available here, are not connected to real spending, or earn their money from credit.
- **Finnish bank apps are serious tracking tools.** OP-mobiili, Nordea Mobile and S-mobiili show balances, budgets and Bonus. None has a mascot, a streak or a daily action.
- **The strongest pattern to borrow is "one tiny action a day keeps the streak"** (Duolingo), combined with a companion whose mood reflects effort, not balance (Finch), and automatic saving rules with names (Dreams, Plum, Qapital).
- **The clearest thing to avoid is earning from the user's worst moment.** Cleo makes most of its revenue from cash-advance fees and paid $17M to settle with the US FTC. Finnish rules on credit marketing are stricter than US ones.
- **S-Pankki already owns the rails.** Its Säästäjä service saves from every card purchase and from Bonus, with a suitability check built in. What is missing is the motivation layer on top. That is our product.

## How to read this report

| Mark | Meaning |
|---|---|
| no mark | I opened the source, or read it from the App Store API or store screenshots on 2026-11-13 |
| *(snippet)* | Seen only in a search-result summary. The page itself was not opened |
| *(unverified)* | Could not be confirmed. Treat as a lead, not a fact |

**UI descriptions** come from the current App Store screenshots of each app (linked in the table below), which I downloaded and looked at. Duolingo and Finch were also checked against in-app screens from the Appllama library (8 credits used). I did not install or use any of the apps, so navigation details beyond what screenshots show are marked.

**Gamification depth (0–3):** 0 = none. 1 = light (goals, progress bars, round-ups). 2 = structured (named rules, challenges, rewards). 3 = the core loop is a game (mascot or pet, currency, quests, levels).

**Compliance notes are not legal advice.** They point at published regulator positions. S-Pankki's legal team has to confirm them.

### Liveness and Finnish App Store check (App Store API, 2026-11-13)

"FI store" means the app is listed in the Finnish App Store. It does not always mean the service works for Finnish residents (see the Monzo and Lunar rows).

| App | Last update | Home store rating (count) | In FI store, rating (count) | Listing |
|---|---|---|---|---|
| Cleo | 2026-11-10 | US 4.67 (269,209) | no | https://apps.apple.com/us/app/cleo-ai-cash-advance-budget/id1447274646 |
| Emma | 2026-11-12 | GB 4.65 (27,292) | no | https://apps.apple.com/gb/app/emma-budget-planner-tracker/id1270062373 |
| Copilot Money | 2026-11-04 | US 4.75 (31,036) | no | https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651 |
| YNAB | 2026-11-11 | US 4.79 (62,184) | yes, 4.66 (117) | https://apps.apple.com/us/app/ynab/id1010865877 |
| Plum | 2026-11-09 | GB 4.68 (70,972) | no | https://apps.apple.com/gb/app/plum-smart-saving-investing/id1456139507 |
| Zogo | 2026-11-11 | US 4.78 (57,608) | no | https://apps.apple.com/us/app/zogo-learn-and-earn/id1474636588 |
| Qapital | 2026-10-28 | US 4.80 (85,904) | no | https://apps.apple.com/us/app/qapital-the-money-saving-app/id969977669 |
| Dreams | 2026-11-03 | SE 4.67 (9,858) | no | https://apps.apple.com/se/app/dreams-spara-till-dr%C3%B6mmar/id1083073963 |
| Fortune City | 2026-11-09 | US 4.52 (4,989) | yes, 4.25 (32) | https://apps.apple.com/us/app/fortune-city-expense-tracker/id1172713884 |
| Acorns | 2026-11-09 | US 4.75 (960,669) | no | https://apps.apple.com/us/app/acorns-save-invest-money/id883324671 |
| Monzo | 2026-11-12 | GB 4.86 (370,317) | yes, 4.15 (26), but UK and Ireland residents only | https://apps.apple.com/gb/app/monzo-bank-mobile-banking/id1052238659 |
| Revolut | 2026-11-13 | GB 4.86 (1,103,956) | yes, 4.82 (11,882) | https://apps.apple.com/gb/app/revolut-mobile-finance/id932493382 |
| Lunar | 2026-11-12 | DK 4.66 (38,522) | yes, 4.75 (12), no Finnish language | https://apps.apple.com/dk/app/lunar/id1068850213 |
| Klarna | 2026-11-13 | SE 4.68 (591,741) | yes, 4.59 (48,705) | https://apps.apple.com/se/app/klarna-smart-vardagsekonomi/id1115120118 |
| bunq | 2026-11-12 | NL 4.38 (37,197) | yes, 4.68 (203) | https://apps.apple.com/nl/app/bunq/id1021178150 |
| MobilePay (FI) | 2026-11-13 | FI 4.57 (162,629) | yes | https://apps.apple.com/fi/app/mobilepay/id768172577 |
| OP-mobiili | 2026-11-04 | FI 2.98 (2,619) | yes | https://apps.apple.com/fi/app/op-mobile/id767393591 |
| Nordea Mobile | 2026-11-10 | FI 4.49 (201,493) | yes | https://apps.apple.com/fi/app/nordea-mobile-finland/id571238397 |
| S-mobiili (our baseline) | 2026-10-30 | FI 4.36 (32,136) | yes | https://apps.apple.com/fi/app/s-mobiili/id740514933 |
| Anyfin | 2026-11-10 | SE 4.85 (12,627) | yes, 4.76 (1,559) | https://apps.apple.com/se/app/anyfin/id1412749891 |
| Duolingo | 2026-11-11 | US 4.72 (5,584,845) | yes, 4.54 (53,860) | https://apps.apple.com/us/app/duolingo-learn-languages/id570060128 |
| Finch | 2026-11-12 | US 4.95 (775,318) | yes, 4.91 (2,404) | https://apps.apple.com/us/app/finch-self-care-pet/id1528595748 |
| Headspace | 2026-11-10 | US 4.84 (973,769) | yes, 4.68 (6,082) | https://apps.apple.com/us/app/headspace-sleep-meditation/id493145008 |

**Checked and left out** (all live in November 2026, none in the Finnish App Store): Rocket Money, Monarch, Snoop, Chip, Step, Greenlight, Rocker. They repeat patterns already covered by a stronger example. Step was bought by MrBeast's Beast Industries in February 2026 and is US-only (https://cointelegraph.com/news/mrbeast-acquires-gen-z-bank-step, *snippet*). Rocker is a Swedish budgeting and savings app, Sweden only (https://apps.apple.com/se/app/rocker/id1502708608). Moank has no App Store app that I could find and is a lender, not a coach *(unverified beyond the store search)*.

---

## The user we are competing for

- Finns under 30: **48% worry about their money at least weekly, 21% have no savings at all**, and about a quarter have savings for one month at most. S-Pankki survey by Kantar, 3,102 adults, Feb–Mar 2026 (https://www.sttinfo.fi/tiedote/72282300/s-pankin-tutkimus-nuoret-kokevat-arjen-turvalliseksi-vaikka-talous-huolettaakin?lang=fi).
- People in their 20s are the largest share of **new** payment defaulters in Finland. Over 60% of defaults relate to overdrafts, one-off loans and instant credit, and easy online shopping plays a part. About 387,000 people had at least one default at the end of June 2026 (https://yle.fi/a/74-20237476, citing Suomen Asiakastieto).
- Almost three in four young adults want saving to be automatic and unnoticeable (S-Pankki "Säästäjien Suomi", March 2026, https://dokumentit.s-pankki.fi/tiedostot/s-pankki-saastajien-suomi-032026).

Two consequences for the comparison: a €9–15 monthly subscription is a poor fit for someone on under €2,000 net, and anything that leans on credit is the wrong side of this user's problem.

---

## Group A: AI and chat money coaches, budgeting apps

### 1. Cleo

**Facts**
- AI money assistant with chat at the centre. Budgeting, saving, credit building, investing and cash advances. Built in the UK, focused on the US since 2022 (https://ffnews.com/newsarticle/fintech/cleo-brings-ai-powered-money-management-back-to-the-uk, *snippet*).
- Target: young, paycheck-to-paycheck Americans. The store listing leads with a cash advance of up to $500 and "Dump your overpriced overdraft" (https://apps.apple.com/us/app/cleo-ai-cash-advance-budget/id1447274646).
- Scale: "9+ million users", internal data as of January 2026 (same listing). About $400M annualised revenue in May 2026 according to Sacra's estimate (https://sacra.com/c/cleo, *snippet*).
- Price: free tier, then Plus $5.99, Pro $8.99, Builder $14.99 a month (third-party check of Cleo's pricing page, October 2026: https://toolradar.com/tools/cleo-ai/pricing.md, *snippet*).
- Finland: **no.** Not in the Finnish App Store. UK relaunch began in February 2026 with a waitlist (https://itbrief.co.uk/story/cleo-relaunches-uk-ai-money-app-to-ease-cash-anxiety, *snippet*).

**UI**
- Recently restyled: dark maroon fading to black, warm cream surfaces, pale blue and sage cards, tight grotesk headlines. The wordmark sits in a pill. No mascot and no illustration; the "character" is the chat voice.
- Home greets by name ("Hi, Shay") above a budget card. Screens seen: Plan (Budget / Roadmap) and Request (Cash Advance / Credit Score).
- Progress is shown as a streak-like checklist: "Spend smarter. On track. Goal: spend less than you earn for at least 4 of the next 6 months", with one dot per month.
- Explains its own advice in plain maths. The savings screen has a "Why 3%?" card that walks through the user's own numbers.
- Signature moment: chat replies in "Roast Mode" or "Hype Mode", which the user picks (https://www.trendhunter.com/trends/ai-powered-budgeting-app, *snippet*).

**Brand**
- Line: "Everything your bank can't do" and "The world's first AI financial assistant" (store screenshots).
- Voice: a blunt, funny friend. Verified copy: "Cleo turns money stress into a simple chat." "Enter your portfolio era." The App Store age rating notes infrequent profanity or crude humour.
- Acquisition: social-first, shareable roasts. *(Channel mix not verified.)*
- Monetisation: about 62% of 2025 revenue from cash-advance express fees and 35% from subscriptions (Sacra, https://sacra.com/c/cleo, *snippet*).

**Weak spots**
- **FTC settlement, March 2025: $17M.** The FTC said Cleo advertised advances of $250–500 while most users were offered far less, required a subscription before showing the amount, and blocked cancellation while an advance was outstanding (https://www.ftc.gov/news-events/news/press-releases/2025/03/cash-advance-company-cleo-ai-agrees-pay-17-million-result-ftc-lawsuit-charging-it-deceives-consumers).
- The coach earns most when the user runs out of money. That conflict is the main lesson for us.
- Some reviewers find the tone unsuitable for serious decisions (https://buildfastwithai.com/ai-tools/cleo, *snippet*).

### 2. Emma

**Facts**
- UK budgeting app that connects bank accounts through open banking, tracks subscriptions, and has added saving, investing and credit-score features (https://emma-app.com/).
- Target: UK adults who want every account in one place.
- Scale: "3m+" downloads and "10bn+" analysed transactions (https://emma-app.com/).
- Price: free basic tier. Paid tiers Plus, Pro and Ultimate. Third-party figures: about £4.99–5.99, £9.99 and £14.99 a month (https://www.householdmoneysaving.com/emma-app-review/, *snippet*; Which? lists Plus at £5.99, *snippet*).
- Finland: **no.** Its site names only the UK, and it is not in the Finnish App Store.

**UI**
- Deep indigo "night sky" marketing with cyan highlights. In-app: purple header, white rounded cards, cyan and pink accents. No mascot in the store screenshots.
- Home is a stack of totals: Everyday, Savings, Investments, Net worth, then recent transactions.
- Budget is a donut with the amount "left of" the total in the middle. Budgets run payday to payday.
- A dedicated Subscriptions list with merchant logos, price and billing cycle.

**Brand**
- Line: "Take control of your money". Sub-line: "the all-in-one financial membership."
- Voice: direct and practical. "Cancel wasteful subscriptions and never miss on a payment again."
- Monetisation: subscription tiers, plus cashback deals in the paid plans.

**Weak spots**
- Reviewers criticise the price for a budgeting app and the frequent upgrade prompts (https://www.householdmoneysaving.com/emma-app-review/, *snippet*).
- It tracks well but does not coach: there is no daily action.

### 3. Copilot Money

**Facts**
- Premium US personal-finance app: spending, budgets, investments, net worth, and an AI "money assistant" (https://www.copilot.money/).
- Target: design-conscious iPhone users with several accounts. Older and wealthier than our persona.
- Scale: 31,036 App Store ratings at 4.75. Apple Design Awards finalist (https://www.copilot.money/). User numbers are not public.
- Price: no free plan. The site shows $109 billed yearly (about $9 a month). The App Store lists a monthly option at $18 (Appllama listing, October 2026). Third-party pages quoting $13 a month and $95 a year look out of date.
- Platforms: iPhone, iPad, Mac and web. No Android app.
- Finland: **no.** US institutions only.

**UI**
- Light, airy blue gradients, glass-like cards, emoji-style category icons. The most polished "serious" UI in this set.
- Top tabs: Dashboard, Investments, Transactions. Hero number: "$2,272 left out of $3,400 budgeted", with a small line showing pace against the month.
- A "To review" queue where the app proposes fixes and the user taps "Approve all".
- The assistant writes a feed of findings: "I went through your last 3 months of transactions, and a few things stood out", followed by cards such as "$78 per month on matcha".

**Brand**
- Line: "Your money finally has a copilot."
- Voice: calm and confident. "Insights before you even ask." "You just approve."
- Trust message: "We never sell your financial data, train external AI models on it, or show you ads."
- Monetisation: one subscription. "No tiers, no add-ons, no AI credits."

**Weak spots**
- Paywalled from day one, US only, no Android. Informative but passive: no streaks, no celebration.

### 4. YNAB (You Need A Budget)

**Facts**
- Zero-based budgeting app built around a method: give every unit of money a job.
- Target: people ready to budget by hand each week. Skews adult and committed.
- Price: $14.99 a month or $109 a year, 34-day free trial, and a free year for college students (https://www.ynab.com/pricing).
- Scale: 62,184 US App Store ratings at 4.79. User numbers are not public.
- Finland: **partly.** The app is in the Finnish App Store (117 ratings) and priced in dollars. YNAB's help centre lists Finland for bank import in Europe through Plaid, but coverage of individual Finnish banks is not confirmed (https://support.ynab.com/en_us/direct-import-in-the-uk-and-eu-an-overview-Syae1z_A9, *snippet*).

**UI**
- Blurple background with lime-green pills and flying-banknote illustrations. Cream cards in the newer screens.
- Home shows "Ready to assign" and a list of "Top priorities".
- Every category has a green pill with what is available. Meeting a target shows a large check and "You've met your target!".
- Overspending is handled as a calm repair step: a "Cover overspending" sheet asks which category the money should come from.

**Brand**
- Line: "Never worry about money again" and "Get good at money."
- Voice: honest and warm, takes the shame out. "You're bad at money (but not a bad person)." "Can you put a price on inner peace? Not really. But $109 a year will get you pretty close."
- Retention: the method itself, plus a large teaching community *(not measured here)*.
- Monetisation: subscription only.

**Weak spots**
- High effort and a steep learning curve. Price has roughly doubled since launch (https://pocketclear.app/blog/ynab-price-increases-history.html, *snippet*). Not localised for Finland.

### 5. Plum

**Facts**
- UK automatic saving and investing app. An algorithm ("Brain") moves small amounts aside. Offers ISAs, pensions and investments (https://withplum.com/).
- Price in the UK: Basic free, Plus £3.99, Boost £7.99, Max £14.99 a month (https://withplum.com/).
- Scale: 70,972 UK App Store ratings. User counts in circulation (1.5M in 2023, 2.5M+ in 2026) come from press and affiliate pages *(unverified)*.
- Markets: UK, Ireland, France, Spain, Portugal, Italy, Belgium, Netherlands, Greece, Cyprus (https://thefintechtimes.com/plum-launches-its-personal-finance-app-in-five-more-european-countries/, *snippet*).
- Finland: **no.**

**UI**
- Deep purple with bright green and yellow accents. Heavy uppercase headline ("MONEY FOR LIFE"). Chunky 3D-style goal illustrations (house, holiday, retirement).
- Home shows total saved and "past week" change, then pockets.
- Saving rules have names and switches: Rainy days, Pay Days, Automatic, Weekly depositor, Round ups, and a 52-week challenge.
- A conversational planner: "Hey Jack, what are we building towards?" with picture tiles to choose from.

**Brand**
- Line: "Money for life".
- Voice: cheerful British wordplay. "Go from pipe dreams to choosing colour schemes." "Plan for the plot twists, without growing your to-do list!"
- Monetisation: subscription tiers and investment fees.

**Weak spots**
- Many automations sit behind paid tiers ("Some automations are paid features", store screenshot footnote). Interest is paid only in the UK (https://techcrunch.com/?p=2473841, *snippet*).

---

## Group B: gamified saving and financial-literacy apps

### 6. Zogo

**Facts**
- Financial-literacy app with bite-size lessons and quizzes. Learners earn points and swap them for rewards such as gift cards.
- Business model: B2B2C. Credit unions, banks and fintechs license it and fund the rewards. Over 200 partner institutions (https://zogo.com/).
- Scale: "hundreds of thousands of users" (store description). 57,608 US ratings at 4.78.
- Price: free for learners.
- Finland: **no.** US only.

**UI**
- White background with blue and green, friendly photo marketing. A "Learning Path" of skills (Apply for Credit, Repay Debt, Start Investing), each with a module count and percent complete.
- A coin balance in the top corner. Lessons are swipeable cards.
- A Games tab with "Trivia Party" (a live daily quiz with a prize pool) and community leaderboards, including one per partner institution.
- Claims "75+ skills, 1,100+ lessons" (store screenshot).

**Brand**
- Line: "money skills made easy". To institutions: "Gamified education, real-world growth."
- Voice: plain and encouraging. "Do you wish you took a financial literacy class in school?"
- Retention: rewards, daily trivia, leaderboards.

**Weak spots**
- **It teaches but never touches the learner's real money.** No link between a lesson and what the user actually spent yesterday. This is the gap a bank can close.
- Rewards are small: 5,000 points for a $5 gift card in one review (https://www.fool.com/money/personal-finance/zogo-review, *snippet*).

### 7. Qapital

**Facts**
- US saving app built on rules: "save automatically with fun, customizable triggers" (https://www.qapital.com/pricing).
- Price: Basic $3, Complete $8, Premier $12 a month, 30-day free trial. No free tier.
- Scale: "2 Million+ members" and "$3B saved by our users" (store screenshot).
- Finland: **no.** US only.

**UI**
- Deep green with white. Goals are full-bleed photo cards with a progress bar and a projected finish date ("Projected to reach $3,000: about 6 months").
- "Payday Divvy" splits each paycheck by percentage (15% spend, 35% goals, 50% left) with one coloured bar.
- "Set & Forget" confirmation chip: "Saving $150 automatically next Friday".

**Brand**
- Line: "Zero-discipline money management" and "Think less. Save more."
- Voice: reassuring, removes the need for willpower.
- Monetisation: subscription.

**Weak spots**
- Charging $3–12 a month to people who struggle to save is hard to defend for our persona.

### 8. Dreams (Sweden)

**Facts**
- Swedish goal-saving app. The user sets a "dream", picks saving tricks, and the app moves money from their bank a little at a time. Also loan consolidation, cashback, shared goals and fund saving (https://apps.apple.com/se/app/dreams-save-to-your-goals/id1083073963?l=en-GB).
- Operated by Dreams Sustainable AB. Not a bank: savings sit with Svea Bank under the deposit guarantee.
- Price: SEK 29 a month after 30 free days.
- Scale: 9,858 Swedish App Store ratings at 4.67. Calls itself "Sveriges populäraste sparapp". User count *(unverified)*.
- Claim: users save "around SEK 1,500 more a month" than before (store description, company claim).
- Finland: **no.** Requires being 18 and registered in Sweden.

**UI**
- Dark aubergine in-app, cream marketing, serif editorial headlines. Feels like a lifestyle magazine, not a bank.
- Dreams are photo cards with a progress bar. Shared dreams show friends' avatars.
- **Saving tricks are illustrated characters and badges:** Tjuven ("the Thief", a hooded figure), Autopiloten, Everest, Sparligan ("the savings league").
- Debt payoff is branded "Skuldfrid" (debt peace).

**Brand**
- Line: "Vad drömmer du om?" (What do you dream of?)
- Voice: soft and aspirational. "Tjuven sparar en slumpmässig summa på en slumpmässig dag, varje vecka." (The Thief saves a random amount on a random day, every week.)
- Monetisation: subscription, plus partner income from loans, cashback and funds.

**Weak spots**
- A paid subscription to save. One market. The same app sells loan consolidation, which mixes saving and credit.
- A random-amount saver needs clear caps and consent to be safe for people with thin balances.

### 9. Fortune City

**Facts**
- Expense tracker turned city-builder, by Fourdesire, published by SPARKFUL. Each logged expense adds a building. The city grows as the habit sticks (https://apps.apple.com/us/app/fortune-city-expense-tracker/id1172713884).
- Price: free with optional subscription. Prices vary by region.
- Scale: third-party install estimates only *(unverified)*. Small in Finland: 32 ratings.
- Finland: **yes** (App Store), English only, manual entry, no bank link.

**UI**
- Saturated gradient backgrounds, an isometric toy city, and a cast of animal mascots (owl, rabbit, fox) who react with moods.
- Entry is a keypad with category icons. Charts are pie and bar.
- The reward is visual and cumulative: the city is the progress bar.

**Brand**
- Line: "Track your spending, grow a city!"
- Voice: cute and openly habit-forming. Store captions: "Gets You Hooked. Watch the City Flourish." "I want to open the app every day!"

**Weak spots**
- Manual logging is the whole job. The game rewards recording, not spending less. Recent reviews mention lost data after an update (https://appgoblin.info/apps/1172713884, *snippet*).

### 10. Acorns

**Facts**
- US micro-investing app. Rounds up card purchases and invests the change in diversified portfolios. Adds retirement, banking and kids' accounts (https://www.acorns.com/pricing).
- Price: subscription tiers Bronze, Silver and Gold. Most sources list $3, $6 and $12 a month. An increase to $4 and $8 was reported in autumn 2026 but I could not confirm it on Acorns' own page *(unverified)*.
- Scale: 960,669 US ratings at 4.75. "Over 16 million all-time customers" is a homepage claim relayed by an aggregator *(snippet, unverified)*.
- Finland: **no.** US only.

**UI**
- Bright green and black. Large balance header over a line chart. A long-range projection screen: "Your Acorns Potential $491,395".
- A leaf-shaped graphic shows how each deposit splits across investing, saving and spending.
- Marketing uses a photoreal squirrel in a suit. It does not appear to act as an in-app coach.

**Brand**
- Line: "Save & invest for your future" and "Your money on autopilot".
- Voice: simple and optimistic. "Starting with just spare change."

**Weak spots**
- A flat monthly fee is a large percentage of a small balance. By my arithmetic, $3 a month on $100 invested is 36% a year. Reviews raise the same point about whether the subscription is worth it (https://www.nerdwallet.com/investing/reviews/acorns, *snippet*).

---

## Group C: youth-leaning neobanks with strong brands

### 11. Monzo

**Facts**
- UK digital bank. 15.2 million customers, £1.7bn revenue in the year to March 2026, 1.6M+ on paid plans (https://monzo.com/annual-report/2026, *snippet*; https://ffnews.com/newsarticle/fintech/monzo-reports-strong-profitable-growth-1-7bn-revenue-and-172-6m-profit-as-it-adds-record-customers-in-the-uk-and-sets-its-sights-on-europe/, *snippet*).
- Price: free account. Paid plans Extra, Perks and Max.
- Markets: UK, and Ireland since April 2026 as its EU base (https://thepaypers.com/fintech/news/monzo-enters-ireland-with-free-accounts-and-eu-ambitions, *snippet*).
- Finland: **no.** The app is in the Finnish store but accounts are for UK and Irish residents.

**UI**
- Hot coral with deep navy. The card is the hero at the top of Home, with the balance on it.
- Below: a plain activity feed with merchant logos and upcoming payments. Tabs: Home, Trends, Payments, Help.
- Marketing uses real hands, real cards and bright flat colour.
- Saving lives in "Pots", fed by round-ups and a "Salary Sorter" that splits pay on arrival (https://monzo.com/blog/2023/02/23/manage-your-money-minimal-effort, *snippet*).
- Signature moment: the **1p Saving Challenge**. Save 1p on day one, 2p on day two, up to £3.65, for £667.95 over a year (https://monzo.com/features/1p-saving-challenge, *snippet*).

**Brand**
- Line: "Download your new favourite bank."
- Voice: the best-documented in banking. Principles: "Straightforward kindness", "Everyday magic", "Warm wit". Rule of thumb: write "We're sorry", not "We'd like to apologise". "Humour is a delicate seasoning in our writing." (https://monzo.com/tone-of-voice/)
- Acquisition and retention: the coral card as a walking advert, community forum, and seasonal challenges. Over a million people joined the 2025 1p challenge, and customers saved over £220M through round-ups in 2025 (https://www.gbnews.com/money/monzo-savings-challenge-2026-1p, *snippet*; https://uk.style.yahoo.com/bank-offers-people-last-chance-120259092.html, *snippet*).
- Monetisation: interchange, lending, paid plans, business banking.

**Weak spots**
- Fined £21.1M by the FCA in July 2025 for weak financial-crime controls during fast growth (https://www.fca.org.uk/news/press-releases/fca-fines-monzo-21m-failings-financial-crime-controls).
- The 2026 1p challenge is limited to paying subscribers and adds monthly £100 prize draws (https://monzo.com/blog/save-gbp667-95-a-year-with-the-1p-saving-challenge, *snippet*). Both are things to think twice about.

### 12. Revolut

**Facts**
- Global finance app: accounts, cards, currency exchange, savings, stocks, crypto.
- Scale: 68.3 million retail customers and $6.0bn revenue in 2025 (https://www.revolut.com/en-AT/news/revolut_reports_record_profit_of_2_3bn_for_2025_as_revenue_surges_to_6bn/, *snippet*). The store now says "Join the 80+ million".
- Price: free plan plus paid plans. *(Finnish plan prices not checked: revolut.com blocked my fetch.)*
- Finland: **yes.** Over 250,000 Finnish customers. Revolut applied in August 2026 for a Finnish branch so customers can get local account numbers (https://thepaypers.com/fintech/news/revolut-applies-for-bank-branch-licence-in-finland). App available in Finnish, rated 4.82 from 11,882 Finnish ratings.

**UI**
- Black, glassy and dense. Photography behind account headers. A row of round action buttons (Add money, Move, Info, More).
- Shows savings progress as small stat tiles ("Saved this month", "Earned this month") and interest paid daily.
- Feels like a trading terminal made friendly. No mascot, little illustration.

**Brand**
- Line: "Change the way you money."
- Voice: short, confident, feature-led. "Your money's safe space, 24/7."
- Acquisition: referrals, travel use case, constant feature launches. *(Channel mix not verified. A points programme called RevPoints exists from memory, not checked.)*

**Weak spots**
- Fined €3.5M by the Bank of Lithuania in April 2025 for anti-money-laundering failings (https://www.finextra.com/newsarticle/45802/revolut-fined-35-million-by-lithuanian-central-bank-for-aml-failings, *snippet*).
- Recurring fraud and customer-support criticism in UK media *(snippet)*. Puts stocks and crypto one tap from a current account, which is the opposite of what a person with no buffer needs.

### 13. Lunar

**Facts**
- Danish neobank for consumers, businesses and under-18s. "1 million users across the Nordics" (store description).
- Raised €46M in January 2026 and is aiming for profitability in 2026. CEO change in mid-2026 (https://tech.eu/2026/01/27/nordic-challenger-bank-lunar-raises-46m-as-looks-to-grow-business-users/, *snippet*).
- Price: free account, paid upgrades for premium and metal cards.
- Finland: **not for consumers, as far as I can confirm.** Operates in Denmark, Sweden and Norway. Funding news names Finland as an expansion target, with a business-banking focus (*snippet*). The app has 12 Finnish ratings and no Finnish language.

**UI**
- Black and vivid green, with sticker-like coloured circles in marketing. Customisable Home ("Edit home") with a green account card.
- "Set your budget with three swipes" (store description). Insights are simple bar charts by category.
- A December 2024 redesign added 3D assets, wallpapers and personalised home screens (https://www.finextra.com/pressarticle/103560/lunar-rolls-out-major-app-update, *snippet*).

**Brand**
- Line: "Bank smarter."
- Voice: upbeat and short. "Share accounts. Share expenses. Share adventures."

**Weak spots**
- Years of losses and repeated funding rounds *(snippet)*. Relevant here mainly as a visual reference: **Lunar already owns "black + bright green" for Nordic youth banking.** Our green needs a different partner colour and shape language to avoid looking like it.

### 14. Klarna

**Facts**
- Payments and shopping app, now adding bank features. 120 million active consumers, Klarna Card at 6.5 million users, 2 million paying members (Q2 2026 results, https://s205.q4cdn.com/644747736/files/doc_earnings/2026/q2/earnings-result/Q2-26-Klarna-Group-plc-Press-Release.pdf, *snippet*).
- Finland: **yes.** Products listed for Finland: pay now, pay in 3, pay in 30 days, financing, Klarna card, bank account, savings accounts, cashback, and membership tiers (https://www.klarna.com/fi/). 48,705 Finnish App Store ratings.
- Price: free to use. Paid membership tiers. Interest and fees on financing.

**UI**
- Pink wordmark on dark aubergine, cream surfaces, black pill buttons with a pink Klarna tag.
- Home mixes balance, card, payments due and shopping offers. Cashback tiles and "double cashback" timers sit next to money management.
- The app is a shop as much as a wallet.

**Brand**
- Line in Finland: "Rahasi ansaitsee parempaa" (Your money deserves better) and "Arkesi rahasovellus" (Your everyday money app).
- Voice: smooth, light, shopping-positive. "Shoppaile fiksummin tänä jouluna."
- Acquisition: checkout buttons at merchants, cashback, influencer and celebrity campaigns *(not verified in detail)*.
- Monetisation: merchant fees, consumer interest and late fees, memberships.

**Weak spots**
- **It is the habit our user needs to break.** The Norwegian Consumer Council reported Klarna because young people do not see "taking it on Klarna" as credit, and because the app suggested the maximum credit limit by default (https://www.vixio.com/insights/pc-norwegian-consumer-council-reports-klarna-breaching-regulatory-requirements, *snippet*).
- A "money app" that rewards spending with cashback teaches the wrong loop.

### Also checked: bunq

- Dutch neobank, 20M+ users (store screenshot), full EU licence, open to residents of EEA countries including Finland (https://help.bunq.com/articles/who-can-open-a-bunq-personal-account, *snippet*). 203 Finnish ratings.
- Rainbow card, photo-led lifestyle marketing, weekly interest payouts shown as "This week you earned €6.24", and an AI assistant ("Finn") answering "What did I spend on restaurants this month?" in chat.
- Paid plans up to about €18.99 a month (third-party, 2025 price list, *unverified*). Niche in Finland.

---

## Group D: what a Finnish 18–35 year old actually uses

### 15. MobilePay (becoming Vipps)

**Facts**
- The default way to send money between people in Finland. **3 million users in Finland**, on more than every second Finn's phone (https://www.sttinfo.fi/tiedote/72227146/mobilepayn-kayttajamaara-ylitti-3-miljoonaa?lang=fi).
- The name changes to **Vipps on 12 January 2027**. The icon already changed on 6 October 2026. The blue colour stays in Finland (https://www.sttinfo.fi/tiedote/72387706/mobilepayn-nimeksi-vipps?lang=fi).
- A version for 7–14 year olds launched in June 2026 and had 12,000 users in two months.
- Price: free for consumers.

**UI**
- Flat periwinkle blue, white cards, large amounts, avatars and emoji in payment notes.
- Core screens: send, request, split, shared "boxes" for collecting money, tap to pay, loyalty cards.
- No budgeting, no insights, no saving.

**Brand**
- Line: "MobilePaylla maksaminen on helpon helppoa!" (Paying with MobilePay is easy-peasy.) Current store caption: "Kaikki maksut yhdessä sovelluksessa. Kuten ennenkin." (All payments in one app. Just like before.)
- Voice: light, social, never about discipline.

**How it compares, honestly**
- Not a competitor for coaching. It is the benchmark for **how casual and fast money can feel in Finnish**, and it is where social spending (splitting a Wolt order, a bar tab) happens. A coach that ignores MobilePay transfers will misread a young person's spending.

### 16. OP-mobiili

**Facts**
- App of OP Financial Group, Finland's largest bank group. Banking, loans, investing and insurance in one app. User numbers not found *(unverified)*.
- App Store rating **2.98** from 2,619 ratings on 2026-11-13.
- Price: free with an OP customer relationship.

**UI**
- White with thin orange line icons and plain list rows. Five tabs: Home, Loans, Investments, Insurance, Customer info.
- "My finances" shows income and expenses per month and sorts spending into **Needs, Wants, and Savings and investments**.
- "Money Box" is a saving target with one progress bar ("Vacation trip 140.17 / 500.00").
- An assistant entry point ("How can I help you?"). OP Aina is the bank's AI assistant: it watches accounts, flags late payments and failed card payments, and suggests actions (https://www.op.fi/en/private-customers/digital-services/op-aina, *snippet*).

**Brand**
- Voice: functional and safe. "Smooth and secure transactions." "Balance your finances."
- Retention: it is the bank. People open it because they must.

**How it compares, honestly**
- OP has the pieces a coach needs (needs/wants split, a goal, an assistant) but presents them as a statement, not a habit. No streak, no character, no celebration. The low store rating suggests frustration, though I did not read the reviews.

### 17. Nordea Mobile

**Facts**
- Nordea's Finnish banking app. Rated 4.49 from 201,493 ratings. User numbers not found *(unverified)*.
- Latest feature release 4.36 in June 2026 added a new Invest tab (https://www.nordea.fi/en/apps/netbank/household/productstore/internet/new-nordeamobile.html, *snippet*).

**UI**
- Deep Nordea blue header over white cards. Five tabs: Overview, Pay, Invest, Services, Help. Isometric blue icons.
- The Overview can be rearranged, and accounts from other banks can be added.
- An Insights tab shows spending by month or year with adjustable categories and a budget (https://www.nordea.fi/en/personal/our-services/online-mobile-services/mobile-banking/managing-your-finances.html, *snippet*).
- The Invest tab carries an "AI News Summary" of market news.

**Brand**
- Line: "Bank in your pocket". Voice: corporate and calm. "Invest confidently for the future you want."

**How it compares, honestly**
- Well-rated and complete as a tool. It answers "what happened to my money", not "what should I do today". Aimed at all ages, not at youth.

### 18. Anyfin

**Facts**
- Swedish fintech that refinances existing credit (instalment plans, card debt, loans) at a lower rate, then helps the user pay it off faster. The app also lists subscriptions and fixed costs, and offers a credit block (https://apps.apple.com/se/app/anyfin/id1412749891).
- Finland: **yes.** Finnish language in the app, 1,559 Finnish ratings, Finnish product pages for refinancing, consumer credit, credit card and car loans (seen in the navigation of anyfin.com/fi).
- Price: the app is free. Income is interest on the loans.
- Expanding in Germany with a SEK 450M investment in October 2026 (*snippet*).

**UI**
- Warm yellow and cream with dark brown text. A soft, white cartoon character with a jetpack appears on Home. It is the closest thing to a mascot among the Finnish-available finance apps.
- The payoff planner is the standout screen: choose a monthly amount and each option shows a tag with the months until debt-free (54, 45, 30, 12).
- Extra payments are one tap ("Pay 1,500 kr", "Pay 264 kr", "choose another amount").

**Brand**
- Line: "Betala mindre för dina krediter" (Pay less for your credit). "Betala mindre ränta, betala av mer."
- Voice: on your side against expensive lenders.
- Acquisition: paid influencer posts, among other channels.

**Weak spots**
- **Reprimanded by the Finnish Consumer Ombudsman in June 2024.** Its loans were marketed as a savings tool, influencer posts presented the app as a budgeting tool, and costs were not shown clearly. Anyfin agreed to change its practices (https://www.kaleva.fi/anyfin-kuluttajaluottojen-markkinointi-totuudenvas/11019889).
- It is a lender dressed as a helper. The friendliest brand in the Finnish debt space is still selling credit.

### Baseline: S-mobiili (the product we extend)

Not a competitor, but the starting point judges will compare against.

- S-Pankki had **896,000 active customers** at the end of June 2026 (https://www.sttinfo.fi/ir-files/4521144/72204705/24007/S-Pankki%20Oyj%20puolivuosikatsaus%20H1%202026.pdf, *snippet*). S-mobiili user numbers were not found *(unverified)*.
- The app combines banking with co-op member services: Bonus tracking with a gauge to the next Bonus level, the S-Etukortti in the phone, itemised digital receipts, and benefit coupons (store screenshots).
- "Bonus and Purchases" lets members "review the breakdown of your purchases into different product groups, the degree of Finnish origin of your shopping basket, and compare price levels with competitors" (store description).
- About 60% of S Group customers aged 18–24 have added the card to their phone (https://www.sttinfo.fi/tiedote/72352331/joka-viides-s-ryhman-bonusosto-kirjataan-nyt-puhelimella-mobiilibonustelu-ohitti-maksukortin-sirun?lang=fi).
- **Säästäjä**, S-Pankki's micro-saving service, already does the mechanics: a chosen amount moves to savings on every debit-card payment, Bonus can flow straight to savings, and the service gives a fund recommendation with a suitability statement (https://dokumentit.s-pankki.fi/tiedostot/saastajan_palvelukuvaus_fi).
- Säästäjä had over 130,000 users at the end of January 2026. Nearly 71,000 save €0.50–5 from each card purchase (average €1.36), 67,000 route their Bonus to savings, and 55% of people who opened it in 2025 had never invested before. Only 11% of its users are 18–25 and 26% are 26–35 (https://dokumentit.s-pankki.fi/tiedostot/s-pankki-saastajien-suomi-032026).
- Visually: S green and white, dense, coupon-heavy. Useful, not motivating.

---

## Group E: interaction benchmarks outside finance

Only the mechanics that transfer to money.

### Duolingo

- **Scale:** 64.9 million daily users and 13.1 million paid subscribers in Q3 2026 (https://www.sec.gov/Archives/edgar/data/0001562088/000162828026069474/q3fy26duolingo9-30x26share.htm, *snippet*).
- **Look (in-app screens checked):** white canvas, saturated flat colours (green #58CC02, orange for streak, purple for quests), thick rounded shapes with a darker bottom edge that reads as a pressable 3D button, rounded bold type, and a cast of characters. Home is a vertical path of round nodes with one "CONTINUE" bubble. A top bar shows streak, gems and energy at all times.
- **Mechanics that transfer:**
  - **The smallest possible action keeps the streak.** When Duolingo let one lesson extend the streak, day-14 retention rose 3.3% and the number of learners on a 7+ day streak rose by over 40%. A learner who reaches day 7 is 2.4 times as likely to come back the next day (https://blog.duolingo.com/improving-the-streak).
  - **Streak protection.** A second streak-freeze slot brought back 200,000 more daily users. Shared friend streaks make daily completion 22% more likely (https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs).
  - **Commitment at the start.** A "Commit to my goal" button in place of "Continue" brought 10,000 more daily opens (same source).
  - **A streak screen worth visiting:** big number, flame, and a month calendar showing practised days and freezes used.
  - **Quests with visible timers and a chest at the end** ("Daily quest: Complete 2 lessons", "Friends quest").
- **Brand:** the mascot is the media channel. The TikTok account grew from 50,000 to 16 million followers in about four years with "unhinged" humour (https://www.thedrum.com/news/2025/02/25/duolingo-s-tiktok-mastermind-its-unhinged-social-strategy-and-killing-its-mascot, *snippet*).
- **What not to copy:**
  - Fear-based reminders. The owl's guilt-trip notifications are part of the joke for language learning. They are not a joke for someone short on rent.
  - The energy system that replaced hearts in 2025 drains on every exercise and pushes free users to pay or watch ads. It drew petitions and public complaints (https://www.androidauthority.com/quitting-duolingo-energy-system-3599842/, *snippet*).
  - The 2025 "AI-first" announcement cost goodwill with exactly the young audience the brand had won (https://fortune.com/2025/05/24/duolingo-ai-first-employees-ceo-luis-von-ahn/, *snippet*).

### Finch

- **Scale:** 775,318 US ratings at **4.95**, the highest in this report. Finch Plus costs about $9.99 a month or $39.99–69.99 a year depending on the offer (Appllama listing, October 2026). Download and revenue figures are third-party estimates *(unverified)*.
- **Look (in-app screens checked):** deep teal background, soft rounded cards, a small bird in a room at the top of Home, amber accents. Calm and cosy where Duolingo is loud.
- **Mechanics that transfer:**
  - **A companion you look after by looking after yourself.** Onboarding has you choose and hatch an egg ("You hatched a birb!") and pick a personality trait for it. The app invests in attachment before it asks for anything.
  - **Effort is the currency.** Each completed goal gives energy. Energy fills a bar that sends the bird on an "adventure". Goals are tiny by default ("Get out of bed", "Drink water").
  - **Celebration is brief and kind:** confetti over the list and "Hooray! First time completion!".
  - **No punishment for a missed day.** The pet does not suffer. A missed day shows a repair icon, not a broken streak (https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs). The profile says "1 day streak. Longest self-care streak ever!".
  - **A soft economy:** earned stones buy outfits and furniture. Daily and seasonal quests. Friends can send encouragement.
- **Caveat:** some users say the lack of consequences is why the habit never formed (https://habitbox.app/blog/finch-app-review, *snippet*). The right answer for money is probably Finch's kindness with Duolingo's clarity.

### Headspace

- **Scale:** 973,769 US ratings at 4.84. About $12.99 a month or $69.99 a year (third-party, *snippet*).
- **Look:** warm orange and yellow, hand-drawn blobs with simple smiling faces, large friendly type, a "Today" tab that lays out a short plan for the day.
- **Mechanics that transfer:**
  - **A daily plan of three or four small items** in time order ("Start your day", then a breathing exercise, then a monthly reflection).
  - **Sessions sized in minutes** on every card ("3–7 min", "1 min"), so starting never feels heavy.
  - **A monthly check-in** ("Monthly Stress Reflection") that tracks a feeling, not just activity. For us: a monthly "how do you feel about money" pulse next to the numbers.
  - **Characters with feelings but no names or jokes.** Proof that a brand can be soft and illustrated without being childish.

---

## 1. Comparison table

| Product | Target | Core mechanic | Visual style | Tone | Mascot | Gamif. (0–3) | Price | In Finland |
|---|---|---|---|---|---|---|---|---|
| Cleo | Young US adults short on cash | AI chat coach, cash advance | Maroon and cream, grotesk type, no illustration | Sassy friend (roast or hype) | n | 1 | Free; $5.99–14.99/mo | n |
| Emma | UK adults with many accounts | Account aggregation, subscription tracking | Indigo and purple, cyan accents | Practical | n | 0 | Free; about £5–15/mo | n |
| Copilot Money | Design-minded US iPhone users | Auto-categorised dashboard, AI findings to approve | Light blue glass, emoji icons | Calm expert | n | 0 | $109/yr | n |
| YNAB | Committed budgeters | Zero-based budget method | Blurple and lime, cash illustrations | Honest, warm teacher | n | 1 | $14.99/mo or $109/yr | partly (app yes, bank sync unconfirmed) |
| Plum | UK and EU savers 25–40 | Automatic saving rules, investing | Purple, green, yellow, 3D goal art | Cheerful wordplay | n | 2 | Free; £3.99–14.99/mo | n |
| Zogo | US teens and young adults via credit unions | Lessons and quizzes for rewards | White, blue, green | Encouraging | n | 3 | Free (institution pays) | n |
| Qapital | US savers | Rule-based saving, paycheck split | Deep green, photo goal cards | Reassuring | n | 2 | $3–12/mo | n |
| Dreams | Swedish adults 20–40 | Goal saving with named "tricks" | Aubergine and cream, serif, illustrated tricks | Soft, aspirational | partly (trick characters) | 2 | SEK 29/mo | n |
| Fortune City | Casual trackers, game fans | Log expenses to grow a city | Pastel gradients, isometric city | Cute | y | 3 | Free; optional subscription | y (English, manual) |
| Acorns | US first-time investors | Round-ups into portfolios | Green and black, charts | Simple, optimistic | marketing only | 1 | about $3–12/mo | n |
| Monzo | UK 18–40 | Bank with pots, round-ups, seasonal challenge | Hot coral and navy, card as hero | Warm, witty, plain | n | 2 | Free; paid plans | n |
| Revolut | Mobile-first Europeans | All-in-one finance app | Black, glassy, photographic | Confident, short | n | 1 | Free; paid plans | y |
| Lunar | Nordic 18–35 and small firms | Neobank with custom home | Black and vivid green | Upbeat | n | 0 | Free; paid plans | n (consumer launch unconfirmed) |
| Klarna | Online shoppers | Pay later, cashback, card | Pink on aubergine, cream | Smooth, shopping-positive | n | 1 | Free; fees on credit | y |
| bunq | EU expats and digital natives | Neobank with AI chat | Rainbow, lifestyle photos | Breezy | n | 1 | Free; paid plans | y |
| MobilePay | Everyone in Finland | Person-to-person payments | Flat blue, avatars | Light, social | n | 0 | Free | y |
| OP-mobiili | All OP customers | Full bank app, needs/wants split, AI assistant | White, orange line icons | Functional | n | 1 | Free | y |
| Nordea Mobile | All Nordea customers | Full bank app, insights, budget | Nordea blue, white cards | Corporate calm | n | 0 | Free | y |
| Anyfin | Nordic adults with consumer debt | Refinance and pay off faster | Yellow and cream, cartoon character | On-your-side | partly | 1 | Free app; loan interest | y |
| S-mobiili (baseline) | S Group co-op members | Bank, Bonus, receipts, benefits | S green and white, coupons | Helpful, retail | n | 1 | Free | y |
| Duolingo (benchmark) | Everyone | Daily lesson, streak, quests | White, saturated flats, 3D-edge buttons | Playful, cheeky | y | 3 | Free; about $84–120/yr | y |
| Finch (benchmark) | Teens and young adults | Self-care goals grow a pet | Teal, soft, cosy | Gentle | y | 3 | Free; about $40–70/yr | y (English) |
| Headspace (benchmark) | Stressed adults | Short daily sessions | Orange and yellow, blob characters | Calm, kind | characters | 1 | about $70/yr | y (English) |

Gamification scores and "partly" entries are my judgement from screenshots and listings. Benchmark prices come from App Store in-app purchase listings (Duolingo, Finch) and a third-party page (Headspace), in US dollars.

---

## 2. Positioning map

Two axes. Horizontal: **serious to playful** (how the product looks and talks). Vertical: **tracking tool to active coach** (does it show you what happened, or tell you what to do next and push you to do it).

Scores run from −2 to +2 and are my judgement.

| Product | Serious (−2) to playful (+2) | Tracker (−2) to coach (+2) |
|---|---|---|
| Nordea Mobile | −2 | −2 |
| OP-mobiili | −2 | −1 |
| Revolut | −1 | −2 |
| S-mobiili | −1 | −2 |
| Copilot Money | −1 | 0 |
| Emma | 0 | −1 |
| Lunar | 0 | −2 |
| MobilePay | +1 | −2 |
| Klarna | +1 | −2 |
| Monzo | +1 | −1 |
| Fortune City | +2 | −1 |
| YNAB | −1 | +2 |
| Anyfin | 0 | +1 |
| Acorns | 0 | +1 |
| Qapital | 0 | +1 |
| Plum | +1 | +1 |
| Dreams | +1 | +1 |
| Zogo | +1 | +1 (teaches, but not about your own money) |
| Cleo | +2 | +2 |
| *Benchmarks:* Headspace | +1 | +1 |
| *Benchmarks:* Finch | +2 | +2 |
| *Benchmarks:* Duolingo | +2 | +2 |

**In words**

- **Bottom left, serious trackers:** all Finnish bank apps, plus Revolut. Crowded. This is where S-mobiili sits today.
- **Bottom right, playful tools:** MobilePay, Klarna, Monzo, Fortune City. Friendly surfaces, but they help you pay or record, not change.
- **Top left, serious coaches:** YNAB alone. It works, but demands effort and money.
- **Middle band, automation:** Plum, Qapital, Dreams, Acorns, Anyfin. They do the saving for you. Coaching is light, and each one charges a fee or sells credit.
- **Top right, playful coaches:** Cleo is the only finance product here, with Duolingo and Finch showing what the corner looks like in other categories.

**White space**

> A playful, daily, mascot-led coach that works on the user's real transactions, is available in Finnish, is free, and never earns money from the user's debt.

No product in this report meets all five conditions. Cleo is not in Finland, has no mascot, and earns from cash advances. Zogo is not in Finland and is not connected to real money. Dreams is Sweden only, paid, and sells loan consolidation. Fortune City is playful and available but is a manual tracker in English. The Finnish bank apps have the data and the trust but none of the play.

A second, smaller gap is **visual**: among products available in Finland, none uses a mascot with moods. Anyfin has a character but it decorates a loan product. Green is partly taken: Lunar pairs it with black, Acorns with black, Qapital uses deep green. S green with a warm, bright secondary palette and thick rounded shapes would not be confused with any of them.

---

## 3. Patterns worth borrowing

| # | Pattern | Who does it best | Evidence | How it maps to our app |
|---|---|---|---|---|
| 1 | **One tiny action a day keeps the streak** | Duolingo | +3.3% day-14 retention and 40% more people on a 7+ day streak when one lesson was enough (https://blog.duolingo.com/improving-the-streak) | The daily action must take under 30 seconds: check "left to spend", confirm one transaction, answer one question. Never tie the streak to *not spending*. |
| 2 | **Streak protection and repair** | Duolingo (freeze), Finch (repair icon) | A second freeze slot brought back 200,000 daily users (https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs) | Give freezes freely. Add a "tight week" mode the user can switch on before payday, so a hard week does not also cost them their streak. |
| 3 | **A companion whose mood follows effort, not balance** | Finch | 4.95 store rating. Egg-hatching onboarding, energy per completed goal, no suffering pet | The mascot is proud when you showed up, curious when you have been away, never sad because you are broke. Moods: proud, curious, sleepy, hyped. No disappointed face about spending. |
| 4 | **Chat with a chosen tone** | Cleo | Roast and Hype modes are the most talked-about feature | Offer tone as a setting (gentle, straight, cheeky). Default to gentle. Any roast is opt-in and never about debt or hardship. |
| 5 | **Named automatic saving rules** | Dreams (Tjuven, Autopiloten), Plum (Rainy days, 52-week), Qapital | Dreams claims about SEK 1,500 more saved a month (company claim) | Skin Säästäjä's existing options as characters or cards: "Round it" (per purchase), "Bonus stash" (Bonus to savings), "Payday first" (monthly). |
| 6 | **Micro-saving on every purchase as the default path** | Acorns, Monzo, and S-Pankki's own Säästäjä | Monzo customers saved over £220M via round-ups in 2025 *(snippet)*. Säästäjä users average €1.36 per purchase | Make switching this on the first "win" of onboarding, with the mascot celebrating the first cents saved. |
| 7 | **A time-boxed, shared challenge** | Monzo 1p Saving Challenge | Over a million participants in 2025 *(snippet)* | A Finnish seasonal challenge with a fixed start date and a known total: "Joulukuun euro" (a euro more each day) or a 30-day "no delivery" challenge. Keep it free. |
| 8 | **Findings first, then one-tap approve** | Copilot Money | "Insights before you even ask." "You just approve." | The coach opens with what it noticed ("3 subscriptions you did not use last month: €27") and one button. No dashboards to interpret. |
| 9 | **One hero number: left to spend** | Copilot ("$2,272 left"), Emma (donut "left of"), YNAB ("Ready to assign") | All three lead with it | Home shows "left until payday" and a per-day figure. Everything else is below the fold. |
| 10 | **Subscription list with a cancel nudge** | Emma, Anyfin, Rocker | Each has a dedicated screen | Bank data makes this exact. Pair it with a quest: "Cancel one thing you forgot about". |
| 11 | **Bite-size lessons tied to real rewards** | Zogo | 200+ institutions pay for it | Tie each lesson to the user's own data ("you paid €14 in delivery fees this week, here is how that works"), and pay rewards in Bonus or S Group benefits, not gift cards. |
| 12 | **Written tone rules** | Monzo, YNAB | Monzo's public guide: "We're sorry", not "We'd like to apologise". YNAB: "You're bad at money (but not a bad person)." | Put a short tone guide in the brand kit so every AI-generated screen sounds the same: plain Finnish, short sentences, no shame, humour as seasoning. |
| 13 | **Payday split** | Qapital (Payday Divvy), Monzo (Salary Sorter) | Core feature in both | On payday the mascot proposes a split (bills, daily money, savings) with one slider. This is the highest-value moment of the month. |
| 14 | **Show the finish line in time, not just money** | Anyfin (months to debt-free), Qapital ("about 6 months") | Seen in both payoff and goal screens | Goals and any debt show "X weeks to go at this pace", and how one extra action today changes that. |

---

## 4. Patterns to avoid

| # | Pattern | Seen at | Why it is wrong for a regulated Finnish bank |
|---|---|---|---|
| 1 | **Guilt and fear in push notifications** | Duolingo's reminder persona | Nearly half of Finns under 30 already worry about money weekly. Shame makes people stop opening a money app. It also sits badly with the Consumer Ombudsman's principle that people must be able to decide "calmly without undue pressure or inducement" (written about credit, https://www.kkv.fi/en/current/press-releases/the-consumer-ombudsman-intervened-in-the-unlawful-marketing-of-consumer-credits/). Notifications should invite, never accuse. |
| 2 | **Fake urgency: countdowns and "only today" on saving or investing** | Common in subscription apps. Klarna's timed "double cashback" tiles | Urgency pushes spending and rushed product decisions. For anything touching credit, emphasising speed is explicitly not allowed in Finland (same KKV source). Real deadlines (payday, a bill due date) are fine. Invented ones are not. |
| 3 | **Gambling-like random rewards with real money** | Monzo's £100 monthly prize draws for challenge savers. Loot-chest mechanics in games | A random cash prize for depositing money looks like a lottery, and variable rewards are the mechanism behind compulsive play. Finnish lottery and marketing rules need a legal check before any prize draw *(not verified here)*. Keep rewards fixed, earned and predictable. Random *cosmetics* for the mascot are a safer place for surprise. |
| 4 | **Earning from the user's shortfall** | Cleo (about 62% of revenue from cash-advance fees, $17M FTC settlement) | The coach's incentive must point the same way as the user's. In Finland, credit must not be marketed as an everyday thing or a way to fulfil dreams, speed must not be the pitch, and credit must not be advertised as available to people with payment default entries (KKV source above). The app should never surface a loan, overdraft or BNPL offer as a solution inside a coaching flow. |
| 5 | **Pushing investments at people with payment problems or no buffer, and gamifying trading** | Revolut and others place stocks and crypto beside the current account | ESMA has warned that gamification in trading apps can lead retail investors to trade without understanding the risks, and proposed that techniques encouraging more trading in risky products should not be allowed (https://www.esma.europa.eu/press-news/esma-news/esma-makes-recommendations-improve-investor-protection, *snippet*). Our order should be: stop the leaks, build a buffer, then invest through the existing Säästäjä flow with its suitability statement. No streaks, badges or confetti for buying or trading. Celebrate the habit of regular saving, not the transaction. |
| 6 | **Paywalling the core and nagging to upgrade** | Emma's upgrade prompts, Duolingo's energy system, subscriptions at Qapital, Dreams and Acorns | Charging someone on under €2,000 a month in order to help them save is self-defeating. Energy or lives that block use until you pay were the most criticised change at Duolingo. The trainer should be free and unlimited. |
| 7 | **Roast by default, profanity, humiliation** | Cleo's default persona | Works as entertainment in a US startup. From a bank it reads as contempt, and for someone in real difficulty it is harmful. Cheeky only when chosen, and never about debt, late payments or low balance. |
| 8 | **Overclaiming savings or blurring what the product is** | Anyfin in Finland (reprimand, June 2024) | Promised savings that could not be guaranteed and influencer posts that presented a lender as a budgeting tool (https://www.kaleva.fi/anyfin-kuluttajaluottojen-markkinointi-totuudenvas/11019889). Any "you could save €X" must be calculated from the user's own data and labelled as an estimate. Influencer content needs the same disclosures. |
| 9 | **Leaderboards and social comparison in euros** | Zogo's leaderboards are harmless because they rank quiz points | Ranking people by money saved shames low earners and leaks private information. Compare effort only (streak length, quests done), and only among friends who opted in. |
| 10 | **Hard-to-leave flows** | Cleo (blocked cancellation while an advance was open, per FTC) | Every automation (round-ups, Bonus saving, challenges) must be switchable off in one tap, as Säästäjä's terms already promise. |

Related change to watch: the revised EU Consumer Credit Directive brings buy-now-pay-later products into scope, and Finnish rules implementing it are expected to apply from 20 November 2026 (https://kpmg.com/fi/fi/ajankohtaista/riskit-ja-saantely/eun-kuluttajaluottodirektiivi-ja-kuluttajaoikeusdirektiivin-muutosdirektiivi-tuovat-muutoksia-kuluttajansuojalakiin.html, *snippet*; final Finnish date not confirmed). It supports a clear anti-BNPL stance.

---

## 5. Our angle

What this app can own because a bank and the S Group stand behind it.

**1. It already knows, so there is nothing to connect.**
Cleo, Emma, Copilot and YNAB all start by asking the user to link bank accounts through a third party. Ours starts with the user's real S-Pankki transactions on first open. The first screen can already say something true: "You spent €212 on food delivery last month." No competitor available in Finland can do that on day one.

**2. Basket-level coaching, not just merchant-level.**
Other apps see "Prisma €60". S Group sees the receipt. S-mobiili already breaks purchases into product groups and compares price levels with competitors. The trainer can turn that into actions no one else can offer: "Swapping these 4 items for the store brand saves about €9 a week", or "Two Wolt dinners cost what five Prisma dinners did." Needs the member's consent to use purchase data in this way.

**3. Bonus as the reward currency.**
Duolingo pays in gems, Zogo in gift cards, Monzo in prize draws. We can pay in something real that the user already understands: Bonus and S Group benefits. A finished weekly quest could unlock a concrete benefit at S-market, Prisma or ABC. Rewards that reduce the grocery bill reinforce the goal instead of fighting it. *(Needs a commercial decision from S Group; not something the hackathon team can promise.)*

**4. The saving and investing rails exist. We add the reason to use them.**
Säästäjä already saves from every card purchase, routes Bonus to savings, and includes a suitability check. It has 130,000 users, but only 11% of them are 18–25. That is the gap: the mechanics work, the motivation layer for young people is missing. "Start investing" becomes a milestone the mascot leads up to after a buffer exists, and the regulated part is handled by a flow that is already approved.

**5. A coach with no reason to sell you debt.**
Cleo earns from cash advances, Klarna from pay-later, Anyfin from loans, Dreams from a subscription and loan referrals. A co-operative bank that returns value to members as Bonus can say plainly: free, no ads for credit, no upsell in the coaching flow. In a market where the Consumer Ombudsman is actively policing credit marketing, "the money app that will never offer you a loan" is a position competitors cannot copy without breaking their model.

**6. Finnish, local and physical.**
Every playful coach in this report is English-first and American or British in its references. Ours can speak Finnish (and Swedish), know when Kela and student-aid payments arrive, understand MobilePay transfers between friends, and set quests around real places: an ABC coffee skipped, a Prisma shop instead of a delivery. S Group stores are a physical touchpoint no app-only competitor has.

**7. The only mascot in Finnish banking.**
OP, Nordea and S-mobiili are all text and tables. Lunar and Revolut are slick and cold. A character with moods, a streak and small celebrations, in S green with a bold, warm palette, would be instantly recognisable in a Finnish App Store screenshot. The brand kit should fix three things so the mascot never drifts into the patterns in section 4: it reacts to effort, it never mocks, and it never appears next to a credit offer.

---

## What I could not verify

- **User numbers** for OP-mobiili, Nordea Mobile, S-mobiili, Dreams, Copilot Money, YNAB and Finch. Store rating counts are given instead.
- **Acorns' current prices** (reported rise to $4 and $8 for the lower tiers) and its "16 million customers" figure.
- **Emma, Cleo, bunq and Headspace prices** come from third-party pages, not the companies' own pricing pages.
- **Revolut's Finnish plan prices and its RevPoints programme.** revolut.com blocked automated access.
- **Lunar in Finland.** No evidence of a consumer launch. Finland is named only as an expansion target.
- **YNAB bank sync for Finnish banks.** Finland is listed for European import, individual banks not checked.
- **Cleo's "Roast Mode" copy examples.** The modes are confirmed by several sources, but the widely quoted lines were not traced to a primary source, so I used store copy instead.
- **Acquisition channel details** for most products (TikTok, referrals, influencer spend). Only Duolingo's and Anyfin's are sourced.
- **Finnish law on prize draws and lotteries in marketing,** and the final date the new consumer-credit rules apply in Finland. Both need a legal check.
- **Omat ostot user numbers.** The only figure found (380,000 users) dates from January 2020.
- **In-app behaviour.** No app was installed. Navigation and flows are read from store screenshots, except Duolingo and Finch, which were checked against in-app screen captures.
- **The Junction challenge brief itself** was not found online, so this report follows the description given to me.
