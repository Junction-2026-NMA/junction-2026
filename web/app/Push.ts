// Phone notifications (v2 push): the service worker (public/sw.js, scope "/"), the permission, the subscription
// and what the server knows of it. One small store for the whole page, read with `usePush()`.
// - iOS shows web notifications only in the home-screen app (iOS 16.4+): outside it the status is "homeScreen".
// - The permission is asked from the tap itself: `enable()` calls Notification.requestPermission() before any await,
//   or iOS refuses it.
// - The subscription is sent to POST /api/push/subscribe and kept in the visitor's session on the server; the
//   notification text never carries anything financial (the server writes it).
// - A tap on a notification posts { type: "open-project", customerId, projectId } to the open app, or opens
//   /app?...&customer=&project= (useProjectLaunch handles both).
import { useEffect, useSyncExternalStore } from "react";
import { sisuFetch } from "@/web/core/VisitorSession";

export type PushStatus = "checking" | "on" | "off" | "blocked" | "homeScreen" | "unsupported" | "serverOff";
export interface PushState { readonly status: PushStatus; readonly busy: boolean; readonly message: string | null }

export const PushText: Record<PushStatus, string> = {
  checking: "Checking…",
  on: "Enabled",
  off: "Off",
  blocked: "Blocked in browser settings",
  homeScreen: "Add Sisu to your Home Screen to get notifications",
  unsupported: "Not supported here",
  serverOff: "Notifications aren't set up on this server",
};

let state: PushState = { status: "checking", busy: false, message: null };
const listeners = new Set<() => void>();
const set = (next: Partial<PushState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const hasWindow = () => typeof window !== "undefined" && typeof navigator !== "undefined";
const isIOS = () => hasWindow() && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
const isStandalone = () => hasWindow() && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const supported = () => hasWindow() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const api = (baseURL: string, path: string) => `${baseURL.replace(/\/+$/, "")}${path}`;
async function errorOf(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : fallback;
}

let registering: Promise<ServiceWorkerRegistration | null> | null = null;
/** Registers public/sw.js once (scope "/", so it covers /app). Null where there is no service worker. */
export function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!hasWindow() || !("serviceWorker" in navigator)) return Promise.resolve(null);
  registering ??= navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
  return registering;
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Works out the status from the browser and the server's key route. */
export async function refreshPush(baseURL: string): Promise<void> {
  if (!supported()) return set({ status: isIOS() && !isStandalone() ? "homeScreen" : "unsupported" });
  if (isIOS() && !isStandalone()) return set({ status: "homeScreen" });
  if (Notification.permission === "denied") return set({ status: "blocked" });
  const key = await sisuFetch(api(baseURL, "/api/push/key"), { cache: "no-store" }).catch(() => null);
  if (!key || key.status === 503) return set({ status: "serverOff" });
  const registration = await registerWorker();
  const subscription = await registration?.pushManager.getSubscription().catch(() => null);
  set({ status: Notification.permission === "granted" && subscription ? "on" : "off" });
}

/** "Turn on notifications": call straight from the tap (the permission prompt needs the gesture). */
export async function enablePush(baseURL: string, customerId: string): Promise<boolean> {
  if (!supported()) {
    set({ status: isIOS() && !isStandalone() ? "homeScreen" : "unsupported" });
    return false;
  }
  const asked = Notification.requestPermission(); // first, before any await
  set({ busy: true, message: null });
  try {
    const permission = await asked;
    if (permission !== "granted") {
      set({ status: permission === "denied" ? "blocked" : "off", message: permission === "denied" ? "Notifications are blocked. Allow them for Sisu in Settings, then try again." : null });
      return false;
    }
    const key = await sisuFetch(api(baseURL, "/api/push/key"), { cache: "no-store" });
    if (!key.ok) {
      set({ status: key.status === 503 ? "serverOff" : "off", message: await errorOf(key, "The server did not give a notification key.") });
      return false;
    }
    const { publicKey } = (await key.json()) as { publicKey: string };
    const registration = await registerWorker();
    if (!registration) throw new Error("The service worker could not start.");
    await navigator.serviceWorker.ready;
    const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    const saved = await sisuFetch(api(baseURL, "/api/push/subscribe"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, subscription: subscription.toJSON() }) });
    if (!saved.ok) {
      set({ status: "off", message: await errorOf(saved, "The server could not save this phone for notifications.") });
      return false;
    }
    set({ status: "on", message: "Notifications are on." });
    return true;
  } catch (error) {
    set({ status: "off", message: `Notifications could not be turned on: ${(error as Error).message}` });
    return false;
  } finally {
    set({ busy: false });
  }
}

/** "Send a test notification": the server pushes one to this visitor's phones. */
export async function testPush(baseURL: string, customerId: string, projectId: string | null = null): Promise<void> {
  set({ busy: true, message: null });
  try {
    const response = await sisuFetch(api(baseURL, "/api/push/test"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, projectId }) });
    set({ message: response.ok ? "Test sent. It should arrive in a few seconds." : await errorOf(response, "The test notification could not be sent.") });
  } catch {
    set({ message: "The server could not be reached." });
  } finally {
    set({ busy: false });
  }
}

/** The demo's delayed simulated change: the server waits, records a finding labelled simulated, and pushes. */
export async function scheduleSimulatedChange(baseURL: string, projectId: string, customerId: string, delaySeconds = 30): Promise<string> {
  try {
    const response = await sisuFetch(api(baseURL, `/api/watch/${encodeURIComponent(projectId)}/simulate-drop`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, delaySeconds }) });
    return response.ok ? `Scheduled: in ${delaySeconds} seconds a simulated change will be recorded and a notification sent. Lock the phone now.` : await errorOf(response, "The simulated change could not be scheduled.");
  } catch {
    return "The server could not be reached.";
  }
}

/** The push state, kept fresh while mounted (and when the page comes back to the front). */
export function usePush(baseURL: string): PushState {
  const snapshot = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => state, () => state);
  useEffect(() => {
    void refreshPush(baseURL);
    const again = () => { if (document.visibilityState === "visible") void refreshPush(baseURL); };
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, [baseURL]);
  return snapshot;
}
