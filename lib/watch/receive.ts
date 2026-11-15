// v2 push: one Context.dev webhook delivery (POST /api/watch/webhook?ref=…). Answers fast; the check itself runs
// after the answer (after()), as the visitor the encrypted ref names:
//   ref unreadable -> 404; watch gone -> 200 ignored; paused or stopped -> 200 ignored (nothing is checked);
//   bad or stale signature -> 401; a delivery id seen before -> 200 duplicate; else 202 and checkWatches for that
//   watch (trigger "webhook"), which pushes to the phone when it records a new finding.
import { later, runAsVisitor } from "@/lib/background";
import { SHARED, isSessionId } from "@/lib/store/session";
import { updateState } from "@/lib/store/state";
import { checkWatches, findWatch, replaceWatch } from "./index";
import { decryptRef, parseEvent, verifySignature } from "./webhook";

const MAX_DELIVERIES = 200;

export type Received = { status: number; body: Record<string, unknown> };
export type Delivery = { ref: string | null; signature: string | null; deliveryId: string | null; event: string | null; rawBody: string };

export async function receiveWebhook(delivery: Delivery, now: Date = new Date()): Promise<Received> {
  const ref = decryptRef(delivery.ref);
  if (!ref || !(ref.sessionId === SHARED || isSessionId(ref.sessionId))) return { status: 404, body: { error: "Unknown webhook." } };
  return runAsVisitor(ref.sessionId, async (): Promise<Received> => {
    const watch = findWatch(ref.customerId, ref.watchId);
    if (!watch) return { status: 200, body: { ignored: "gone" } };
    if (watch.status !== "active") return { status: 200, body: { ignored: watch.status } };
    const secrets = [...watch.pages.map((page) => page.webhookSecret), watch.searchWebhookSecret].filter((secret): secret is string => !!secret);
    if (!verifySignature(delivery.signature, delivery.rawBody, secrets, now)) return { status: 401, body: { error: "Bad signature." } };
    const event = parseEvent(delivery.rawBody, delivery.deliveryId, delivery.event);
    if (!event) return { status: 400, body: { error: "Unreadable delivery." } };

    let duplicate = false;
    updateState((state) => {
      duplicate = (state.webhookDeliveries ?? []).includes(event.id);
      if (duplicate) return state;
      const current = (state.watches ?? []).find((item) => item.id === watch.id && item.customerId === watch.customerId);
      const change = event.change;
      const withChange = current && change && event.monitorId ? replaceWatch(state, { ...current, pages: current.pages.map((page) => (page.monitorId === event.monitorId ? { ...page, lastChange: change } : page)) }) : state;
      return { ...withChange, webhookDeliveries: [event.id, ...(state.webhookDeliveries ?? [])].slice(0, MAX_DELIVERIES) };
    });
    if (duplicate) return { status: 200, body: { duplicate: true } };
    later("webhook check", () => checkWatches(ref.customerId, { trigger: "webhook", watchId: ref.watchId }));
    return { status: 202, body: { accepted: true } };
  });
}
