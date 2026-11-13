import type { Confidence, RecurringBill, Transaction } from "@/lib/types";
import { groupBy, mean, median, round2, stddev } from "./math";

const MIN_MONTH_COVERAGE = 0.8; // seen in at least 80% of months to count as recurring
const VARIABLE_CV = 0.15; // above this the amount is treated as usage-based, not fixed

// Sisu's first guess for unnamed bill slots, largest first. The data has no payee, so the user confirms.
const SLOT_GUESSES: Record<string, string[]> = {
  Utilities: ["Electricity", "Home internet", "Mobile plan", "Water", "Insurance"],
  Housing: ["Rent or housing payment"],
};

function modeOf(xs: number[]): number {
  const counts = xs.reduce<Record<number, number>>((acc, x) => ({ ...acc, [x]: (acc[x] ?? 0) + 1 }), {});
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
}

function confidenceOf(coverage: number, cv: number): Confidence {
  if (coverage >= 0.95 && cv < 0.4) return "high";
  if (coverage >= MIN_MONTH_COVERAGE) return "medium";
  return "low";
}

// Non-card payments (no merchant) that repeat every month are bills. A category with three payments a
// month is split into three "slots" by size, because the dataset does not say who was paid.
export function detectRecurringBills(windowTx: Transaction[], months: string[]): RecurringBill[] {
  const candidates = windowTx.filter((t) => t.amount < 0 && t.type !== "purchase" && SLOT_GUESSES[t.category]);
  const byCategory = groupBy(candidates, (t) => t.category);

  return Object.entries(byCategory).flatMap(([category, rows]) => {
    const byMonth = groupBy(rows, (t) => t.date.slice(0, 7));
    const slotsPerMonth = modeOf(months.map((m) => byMonth[m]?.length ?? 0));
    if (slotsPerMonth === 0) return [];

    return Array.from({ length: slotsPerMonth }, (_, slot): RecurringBill | null => {
      const picks = months.flatMap((m) => {
        const sorted = [...(byMonth[m] ?? [])].sort((a, b) => a.amount - b.amount); // most negative first
        return sorted[slot] ? [sorted[slot]] : [];
      });
      const coverage = picks.length / months.length;
      if (coverage < MIN_MONTH_COVERAGE) return null;

      const amounts = picks.map((t) => -t.amount);
      const avg = mean(amounts);
      const cv = avg ? stddev(amounts) / avg : 0;
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      const shape = cv > VARIABLE_CV ? "the amount moves, so it looks usage-based" : "the amount is steady, so it looks like a fixed contract";
      return {
        id: `${category.toLowerCase()}-${slot + 1}`,
        category,
        guessLabel: SLOT_GUESSES[category][slot] ?? `${category} bill ${slot + 1}`,
        monthlyAvg: round2(avg),
        min: round2(min),
        max: round2(max),
        typicalDay: Math.round(median(picks.map((t) => Number(t.date.slice(8, 10))))),
        monthsSeen: picks.length,
        windowMonths: months.length,
        confidence: confidenceOf(coverage, cv),
        basis: `Paid in ${picks.length} of the last ${months.length} months, between €${min.toFixed(0)} and €${max.toFixed(0)}; ${shape}.`,
      };
    }).filter((b): b is RecurringBill => b !== null);
  });
}
