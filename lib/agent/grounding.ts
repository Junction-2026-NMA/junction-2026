// The number verifier. After the model has answered, every number it said is checked against the receipts:
// first the facts tools returned, then the customer summary and raw tool output, then what the user said.
// A number with no source is reported as "unverified", so the UI can flag it and the gauntlet can count it.
import { buildCashFlow } from "@/lib/finance/cashflow";
import { fact } from "@/lib/finance/facts";
import { lastMonthSpending } from "@/lib/finance/recent";
import type { Fact, Grounding, NumberCheck, NumberCorrection, Overview } from "@/lib/types";

const TRIVIAL_MAX = 12; // small counts ("three offers", "12 months") are not financial claims
// Numbers as people write them, in English and Finnish: 1,932.43 · 1 932,43 · 139,47 · 40. Digits glued to
// letters (an ID such as CUST04414) are a name, not a number.
const NUMBER = /(?<![A-Za-z\d.,])(?:\d{1,3}(?:[  ]\d{3})+(?:[.,]\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+[.,]\d{1,2}|\d+)(?![\d])/g;
// Dates and clock times are not amounts: 2026-09-30, 21:16, the Finnish 30.9.2026 or 15.10., "September 16",
// "16 September", "the 15th".
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu(?:ta|ssa|n)?|januar|februar|märz|mai|juni|juli|oktober|dezember|januari|februari|mars|maj|augusti|oktober)";
const DATES = new RegExp(
  [
    "\\b\\d{4}-\\d{2}(?:-\\d{2})?\\b",
    "\\b\\d{1,2}:\\d{2}\\b",
    "\\b\\d{1,2}\\.\\d{1,2}\\.(?:\\d{4}|\\d{2})?(?!\\d)",
    `\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b(?!\\s?(?:€|eur|euro))`,
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\.?\\s+(?:of\\s+)?${MONTH}\\b`,
    "\\b\\d{1,2}(?:st|nd|rd|th)\\b",
  ].join("|"),
  "gi",
);

// Numbers written as words ("twenty seven thousand one hundred sixty two") are turned into digits before
// checking, so spelling a figure out is not a way past the check. Small counts (up to twelve) are left as words.
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUMBER_WORD = `(?:${[...Object.keys(UNITS), ...Object.keys(TENS), "hundred", "thousand", "million"].join("|")})`;
const SPELLED = new RegExp(`\\b${NUMBER_WORD}(?:(?:[\\s-]+and)?[\\s-]+${NUMBER_WORD})*\\b`, "gi");

export function spelledToDigits(text: string): string {
  return text.replace(SPELLED, (phrase) => {
    let total = 0;
    let current = 0;
    for (const word of phrase.toLowerCase().split(/[\s-]+/)) {
      if (word in UNITS) current += UNITS[word];
      else if (word in TENS) current += TENS[word];
      else if (word === "hundred") current = (current || 1) * 100;
      else if (word === "thousand" || word === "million") {
        total += (current || 1) * (word === "thousand" ? 1_000 : 1_000_000);
        current = 0;
      }
    }
    const value = total + current;
    return value > TRIVIAL_MAX ? String(value) : phrase;
  });
}
// A figure this close to a receipt is the same figure with a slipped digit, not a different claim.
const SLIP_ABSOLUTE = 0.05;
const SLIP_RELATIVE = 0.001;

// What kind of quantity the words around a number say it is. A figure said as "euros a year" may only be
// checked against yearly euro receipts, never against a percentage or a monthly figure that happens to be close.
type Hint = "money" | "money-month" | "money-year" | "percent" | "kwh" | "price" | "time" | null;
type Found = { value: number; raw: string; index: number; isYear: boolean; hint: Hint };

function toNumber(raw: string): number {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return Number(raw.replace(/,/g, "")); // 1,932.43
  return Number(raw.replace(/[  ]/g, "").replace(",", ".")); // 1 932,43 and 139,47
}

// The words that mark a figure as money, per month or per year, in the languages Sisu is most used in. A language
// not covered here still works: its figures are then checked as exact matches only, which is the stricter rule.
const MONEY_AFTER = /^\s?(€|eur\b|euros?\b|euroa\b|euron\b|евро|यूरो|يورو)/i;
const PER_MONTH = /\b(a|per|each|every)\s+month\b|\bmonthly\b|\/\s?(mo|month|kk)\b|kuukaudessa|kuussa|\b(pro|im|je)\s+Monat\b|\bmonatlich\b|\b(per|i)\s+månad(en)?\b/i;
const PER_YEAR = /\b(a|per|each|every)\s+year\b|\byearly\b|\bannual(ly)?\b|\/\s?(yr|year|v)\b|vuodessa|\b(pro|im|je)\s+Jahr\b|\bjährlich\b|\b(per|om)\s+år(et)?\b/i;

function hintFor(text: string, raw: string, index: number): Hint {
  const after = text.slice(index + raw.length, index + raw.length + 40);
  const isMoney = text[index - 1] === "€" || text.slice(Math.max(0, index - 2), index) === "€ " || MONEY_AFTER.test(after);
  if (isMoney) {
    const clause = after.split(/[.;!?]|,\s/)[0];
    return PER_MONTH.test(clause) ? "money-month" : PER_YEAR.test(clause) ? "money-year" : "money";
  }
  if (/^\s?(%|percent\b|prosent)/i.test(after)) return "percent";
  if (/^\s?kwh\b/i.test(after)) return "kwh";
  if (/^\s?(c\b|cents?\b|snt\b)/i.test(after)) return "price";
  if (/^\s?(days?|months?|years?|weeks?|purchases?|transactions?|payments?|kk\b|pv\b)/i.test(after)) return "time";
  return null;
}

const COMPATIBLE: Record<Exclude<Hint, null>, Fact["unit"][]> = {
  money: ["EUR", "EUR/month", "EUR/year"],
  "money-month": ["EUR/month", "EUR"],
  "money-year": ["EUR/year", "EUR"],
  percent: ["percent"],
  kwh: ["kWh/year"],
  price: ["c/kWh"],
  time: ["months", "years", "days", "count"],
};

// "2027" on its own is a year. "€2,027", "2027 euros" or "2027 kWh" is an amount.
const isYearToken = (text: string, raw: string, index: number, hint: Hint): boolean => /^20\d{2}$/.test(raw) && hint === null && !/^\s?(a|per)\s+(month|year|week)\b/i.test(text.slice(index + raw.length));

// Numbers in a piece of text, with where they are and what kind of quantity they are. Dates and times are skipped.
function findNumbers(text: string): Found[] {
  const blanked = text.replace(DATES, (match) => " ".repeat(match.length)); // same length, so positions still line up
  return [...blanked.matchAll(NUMBER)]
    .map((match) => {
      const hint = hintFor(blanked, match[0], match.index);
      return { value: toNumber(match[0]), raw: match[0], index: match.index, hint, isYear: isYearToken(blanked, match[0], match.index, hint) };
    })
    .filter((n) => Number.isFinite(n.value));
}

export const numbersIn = (text: string): number[] => findNumbers(text).map((n) => n.value);

// The same figure, written exactly or rounded to whole euros or one decimal.
function sameFigure(said: number, value: number): boolean {
  const v = Math.abs(value);
  const s = Math.abs(said);
  return Math.abs(s - v) < 0.005 || s === Math.round(v) || s === Math.floor(v) || s === Math.round(v * 10) / 10;
}

// How far an "about" figure may sit from the real one: half the step it was rounded to.
// "About 140" (nearest 10) may stand for 135 to 145. "About 1,900" (nearest 100) only for a figure in the thousands.
function roundingSlack(said: number, value: number): number {
  if (!Number.isInteger(said)) return 0;
  if (said % 1000 === 0 && value >= 10_000) return 500;
  if (said % 100 === 0 && value >= 1_000) return 50;
  if (said % 10 === 0) return 5;
  if (said % 5 === 0) return 2.5;
  return 0;
}

// Does a spoken number stand for this value? The same figure, or an honest rounding of it.
export function matches(said: number, value: number): boolean {
  if (sameFigure(said, value)) return true;
  const slack = roundingSlack(Math.abs(said), Math.abs(value));
  return slack > 0 && Math.abs(Math.abs(said) - Math.abs(value)) <= slack;
}

export type Sources = { facts: Fact[]; contextTexts: string[]; userTexts: string[] };

// A number is checked in order of how strong the support is:
// 1. receipt: a fact of the right kind (yearly euros against yearly euros) that it equals or honestly rounds;
// 2. context: the exact figure appears in the summary, a tool result, or what the customer said;
// 3. trivial: a year or a small count.
// The "about" allowance applies only to receipts of the right kind, so an invented round figure cannot ride on
// some unrelated number that happens to be near it.
function classify({ value, isYear, hint }: Pick<Found, "value" | "isYear" | "hint">, sources: Sources, contextNumbers: number[]): NumberCheck {
  const kinds = hint === null ? null : COMPATIBLE[hint];
  const receipt = sources.facts.find((f) => (kinds === null ? sameFigure(value, f.value) : kinds.includes(f.unit) && matches(value, f.value)));
  if (receipt) return { value, status: "receipt", factId: receipt.id };
  if (contextNumbers.some((n) => sameFigure(value, n))) return { value, status: "context", factId: null };
  if (isYear) return { value, status: "trivial", factId: null }; // "September 2026", "next year, 2027": a date, not an amount
  // The monthly version of a yearly receipt, or the other way round: "about 12 a month" for 139 a year.
  const derived =
    hint === "money-month" ? sources.facts.find((f) => f.unit === "EUR/year" && sameFigure(value, f.value / 12)) : hint === "money-year" ? sources.facts.find((f) => f.unit === "EUR/month" && sameFigure(value, f.value * 12)) : undefined;
  if (derived) return { value, status: "context", factId: derived.id };
  if (Number.isInteger(value) && value <= TRIVIAL_MAX) return { value, status: "trivial", factId: null };
  return { value, status: "unverified", factId: null };
}

const contextNumbersOf = (sources: Sources): number[] => [...sources.contextTexts, ...sources.userTexts].flatMap((text) => numbersIn(spelledToDigits(text)));

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
    const decimals = /[.,]\d{1,2}$/.test(found.raw) ? found.raw.split(/[.,]/).pop()!.length : 0;
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
  const numbers = findNumbers(spelledToDigits(answer)).map((found) => classify(found, sources, contextNumbers));
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
    fact("overview:runway-all", "Months of all spending covered", o.monthlySpending > 0 ? Math.max(o.balance, 0) / o.monthlySpending : 0, "months", "balance divided by average monthly spending", { source: "calculation" }),
    fact("overview:buffer-3", "A three-month buffer", o.monthlyMandatory * 3, "EUR", "three times monthly must-pay costs", { source: "calculation" }),
    fact("overview:buffer-6", "A six-month buffer", o.monthlyMandatory * 6, "EUR", "six times monthly must-pay costs", { source: "calculation" }),
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
