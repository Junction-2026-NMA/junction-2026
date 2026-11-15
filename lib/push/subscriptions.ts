// The phones of this visitor that asked for notifications: kept in the visitor's own session state, never returned
// to any client except as "you are subscribed". A subscription is validated before it is stored.
import { readState, updateState } from "@/lib/store/state";
import type { StoredPushSubscription } from "@/lib/types";

const MAX_PER_SESSION = 5;
const B64URL = /^[A-Za-z0-9_-]+=*$/;

// PushSubscription.toJSON(): { endpoint, expirationTime, keys: { p256dh, auth } }. Only https push services.
export function cleanSubscription(value: unknown): Pick<StoredPushSubscription, "endpoint" | "keys"> | null {
  const o = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!o || typeof o !== "object" || typeof o.endpoint !== "string" || o.endpoint.length > 1_000 || !URL.canParse(o.endpoint)) return null;
  if (new URL(o.endpoint).protocol !== "https:") return null;
  const { p256dh, auth } = o.keys ?? {};
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100 || !B64URL.test(p256dh) || !B64URL.test(auth)) return null;
  return { endpoint: o.endpoint, keys: { p256dh, auth } };
}

export const listSubscriptions = (): StoredPushSubscription[] => readState().push ?? [];

export function saveSubscription(customerId: string, subscription: Pick<StoredPushSubscription, "endpoint" | "keys">, now: Date = new Date()): void {
  const record: StoredPushSubscription = { ...subscription, customerId, createdAt: now.toISOString() };
  updateState((state) => ({ ...state, push: [record, ...(state.push ?? []).filter((old) => old.endpoint !== record.endpoint)].slice(0, MAX_PER_SESSION) }));
}

// Without an endpoint: every subscription of the session. Answers how many were removed.
export function removeSubscription(endpoint: string | null): number {
  const before = listSubscriptions().length;
  updateState((state) => ({ ...state, push: endpoint === null ? [] : (state.push ?? []).filter((old) => old.endpoint !== endpoint) }));
  return before - listSubscriptions().length;
}
