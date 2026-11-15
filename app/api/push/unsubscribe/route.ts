import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { listSubscriptions, removeSubscriptions } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

// Forgets one device's subscription. Body: { customerId, endpoint }. Answers { removed, devices }.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "push", 20)) return TOO_MANY();
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!parseCustomerId(body.customerId)) return jsonError("Choose a customer first.", 400);
  if (typeof body.endpoint !== "string" || body.endpoint.length > 1_000) return jsonError("Name the device's notification address (endpoint).", 400);
  const before = listSubscriptions().length;
  removeSubscriptions([body.endpoint]);
  const devices = listSubscriptions().length;
  return Response.json({ removed: before - devices, devices });
});
