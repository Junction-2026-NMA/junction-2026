// Sends a phone notification to every device of the current visitor session, with Web Push (VAPID).
// The text never carries money or listing details: those stay inside the app. A device the push service says is
// gone (404 or 410) is forgotten. Tests swap the sender with setPushSender, so they make no network calls.
import webpush from "web-push";
import type { PushSubscriptionRecord } from "@/lib/types";
import { pushConfigured } from "@/lib/watch/scheduler";
import { listSubscriptions, removeSubscriptions } from "./subscriptions";

export type PushPayload = { title: string; body: string; url: string; tag: string };
export type SendOutcome = { ok: true } | { ok: false; gone: boolean; status: number | null };
export type PushSender = (subscription: PushSubscriptionRecord, payload: string) => Promise<SendOutcome>;
export type Delivery = { status: "sent" | "no-subscription" | "failed" | "push-off"; sent: number; failed: number };

const env = (name: string): string => process.env[name]?.trim() ?? "";

const webPushSender: PushSender = async (subscription, payload) => {
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload, {
      vapidDetails: { subject: env("VAPID_SUBJECT") || "mailto:sisu-demo@example.invalid", publicKey: env("VAPID_PUBLIC_KEY"), privateKey: env("VAPID_PRIVATE_KEY") },
      TTL: 6 * 3600,
      urgency: "high",
      timeout: 8_000,
    });
    return { ok: true };
  } catch (error) {
    const status = typeof (error as { statusCode?: unknown }).statusCode === "number" ? (error as { statusCode: number }).statusCode : null;
    return { ok: false, gone: status === 404 || status === 410, status };
  }
};

const globalPush = globalThis as unknown as { __sisuPushSender?: PushSender | null };
export const setPushSender = (sender: PushSender | null): void => {
  globalPush.__sisuPushSender = sender;
};
const senderNow = (): PushSender => globalPush.__sisuPushSender ?? webPushSender;
// A test sender counts as configured, so tests do not need VAPID keys.
const ready = (): boolean => !!globalPush.__sisuPushSender || pushConfigured();

export async function sendToSession(payload: PushPayload): Promise<Delivery> {
  if (!ready()) return { status: "push-off", sent: 0, failed: 0 };
  const devices = listSubscriptions();
  if (!devices.length) return { status: "no-subscription", sent: 0, failed: 0 };
  const text = JSON.stringify(payload);
  const results = await Promise.all(devices.map((device) => senderNow()(device, text)));
  removeSubscriptions(devices.filter((_, index) => { const result = results[index]; return !result.ok && result.gone; }).map((device) => device.endpoint));
  const sent = results.filter((result) => result.ok).length;
  const failed = results.length - sent;
  if (failed) console.error(`[push] ${failed} of ${results.length} notifications were not accepted by the push service`);
  return { status: sent ? "sent" : "failed", sent, failed };
}
