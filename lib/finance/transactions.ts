import type { BasketId, EvidenceFilter, TransactionList } from "@/lib/types";
import { basketOf } from "./baskets";
import { DATA_AS_OF, findCustomer, transactionsFor } from "./data";
import { round2, sum } from "./math";

const MAX_ROWS = 300;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BASKET_IDS: BasketId[] = ["regular", "irregular", "everyday"];

// Turns untrusted query-string values into a filter, or returns an error message.
export function parseFilter(params: URLSearchParams): EvidenceFilter | string {
  const from = params.get("from") ?? "2024-10-01";
  const to = params.get("to") ?? DATA_AS_OF;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return "Dates must look like 2026-09-30.";
  if (from > to) return "The start date is after the end date.";
  const basket = params.get("basket");
  if (basket && !BASKET_IDS.includes(basket as BasketId)) return "Unknown basket.";
  const mcc = params.get("mcc");
  if (mcc && !/^\d{4}$/.test(mcc)) return "A merchant code is four digits.";
  return {
    from,
    to,
    category: params.get("category") ?? undefined,
    basket: (basket as BasketId) ?? undefined,
    mcc: mcc ?? undefined,
    negativeBalance: params.get("negativeBalance") === "true" || undefined,
  };
}

export function listTransactions(customerId: string, filter: EvidenceFilter): TransactionList | null {
  if (!findCustomer(customerId)) return null;
  const rows = transactionsFor(customerId).filter(
    (t) =>
      t.date >= filter.from &&
      t.date <= filter.to &&
      (!filter.category || t.category === filter.category) &&
      (!filter.basket || basketOf(t.category)?.basket === filter.basket) &&
      (!filter.mcc || t.mcc === filter.mcc) &&
      (!filter.negativeBalance || t.balanceAfter < 0),
  );
  const newestFirst = [...rows].reverse();
  return {
    customerId,
    dataTimestamp: DATA_AS_OF,
    currency: "EUR",
    count: rows.length,
    total: round2(sum(rows.map((t) => t.amount))),
    truncated: rows.length > MAX_ROWS,
    transactions: newestFirst.slice(0, MAX_ROWS),
  };
}
