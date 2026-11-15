import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { markAlertsRead } from "@/lib/watch/alerts";

export const runtime = "nodejs";

// Marks one in-app notification (alert) as read, e.g. after the app opened its finding. Body: { customerId, alertId }.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  if (typeof body.alertId !== "string" || body.alertId.length > 64) return jsonError("Name the notification to mark as read (alertId).", 400);
  return Response.json({ marked: markAlertsRead(customerId, null, body.alertId) });
});
