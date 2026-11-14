import type { BasketId, EvidenceFilter, Transaction, TransactionList } from "@/lib/types";
import { basketOf } from "./baskets";
import { DATA_AS_OF, findCustomer, transactionsFor } from "./data";
import { round2, sum } from "./math";

const MAX_ROWS = 300;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BASKET_IDS: BasketId[] = ["regular", "irregular", "everyday"];

// A real day: 2026-02-31 and 2026-13-99 have the right shape but are not days of the calendar.
function isDay(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

// Turns untrusted query-string values into a filter, or returns an error message.
export function parseFilter(params: URLSearchParams): EvidenceFilter | string {
  const from = params.get("from") ?? "2024-10-01";
  const to = params.get("to") ?? DATA_AS_OF;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return "Dates must look like 2026-09-30.";
  const notADay = [from, to].find((date) => !isDay(date));
  if (notADay) return `${notADay} is not a date in the calendar. Dates must look like 2026-09-30.`;
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

// Every row that matches, with no limit. Use this for sums and rankings; listTransactions is for showing rows.
export function filterTransactions(customerId: string, filter: EvidenceFilter): Transaction[] {
  return transactionsFor(customerId).filter(
    (t) =>
      t.date >= filter.from &&
      t.date <= filter.to &&
      (!filter.category || t.category === filter.category) &&
      (!filter.basket || basketOf(t.category)?.basket === filter.basket) &&
      (!filter.mcc || t.mcc === filter.mcc) &&
      (!filter.negativeBalance || t.balanceAfter < 0),
  );
}

export function listTransactions(customerId: string, filter: EvidenceFilter): TransactionList | null {
  if (!findCustomer(customerId)) return null;
  const rows = filterTransactions(customerId, filter);
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
