import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { vapidKeys } from "@/lib/push/send";
import { cleanSubscription, listSubscriptions, removeSubscription, saveSubscription } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

// This phone's push subscription, kept in the visitor's own session state (never returned, never shared).
// POST { customerId, subscription: PushSubscription.toJSON() } stores it. DELETE { endpoint? } removes it (without
// an endpoint: every subscription of this visitor). GET answers { configured, subscribed } (a count, no endpoints).
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "push", 20)) return TOO_MANY();
  if (!vapidKeys()) return jsonError("Notifications aren't set up on this server.", 503);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const subscription = cleanSubscription(body.subscription);
  if (!subscription) return jsonError("That is not a push subscription this server can use.", 400);
  saveSubscription(customerId, subscription);
  return Response.json({ subscribed: true });
});

export const DELETE = withVisitor(async function DELETE(request: Request) {
  if (!allowRequest(request, "push", 20)) return TOO_MANY();
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  return Response.json({ removed: removeSubscription(endpoint) });
});

export const GET = withVisitor(async function GET() {
  return Response.json({ configured: !!vapidKeys(), subscribed: listSubscriptions().length }, { headers: { "Cache-Control": "no-store" } });
});
