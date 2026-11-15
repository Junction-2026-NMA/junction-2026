// The total effect of moving into a listed flat, worked out in code from the customer's own figures, what the
// listing states and what the customer said. Recurring (every month) and upfront (once) are kept apart.
// A figure nobody knows stays null and is named under `missing`; the only assumption made (the usual deposit) is
// named under `assumptions` and never mixed into a known total. Nothing here is guessed by a model.
import type { Fact, HousingEffect, Listing, Overview, WatchRequirements } from "@/lib/types";
import { categoryAverages } from "./categories";
import { fact } from "./facts";
import { round2 } from "./math";
import { currentHousing, rentFit } from "./rent";

// Finnish landlords usually ask for one to three months' rent as a deposit. Used only when the listing does not say.
export const USUAL_DEPOSIT_MONTHS: [number, number] = [1, 3];

const eur = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const monthsTo = (goal: number, perMonth: number): number | null => (perMonth > 0 ? Math.ceil(goal / perMonth) : null);
const categoryAverage = (overview: Overview, category: string): number => categoryAverages(overview).find((entry) => entry.category === category)?.monthly ?? 0;

type ListingFacts = Pick<Listing, "priceEur"> & Partial<Pick<Listing, "depositEur" | "utilitiesPerMonthEur" | "url">>;

// simulated: the rent was made up by the demo's simulate button, so its receipt says so instead of "read from the listing".
export function housingEffect(overview: Overview, listing: ListingFacts, requirements: WatchRequirements = {}, prefix = "housing", options: { simulated?: boolean } = {}): HousingEffect {
  const fit = rentFit(overview, listing.priceEur);
  const rent = fit.rentEur;
  const housingNow = currentHousing(overview);
  const utilities = typeof listing.utilitiesPerMonthEur === "number" ? round2(listing.utilitiesPerMonthEur) : null;
  const knownChange = round2(fit.changePerMonthEur + (utilities ?? 0));
  const leftOverAfter = round2(fit.leftOverNowEur - knownChange);

  const deposit = typeof listing.depositEur === "number" ? round2(listing.depositEur) : null;
  const assumed = deposit === null ? { low: round2(rent * USUAL_DEPOSIT_MONTHS[0]), high: round2(rent * USUAL_DEPOSIT_MONTHS[1]) } : null;
  const moving = typeof requirements.movingCostEur === "number" ? round2(requirements.movingCostEur) : null;
  const knownUpfront = round2((deposit ?? 0) + (moving ?? 0));
  const range = { low: round2(knownUpfront + (assumed?.low ?? 0)), high: round2(knownUpfront + (assumed?.high ?? 0)) };

  const balance = round2(overview.balance);
  const after = { low: round2(balance - range.high), high: round2(balance - range.low) }; // low: with the most upfront cost
  const keep = typeof requirements.bufferToKeepEur === "number" ? round2(requirements.bufferToKeepEur) : null;
  const keeps = keep === null ? null : after.low >= keep ? "yes" : after.high < keep ? "no" : "depends";
  const goal = typeof requirements.savingsGoalEur === "number" && requirements.savingsGoalEur > 0 ? round2(requirements.savingsGoalEur) : null;
  const savingsGoal = goal === null ? null : { goalEur: goal, monthsNow: monthsTo(goal, fit.leftOverNowEur), monthsAfter: monthsTo(goal, leftOverAfter) };

  const transportToday = categoryAverage(overview, "Transportation");
  const missing = [
    ...(utilities === null ? ["Water and other monthly charges at this flat: the listing does not state them."] : []),
    `Transport after the move: not known (${transportToday > 0 ? `today about ${eur(transportToday)} a month in your bank data` : "your bank data shows no transport spending today"}).`,
    ...(deposit === null ? ["The deposit: the listing does not state it."] : []),
    ...(moving === null ? ["Moving costs: you have not given an estimate."] : []),
    ...(keep === null ? ["How much you want to keep in the account after moving: not given."] : []),
    ...(typeof requirements.maxCommuteMinutes === "number" ? [`Commute time: Sisu cannot measure it; check it against your limit of ${requirements.maxCommuteMinutes} minutes yourself.`] : []),
  ];
  const assumptions = [
    "Housing today and what a month leaves over are 12-month averages from your bank data.",
    ...(assumed ? [`Assumption, not from the listing: deposits are usually ${USUAL_DEPOSIT_MONTHS[0]} to ${USUAL_DEPOSIT_MONTHS[1]} months' rent (${eur(assumed.low)} to ${eur(assumed.high)}).`] : []),
  ];

  const monthly = knownChange === 0 ? "the same as your housing today" : `${eur(Math.abs(knownChange))} a month ${knownChange > 0 ? "more" : "less"} than your housing today`;
  const upfrontText = range.low === range.high ? `${eur(range.low)} upfront` : `${eur(range.low)} to ${eur(range.high)} upfront${assumed ? " (the deposit is assumed)" : ""}`;
  const sentence = `Rent ${eur(rent)} is ${monthly}${utilities === null ? " (water and other charges not stated)" : ", charges included"}; an average month would leave ${leftOverAfter < 0 ? `${eur(-leftOverAfter)} short` : `about ${eur(leftOverAfter)} over`}. Moving in would take ${upfrontText}.`;

  const url = listing.url ? { url: listing.url } : {};
  const facts: Fact[] = [
    options.simulated ? fact(`${prefix}:rent`, "Rent of this flat per month (simulated)", rent, "EUR/month", "made up by the demo's simulate button", { source: "assumption" }) : fact(`${prefix}:rent`, "Rent of this flat per month", rent, "EUR/month", "read from the listing", { source: "context.dev", ...url }),
    fact(`${prefix}:housing-now`, "Housing cost per month today", housingNow, "EUR/month", "Housing payments, 12-month average", { evidence: { from: overview.windowFrom, to: overview.windowTo, category: "Housing" } }),
    fact(`${prefix}:change`, "Known change per month", knownChange, "EUR/month", utilities === null ? "rent minus housing today" : "rent plus stated charges minus housing today", { source: "calculation" }),
    fact(`${prefix}:left-over-now`, "Left over in an average month today", fit.leftOverNowEur, "EUR/month", "monthly budget from averages minus actual everyday spending", { source: "calculation" }),
    fact(`${prefix}:left-over-after`, "Left over in an average month after moving", leftOverAfter, "EUR/month", "left over today minus the known change", { source: "calculation" }),
    ...(utilities === null ? [] : [fact(`${prefix}:utilities`, "Monthly charges on top of the rent", utilities, "EUR/month", "stated on the listing", { source: "context.dev", ...url })]),
    ...(deposit === null ? [] : [fact(`${prefix}:deposit`, "Deposit", deposit, "EUR", "stated on the listing", { source: "context.dev", ...url })]),
    ...(assumed ? [fact(`${prefix}:deposit-low`, "Deposit if it is one month's rent (assumption)", assumed.low, "EUR", "usual range, not from the listing", { source: "assumption" }), fact(`${prefix}:deposit-high`, "Deposit if it is three months' rent (assumption)", assumed.high, "EUR", "usual range, not from the listing", { source: "assumption" })] : []),
    ...(moving === null ? [] : [fact(`${prefix}:moving`, "Your moving cost estimate", moving, "EUR", "the figure you gave", { source: "customer-stated" })]),
    fact(`${prefix}:balance`, "Balance today", balance, "EUR", `account balance on ${overview.dataTimestamp}`),
    fact(`${prefix}:after-low`, "Balance after the upfront costs, at most cost", after.low, "EUR", "balance minus the highest upfront total", { source: "calculation" }),
    ...(keep === null ? [] : [fact(`${prefix}:keep`, "What you want to keep after moving", keep, "EUR", "the figure you gave", { source: "customer-stated" })]),
    ...(savingsGoal ? [fact(`${prefix}:goal`, "Your savings goal", savingsGoal.goalEur, "EUR", "the figure you gave", { source: "customer-stated" }), ...(savingsGoal.monthsAfter === null ? [] : [fact(`${prefix}:goal-months`, "Months to reach the goal after moving", savingsGoal.monthsAfter, "months", "goal divided by what a month would leave over", { source: "calculation" })])] : []),
  ];

  return {
    rentEur: rent,
    recurring: { currentHousingEur: housingNow, rentChangeEur: fit.changePerMonthEur, utilitiesChangeEur: utilities, transportChangeEur: null, knownChangeEur: knownChange, leftOverNowEur: fit.leftOverNowEur, leftOverAfterEur: leftOverAfter },
    upfront: { depositEur: deposit, depositAssumedEur: assumed, movingCostEur: moving, knownEur: knownUpfront, rangeEur: range },
    buffer: { balanceNowEur: balance, afterUpfrontEur: after, keepEur: keep, keeps },
    savingsGoal,
    missing,
    assumptions,
    sentence,
    facts,
  };
}
