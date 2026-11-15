"use client";
// v2 payday: the payday date and bills the person confirmed, per customer, kept in the app's defaults under
// `sisu.payday.<customerId>` (Keys.paydayPrefix; starting over clears it). Today's cash flow, "Show the maths", the
// payday answer card and every question to Sisu read the same value, so they all show the same figure.
import { useSyncExternalStore } from "react";
import { PaydayBudget } from "@/web/core/AppLogic/PaydayBudget";
import type { PaydayOverrides } from "@/web/core/CoachModels";
import { Keys } from "./AppState";
import type { SisuDefaults } from "./Defaults";

class Store {
  private defaults: SisuDefaults | null = null;
  private listeners = new Set<() => void>();
  /** The last value read per customer, by its JSON, so a snapshot keeps its identity while nothing changed. */
  private seen = new Map<string, { json: string; value: PaydayOverrides | null }>();

  attach(defaults: SisuDefaults): void {
    this.defaults = defaults;
    this.seen.clear();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  get = (customerId: string): PaydayOverrides | null => {
    const value = PaydayBudget.decode(this.defaults?.json(`${Keys.paydayPrefix}${customerId}`) ?? null);
    const json = JSON.stringify(value);
    const last = this.seen.get(customerId);
    if (last && last.json === json) return last.value;
    this.seen.set(customerId, { json, value });
    return value;
  };

  set(customerId: string, overrides: PaydayOverrides | null): void {
    const value = PaydayBudget.decode(overrides);
    const key = `${Keys.paydayPrefix}${customerId}`;
    if (value === null) this.defaults?.remove(key);
    else this.defaults?.setJSON(key, value);
    this.listeners.forEach((listener) => listener());
  }
}

export const paydayStore = new Store();

/** The overrides of this customer, updated when they change. */
export function usePaydayOverrides(customerId: string | null): PaydayOverrides | null {
  return useSyncExternalStore(
    paydayStore.subscribe,
    () => (customerId === null ? null : paydayStore.get(customerId)),
    () => null,
  );
}
