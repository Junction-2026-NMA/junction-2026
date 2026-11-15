import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { messageFor } from "@/lib/push/notify";
import { pushToVisitor, vapidKeys } from "@/lib/push/send";
import { listSubscriptions } from "@/lib/push/subscriptions";
import { listWatches } from "@/lib/watch";

export const runtime = "nodejs";

// Sends one test notification to this visitor's phones, so notifications can be checked on the filming phone.
// Body: { customerId, projectId? }. A tap opens that project (or the newest running one, or the app).
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "push", 6)) return TOO_MANY();
  if (!vapidKeys()) return jsonError("Notifications aren't set up on this server.", 503);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  if (!listSubscriptions().length) return jsonError("This phone has not turned on notifications yet.", 409);
  const watches = listWatches(customerId).filter((watch) => watch.status !== "stopped").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const project = watches.find((watch) => watch.id === body.projectId) ?? watches[0] ?? null;
  const message = project ? messageFor(project, "test") : { title: "Sisu", body: "Notifications are on. This is a test from Sisu.", url: `/app?source=homescreen&customer=${encodeURIComponent(customerId)}`, tag: "sisu-test" };
  const result = await pushToVisitor(message);
  if (!result.sent) return jsonError(result.dropped ? "This phone's subscription had expired. Turn notifications on again." : "The push service did not accept the notification.", 502);
  return Response.json({ sent: result.sent });
});
