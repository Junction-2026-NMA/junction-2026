// The rent Sisu suggests, worked out in code from the customer's own 12-month averages: the most a month could cost
// in rent and still leave the month balanced after the savings goal. It is a suggestion the customer confirms or
// edits in the intake card; nothing is searched with it until they do.
import { fact } from "@/lib/finance/facts";
import { round2 } from "@/lib/finance/math";
import { RENT_BUDGET_LIMITS } from "@/lib/finance/rent";
import { monthFiguresOf } from "@/lib/watch/detect";
import type { HousingBudget, Overview } from "@/lib/types";

export const DEFAULT_SAVINGS_PER_MONTH = 50;
const ROUND_TO = 5;
const eur = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;

export function suggestedBudget(overview: Overview, savingsPerMonthEur: number = DEFAULT_SAVINGS_PER_MONTH): HousingBudget {
  const { housingNowEur, leftOverNowEur } = monthFiguresOf(overview);
  const savings = round2(Math.max(0, savingsPerMonthEur));
  const room = round2(housingNowEur + leftOverNowEur - savings);
  const rounded = Math.floor(room / ROUND_TO) * ROUND_TO;
  const maxRent = rounded >= RENT_BUDGET_LIMITS[0] ? rounded : null;
  const steps = [
    { label: "Housing today", amount: housingNowEur, basis: "Housing payments, 12-month average" },
    { label: "Left over in an average month today", amount: leftOverNowEur, basis: "monthly budget from averages minus actual everyday spending, 12-month average" },
    { label: "Your monthly savings goal", amount: -savings, basis: "kept aside every month after moving" },
    { label: "Most rent that keeps the month balanced", amount: maxRent ?? room, basis: `housing today plus what is left over, minus the savings goal, rounded down to €${ROUND_TO}` },
  ];
  const short = leftOverNowEur < 0 ? ` Your average month already comes out ${eur(-leftOverNowEur)} short, so this is below what housing costs you today.` : "";
  const reasoning = maxRent === null
    ? `On your own figures no rent keeps the month balanced after saving ${eur(savings)} a month: housing today is ${eur(housingNowEur)} and an average month leaves ${leftOverNowEur < 0 ? `${eur(-leftOverNowEur)} short` : `${eur(leftOverNowEur)} over`}.`
    : `Up to ${eur(maxRent)} a month keeps your average month balanced after saving ${eur(savings)}: housing today ${eur(housingNowEur)}, ${leftOverNowEur < 0 ? `minus the ${eur(-leftOverNowEur)} your month is already short` : `plus ${eur(leftOverNowEur)} left over`}, minus the savings.${short}`;
  return {
    maxRentEur: maxRent,
    housingNowEur,
    leftOverNowEur,
    savingsPerMonthEur: savings,
    steps,
    reasoning,
    facts: [
      fact("housing:budget:housing-now", "Housing cost per month today", housingNowEur, "EUR/month", "Housing payments, 12-month average", { evidence: { from: overview.windowFrom, to: overview.windowTo, category: "Housing" } }),
      fact("housing:budget:left-over-now", "Left over in an average month today", leftOverNowEur, "EUR/month", "monthly budget from averages minus actual everyday spending", { source: "calculation" }),
      fact("housing:budget:savings", "Your monthly savings goal", savings, "EUR/month", "the goal in the intake card", { source: "customer-stated" }),
      ...(maxRent === null ? [] : [fact("housing:budget:max-rent", "Most rent that keeps the month balanced", maxRent, "EUR/month", "housing today plus left over, minus the savings goal", { source: "calculation" })]),
    ],
  };
}
