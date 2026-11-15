// Teaching cards. Each explains one idea using the customer's own numbers and asks them to predict before the answer
// is revealed. The right answer and the wrong options are all computed here; the model only presents the card.
import type { ConceptId, Fact, Overview, TeachingCard } from "@/lib/types";
import { RETURN_SCENARIOS } from "./scenario";
import { fact } from "./facts";
import { round2 } from "./math";

export const CONCEPTS: ConceptId[] = ["three-baskets", "safe-to-spend", "fixed-vs-spot", "buffer-first", "compound-growth", "switching-bills", "pay-yourself-first"];

const euros = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;

// A stable way to place the right answer among the options, so the same customer always sees the same card.
// `why` holds one kind sentence per option and is placed in the same order, so whyWrong[i] explains options[i].
function placeCorrect(seed: string, correct: string, candidates: string[], why: { correct: string; wrong: string[] } = { correct: "", wrong: [] }): { options: string[]; correctIndex: number; whyWrong: string[] } {
  const pairs = candidates.map((option, index) => ({ option, why: why.wrong[index] ?? "" }));
  const wrong = pairs.filter((pair, index) => pair.option !== correct && pairs.findIndex((other) => other.option === pair.option) === index); // an edge case must not produce two identical options
  const hash = [...seed].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 9973, 7);
  const correctIndex = hash % (wrong.length + 1);
  const placed = [...wrong.slice(0, correctIndex), { option: correct, why: why.correct }, ...wrong.slice(correctIndex)];
  return { options: placed.map((pair) => pair.option), correctIndex, whyWrong: placed.map((pair) => pair.why) };
}

// A second, shorter check for after a wrong first answer: a principle, not a repeat of the same figure.
type FollowUpDraft = { question: string; correct: string; wrong: string[]; reveal: string };
type Draft = Omit<TeachingCard, "id" | "concept" | "options" | "correctIndex" | "whyWrong" | "followUp"> & { correct: string; wrong: string[]; why: { correct: string; wrong: string[] }; followUp: FollowUpDraft };

// "That is more than…" / "The real one is higher…", so a wrong guess hears which way it was off, kindly and accurately:
// "Close" only for a guess within about a fifth of the real figure, never for one that is half or double it.
const CLOSE_WITHIN = 0.2;
export function direction(guess: number, actual: number, unit: string): string {
  const close = Math.abs(guess - actual) <= Math.abs(actual) * CLOSE_WITHIN;
  if (guess > actual) return close ? `Close, but that is more than the real ${unit}.` : `Not quite: that is more than the real ${unit}.`;
  return close ? `Close, but the real ${unit} is higher than that.` : `Not quite: the real ${unit} is higher than that.`;
}

function draftFor(concept: ConceptId, o: Overview): Draft {
  const window = { from: o.windowFrom, to: o.windowTo };
  const everyday = o.baskets.find((b) => b.id === "everyday");
  const regular = o.baskets.find((b) => b.id === "regular");
  const irregular = o.baskets.find((b) => b.id === "irregular");
  const everydayShare = Math.round((everyday?.share ?? 0) * 100);

  switch (concept) {
    case "three-baskets": {
      const facts: Fact[] = [
        fact("teach:baskets:regular", "Regular essentials", regular?.monthlyAvg ?? 0, "EUR/month", "12-month average", { evidence: { ...window, basket: "regular" } }),
        fact("teach:baskets:irregular", "Occasional essentials", irregular?.monthlyAvg ?? 0, "EUR/month", "12-month average", { evidence: { ...window, basket: "irregular" } }),
        fact("teach:baskets:everyday", "Everyday spending", everyday?.monthlyAvg ?? 0, "EUR/month", "12-month average", { evidence: { ...window, basket: "everyday" } }),
        fact("teach:baskets:everyday-share", "Everyday spending, share of spending", everydayShare, "percent", "everyday basket divided by all spending", { source: "calculation" }),
      ];
      const low = Math.max(everydayShare - 25, 5);
      const high = Math.min(everydayShare + 20, 95);
      return {
        title: "Three baskets",
        explanation: "All spending falls into three baskets: regular essentials like rent and bills, occasional essentials like a repair or the dentist, and everyday spending like groceries, transport and eating out. The first two are hard to change quickly. Everyday spending is where day-to-day decisions show, groceries included, and groceries are still essential.",
        question: "What share of your spending do you think goes on everyday spending?",
        correct: `About ${everydayShare}%`,
        wrong: [`About ${low}%`, `About ${high}%`],
        why: { correct: `Yes: about ${everydayShare}% of your spending is everyday spending.`, wrong: [direction(low, everydayShare, "share"), direction(high, everydayShare, "share")] },
        reveal: `It is about ${everydayShare}%: ${euros(everyday?.monthlyAvg ?? 0)} a month on everyday spending, against ${euros(regular?.monthlyAvg ?? 0)} on regular essentials and ${euros(irregular?.monthlyAvg ?? 0)} on occasional essentials.`,
        followUp: {
          question: "Which basket can you usually change fastest, this month?",
          correct: "Everyday spending",
          wrong: ["Regular essentials", "Occasional essentials"],
          reveal: "Everyday spending: you decide it day by day, for example by planning meals or eating out less. Rent and bills take a new contract or a move to change, and occasional essentials are hard to time.",
        },
        facts,
      };
    }
    case "safe-to-spend": {
      const s = o.safeToSpend;
      return {
        title: "Estimated weekly budget",
        explanation: "Your estimated weekly budget is what is left for everyday spending after the money already spoken for: regular essentials, a share set aside for occasional essentials, and the saving you already do. It comes from your averages, so it is a guide, not a guarantee.",
        question: "After your essentials and savings, how much do you think is left for everyday spending each week?",
        correct: `About ${euros(s.perWeek)} a week`,
        wrong: [`About ${euros(s.perWeek * 1.6)} a week`, `About ${euros(s.perWeek * 0.55)} a week`],
        why: { correct: `Right: about ${euros(s.perWeek)} a week, from your 12-month averages.`, wrong: [direction(s.perWeek * 1.6, s.perWeek, "weekly budget"), direction(s.perWeek * 0.55, s.perWeek, "weekly budget")] },
        reveal: `About ${euros(s.perWeek)} a week (${euros(s.perMonth)} a month). You actually spend ${euros(s.actualEverydayPerMonth)} a month on everyday spending, so the gap is ${euros(s.gapPerMonth)} a month${s.gapPerMonth < 0 ? " over" : " to spare"}.`,
        followUp: {
          question: "A bill you did not expect arrives this week. What happens to your weekly budget?",
          correct: "Take the bill off first, then spread what is left over the weeks to payday",
          wrong: ["It stays the same, because it is based on averages", "Skip the bill until payday"],
          reveal: "Take the bill off first. The weekly budget is what is left after what you owe, so a new bill makes each remaining week a little smaller. Averages are a guide; the bill in front of you comes first.",
        },
        facts: [
          fact("teach:safe:week", "Estimated weekly budget from averages", s.perWeek, "EUR", "income minus essentials and savings, divided by weeks in a month", { source: "calculation" }),
          fact("teach:safe:month", "Estimated monthly budget from averages", s.perMonth, "EUR/month", "income minus regular essentials, occasional essentials and savings", { source: "calculation" }),
          fact("teach:safe:actual", "Actual everyday spending per month", s.actualEverydayPerMonth, "EUR/month", "12-month average", { evidence: { ...window, basket: "everyday" } }),
          fact("teach:safe:gap", "Gap per month", s.gapPerMonth, "EUR/month", "the budget minus actual everyday spending", { source: "calculation" }),
        ],
      };
    }
    case "fixed-vs-spot": {
      const bill = o.recurringBills.find((b) => b.guessLabel === "Electricity");
      const swing = bill ? round2(bill.max - bill.min) : 0;
      return {
        title: "Fixed price or spot price",
        explanation: "A fixed electricity contract charges the same price per kWh for the whole term, so the bill only moves with how much you use. A spot contract follows the hourly market price: cheaper on average in calm years, but a cold, windless week can multiply the bill.",
        question: bill ? "Your electricity bill moved between its lowest and highest month. By how much, do you think?" : "Which contract protects you from a price spike in a cold week?",
        correct: bill ? `About ${euros(swing)}` : "A fixed-price contract",
        wrong: bill ? [`About ${euros(swing * 0.3)}`, `About ${euros(swing * 2.2)}`] : ["A spot-price contract", "Neither: both follow the market"],
        why: bill
          ? { correct: `Yes: about ${euros(swing)} between the lowest and highest month.`, wrong: [direction(swing * 0.3, swing, "swing"), direction(swing * 2.2, swing, "swing")] }
          : { correct: "Yes: a fixed price cannot change during the term.", wrong: ["A spot price follows the hourly market, so a cold week can push it up.", "Only a spot price follows the market; a fixed price stays put for the term."] },
        followUp: {
          question: "In a cold, windless week, which contract's bill can jump the most?",
          correct: "A spot-price contract",
          wrong: ["A fixed-price contract", "Both jump the same"],
          reveal: "A spot-price contract: it follows the hourly market, which rises when demand is high and wind is low. A fixed price only moves with how much you use.",
        },
        reveal: bill
          ? `Between ${euros(bill.min)} and ${euros(bill.max)}, a swing of ${euros(swing)}. With a fixed price that swing comes from your use alone; with a spot price the market adds its own swings on top.`
          : "A fixed-price contract: the price per kWh cannot change during the term.",
        facts: bill
          ? [
              fact("teach:fixed:min", "Lowest monthly electricity bill", bill.min, "EUR", "last 12 months", { evidence: { ...window, category: "Utilities" } }),
              fact("teach:fixed:max", "Highest monthly electricity bill", bill.max, "EUR", "last 12 months", { evidence: { ...window, category: "Utilities" } }),
              fact("teach:fixed:swing", "Swing between lowest and highest bill", swing, "EUR", "highest minus lowest", { source: "calculation" }),
            ]
          : [],
      };
    }
    case "buffer-first": {
      const target = round2(o.monthlyMandatory * 3);
      return {
        title: "Buffer before investing",
        explanation: "A buffer is cash that covers your essentials (rent, bills and occasional essentials) if income stops or a large bill lands. A common rule of thumb is three to six months. Without one, a surprise cost has to come from credit, which costs more than most investments earn.",
        question: "How many months of your essentials do you think your balance covers today?",
        correct: `About ${o.runwayMonths} months`,
        wrong: [`About ${round2(o.runwayMonths * 2.5 + 1)} months`, `About ${round2(o.runwayMonths * 0.4 + 6)} months`],
        why: { correct: `Right: about ${o.runwayMonths} months of your essentials.`, wrong: [direction(round2(o.runwayMonths * 2.5 + 1), o.runwayMonths, "number of months"), direction(round2(o.runwayMonths * 0.4 + 6), o.runwayMonths, "number of months")] },
        reveal: `About ${o.runwayMonths} months. Your regular and occasional essentials average ${euros(o.monthlyMandatory)} a month, so a three-month buffer would be ${euros(target)}; your balance is ${euros(o.balance)}.`,
        followUp: {
          question: "A surprise cost lands and there is no buffer. Which way of paying it usually costs the most?",
          correct: "A credit card or a quick loan",
          wrong: ["Cash from a buffer", "Money set aside each month for it"],
          reveal: "A credit card or a quick loan: their interest usually costs more than savings or most investments earn. That is why a buffer usually comes before investing.",
        },
        facts: [
          fact("teach:buffer:runway", "Months of essentials covered", o.runwayMonths, "months", "balance divided by average regular and occasional essentials", { source: "calculation" }),
          fact("teach:buffer:mandatory", "Essentials per month", o.monthlyMandatory, "EUR/month", "regular plus occasional essentials, 12-month average", { evidence: window }),
          fact("teach:buffer:target", "Three-month buffer", target, "EUR", "three times monthly essentials", { source: "calculation" }),
          fact("teach:buffer:balance", "Balance", o.balance, "EUR", `account balance on ${o.dataTimestamp}`),
        ],
      };
    }
    case "compound-growth": {
      const monthly = 50;
      const years = 10;
      const paidIn = monthly * 12 * years;
      const rate = RETURN_SCENARIOS.mid;
      const grown = round2(Array.from({ length: years * 12 }).reduce<number>((pot) => (pot + monthly) * (1 + rate / 12), 0));
      return {
        title: "Growth on growth",
        explanation: "When returns are left invested, the next year's return is earned on a larger amount. Over long periods most of the result comes from that effect, not from the money paid in. Returns are never guaranteed and investments can lose value.",
        question: `If you put €${monthly} a month aside for ${years} years at ${rate * 100}% a year, you pay in ${euros(paidIn)}. What would it have grown to in that scenario?`,
        correct: `About ${euros(grown)}`,
        wrong: [`About ${euros(paidIn * 1.05)}`, `About ${euros(grown * 1.7)}`],
        why: { correct: `Yes: about ${euros(grown)} in this scenario.`, wrong: ["Close to what you pay in, but the growth earns growth too, so it ends higher.", "That is more than this scenario gives: growth adds up, but not that fast."] },
        followUp: {
          question: "Two people save the same amount each month. One starts five years earlier. Who usually ends up with more by the same age?",
          correct: "The one who started earlier",
          wrong: ["Both the same", "The one who started later"],
          reveal: "The one who started earlier: their growth has more years to earn growth of its own. Returns are never guaranteed, but time does most of the work.",
        },
        reveal: `About ${euros(grown)}: ${euros(paidIn)} paid in plus about ${euros(grown - paidIn)} of growth in this ${rate * 100}% scenario. This is an illustration, not a forecast and not advice.`,
        facts: [
          fact("teach:compound:paid-in", "Paid in", paidIn, "EUR", `€${monthly} a month for ${years} years`, { source: "assumption" }),
          fact("teach:compound:grown", "Value in the scenario", grown, "EUR", `monthly compounding at ${rate * 100}% a year`, { source: "calculation" }),
          fact("teach:compound:growth", "Growth in the scenario", grown - paidIn, "EUR", "value minus paid in", { source: "calculation" }),
        ],
      };
    }
    case "switching-bills": {
      const bills = o.recurringBills.filter((b) => b.category === "Utilities");
      const yearly = round2(bills.reduce((total, b) => total + b.monthlyAvg, 0) * 12);
      return {
        title: "Loyalty rarely pays",
        explanation: "Providers usually keep their best prices for new customers. Checking the market once a year takes a few minutes, and a switch does not cut your service: the new provider handles the changeover.",
        question: `Your ${bills.length} monthly bills arrive one at a time. What do you think they add up to in a year?`,
        correct: `About ${euros(yearly)}`,
        wrong: [`About ${euros(yearly * 0.5)}`, `About ${euros(yearly * 1.7)}`],
        why: { correct: `Yes: about ${euros(yearly)} a year.`, wrong: ["Not quite: one bill at a time hides the total, and it is more than that.", "Not quite: that is more than your bills add up to."] },
        followUp: {
          question: "When is usually the best time to compare a fixed-term contract?",
          correct: "A month or two before the term ends",
          wrong: ["Right after signing it", "Never: loyalty is rewarded"],
          reveal: "A month or two before the term ends: you can switch without a fee, and the new provider handles the changeover. Providers usually keep their best prices for new customers.",
        },
        reveal: `About ${euros(yearly)} a year. A saving of even a tenth of that is ${euros(yearly * 0.1)} for one comparison.`,
        facts: [
          fact("teach:switch:yearly", "Monthly bills, per year", yearly, "EUR/year", `${bills.length} recurring bills, 12-month average times 12`, { evidence: { ...window, category: "Utilities" } }),
          fact("teach:switch:tenth", "A tenth of that", yearly * 0.1, "EUR/year", "illustration only", { source: "calculation" }),
        ],
      };
    }
    case "pay-yourself-first": {
      const saved = o.monthlySaved;
      const rate = o.monthlyIncome > 0 ? Math.round((saved / o.monthlyIncome) * 100) : 0;
      return {
        title: "Pay yourself first",
        explanation: "Saving what is left at the end of the month rarely works, because little is left. Moving a fixed amount on payday, before any spending, turns saving into one decision instead of thirty.",
        question: "What share of your income do you think you set aside each month?",
        correct: `About ${rate}%`,
        wrong: [`About ${rate + 12}%`, `About ${rate + 25}%`],
        why: { correct: `Right: about ${rate}% of your income.`, wrong: [direction(rate + 12, rate, "share"), direction(rate + 25, rate, "share")] },
        followUp: {
          question: "When does a monthly saving transfer tend to work best?",
          correct: "On payday, before any spending",
          wrong: ["At the end of the month, from what is left", "Only in months with money to spare"],
          reveal: "On payday, before any spending: it is one decision instead of thirty, and what is left is what you can spend. Saving what is left at the end of the month rarely works, because little is left.",
        },
        reveal: `About ${rate}%: ${euros(saved)} a month out of ${euros(o.monthlyIncome)} of income.`,
        facts: [
          fact("teach:pyf:saved", "Set aside per month", saved, "EUR/month", "investment deposits, 12-month average", { evidence: { ...window, category: "Invest Deposit" } }),
          fact("teach:pyf:income", "Income per month", o.monthlyIncome, "EUR/month", "12-month average", { evidence: window }),
          fact("teach:pyf:rate", "Share of income set aside", rate, "percent", "set aside divided by income", { source: "calculation" }),
        ],
      };
    }
  }
}

export function teachingCard(concept: ConceptId, overview: Overview): TeachingCard {
  const { correct, wrong, why, followUp, ...rest } = draftFor(concept, overview);
  const second = placeCorrect(`${concept}:follow-up:${overview.customerId}`, followUp.correct, followUp.wrong);
  // The id is the concept alone: it reaches the model, which must never see a customer ID.
  return {
    id: concept,
    concept,
    ...rest,
    ...placeCorrect(`${concept}:${overview.customerId}`, correct, wrong, why),
    followUp: { question: followUp.question, options: second.options, correctIndex: second.correctIndex, reveal: followUp.reveal },
  };
}
