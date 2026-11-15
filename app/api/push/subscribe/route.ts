import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { parseSubscription, saveSubscription } from "@/lib/push/subscriptions";
import { pushConfigured } from "@/lib/watch/scheduler";

export const runtime = "nodejs";

// Saves this device's Web Push subscription in the visitor's own session, so Sisu can notify it while the app is
// closed. Body: { customerId, subscription: { endpoint, keys: { p256dh, auth } } }. Answers { saved: true, devices }.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "push", 20)) return TOO_MANY();
  if (!pushConfigured()) return jsonError("Phone notifications are not set up on this server yet. Sisu will show updates inside the app.", 503);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const parsed = parseSubscription(body.subscription);
  if (!parsed.ok) return jsonError(parsed.reason, 400);
  return Response.json({ saved: true, devices: saveSubscription(parsed.subscription) });
});
