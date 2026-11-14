// The number verifier. After the model has answered, every number it said is checked against the receipts:
// first the facts tools returned, then the customer summary and raw tool output, then what the user said.
// A number with no source is reported as "unverified", so the UI can flag it and the gauntlet can count it.
import { fact } from "@/lib/finance/facts";
import type { Fact, Grounding, NumberCheck, NumberCorrection, Overview } from "@/lib/types";

const TRIVIAL_MAX = 12; // small counts ("three offers", "12 months") are not financial claims
// Digits glued to letters (an ID such as CUST04414) are a name, not a number.
const NUMBER = /(?<![A-Za-z\d.])(?:\d{1,3}(?:[,\u00a0 ]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g;
const DATES = /\b\d{4}-\d{2}(?:-\d{2})?\b|\b\d{1,2}:\d{2}\b/g;
// A figure this close to a receipt is the same figure with a slipped digit, not a different claim.
const SLIP_ABSOLUTE = 0.05;
const SLIP_RELATIVE = 0.001;

type Found = { value: number; raw: string; index: number };

// Numbers in a piece of text, with where they are. "1,932.43", "1 932" and "40" all work. Dates and times are skipped.
function findNumbers(text: string): Found[] {
  const blanked = text.replace(DATES, (match) => " ".repeat(match.length)); // same length, so positions still line up
  return [...blanked.matchAll(NUMBER)].map((match) => ({ value: Number(match[0].replace(/[,\u00a0 ]/g, "")), raw: match[0], index: match.index })).filter((n) => Number.isFinite(n.value));
}

export const numbersIn = (text: string): number[] => findNumbers(text).map((n) => n.value);

// Years named in the data or by the user ("September 2026") are dates, not amounts.
const yearsIn = (texts: string[]): number[] => texts.flatMap((text) => [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1])));

// "About 140" or "about 1,900" is a rounded figure. 1,536 is not: a precise-looking number must match precisely.
const isRound = (n: number): boolean => Number.isInteger(n) && n % 5 === 0;

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

export type Sources = { facts: Fact[]; contextTexts: string[]; userTexts: string[] };

function classify(value: number, sources: Sources, contextNumbers: number[], years: number[]): NumberCheck {
  const receipt = sources.facts.find((f) => matches(value, f.value));
  if (receipt) return { value, status: "receipt", factId: receipt.id };
  if (contextNumbers.some((n) => matches(value, n))) return { value, status: "context", factId: null };
  if (Number.isInteger(value) && years.includes(value)) return { value, status: "trivial", factId: null };
  const derived = sources.facts.find((f) => (f.unit === "EUR/month" || f.unit === "EUR/year" || f.unit === "EUR") && matchesDerived(value, f.value));
  if (derived) return { value, status: "context", factId: derived.id };
  if (Number.isInteger(value) && value <= TRIVIAL_MAX) return { value, status: "trivial", factId: null };
  return { value, status: "unverified", factId: null };
}

const prepared = (sources: Sources) => ({
  contextNumbers: [...sources.contextTexts, ...sources.userTexts].flatMap(numbersIn),
  years: [...yearsIn([...sources.contextTexts, ...sources.userTexts]), new Date().getFullYear()],
});

// Fixes slipped digits. A number with no source that sits within a hair of a receipt (1,059.49 for 1,059.47) is
// replaced by the receipt's value, written the way the model wrote it. Anything further away is left for the report.
export function correctNumbers(text: string, sources: Sources): { text: string; corrections: NumberCorrection[] } {
  const { contextNumbers, years } = prepared(sources);
  const corrections: NumberCorrection[] = [];
  let corrected = text;
  for (const found of findNumbers(text).reverse()) {
    if (classify(found.value, sources, contextNumbers, years).status !== "unverified") continue;
    const near = sources.facts.find((f) => Math.abs(Math.abs(f.value) - found.value) <= Math.max(SLIP_ABSOLUTE, Math.abs(f.value) * SLIP_RELATIVE));
    if (!near) continue;
    const decimals = found.raw.includes(".") ? found.raw.split(".")[1].length : 0;
    const replacement = Math.abs(near.value).toFixed(decimals);
    corrected = corrected.slice(0, found.index) + replacement + corrected.slice(found.index + found.raw.length);
    corrections.unshift({ said: found.value, corrected: Number(replacement), factId: near.id });
  }
  return { text: corrected, corrections };
}

export function checkGrounding(answer: string, facts: Fact[], contextTexts: string[], userTexts: string[], corrections: NumberCorrection[] = []): Grounding {
  const sources = { facts, contextTexts, userTexts };
  const { contextNumbers, years } = prepared(sources);
  const numbers = numbersIn(answer).map((value) => classify(value, sources, contextNumbers, years));
  const unverified = numbers.filter((n) => n.status === "unverified").map((n) => n.value);
  return { ok: unverified.length === 0, checked: numbers.length, unverified, numbers, corrections };
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
