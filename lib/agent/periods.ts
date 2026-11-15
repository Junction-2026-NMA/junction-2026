// Named months in the customer's own words ("June 2026", "maaliskuussa 2026", "i maj"), found by code.
// The model reliably used get_spending for English month names but answered "I can't see March 2026" for the
// Finnish "maaliskuussa 2026", even though the data covers it. Naming the dates for it removes the guess.
import { DATA_AS_OF, lastDayOf } from "@/lib/finance/data";

// Index 0-11. Finnish names are matched as stems, so inflected forms (maaliskuussa, maaliskuun) count too.
const MONTH_WORDS: string[][] = [
  ["january", "jan", "tammikuu", "januari"],
  ["february", "feb", "helmikuu", "februari"],
  ["march", "maaliskuu", "mars"],
  ["april", "apr", "huhtikuu"],
  ["may", "toukokuu", "maj"],
  ["june", "jun", "kesäkuu", "juni"],
  ["july", "jul", "heinäkuu", "juli"],
  ["august", "aug", "elokuu", "augusti"],
  ["september", "sept", "sep", "syyskuu"],
  ["october", "oct", "lokakuu", "oktober"],
  ["november", "nov", "marraskuu"],
  ["december", "dec", "joulukuu"],
];
// Words that are also ordinary words: they count only with a year right after them.
const NEEDS_YEAR = new Set(["may", "mars", "maj", "jan", "feb", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"]);
const FINNISH_STEMS = new Set(MONTH_WORDS.flat().filter((word) => word.endsWith("kuu")));
const MAX_MONTHS = 3;

export function namedMonths(text: string, asOf: string = DATA_AS_OF): string[] {
  const found: string[] = [];
  const latest = asOf.slice(0, 7);
  const words = /\p{L}+(?:\s*,?\s*(\d{4}))?/gu;
  for (const match of text.toLowerCase().matchAll(words)) {
    const word = match[0].replace(/[\s,\d]+$/, "");
    const year = match[1];
    const index = MONTH_WORDS.findIndex((names) => names.some((name) => (FINNISH_STEMS.has(name) ? word.startsWith(name) : word === name)));
    if (index < 0 || (NEEDS_YEAR.has(word) && !year)) continue;
    const mm = String(index + 1).padStart(2, "0");
    // Without a year: the most recent such month up to the end of the data.
    const month = year ? `${year}-${mm}` : `${latest.slice(0, 4)}-${mm}` <= latest ? `${latest.slice(0, 4)}-${mm}` : `${Number(latest.slice(0, 4)) - 1}-${mm}`;
    if (!found.includes(month)) found.push(month);
    if (found.length >= MAX_MONTHS) break;
  }
  return found;
}

// A note for the model when the customer names a month other than the last one in the data.
export function periodNote(text: string, asOf: string = DATA_AS_OF): string | null {
  const months = namedMonths(text, asOf).filter((month) => month !== asOf.slice(0, 7));
  if (!months.length) return null;
  const ranges = months.map((month) => `${month}-01 to ${lastDayOf(month)}`).join("; ");
  return `(Note from the app: the customer names ${ranges}. If they ask about money in that period, call get_spending with those dates; it says whether the period is in their bank data. Do not decide that yourself.)`;
}
