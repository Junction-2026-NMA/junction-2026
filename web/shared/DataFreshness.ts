"use client";
// When the screens last received data, for Settings > Data and sources. Port of DataFreshness in
// ios/Sisu/Shared/SisuStyle.swift: Today notes it when an overview finishes loading.
// A module singleton with a subscribe callback; read it in React with useDataFreshness().
import { useSyncExternalStore } from "react";

/** The two Overview fields this needs (web/core Models.ts `Overview` has them). */
export interface OverviewStamp {
  customerId: string;
  dataTimestamp: string;
}

let overviewFetchedAt: Date | null = null;
let overviewTimestamp: string | null = null;
const listeners = new Set<() => void>();

export const DataFreshness = {
  get overviewFetchedAt(): Date | null {
    return overviewFetchedAt;
  },

  /** Call when an overview finished loading. A new customer or data timestamp restarts the clock. */
  overviewLoaded(overview: OverviewStamp | null | undefined): void {
    if (!overview) return;
    const stamp = `${overview.customerId}|${overview.dataTimestamp}`;
    if (stamp === overviewTimestamp && overviewFetchedAt !== null) return;
    overviewTimestamp = stamp;
    overviewFetchedAt = new Date();
    for (const listener of listeners) listener();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** The time the overview was last fetched, or null. Re-renders when it changes. */
export function useDataFreshness(): Date | null {
  return useSyncExternalStore(DataFreshness.subscribe, () => overviewFetchedAt, () => null);
}
