// The number verifier. After the model has answered, every number it said is checked against the receipts:
// first the facts tools returned, then the customer summary and raw tool output, then what the user said.
// A number with no source is reported as "unverified", so the UI can flag it and the gauntlet can count it.
import { fact } from "@/lib/finance/facts";
import type { Fact, Grounding, NumberCheck, Overview } from "@/lib/types";

const TRIVIAL_MAX = 12; // small counts ("three offers", "12 months") are not financial claims
const NUMBER = /\d{1,3}(?:[,\u00a0 ]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

// Numbers in a piece of text. "1,932.43", "1 932" and "40" all work. Dates like 2026-09-30 are skipped.
export function numbersIn(text: string): number[] {
  const withoutDates = text.replace(/\b\d{4}-\d{2}(?:-\d{2})?\b/g, " ").replace(/\b\d{1,2}:\d{2}\b/g, " ");
  return [...withoutDates.matchAll(NUMBER)].map((match) => Number(match[0].replace(/[,\u00a0 ]/g, ""))).filter((n) => Number.isFinite(n));
}

const isRound = (n: number): boolean => Number.isInteger(n) && (n % 5 === 0 || n >= 1000);

// Does a spoken number stand for this value? Exact, rounded to whole euros or one decimal, or a round "about" figure within 3%.
export function matches(said: number, value: number): boolean {
  const v = Math.abs(value);
  const s = Math.abs(said);
  if (Math.abs(s - v) < 0.005) return true;
  if (s === Math.round(v) || s === Math.floor(v) || s === Math.round(v * 10) / 10) return true;
  if (isRound(s) && Math.abs(s - v) <= Math.max(v * 0.03, 2.5)) return true;
  return false;
}

// Monthly and yearly versions of the same figure count as supported: "about 12 a month" for 139 a year.
const matchesDerived = (said: number, value: number): boolean => matches(said, value * 12) || matches(said, value / 12);

export function checkGrounding(answer: string, facts: Fact[], contextTexts: string[], userTexts: string[]): Grounding {
  const contextNumbers = contextTexts.flatMap(numbersIn);
  const userNumbers = userTexts.flatMap(numbersIn);
  const numbers: NumberCheck[] = numbersIn(answer).map((value): NumberCheck => {
    const receipt = facts.find((f) => matches(value, f.value));
    if (receipt) return { value, status: "receipt", factId: receipt.id };
    if (contextNumbers.some((n) => matches(value, n)) || userNumbers.some((n) => matches(value, n))) return { value, status: "context", factId: null };
    const derived = facts.find((f) => (f.unit === "EUR/month" || f.unit === "EUR/year" || f.unit === "EUR") && matchesDerived(value, f.value));
    if (derived) return { value, status: "context", factId: derived.id };
    if (Number.isInteger(value) && value <= TRIVIAL_MAX) return { value, status: "trivial", factId: null };
    return { value, status: "unverified", factId: null };
  });
  const unverified = numbers.filter((n) => n.status === "unverified").map((n) => n.value);
  return { ok: unverified.length === 0, checked: numbers.length, unverified, numbers };
}

// Receipts for the figures in the customer summary, so an answer that needed no tool still has sources.
export function overviewFacts(o: Overview): Fact[] {
  const window = { from: o.windowFrom, to: o.windowTo };
  const basis = `average of the last ${o.windowMonths} months`;
  return [
    fact("overview:balance", "Balance", o.balance, "EUR", `account balance on ${o.dataTimestamp}`),
    fact("overview:income", "Income per month", o.monthlyIncome, "EUR/month", basis, { evidence: window }),
    fact("overview:spending", "Spending per month", o.monthlySpending, "EUR/month", basis, { evidence: window }),
    fact("overview:saved", "Saved per month", o.monthlySaved, "EUR/month", `investment deposits, ${basis}`, { evidence: { ...window, category: "Invest Deposit" } }),
    fact("overview:mandatory", "Must-pay costs per month", o.monthlyMandatory, "EUR/month", basis, { evidence: window }),
    fact("overview:everyday", "Everyday spending per month", o.monthlyEveryday, "EUR/month", basis, { evidence: { ...window, basket: "everyday" } }),
    fact("overview:runway", "Months of must-pay costs covered", o.runwayMonths, "months", "balance divided by must-pay costs", { source: "calculation" }),
    fact("overview:safe-week", "Safe to spend per week", o.safeToSpend.perWeek, "EUR", "safe to spend per month divided by weeks in a month", { source: "calculation" }),
    fact("overview:safe-month", "Safe to spend per month", o.safeToSpend.perMonth, "EUR/month", "income minus must-pays, now-and-then costs and savings", { source: "calculation" }),
    fact("overview:safe-gap", "Gap between safe to spend and actual everyday spending", o.safeToSpend.gapPerMonth, "EUR/month", "safe to spend minus actual", { source: "calculation" }),
    fact("overview:age", "Age", o.age, "years", "customer record"),
    fact("overview:peers", "Customers in the same age band", o.peerCount, "count", `ages ${o.ageBand}`),
    ...o.baskets.flatMap((b) => [
      fact(`overview:basket:${b.id}`, `${b.label}, per month`, b.monthlyAvg, "EUR/month", basis, { evidence: { ...window, basket: b.id } }),
      fact(`overview:basket:${b.id}:share`, `${b.label}, share of spending`, Math.round(b.share * 100), "percent", "basket divided by all spending", { source: "calculation" }),
      ...b.categories.flatMap((c) => [
        fact(`overview:category:${c.category}`, `${c.category}, per month`, c.monthlyAvg, "EUR/month", `${c.count} transactions, ${basis}`, { evidence: { ...window, category: c.category } }),
        ...(c.peerMonthlyAvg === null ? [] : [fact(`overview:category:${c.category}:peers`, `${c.category}, age ${o.ageBand} average`, c.peerMonthlyAvg, "EUR/month", `${o.peerCount} customers in the same age band`)]),
        ...(c.peerMonthlyAvg === null ? [] : [fact(`overview:category:${c.category}:gap`, `${c.category}, gap to peers`, c.monthlyAvg - c.peerMonthlyAvg, "EUR/month", "your average minus the peer average", { source: "calculation" })]),
      ]),
    ]),
    ...o.recurringBills.flatMap((bill) => [
      fact(`overview:bill:${bill.id}`, `${bill.guessLabel}, per month`, bill.monthlyAvg, "EUR/month", `average of ${bill.monthsSeen} payments`, { evidence: { ...window, category: bill.category } }),
      fact(`overview:bill:${bill.id}:low`, `${bill.guessLabel}, lowest month`, bill.min, "EUR", "last 12 months"),
      fact(`overview:bill:${bill.id}:high`, `${bill.guessLabel}, highest month`, bill.max, "EUR", "last 12 months"),
    ]),
  ];
}
