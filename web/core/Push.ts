// Phone notifications (Web Push) for Projects. The service worker (public/sisu-sw.js) only shows a pushed
// notification and opens the right finding when it is tapped: it has no fetch handler and caches nothing, so
// updates during the demo stay instant. Permission is asked ONLY from a tap ("Turn on phone notifications").
// On an iPhone, Web Push works only in the app added to the Home Screen (iOS 16.4 and later).
// When it cannot work (denied, unsupported, or a server without push), Sisu shows updates inside the app instead.
import type { CoachClient } from "./CoachClient";
import { ProjectCalls } from "./ProjectCreate";

export type PushStatus = "on" | "off" | "unavailable" | "not-asked";

export const SW_URL = "/sisu-sw.js";
export const SW_SCOPE = "/app";

export const PushText = {
  status(status: PushStatus): string {
    switch (status) {
      case "on": return "Phone notifications are on.";
      case "off": return "Notifications are off. Sisu will show updates inside the app.";
      case "unavailable": return "Phone notifications are not available here. Sisu will show updates inside the app.";
      case "not-asked": return "Sisu can notify you on this phone when it finds a match.";
    }
  },
  turnOn: "Turn on phone notifications",
  test: "Send a test notification",
  needsServer: "Phone notifications need the updated Sisu server. Sisu shows updates inside the app.",
  iosHint: "On an iPhone, add Sisu to the Home Screen and open it from there to get notifications.",
} as const;

const hasWindow = () => typeof window !== "undefined" && typeof navigator !== "undefined";

/** The browser can do Web Push here. iOS only offers it in the app opened from the Home Screen. */
export function pushSupported(): boolean {
  if (!hasWindow()) return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushStatusNow(): PushStatus {
  if (!pushSupported()) return "unavailable";
  if (Notification.permission === "denied") return "off";
  return Notification.permission === "granted" ? "on" : "not-asked";
}

let registering: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registers the worker once (scope /app). Safe to call on every mount; null where it cannot run. */
export function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!hasWindow() || !("serviceWorker" in navigator)) return Promise.resolve(null);
  registering ??= navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch(() => null);
  return registering;
}

/** VAPID keys come base64url encoded; PushManager wants the bytes. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null, wanted: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === wanted.length && bytes.every((value, index) => value === wanted[index]);
}

/** From a tap only: asks permission, subscribes this device and sends the subscription to the visitor's session.
 *  Answers the status to show; never throws. */
export async function enablePush(client: CoachClient, customerId: string): Promise<PushStatus> {
  if (!pushSupported()) return "unavailable";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "off" : "not-asked";
    const key = await ProjectCalls.pushKey(client);
    if (!key) return "unavailable";
    await registerWorker();
    // subscribe() needs an ACTIVE worker (iOS refuses otherwise), so wait for it rather than the bare registration.
    const registration = await navigator.serviceWorker.ready;
    const wanted = keyBytes(key);
    const existing = await registration.pushManager.getSubscription();
    // A subscription made with another server key (keys changed, another server) cannot receive our pushes.
    const reusable = existing && sameKey(existing.options.applicationServerKey, wanted) ? existing : null;
    if (existing && !reusable) await existing.unsubscribe().catch(() => false);
    const subscription = reusable ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "unavailable";
    await ProjectCalls.pushSubscribe(client, customerId, { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
    return "on";
  } catch {
    return "unavailable";
  }
}

/** The message the worker posts when a notification is tapped while the app is open. */
export interface OpenMessage { type: "sisu-open"; url: string }
export const isOpenMessage = (data: unknown): data is OpenMessage =>
  !!data && typeof data === "object" && (data as { type?: unknown }).type === "sisu-open" && typeof (data as { url?: unknown }).url === "string";
