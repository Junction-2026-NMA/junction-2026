// Average monthly spending per category over the overview's window, largest first. One place for it, so a chart,
// a scenario and an answer about "your restaurants" all start from the same figure.
import type { Overview } from "@/lib/types";
import { transactionsFor } from "./data";
import { groupBy, round2, sum } from "./math";

export type CategoryAverage = { category: string; monthly: number };

export function categoryAverages(overview: Overview): CategoryAverage[] {
  const rows = transactionsFor(overview.customerId).filter((row) => row.amount < 0 && row.date >= overview.windowFrom && row.date <= overview.windowTo);
  return Object.entries(groupBy(rows, (row) => row.category))
    .map(([category, list]) => ({ category, monthly: round2(-sum(list.map((row) => row.amount)) / overview.windowMonths) }))
    .filter((entry) => entry.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);
}
