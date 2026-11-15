// Estimated weekly budget until the next payday: what is left for everyday spending each week once the bills due
// before payday and a protected buffer are taken off the balance. An estimate from the customer's own numbers,
// never called "safe to spend": the bills and the payday date come from their history, not from a bill in hand.
import type { CalcStep, Overview, WeeklyBudget } from "@/lib/types";
import { DATA_AS_OF } from "./data";
import { round2 } from "./math";

const WEEKS_PER_MONTH = 52 / 12;
export const BUFFER_LIMITS: [number, number] = [0, 100_000];

// v2 payday: `paydayConfirmed` when the customer gave the date, `addedBills` how many of the bills they added.
type Inputs = { nextPayday: string | null; daysToNextPayday: number | null; billsBeforePaydayEur: number; billCount: number; averageDailyEverydayEur: number; paydayConfirmed?: boolean; addedBills?: number };

// The default buffer: one week of regular and occasional essentials (rent and bills, plus the share set aside for
// costs that come now and then). An assumption the customer can replace with their own figure.
export const defaultBufferEur = (overview: Overview): number => round2(Math.max(overview.monthlyMandatory, 0) / WEEKS_PER_MONTH);

export function parseBuffer(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= BUFFER_LIMITS[0] && value <= BUFFER_LIMITS[1] ? round2(value) : null;
}

// Above this many times the usual everyday spending a week, a weekly figure is not a budget anyone would spend: it
// is most of the balance. The answer then says the bills before payday are covered and how much is left after them,
// instead of headlining the weekly figure. The same rule as Today in the app (WeeklyBudget.covered); the weekly
// figure itself is not capped and stays in the working.
export const COVERED_FACTOR = 3;

export const billsCovered = (budget: Pick<WeeklyBudget, "leftForSpendingEur" | "perWeekEur" | "usualEverydayPerWeekEur">): boolean =>
  budget.leftForSpendingEur > 0 && budget.perWeekEur > COVERED_FACTOR * budget.usualEverydayPerWeekEur;

// "Bills before payday are covered: about €25,964 is left after them and the buffer." For cards and the model.
export const coveredText = (budget: Pick<WeeklyBudget, "leftForSpendingEur" | "nextPayday">): string =>
  `Bills before payday on ${budget.nextPayday} are covered: about €${Math.round(budget.leftForSpendingEur).toLocaleString("en-US")} is left after them and the buffer.`;

// Where a stated buffer came from: said in this chat, or set in the app (Today or Settings).
export type BufferFrom = "chat" | "app";

export function buildWeeklyBudget(overview: Overview, inputs: Inputs, statedBufferEur: number | null = null, bufferFrom: BufferFrom = "chat"): WeeklyBudget | null {
  if (!inputs.nextPayday || inputs.daysToNextPayday === null) return null;
  const days = Math.max(inputs.daysToNextPayday, 1);
  // A payday within the week is one week of budget, not a bigger one. The budget divides by the exact number of
  // weeks (15 days = 2.142857 weeks), the same as Today in the app; the rounded figure is only for the working text.
  const exactWeeks = Math.max(days / 7, 1);
  const weeks = round2(exactWeeks);
  const bufferSource = statedBufferEur === null ? "default" : "customer-stated";
  const bufferEur = statedBufferEur ?? defaultBufferEur(overview);
  const balanceEur = round2(overview.balance);
  const bills = round2(inputs.billsBeforePaydayEur);
  const beforeBuffer = round2(balanceEur - bills);
  const leftForSpendingEur = round2(Math.max(beforeBuffer - bufferEur, 0));
  const perWeekEur = round2(leftForSpendingEur / exactWeeks);
  const usualEverydayPerWeekEur = round2(inputs.averageDailyEverydayEur * 7);
  const steps: CalcStep[] = [
    { label: "Balance today", amount: balanceEur, basis: overview.balanceBasis ?? `account balance on ${DATA_AS_OF}, from your bank data` },
    { label: `Bills expected before payday (${inputs.billCount})`, amount: -bills, basis: inputs.addedBills ? `each bill's 12-month average on its usual day, plus ${inputs.addedBills} you added` : "each bill's 12-month average, on its usual day of the month" },
    { label: "Protected buffer", amount: -bufferEur, basis: bufferSource === "default" ? "assumed: one week of regular and occasional essentials" : bufferFrom === "app" ? "the amount you set in the app" : "the amount you said you want to keep" },
    { label: "Left for spending until payday", amount: leftForSpendingEur, basis: "never below zero" },
    { label: "Estimated weekly budget", amount: perWeekEur, basis: `divided by ${weeks} weeks until payday on ${inputs.nextPayday}` },
  ];
  return {
    perWeekEur,
    nextPayday: inputs.nextPayday,
    daysToPayday: inputs.daysToNextPayday,
    weeksToPayday: weeks,
    balanceEur,
    billsBeforePaydayEur: bills,
    bufferEur,
    bufferSource,
    leftForSpendingEur,
    usualEverydayPerWeekEur,
    differencePerWeekEur: round2(perWeekEur - usualEverydayPerWeekEur),
    shortBeforePayday: beforeBuffer < bufferEur,
    steps,
    assumptions: [
      inputs.paydayConfirmed ? `Payday is on ${inputs.nextPayday}, the date you gave.` : `Payday is expected on ${inputs.nextPayday}, the usual salary day in your history.`,
      "Bills are their 12-month averages on their usual day. A bill due on payday itself is not counted.",
      bufferSource === "default"
        ? `The protected buffer of €${bufferEur.toFixed(2)} is an assumption: one week of your regular and occasional essentials. Tell Sisu if you want to keep a different amount.`
        : `The protected buffer of €${bufferEur.toFixed(2)} is the amount you ${bufferFrom === "app" ? "set in the app" : "said"}.`,
      "Only this account is visible. Money held elsewhere is not counted.",
      "An estimate from your history, not a guarantee: an unexpected bill would lower it.",
    ],
  };
}
