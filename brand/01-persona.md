# 01 · Persona

Status: v0.1, 2026-11-13. The people below are invented. Their budgets are illustrative assumptions, not data. The statistics are real and sourced in [`research/s-pankki-brand-audit.md`](../research/s-pankki-brand-audit.md), section 6.

## Who we design for

People aged 18 to 35 in Finland who:

- earn **under €2,000 net a month**,
- have never been taught to budget and do not track spending,
- lose a real share of their money to small, frequent, avoidable purchases,
- could save and later invest if those leaks were visible.

## Why this group (real numbers)

| Fact | Source |
|---|---|
| The low-income line for a person living alone is about €1,530 net a month. About one in three 18 to 24 year olds lives in a low-income household. | Tilastokeskus, 2025 |
| 48 % of under-30s worry about money at least weekly. 21 % have no savings at all. | S-Pankki / Kantar, 2026 |
| Financial knowledge is weakest among 18 to 29 year olds. | Ministry of Justice, 2023 |
| First payment defaults are most common at 20 to 24. | Suomen Asiakastieto, 2026 |
| New debt-collection cases peak at 25 to 29. | Lowell, 2026 |
| Young adults find buy-now-pay-later purchases hardest to keep track of. | Intrum survey via Verkkouutiset, 2024 |
| Nearly three in four young adults want saving to be automatic. Only 11 % of Säästäjä users are 18 to 25. | S-Pankki, 2026 |

## Primary persona: Aino, 24

> "I'm not bad with money. I just don't know where it goes."

| | |
|---|---|
| Lives | Tampere, rented studio, alone |
| Work | Full-time in a clothing shop; one evening course at an open university |
| Income | About €1,750 net a month, paid on the 15th |
| Bank | S-Pankki since she got her S-Etukortti at 18; uses S-mobiili to pay and to check her balance |
| Phone | iPhone, about 5 hours a day; TikTok, Instagram, Snapchat, Wolt, Vinted |
| Savings | €180 on the main account. No buffer, no investments |

### Her month (illustrative)

| Basket | What is in it | Per month |
|---|---|---|
| Fixed (mandatory, regular) | Rent €690, electricity €35, phone and internet €45, transport pass €60, home insurance €12 | €842 |
| Curveballs (mandatory, irregular) | Dentist, phone screen, winter coat, gifts, annual fees, averaged over a year | about €110 |
| Leaks (everyday, slips away) | Food delivery €140, subscriptions €62 (five of them, two unused), buy-now-pay-later instalments €85, impulse clothing €120, bars, coffee and energy drinks €110 | €517 |
| Food and household | Groceries, mostly S-market and Prisma | €260 |
| **Left** | | **about €20** |

### Where the room is

About **€220 a month** of her leaks could go without her feeling poorer: two unused subscriptions (€24), half the delivery orders replaced by cooking (€70), no new instalment purchases (€85 once the current ones end), and a cap on impulse buys (€40). That is about **€2,640 a year**, or a three-month buffer in about two years. She has never seen this number.

### Behaviour

- Checks her balance before she pays, never afterwards.
- The week before payday is tight. She uses pay-later to get through it.
- Has tried a spreadsheet twice. Each lasted under two weeks.
- Opens apps that give her something small every day: Duolingo streak of 212 days, BeReal, Snapchat streaks.
- Feels shame when banks send her "advice". Reads it as being told off.
- Is curious about investing because of TikTok, and is afraid of doing it wrong.

### Goals

1. Get to payday without borrowing.
2. Have €1,000 that she does not touch.
3. Go to Japan with a friend in 2028.
4. Start investing "something, even €20".

### Frustrations

- Bank apps show lists of transactions, not answers.
- Budget apps want an hour of setup and manual entry.
- Advice assumes she has money to spare.
- She cannot tell which costs are normal for someone like her.

### What she needs from us

| Need | What the app does |
|---|---|
| "What can I spend this week?" | One hero number on home: safe to spend until payday |
| "Where does it go?" | Three baskets, sorted for her, no setup |
| "Is that normal?" | Benchmarks against people like her (Statistics Finland) |
| "What do I do about it?" | One tiny action a day, never a lecture |
| "Am I getting anywhere?" | Streak, berries, jars filling up, a weekly receipt |
| "Don't judge me" | A coach whose mood follows her effort, not her balance |

### Questions she would ask the chat

- "How much did I spend on Wolt last month?"
- "Can I afford the concert on Friday?"
- "What am I paying for that I don't use?"
- "What happens if I skip takeaway twice a week?"
- "Is €60 a month on subscriptions a lot?"
- "How do I start investing with €20?"

## Secondary personas

### Eetu, 20, student in Jyväskylä

- Income about €1,000 a month: study grant, housing support, student loan drawn monthly, weekend shifts.
- Spends the loan as if it were income. Energy drinks, gaming purchases, kebab at 2 am.
- First unpaid bill last spring (gym contract). Scared of a payment default entry.
- Needs: to see the loan as debt, to survive an irregular bill, to avoid the first default.
- Speaks English with half his friends, so the app must work in both languages.

### Sara, 31, practical nurse in Vantaa

- Income about €1,950 net a month with shift pay. Shares a flat with her partner.
- Three pay-later plans and a credit card she pays the minimum on. No idea of the total.
- Wants to buy a home one day and thinks it is impossible.
- Needs: one view of everything she owes, a payoff order, and proof that small sums add up.
- Less patient with cute. For her, the mascot must be useful first.

## Who we do not design for

- People who already budget in a spreadsheet and want 40 categories.
- Active investors who want trading tools.
- People in a debt crisis. The app must spot this and point to free help (Takuusäätiö, municipal debt advice), not coach it away.

## Design rules that follow from the persona

1. **No setup.** Value in the first minute, from data the bank already has.
2. **One number, one action.** Never open on a dashboard of charts.
3. **Small sums are the point.** €1 to €5 actions. Celebrate them as much as big ones.
4. **Payday is the calendar.** Count in "days to payday", not calendar months.
5. **Tight weeks are normal.** A tight-week mode pauses saving goals and protects the streak.
6. **Never shame.** No red totals as the first thing on screen, no "you overspent", no disappointed mascot.
7. **Investing comes after a buffer.** Teach it early, offer it late.
