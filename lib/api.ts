import type { DemoCustomer, EvidenceFilter, Overview, TransactionList } from "@/lib/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "Something went wrong. Please try again.");
  return body as T;
}

export const fetchDemoCustomers = () => getJson<DemoCustomer[]>("/api/customers/demo");

export const fetchOverview = (customerId: string) => getJson<Overview>(`/api/customers/${customerId}/overview`);

export function fetchTransactions(customerId: string, filter: EvidenceFilter) {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  return getJson<TransactionList>(`/api/customers/${customerId}/transactions?${params}`);
}
