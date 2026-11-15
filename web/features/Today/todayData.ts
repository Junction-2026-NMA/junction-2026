"use client";
// What Today loads besides the overview: the cash flow (next payday, bills due before it, the everyday pace;
// GET /api/coach/cash-flow) and the newest transactions. Each is read once per customer and data source and kept
// for the page's life, so switching tabs does not ask again. A failure is remembered as `failed`, never filled in
// with other data: the screen says what is missing. The source follows the overview's: live while the overview is
// live, the bundled sample once the app has fallen back to it.
import { useEffect, useState } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { CoachClient } from "@/web/core/CoachClient";
import type { CashFlow } from "@/web/core/CoachModels";
import type { Transaction } from "@/web/core/Models";

export type Remote<T> = { readonly kind: "loading" } | { readonly kind: "loaded"; readonly value: T } | { readonly kind: "failed" };

const cashFlows = new Map<string, Promise<CashFlow>>();
const recents = new Map<string, Promise<Transaction[]>>();

/** How many transactions Today lists. */
export const recentCount = 5;

/** Newest first (date, then time), the first `count`. */
export function newest(rows: readonly Transaction[], count: number): Transaction[] {
  const key = (row: Transaction) => `${row.date}T${row.time ?? ""}`;
  return [...rows].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0)).slice(0, count);
}

function useRemote<T>(key: string | null, load: () => Promise<T>): Remote<T> {
  const [state, setState] = useState<{ key: string | null; remote: Remote<T> }>({ key: null, remote: { kind: "loading" } });
  useEffect(() => {
    if (key === null) return;
    let alive = true;
    load().then(
      (value) => { if (alive) setState({ key, remote: { kind: "loaded", value } }); },
      () => { if (alive) setState({ key, remote: { kind: "failed" } }); },
    );
    return () => { alive = false; };
    // `load` is rebuilt every render; the key names everything it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state.remote : { kind: "loading" };
}

/** The cash flow of the shown customer. */
export function useCashFlow(): Remote<CashFlow> {
  const customerId = useAppSelector((s) => s.customer?.customerId ?? null);
  const live = useAppSelector((s) => s.isLive);
  const baseURL = useAppSelector((s) => s.baseURLString);
  const key = customerId === null ? null : `${live ? `live:${baseURL}` : "sample"}|${customerId}`;
  return useRemote(key, () => {
    const cached = cashFlows.get(key ?? "");
    if (cached) return cached;
    const client = live ? CoachClient.live(baseURL) : CoachClient.sample();
    const request = client.cashFlow(customerId ?? "");
    // A failure is not kept, so the next visit to Today asks again.
    request.catch(() => cashFlows.delete(key ?? ""));
    cashFlows.set(key ?? "", request);
    return request;
  });
}

/** The newest transactions of the shown customer (the overview's window, newest first). */
export function useRecentTransactions(): Remote<Transaction[]> {
  const model = useAppModel();
  const customerId = useAppSelector((s) => s.customer?.customerId ?? null);
  const apiKind = useAppSelector((s) => s.apiKind);
  const overview = useAppSelector((s) => s.overview);
  const ready = customerId !== null && overview !== null && overview.customerId === customerId;
  const key = ready ? `${apiKind}|${customerId}` : null;
  return useRemote(key, () => {
    const cached = recents.get(key ?? "");
    if (cached) return cached;
    const request = model.transactions(null).then((list) => newest(list.transactions, recentCount));
    request.catch(() => recents.delete(key ?? ""));
    recents.set(key ?? "", request);
    return request;
  });
}
