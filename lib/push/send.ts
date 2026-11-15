// Sends a phone notification to every subscription of the current visitor, with web-push (VAPID).
// The payload is the PushMessage only: a title, one sentence with nothing financial in it, and where a tap goes.
// A subscription the push service says is gone (404 or 410) is dropped. iOS requires every push to show a
// notification, so nothing is ever sent silently: the service worker (public/sw.js) always shows it.
import webpush from "web-push";
import type { PushMessage, StoredPushSubscription } from "@/lib/types";
import { listSubscriptions, removeSubscription } from "./subscriptions";

// The JWT `sub`: Apple's push service is strict about it, so a real https URL by default (no email address).
const DEFAULT_SUBJECT = "https://sisu-demo.vercel.app";
const TTL_SECONDS = 6 * 3600;

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };
export type PushSender = (subscription: StoredPushSubscription, payload: string, vapid: VapidKeys) => Promise<{ statusCode: number }>;

export function vapidKeys(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT?.trim() || DEFAULT_SUBJECT };
}

const webPushSender: PushSender = async (subscription, payload, vapid) => {
  const result = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload, { TTL: TTL_SECONDS, urgency: "high", vapidDetails: vapid });
  return { statusCode: result.statusCode };
};

let sender: PushSender = webPushSender;
// For tests: replace the sender (null puts web-push back).
export function setPushSender(next: PushSender | null): void {
  sender = next ?? webPushSender;
}

export type PushResult = { sent: number; dropped: number; failed: number; configured: boolean };

export async function pushToVisitor(message: PushMessage): Promise<PushResult> {
  const vapid = vapidKeys();
  const subscriptions = listSubscriptions();
  if (!vapid || !subscriptions.length) return { sent: 0, dropped: 0, failed: 0, configured: !!vapid };
  const payload = JSON.stringify(message);
  const results = await Promise.allSettled(subscriptions.map((subscription) => sender(subscription, payload, vapid)));
  let sent = 0;
  let dropped = 0;
  let failed = 0;
  results.forEach((result, index) => {
    const status = result.status === "fulfilled" ? result.value.statusCode : ((result.reason as { statusCode?: number }).statusCode ?? 0);
    if (status === 404 || status === 410) {
      removeSubscription(subscriptions[index].endpoint);
      dropped += 1;
    } else if (status >= 200 && status < 300) sent += 1;
    else {
      failed += 1;
      console.error(`[push] a notification was not accepted (${status || (result.status === "rejected" ? (result.reason as Error).message : "no status")})`);
    }
  });
  return { sent, dropped, failed, configured: true };
}
