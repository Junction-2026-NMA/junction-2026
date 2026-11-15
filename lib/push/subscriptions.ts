// Web Push subscriptions: one per device that turned notifications on, kept in the visitor's own session state.
// The server only ever posts to a known browser push service, so a subscription cannot point it at any address.
import { readState, updateState } from "@/lib/store/state";
import type { PushSubscriptionRecord } from "@/lib/types";

const MAX_PER_SESSION = 5;
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "web.push.apple.com", "updates.push.services.mozilla.com"];
const PUSH_SUFFIXES = [".push.apple.com", ".push.services.mozilla.com", ".notify.windows.com", ".googleapis.com"];
const P256DH = /^[A-Za-z0-9_-]{80,100}={0,2}$/; // 65 bytes, base64url
const AUTH = /^[A-Za-z0-9_-]{16,32}={0,2}$/; // 16 bytes, base64url

export function knownPushService(endpoint: string): boolean {
  if (endpoint.length > 1_000 || !URL.canParse(endpoint)) return false;
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return PUSH_HOSTS.includes(url.hostname) || PUSH_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

export type Parsed = { ok: true; subscription: Omit<PushSubscriptionRecord, "createdAt"> } | { ok: false; reason: string };

export function parseSubscription(value: unknown): Parsed {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const keys = (raw.keys && typeof raw.keys === "object" ? raw.keys : {}) as Record<string, unknown>;
  const endpoint = typeof raw.endpoint === "string" ? raw.endpoint.trim() : "";
  if (!knownPushService(endpoint)) return { ok: false, reason: "This browser's notification address is not one Sisu can send to." };
  if (typeof keys.p256dh !== "string" || !P256DH.test(keys.p256dh) || typeof keys.auth !== "string" || !AUTH.test(keys.auth)) return { ok: false, reason: "The browser's notification keys could not be read." };
  return { ok: true, subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } };
}

export const listSubscriptions = (): PushSubscriptionRecord[] => readState().pushSubscriptions ?? [];

// Saves this device (once per endpoint); the newest five devices of a session are kept.
export function saveSubscription(subscription: Omit<PushSubscriptionRecord, "createdAt">, now: Date = new Date()): number {
  const next = updateState((state) => {
    const others = (state.pushSubscriptions ?? []).filter((item) => item.endpoint !== subscription.endpoint);
    return { ...state, pushSubscriptions: [...others, { ...subscription, createdAt: now.toISOString() }].slice(-MAX_PER_SESSION) };
  });
  return next.pushSubscriptions?.length ?? 0;
}

export function removeSubscriptions(endpoints: string[]): void {
  if (!endpoints.length) return;
  updateState((state) => ({ ...state, pushSubscriptions: (state.pushSubscriptions ?? []).filter((item) => !endpoints.includes(item.endpoint)) }));
}
