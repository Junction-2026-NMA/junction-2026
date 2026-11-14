// Teaching cards. Each explains one idea using the customer's own numbers and asks them to predict before the answer
// is revealed. The right answer and the wrong options are all computed here; the model only presents the card.
import type { ConceptId, Fact, Overview, TeachingCard } from "@/lib/types";
import { RETURN_SCENARIOS } from "./scenario";
import { fact } from "./facts";
import { round2 } from "./math";

export const CONCEPTS: ConceptId[] = ["three-baskets", "safe-to-spend", "fixed-vs-spot", "buffer-first", "compound-growth", "switching-bills", "pay-yourself-first"];

const euros = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;

// A stable way to place the right answer among the options, so the same customer always sees the same card.
function placeCorrect(seed: string, correct: string, wrong: string[]): { options: string[]; correctIndex: number } {
  const hash = [...seed].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 9973, 7);
  const correctIndex = hash % (wrong.length + 1);
  return { options: [...wrong.slice(0, correctIndex), correct, ...wrong.slice(correctIndex)], correctIndex };
}

type Draft = Omit<TeachingCard, "id" | "concept" | "options" | "correctIndex"> & { correct: string; wrong: string[] };

function draftFor(concept: ConceptId, o: Overview): Draft {
  const window = { from: o.windowFrom, to: o.windowTo };
  const everyday = o.baskets.find((b) => b.id === "everyday");
  const regular = o.baskets.find((b) => b.id === "regular");
  const irregular = o.baskets.find((b) => b.id === "irregular");
  const everydayShare = Math.round((everyday?.share ?? 0) * 100);

  switch (concept) {
    case "three-baskets": {
      const facts: Fact[] = [
        fact("teach:baskets:regular", "Must pay, every month", regular?.monthlyAvg ?? 0, "EUR/month", "12-month average", { evidence: { ...window, basket: "regular" } }),
        fact("teach:baskets:irregular", "Must pay, now and then", irregular?.monthlyAvg ?? 0, "EUR/month", "12-month average", { evidence: { ...window, basket: "irregular" } }),
        fact("teach:baskets:everyday", "Everyday choices", everyday?.monthlyAvg ?? 0, "EUR/month", "12-month average", { evidence: { ...window, basket: "everyday" } }),
        fact("teach:baskets:everyday-share", "Everyday choices, share of spending", everydayShare, "percent", "everyday basket divided by all spending", { source: "calculation" }),
      ];
      return {
        title: "Three baskets",
        explanation: "All spending falls into three baskets: what you must pay every month, what you must pay now and then, and everyday choices. The first two are hard to change quickly. The third is where daily decisions add up.",
        question: "What share of your spending do you think goes on everyday choices?",
        correct: `About ${everydayShare}%`,
        wrong: [`About ${Math.max(everydayShare - 25, 5)}%`, `About ${Math.min(everydayShare + 20, 95)}%`],
        reveal: `It is about ${everydayShare}%: ${euros(everyday?.monthlyAvg ?? 0)} a month on everyday choices, against ${euros(regular?.monthlyAvg ?? 0)} on monthly must-pays and ${euros(irregular?.monthlyAvg ?? 0)} on now-and-then costs.`,
        facts,
      };
    }
    case "safe-to-spend": {
      const s = o.safeToSpend;
      return {
        title: "Safe to spend",
        explanation: "Safe to spend is what is left for everyday choices after the money that is already spoken for: monthly must-pays, an amount set aside for now-and-then costs, and the saving you already do.",
        question: "After your must-pay costs and savings, how much do you think is left for everyday choices each week?",
        correct: `About ${euros(s.perWeek)} a week`,
        wrong: [`About ${euros(s.perWeek * 1.6)} a week`, `About ${euros(s.perWeek * 0.55)} a week`],
        reveal: `About ${euros(s.perWeek)} a week (${euros(s.perMonth)} a month). You actually spend ${euros(s.actualEverydayPerMonth)} a month on everyday choices, so the gap is ${euros(s.gapPerMonth)} a month${s.gapPerMonth < 0 ? " over" : " to spare"}.`,
        facts: [
          fact("teach:safe:week", "Safe to spend per week", s.perWeek, "EUR", "income minus must-pays, now-and-then costs and savings, divided by weeks in a month", { source: "calculation" }),
          fact("teach:safe:month", "Safe to spend per month", s.perMonth, "EUR/month", "income minus must-pays, now-and-then costs and savings", { source: "calculation" }),
          fact("teach:safe:actual", "Actual everyday spending per month", s.actualEverydayPerMonth, "EUR/month", "12-month average", { evidence: { ...window, basket: "everyday" } }),
          fact("teach:safe:gap", "Gap per month", s.gapPerMonth, "EUR/month", "safe to spend minus actual everyday spending", { source: "calculation" }),
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
        explanation: "A buffer is cash that covers your must-pay costs if income stops or a large bill lands. A common rule of thumb is three to six months. Without one, a surprise cost has to come from credit, which costs more than most investments earn.",
        question: "How many months of your must-pay costs do you think your balance covers today?",
        correct: `About ${o.runwayMonths} months`,
        wrong: [`About ${round2(o.runwayMonths * 2.5 + 1)} months`, `About ${round2(o.runwayMonths * 0.4 + 6)} months`],
        reveal: `About ${o.runwayMonths} months. Your must-pay costs average ${euros(o.monthlyMandatory)} a month, so a three-month buffer would be ${euros(target)}; your balance is ${euros(o.balance)}.`,
        facts: [
          fact("teach:buffer:runway", "Months of must-pay costs covered", o.runwayMonths, "months", "balance divided by average must-pay costs", { source: "calculation" }),
          fact("teach:buffer:mandatory", "Must-pay costs per month", o.monthlyMandatory, "EUR/month", "regular plus now-and-then baskets, 12-month average", { evidence: window }),
          fact("teach:buffer:target", "Three-month buffer", target, "EUR", "three times monthly must-pay costs", { source: "calculation" }),
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
  const { correct, wrong, ...rest } = draftFor(concept, overview);
  // The id is the concept alone: it reaches the model, which must never see a customer ID.
  return { id: concept, concept, ...rest, ...placeCorrect(`${concept}:${overview.customerId}`, correct, wrong) };
}
