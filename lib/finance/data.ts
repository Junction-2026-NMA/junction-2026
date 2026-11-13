import txJson from "@/data/customers/transactions.json";
import indexJson from "@/data/customers/index.json";
import benchJson from "@/data/benchmarks.json";
import type { DemoCustomer, Transaction } from "@/lib/types";

// The synthetic dataset ends on this day. Sisu treats it as "today".
export const DATA_AS_OF = "2026-09-30";

// Names are invented for the demo. The dataset identifies customers only by ID.
const DISPLAY: Record<string, { displayName: string; area: string }> = {
  CUST04974: { displayName: "Aino", area: "Helsinki" },
  CUST04414: { displayName: "Eetu", area: "Espoo" },
  CUST02003: { displayName: "Sanna", area: "Helsinki" },
};

const ALL_TX = txJson as unknown as Transaction[];
const BENCH = benchJson as { ageBand: string; category: string; customers: number; avgMonthly: number }[];

export const DEMO_CUSTOMERS: DemoCustomer[] = (indexJson as { customerId: string; postalCode: string; age: number }[])
  .filter((c) => DISPLAY[c.customerId])
  .map((c) => ({ ...c, ...DISPLAY[c.customerId] }))
  .sort((a, b) => a.age - b.age);

export function findCustomer(customerId: string): DemoCustomer | null {
  return DEMO_CUSTOMERS.find((c) => c.customerId === customerId) ?? null;
}

// Per-customer scoping: every read goes through here, so one customer never sees another's rows.
export function transactionsFor(customerId: string): Transaction[] {
  return ALL_TX.filter((t) => t.customerId === customerId);
}

export function ageBandOf(age: number): string {
  if (age < 25) return "18-24";
  if (age < 31) return "25-30";
  if (age < 45) return "31-44";
  return "45+";
}

export function peerAverage(ageBand: string, category: string): { avgMonthly: number; customers: number } | null {
  const row = BENCH.find((b) => b.ageBand === ageBand && b.category === category);
  return row ? { avgMonthly: row.avgMonthly, customers: row.customers } : null;
}

export function peerCount(ageBand: string): number {
  return BENCH.find((b) => b.ageBand === ageBand)?.customers ?? 0;
}

// The last `count` full months ending at DATA_AS_OF, oldest first, as YYYY-MM.
export function lastMonths(count: number): string[] {
  const [year, month] = DATA_AS_OF.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}
