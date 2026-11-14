// The number verifier. After the model has answered, every number it said is checked against the receipts:
// first the facts tools returned, then the customer summary and raw tool output, then what the user said.
// A number with no source is reported as "unverified", so the UI can flag it and the gauntlet can count it.
import { buildCashFlow } from "@/lib/finance/cashflow";
import { fact } from "@/lib/finance/facts";
import { lastMonthSpending } from "@/lib/finance/recent";
import type { Fact, Grounding, NumberCheck, NumberCorrection, Overview } from "@/lib/types";

const TRIVIAL_MAX = 12; // small counts ("three offers", "12 months") are not financial claims
// Digits glued to letters (an ID such as CUST04414) are a name, not a number.
const NUMBER = /(?<![A-Za-z\d.])(?:\d{1,3}(?:[,\u00a0 ]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g;
const DATES = /\b\d{4}-\d{2}(?:-\d{2})?\b|\b\d{1,2}:\d{2}\b/g;
// A figure this close to a receipt is the same figure with a slipped digit, not a different claim.
const SLIP_ABSOLUTE = 0.05;
const SLIP_RELATIVE = 0.001;

type Found = { value: number; raw: string; index: number; isYear: boolean };

// "2027" on its own is a year. "€2,027" or "2027 euros" is an amount.
const isYearToken = (text: string, raw: string, index: number): boolean =>
  /^20\d{2}$/.test(raw) && text[index - 1] !== "€" && !/^\s?(€|eur\b|euros?\b)/i.test(text.slice(index + raw.length));

// Numbers in a piece of text, with where they are. "1,932.43", "1 932" and "40" all work. Dates and times are skipped.
function findNumbers(text: string): Found[] {
  const blanked = text.replace(DATES, (match) => " ".repeat(match.length)); // same length, so positions still line up
  return [...blanked.matchAll(NUMBER)]
    .map((match) => ({ value: Number(match[0].replace(/[,\u00a0 ]/g, "")), raw: match[0], index: match.index, isYear: isYearToken(blanked, match[0], match.index) }))
    .filter((n) => Number.isFinite(n.value));
}

export const numbersIn = (text: string): number[] => findNumbers(text).map((n) => n.value);

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

function classify({ value, isYear }: Pick<Found, "value" | "isYear">, sources: Sources, contextNumbers: number[]): NumberCheck {
  const receipt = sources.facts.find((f) => matches(value, f.value));
  if (receipt) return { value, status: "receipt", factId: receipt.id };
  if (contextNumbers.some((n) => matches(value, n))) return { value, status: "context", factId: null };
  if (isYear) return { value, status: "trivial", factId: null }; // "September 2026", "next year, 2027": a date, not an amount
  const derived = sources.facts.find((f) => (f.unit === "EUR/month" || f.unit === "EUR/year" || f.unit === "EUR") && matchesDerived(value, f.value));
  if (derived) return { value, status: "context", factId: derived.id };
  if (Number.isInteger(value) && value <= TRIVIAL_MAX) return { value, status: "trivial", factId: null };
  return { value, status: "unverified", factId: null };
}

const contextNumbersOf = (sources: Sources): number[] => [...sources.contextTexts, ...sources.userTexts].flatMap(numbersIn);

// Fixes slipped digits. A number with no source that sits within a hair of a receipt (1,059.49 for 1,059.47) is
// replaced by the receipt's value, written the way the model wrote it. Anything further away is left for the report.
export function correctNumbers(text: string, sources: Sources): { text: string; corrections: NumberCorrection[] } {
  const contextNumbers = contextNumbersOf(sources);
  const corrections: NumberCorrection[] = [];
  let corrected = text;
  for (const found of findNumbers(text).reverse()) {
    if (classify(found, sources, contextNumbers).status !== "unverified") continue;
    const near = sources.facts.find((f) => Math.abs(Math.abs(f.value) - found.value) <= Math.max(SLIP_ABSOLUTE, Math.abs(f.value) * SLIP_RELATIVE));
    if (!near) continue;
    const decimals = found.raw.includes(".") ? found.raw.split(".")[1].length : 0;
    const replacement = Math.abs(near.value).toFixed(decimals);
    corrected = corrected.slice(0, found.index) + replacement + corrected.slice(found.index + found.raw.length);
    corrections.unshift({ said: found.value, corrected: Number(replacement), factId: near.id });
  }
  return { text: corrected, corrections };
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

// The same idea for names. The model sometimes misspells a provider it just read ("Myönti" for "Myynti").
// A phrase one or two letters away from a provider the tools returned is replaced by the real name.
export function correctNames(text: string, names: string[]): { text: string; corrections: { said: string; corrected: string }[] } {
  const corrections: { said: string; corrected: string }[] = [];
  let corrected = text;
  for (const name of [...new Set(names)].filter((n) => n.length >= 6).sort((a, b) => b.length - a.length)) {
    const tolerance = name.length >= 12 ? 2 : 1;
    const length = name.split(/\s+/).length;
    // Every run of `length` consecutive words is a candidate, wherever it starts.
    const words = [...corrected.matchAll(/[\p{L}\p{N}&.'’-]+/gu)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
    const edits: { start: number; end: number }[] = [];
    for (let i = 0; i + length <= words.length; i++) {
      const start = words[i].start;
      const phrase = corrected.slice(start, words[i + length - 1].end);
      const bare = phrase.replace(/[.,;:!?]+$/u, "").replace(/['’]s$/u, "");
      if (bare === name || names.includes(bare)) continue;
      const distance = editDistance(bare.toLowerCase(), name.toLowerCase());
      if (distance === 0 || distance > tolerance) continue;
      edits.push({ start, end: start + bare.length });
      corrections.push({ said: bare, corrected: name });
      i += length - 1;
    }
    for (const edit of edits.reverse()) corrected = corrected.slice(0, edit.start) + name + corrected.slice(edit.end);
  }
  return { text: corrected, corrections };
}

export function checkGrounding(answer: string, facts: Fact[], contextTexts: string[], userTexts: string[], corrections: NumberCorrection[] = []): Grounding {
  const sources = { facts, contextTexts, userTexts };
  const contextNumbers = contextNumbersOf(sources);
  const numbers = findNumbers(answer).map((found) => classify(found, sources, contextNumbers));
  const unverified = numbers.filter((n) => n.status === "unverified").map((n) => n.value);
  return { ok: unverified.length === 0, checked: numbers.length, unverified, numbers, corrections };
}

// Receipts for the figures in the customer summary, so an answer that needed no tool still has sources.
export function overviewFacts(o: Overview): Fact[] {
  const window = { from: o.windowFrom, to: o.windowTo };
  const basis = `average of the last ${o.windowMonths} months`;
  const last = lastMonthSpending(o);
  const flow = buildCashFlow(o);
  return [
    fact("last-month:total", `All spending in ${last.month}`, last.totalEur, "EUR", `sum of ${last.transactions} transactions`, { evidence: last.evidence }),
    ...last.categories.flatMap((c) => [
      fact(`last-month:${c.category}`, `${c.category} in ${last.month}`, c.totalEur, "EUR", `sum of ${c.transactions} transactions`, { evidence: { ...last.evidence, category: c.category } }),
      fact(`last-month:${c.category}:count`, `${c.category} purchases in ${last.month}`, c.transactions, "count", "number of transactions", { evidence: { ...last.evidence, category: c.category } }),
    ]),
    ...(flow.projectedLowPointEur === null ? [] : [fact("payday:expected-balance", "Expected balance just before the next payday", flow.projectedLowPointEur, "EUR", `balance minus bills due and average everyday spending until ${flow.nextPayday}`, { source: "calculation" })]),
    ...(flow.daysToNextPayday === null ? [] : [fact("payday:days", "Days to the next payday", flow.daysToNextPayday, "days", `next payday expected on ${flow.nextPayday}`, { source: "calculation" })]),
    ...(flow.typicalPayday === null ? [] : [fact("payday:day", "Usual payday (day of the month)", flow.typicalPayday, "days", "the usual salary day in the history")]),
    ...(flow.steps[1] ? [fact("payday:bills-due", "Bills due before the next payday", -flow.steps[1].amount, "EUR", flow.steps[1].basis, { source: "calculation" })] : []),
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
