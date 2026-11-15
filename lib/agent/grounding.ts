// The number verifier. After the model has answered, every number it said is checked against the receipts:
// first the facts tools returned, then the customer summary and raw tool output, then what the user said.
// A number with no source is reported as "unverified", so the UI can flag it and the gauntlet can count it.
import { buildCashFlow } from "@/lib/finance/cashflow";
import { fact } from "@/lib/finance/facts";
import { lastMonthSpending } from "@/lib/finance/recent";
import type { Fact, Grounding, NumberCheck, NumberCorrection, Overview, WeeklyBudget } from "@/lib/types";

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
type Hint = "money" | "money-day" | "money-week" | "money-month" | "money-year" | "percent" | "kwh" | "price" | "time" | "count" | null;
// `negative`: the clause says the figure is a shortfall or a difference ("12 euros short", "minus 12", "12 less"),
// so it may stand for a negative receipt. Without such a word, "12 euros" is never the receipt −12.17.
type Found = { value: number; raw: string; index: number; isYear: boolean; hint: Hint; negative: boolean };

function toNumber(raw: string): number {
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return Number(raw.replace(/,/g, "")); // 1,932.43
  return Number(raw.replace(/[  ]/g, "").replace(",", ".")); // 1 932,43 and 139,47
}

// The words that mark a figure as money, per month or per year, in the languages Sisu is most used in. A language
// not covered here still works: its figures are then checked as exact matches only, which is the stricter rule.
const MONEY_AFTER = /^\s?(€|eur\b|euros?\b|euroa\b|euron\b|евро|यूरो|يورو)/i;
const PER_MONTH = /\b(a|per|each|every)\s+month\b|\bmonthly\b|\/\s?(mo|month|kk)\b|kuukaudessa|kuussa|\b(pro|im|je)\s+Monat\b|\bmonatlich\b|\b(per|i)\s+månad(en)?\b/i;
const PER_YEAR = /\b(a|per|each|every)\s+year\b|\byearly\b|\bannual(ly)?\b|\/\s?(yr|year|v)\b|vuodessa|\b(pro|im|je)\s+Jahr\b|\bjährlich\b|\b(per|om)\s+år(et)?\b/i;
// "12 euros a day", "202 a week": a daily or weekly amount is only ever checked against daily or weekly receipts.
const PER_DAY = /\b(a|per|each|every)\s+day\b|\bdaily\b|\/\s?(d|day|pv)\b|päivässä|\b(pro|je)\s+Tag\b|\btäglich\b|\bper\s+dag\b|\bom\s+dagen\b/i;
const PER_WEEK = /\b(a|per|each|every)\s+week\b|\bweekly\b|\/\s?(wk|week|vk|vko)\b|viikossa|\b(pro|je)\s+Woche\b|\bwöchentlich\b|\b(per|i)\s+vecka(n)?\b/i;
const PERIODS: [RegExp, Hint][] = [[PER_DAY, "money-day"], [PER_WEEK, "money-week"], [PER_MONTH, "money-month"], [PER_YEAR, "money-year"]];

// The period named nearest after the figure: "12 euros a day, about 360 a month" is a daily figure.
function periodHint(clause: string): Hint {
  const named = PERIODS.map(([pattern, hint]) => ({ hint, at: clause.search(pattern) })).filter((p) => p.at >= 0);
  return named.length ? named.reduce((first, p) => (p.at < first.at ? p : first)).hint : "money";
}

// Words that make a figure a shortfall or a difference, in the clause around it. A sign written before the figure counts too.
const NEGATIVE_WORDS = /\b(short(fall)?|over\w*|below|less|lower|minus|negative|under|deficit|more|above|exceed\w*|too much|behind|vähemmän|alle|miinus|vaje\w*|yli|enemmän|unter|weniger|mindre)\b/i;
const CLAUSE_END = /[.;!?](?=\s|$)|,\s/;

// A minus sign written straight before the figure: "-12.17" in a tool's JSON, "−€12" in a sentence.
const signedMinus = (text: string, index: number): boolean => /[-−–]\s?€?\s?$/.test(text.slice(Math.max(0, index - 4), index));

function saysNegative(text: string, raw: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 60), index);
  if (signedMinus(text, index) || /\bminus\s?€?\s?$/i.test(before)) return true;
  const clauseBefore = before.split(CLAUSE_END).pop() ?? "";
  const clauseAfter = text.slice(index + raw.length, index + raw.length + 60).split(CLAUSE_END)[0];
  return NEGATIVE_WORDS.test(clauseBefore) || NEGATIVE_WORDS.test(clauseAfter);
}

function hintFor(text: string, raw: string, index: number): Hint {
  const after = text.slice(index + raw.length, index + raw.length + 40);
  // A tool's JSON names its euro fields: {"perWeekEur":133.64}.
  const isMoney = text[index - 1] === "€" || text.slice(Math.max(0, index - 2), index) === "€ " || MONEY_AFTER.test(after) || /Eur(os)?"\s?:\s?-?$/.test(text.slice(Math.max(0, index - 12), index));
  if (isMoney) return periodHint(after.split(/[.;!?]|,\s/)[0]);
  if (/^\s?(%|percent\b|prosent)/i.test(after)) return "percent";
  if (/^\s?kwh\b/i.test(after)) return "kwh";
  if (/^\s?(c\b|cents?\b|snt\b)/i.test(after)) return "price";
  // "12 months" and "a 12-month average" are periods of time.
  if (/^[\s-]?(days?|months?|years?|weeks?|purchases?|transactions?|payments?|kk\b|pv\b|päiv|viik|kuukau|vuo(?:si|de|tta|sia))/i.test(after)) return "time";
  if (COUNTED.test(after)) return "count";
  return null;
}

// A number followed by a word that names what is counted ("the 25 largest companies", "40 countries", "95 people")
// is a count of those things. It may stand for a count the tools returned, never for a euro figure or a percentage
// that happens to round to it. These are the words that can follow an amount without naming a thing:
// "25 a month", "40 more", "12 less than last month", "133 left".
const AMOUNT_WORDS = [
  "a", "an", "the", "per", "each", "every", "more", "less", "extra", "over", "under", "above", "below", "in", "on", "at", "to", "from", "for", "and", "or", "nor",
  "of", "than", "by", "with", "without", "left", "saved", "back", "off", "out", "up", "down", "then", "so", "but", "if", "as", "is", "was", "are", "were", "be",
  "been", "will", "would", "could", "should", "can", "may", "might", "must", "minus", "plus", "net", "gross", "total", "overall", "altogether", "instead", "now",
  "today", "this", "that", "these", "those", "last", "next", "already", "still", "only", "just", "after", "before", "because", "since", "until", "into", "onto",
  "there", "here", "you", "your", "it", "its", "we", "they", "he", "she", "i", "which", "who", "while", "when", "where", "monthly", "yearly", "annually", "weekly",
  "daily", "ago", "later", "earlier", "together", "apiece", "versus", "vs", "compared", "higher", "lower", "cheaper", "too", "also", "again", "roughly",
  "approximately", "about", "around", "even", "e", "k",
  "ja", "tai", "kuin", "eli", "on", "oli", "ovat", "olisi", "jää", "jäi", "jäljelle", "lisää", "vähemmän", "enemmän", "kuussa", "kuukaudessa", "vuodessa",
  "viikossa", "päivässä", "verran", "asti", "saakka", "mennessä", "jälkeen", "ennen", "nyt", "tänään", "vielä", "jo", "vain", "noin", "myös",
].join("|");
const COUNTED = new RegExp(`^\\s?(?!(?:${AMOUNT_WORDS})(?![\\p{L}\\p{N}]))\\p{L}`, "iu");

// A euro receipt in plain "EUR" can still be a daily or weekly figure: its label says so ("average per day",
// "Estimated weekly budget"). Those may only stand for a figure said per day or per week.
type Period = "day" | "week" | null;
const periodOf = (f: Fact): Period => (f.unit !== "EUR" ? null : /\b(per|a|each)\s+day\b|\bdaily\b/i.test(f.label) ? "day" : /\bweek(ly)?\b/i.test(f.label) ? "week" : null);

const COMPATIBLE: Record<Exclude<Hint, null>, (f: Fact) => boolean> = {
  money: (f) => ["EUR", "EUR/month", "EUR/year"].includes(f.unit),
  "money-day": (f) => periodOf(f) === "day",
  "money-week": (f) => periodOf(f) === "week",
  "money-month": (f) => f.unit === "EUR/month" || (f.unit === "EUR" && periodOf(f) === null),
  "money-year": (f) => f.unit === "EUR/year" || (f.unit === "EUR" && periodOf(f) === null),
  percent: (f) => f.unit === "percent",
  kwh: (f) => f.unit === "kWh/year",
  price: (f) => f.unit === "c/kWh",
  time: (f) => ["months", "years", "days", "count"].includes(f.unit),
  count: (f) => f.unit === "count",
};
const isMoneyHint = (hint: Hint): boolean => hint !== null && hint.startsWith("money");
// Which figures in the context may back a euro amount: euros, or an unmarked figure. Never a duration, a count, a
// share or a price ("12 euros a day" may not lean on "12 months"), and never a small unmarked whole number such as
// the 12 in "52/12", which is a divisor, not an amount.
const backsEuros = (n: ContextNumber): boolean => isMoneyHint(n.hint) || (n.hint === null && !(Number.isInteger(n.value) && n.value <= TRIVIAL_MAX));

// "2027" on its own (or "the 2027 prices") is a year. "€2,027", "2027 euros" or "2027 kWh" is an amount.
const isYearToken = (text: string, raw: string, index: number, hint: Hint): boolean => /^20\d{2}$/.test(raw) && (hint === null || hint === "count") && !/^\s?(a|per)\s+(month|year|week)\b/i.test(text.slice(index + raw.length));

// Numbers in a piece of text, with where they are and what kind of quantity they are. Dates and times are skipped.
function findNumbers(text: string): Found[] {
  const blanked = text.replace(DATES, (match) => " ".repeat(match.length)); // same length, so positions still line up
  return [...blanked.matchAll(NUMBER)]
    .map((match) => {
      const hint = hintFor(blanked, match[0], match.index);
      return { value: toNumber(match[0]), raw: match[0], index: match.index, hint, isYear: isYearToken(blanked, match[0], match.index, hint), negative: saysNegative(blanked, match[0], match.index) };
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
// A negative receipt (a gap, a shortfall, a balance below zero) stands for a figure only when the words say it is
// one. The exception is a deduction in a working ("Bills expected before payday −500", "Protected buffer −247"):
// its sign only says it is taken off, so "bills of 500 euros" is that figure.
const isDeduction = (f: Fact): boolean => /(^|:)(step|budget-week|safe):\d+$/.test(f.id) && !/balance|left for|budget/i.test(f.label);
const signFits = (f: Fact, negative: boolean): boolean => f.value >= 0 || negative || isDeduction(f);

// A figure in the context, with its kind and whether it was written with a minus sign.
type ContextNumber = { value: number; hint: Hint; minus: boolean };

function classify({ value, isYear, hint, negative }: Pick<Found, "value" | "isYear" | "hint" | "negative">, sources: Sources, contextNumbers: ContextNumber[]): NumberCheck {
  const fits = hint === null ? null : COMPATIBLE[hint];
  // A count is said as it is: no "about" allowance, and in the context only the very same figure counts.
  const close = hint === "count" ? sameFigure : matches;
  const money = isMoneyHint(hint);
  const inContext = (n: ContextNumber): boolean => (money && !backsEuros(n)) || (n.minus && !negative) ? false : hint === "count" ? Math.abs(n.value - value) < 0.005 : sameFigure(value, n.value);
  const receipt = sources.facts.find((f) => signFits(f, negative) && (fits === null ? sameFigure(value, f.value) : fits(f) && close(value, f.value)));
  if (receipt) return { value, status: "receipt", factId: receipt.id };
  if (contextNumbers.some(inContext)) return { value, status: "context", factId: null };
  if (isYear) return { value, status: "trivial", factId: null }; // "September 2026", "next year, 2027": a date, not an amount
  // The monthly version of a yearly receipt, or the other way round: "about 12 a month" for 139 a year.
  const derived =
    hint === "money-month" ? sources.facts.find((f) => f.unit === "EUR/year" && signFits(f, negative) && sameFigure(value, f.value / 12)) : hint === "money-year" ? sources.facts.find((f) => f.unit === "EUR/month" && signFits(f, negative) && sameFigure(value, f.value * 12)) : undefined;
  if (derived) return { value, status: "context", factId: derived.id };
  // A small count is not a financial claim. A small amount of money is: "12 euros a day" needs a source like any other.
  if (Number.isInteger(value) && value <= TRIVIAL_MAX && !money) return { value, status: "trivial", factId: null };
  return { value, status: "unverified", factId: null };
}

const contextNumbersOf = (sources: Sources): ContextNumber[] =>
  [...sources.contextTexts, ...sources.userTexts].flatMap((text) => {
    const digits = spelledToDigits(text);
    return findNumbers(digits).map((n) => ({ value: n.value, hint: n.hint, minus: signedMinus(digits, n.index) }));
  });

// Fixes slipped digits. A number with no source that sits within a hair of a receipt (1,059.49 for 1,059.47) is
// replaced by the receipt's value, written the way the model wrote it. Anything further away is left for the report.
export function correctNumbers(text: string, sources: Sources): { text: string; corrections: NumberCorrection[] } {
  const contextNumbers = contextNumbersOf(sources);
  const corrections: NumberCorrection[] = [];
  let corrected = text;
  for (const found of findNumbers(text).reverse()) {
    if (found.hint === "count") continue; // a count of things is not a euro figure with a slipped digit
    if (classify(found, sources, contextNumbers).status !== "unverified") continue;
    // Only a figure of some size can have a "slipped digit": 0.05 is not a slip of 0.
    const near = sources.facts.find((f) => signFits(f, found.negative) && Math.abs(f.value) >= 1 && Math.abs(Math.abs(f.value) - found.value) <= Math.max(SLIP_ABSOLUTE, Math.abs(f.value) * SLIP_RELATIVE));
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
  const found = findNumbers(spelledToDigits(answer));
  const first = found.map((n) => classify(n, sources, contextNumbers));
  // "Yours is 662, the typical figure is 730, so you pay 68 less": the 68 is the difference of two sourced figures
  // in the same answer. Code can check that sum, so it counts as supported. A wrong sum still fails. A count of
  // things ("40 countries") is never a sum of amounts.
  const sourced = first.filter((n) => n.status === "receipt" || n.status === "context").map((n) => n.value);
  const fromTwo = (value: number): boolean => sourced.some((a, i) => sourced.some((b, j) => i < j && (sameFigure(value, a + b) || sameFigure(value, Math.abs(a - b)))));
  const numbers = first.map((n, i): NumberCheck => (n.status === "unverified" && n.value > TRIVIAL_MAX && found[i].hint !== "count" && fromTwo(n.value) ? { ...n, status: "context" } : n));
  const unverified = numbers.filter((n) => n.status === "unverified").map((n) => n.value);
  return { ok: unverified.length === 0, checked: numbers.length, unverified, numbers, corrections };
}

// Receipts for the figures in the customer summary, so an answer that needed no tool still has sources.
// The estimated weekly budget until payday and its inputs, so the answer can say them and the card can show them.
export function weeklyBudgetFacts(budget: WeeklyBudget | null | undefined, prefix = "budget"): Fact[] {
  if (!budget) return [];
  return [
    fact(`${prefix}:per-week`, "Estimated weekly budget until payday", budget.perWeekEur, "EUR", `(balance - bills due - protected buffer) / ${budget.weeksToPayday} weeks`, { source: "calculation" }),
    fact(`${prefix}:left`, "Left for spending until payday", budget.leftForSpendingEur, "EUR", "balance minus bills due before payday and the protected buffer", { source: "calculation" }),
    fact(`${prefix}:buffer`, "Protected buffer", budget.bufferEur, "EUR", budget.steps.find((step) => step.label === "Protected buffer")?.basis ?? "the amount the customer chose", { source: budget.bufferSource === "default" ? "assumption" : "customer-stated" }),
    fact(`${prefix}:weeks`, "Weeks until payday", budget.weeksToPayday, "count", `${budget.daysToPayday} days to ${budget.nextPayday}, divided by 7`, { source: "calculation" }),
    fact(`${prefix}:usual-week`, "Usual everyday spending per week", budget.usualEverydayPerWeekEur, "EUR", "12-month average", { source: "calculation" }),
    fact(`${prefix}:difference`, "Weekly budget minus usual weekly spending", budget.differencePerWeekEur, "EUR", "negative means usual spending is above the budget", { source: "calculation" }),
  ];
}

// `bufferEur`: the protected buffer the customer set in the app, if any, so the weekly budget's receipts match Today.
export function overviewFacts(o: Overview, bufferEur: number | null = null): Fact[] {
  const window = { from: o.windowFrom, to: o.windowTo };
  const basis = `average of the last ${o.windowMonths} months`;
  const last = lastMonthSpending(o);
  const flow = buildCashFlow(o, { bufferEur, bufferFrom: "app" });
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
    fact("overview:mandatory", "Essential costs per month", o.monthlyMandatory, "EUR/month", basis, { evidence: window }),
    fact("overview:everyday", "Everyday spending per month", o.monthlyEveryday, "EUR/month", basis, { evidence: { ...window, basket: "everyday" } }),
    fact("overview:runway", "Months of essential costs covered", o.runwayMonths, "months", "balance divided by essential costs", { source: "calculation" }),
    fact("overview:runway-all", "Months of all spending covered", o.monthlySpending > 0 ? Math.max(o.balance, 0) / o.monthlySpending : 0, "months", "balance divided by average monthly spending", { source: "calculation" }),
    fact("overview:buffer-3", "A three-month buffer", o.monthlyMandatory * 3, "EUR", "three times monthly essential costs", { source: "calculation" }),
    fact("overview:buffer-6", "A six-month buffer", o.monthlyMandatory * 6, "EUR", "six times monthly essential costs", { source: "calculation" }),
    fact("overview:safe-week", "Estimated weekly budget from 12-month averages", o.safeToSpend.perWeek, "EUR", "the monthly figure divided by weeks in a month", { source: "calculation" }),
    fact("overview:safe-month", "Estimated monthly budget for everyday spending, from 12-month averages", o.safeToSpend.perMonth, "EUR/month", "income minus regular essentials, occasional essentials and savings", { source: "calculation" }),
    fact("overview:safe-gap", "Gap between that budget and actual everyday spending", o.safeToSpend.gapPerMonth, "EUR/month", "budget minus actual", { source: "calculation" }),
    ...weeklyBudgetFacts(flow.weeklyBudget),
    fact("overview:weeks", "Weeks in a month", 52 / 12, "count", "52 weeks divided by 12 months", { source: "calculation" }),
    fact("overview:age", "Age", o.age, "years", "customer record"),
    fact("overview:peers", "Other demo profiles in the same age band", o.peerCount, "count", `ages ${o.ageBand}, synthetic demo data`, { synthetic: true }),
    ...o.baskets.flatMap((b) => [
      fact(`overview:basket:${b.id}`, `${b.label}, per month`, b.monthlyAvg, "EUR/month", basis, { evidence: { ...window, basket: b.id } }),
      fact(`overview:basket:${b.id}:share`, `${b.label}, share of spending`, Math.round(b.share * 100), "percent", "basket divided by all spending", { source: "calculation" }),
      ...b.categories.flatMap((c) => [
        fact(`overview:category:${c.category}`, `${c.category}, per month`, c.monthlyAvg, "EUR/month", `${c.count} transactions, ${basis}`, { evidence: { ...window, category: c.category } }),
        ...(c.peerMonthlyAvg === null ? [] : [fact(`overview:category:${c.category}:peers`, `${c.category}, average of demo profiles aged ${o.ageBand}`, c.peerMonthlyAvg, "EUR/month", `${o.peerCount} other profiles in the synthetic demo data`, { synthetic: true })]),
        ...(c.peerMonthlyAvg === null ? [] : [fact(`overview:category:${c.category}:gap`, `${c.category}, gap to demo profiles`, c.monthlyAvg - c.peerMonthlyAvg, "EUR/month", "your average minus theirs, within the demo data", { source: "calculation", synthetic: true })]),
      ]),
    ]),
    ...o.recurringBills.flatMap((bill) => [
      fact(`overview:bill:${bill.id}`, `${bill.guessLabel}, per month`, bill.monthlyAvg, "EUR/month", `average of ${bill.monthsSeen} payments`, { evidence: { ...window, category: bill.category } }),
      fact(`overview:bill:${bill.id}:low`, `${bill.guessLabel}, lowest month`, bill.min, "EUR", "last 12 months"),
      fact(`overview:bill:${bill.id}:high`, `${bill.guessLabel}, highest month`, bill.max, "EUR", "last 12 months"),
    ]),
  ];
}
