// The last full month in the data, by category. "How much did I spend on X last month?" is the most common question,
// so its answer is worked out once here and handed to the model up front instead of costing a tool round trip.
import type { EvidenceFilter, Overview } from "@/lib/types";
import { basketOf } from "./baskets";
import { lastDayOf } from "./data";
import { groupBy, round2, sum } from "./math";
import { filterTransactions } from "./transactions";

export type LastMonth = { month: string; evidence: EvidenceFilter; totalEur: number; transactions: number; categories: { category: string; totalEur: number; transactions: number }[] };

export function lastMonthSpending(overview: Overview): LastMonth {
  const month = overview.dataTimestamp.slice(0, 7);
  const evidence = { from: `${month}-01`, to: lastDayOf(month) };
  const rows = filterTransactions(overview.customerId, evidence).filter((row) => row.amount < 0 && basketOf(row.category));
  const categories = Object.entries(groupBy(rows, (row) => row.category))
    .map(([category, items]) => ({ category, totalEur: round2(-sum(items.map((row) => row.amount))), transactions: items.length }))
    .sort((a, b) => b.totalEur - a.totalEur);
  return { month, evidence, totalEur: round2(-sum(rows.map((row) => row.amount))), transactions: rows.length, categories };
}
