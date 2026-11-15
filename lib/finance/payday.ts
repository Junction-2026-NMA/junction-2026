// v2 payday: the inputs a customer can confirm for the budget until payday (the payday date, a bill the history does
// not show), the period said in words, and category cuts worked out in cents so 10% is exactly half of 20%.
import type { CutBackSuggestion, ExtraBill, Overview, PaydayOverrides } from "@/lib/types";
import { categoryAverages } from "./categories";
import { DATA_AS_OF } from "./data";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
export const MAX_DAYS_AHEAD = 62; // a payday or a bill more than two months after the data ends is not "before payday"
const MAX_BILLS = 10;
const MAX_LABEL = 40;
const MAX_BILL_EUR = 100_000;
export const CUT_BACK_PCT = 20;
// Food at home is a need, not a cut-back: the suggestion looks at the other everyday categories.
const NOT_A_CUT_BACK = new Set(["Groceries"]);
const EVERYDAY = new Set(["Groceries", "Restaurants", "Transportation", "Entertainment", "Lifestyle", "Travel"]);

const toTime = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();
export const daysAfterDataEnd = (iso: string): number => Math.round((toTime(iso) - toTime(DATA_AS_OF)) / DAY_MS);

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

const longDate = (iso: string): string => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");

// "until payday on Thu 15 Oct, 15 days"
export function periodText(nextPayday: string, days: number): string {
  return `until payday on ${longDate(nextPayday)}, ${days} ${days === 1 ? "day" : "days"}`;
}

export function parsePaydayDate(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const date = validDate(value);
  if (!date) return "invalid";
  const days = daysAfterDataEnd(date);
  return days >= 1 && days <= MAX_DAYS_AHEAD ? date : "invalid";
}

// A JSON string (a query parameter or a form field) or an array. Each bill: a label, euros above zero, a due date.
export function parseExtraBills(value: unknown): ExtraBill[] | "invalid" {
  if (value === undefined || value === null || value === "") return [];
  let list: unknown = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return "invalid";
    }
  }
  if (!Array.isArray(list) || list.length > MAX_BILLS) return "invalid";
  const bills = list.map((item): ExtraBill | null => {
    const bill = (item ?? {}) as Record<string, unknown>;
    const label = typeof bill.label === "string" ? bill.label.trim().slice(0, MAX_LABEL) : "";
    const amount = typeof bill.amountEur === "string" ? Number(bill.amountEur) : bill.amountEur;
    const dueDate = validDate(bill.dueDate);
    if (!label || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > MAX_BILL_EUR || !dueDate) return null;
    const days = daysAfterDataEnd(dueDate);
    return days >= 0 && days <= MAX_DAYS_AHEAD ? { label, amountEur: Math.round(amount * 100) / 100, dueDate } : null;
  });
  return bills.every((bill): bill is ExtraBill => bill !== null) ? bills : "invalid";
}

// Both overrides from an untrusted body or query, or the sentence to show when one is wrong.
export function parsePaydayOverrides(input: { paydayDate?: unknown; extraBills?: unknown }): PaydayOverrides | string {
  const paydayDate = parsePaydayDate(input.paydayDate);
  if (paydayDate === "invalid") return `paydayDate must be a date (YYYY-MM-DD) between 1 and ${MAX_DAYS_AHEAD} days after ${DATA_AS_OF}.`;
  const extraBills = parseExtraBills(input.extraBills);
  if (extraBills === "invalid") return `extraBills must be up to ${MAX_BILLS} bills, each with a label, an amount above 0 euros and a due date (YYYY-MM-DD) within ${MAX_DAYS_AHEAD} days of ${DATA_AS_OF}.`;
  return { ...(paydayDate ? { paydayDate } : {}), ...(extraBills.length ? { extraBills } : {}) };
}

// A cut of a monthly baseline, in whole cents: the baseline is rounded to cents first, then the cut. For a baseline
// whose cents divide evenly enough (as here), 10% is exactly half of 20%; the same baseline is used every time.
export function cutOf(baselineEur: number, cutPct: number): number {
  const cents = Math.round(baselineEur * 100);
  return Math.round((cents * cutPct) / 100) / 100;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

// "Based on €276.52 a month at restaurants, Oct 2025–Sep 2026"
export function baselineText(category: string, monthlyEur: number, from: string, to: string): string {
  return `Based on €${monthlyEur.toFixed(2)} a month at ${category.toLowerCase()}, ${monthYear(from)}–${monthYear(to)}`;
}

export function categoryCut(overview: Overview, category: string, cutPct: number): CutBackSuggestion | null {
  const entry = categoryAverages(overview).find((one) => one.category === category);
  if (!entry || !(cutPct > 0 && cutPct <= 100)) return null;
  const average = Math.round(entry.monthly * 100) / 100;
  const perMonth = cutOf(average, cutPct);
  return {
    category,
    averagePerMonthEur: average,
    cutPct,
    freesPerMonthEur: perMonth,
    freesPerYearEur: Math.round(perMonth * 1200) / 100,
    baselineFrom: overview.windowFrom,
    baselineTo: overview.windowTo,
    baselineText: baselineText(category, average, overview.windowFrom, overview.windowTo),
  };
}

// One practical cut-back: 20% of the largest flexible everyday category (restaurants for most young customers).
export function cutBackSuggestion(overview: Overview): CutBackSuggestion | null {
  const largest = categoryAverages(overview).find((entry) => EVERYDAY.has(entry.category) && !NOT_A_CUT_BACK.has(entry.category));
  return largest ? categoryCut(overview, largest.category, CUT_BACK_PCT) : null;
}

// Words people use for each category, so "what about 10%?" can find the category named earlier in the chat.
const CATEGORY_WORDS: [RegExp, string][] = [
  [/restaurant|eating out|dining out|takeaway|ravintola/i, "Restaurants"],
  [/grocer|food shop|ruoka/i, "Groceries"],
  [/transport|travel card|bus|taxi/i, "Transportation"],
  [/entertain|streaming|cinema/i, "Entertainment"],
  [/lifestyle|clothes|shopping/i, "Lifestyle"],
  [/\btravel|holiday|trip/i, "Travel"],
  [/health|pharmacy/i, "Health"],
];

export function categoryIn(text: string): string | null {
  return CATEGORY_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

// The category of the latest earlier message that named one (newest first), or null.
export function categoryFromHistory(texts: string[]): string | null {
  for (const text of [...texts].reverse()) {
    const found = categoryIn(text);
    if (found) return found;
  }
  return null;
}

// "20%" or "20 percent" in a text, or null.
export function percentIn(text: string): number | null {
  const match = /(\d{1,3}(?:[.,]\d+)?)\s?(%|percent|prosent)/i.exec(text);
  return match ? Number(match[1].replace(",", ".")) : null;
}
