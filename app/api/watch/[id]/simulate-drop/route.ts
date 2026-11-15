import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { MAX_DELAY_SECONDS, simulateAndAlert, simulateLater } from "@/lib/watch/simulate";

export const runtime = "nodejs";
export const maxDuration = 90; // a delayed simulation runs after the answer, inside this budget

// For the demo: pretends a watched offer's price dropped to just under the limit, choosing one that would then meet
// every requirement of the Project, and runs that through the same path a real change takes: the page change, the
// requirement verdict, the finding and the phone notification. All of it is labelled "Simulated for demo".
// Body: { customerId, delaySeconds? (0 to 60) }. With a delay it answers 202 { scheduledFor } at once and the change
// happens on the server afterwards, so the phone can be locked before the notification arrives.
export const POST = withVisitor(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId) return jsonError("Choose a customer first.", 400);
  const delay = body.delaySeconds ?? 0;
  if (typeof delay !== "number" || !Number.isInteger(delay) || delay < 0 || delay > MAX_DELAY_SECONDS) return jsonError(`delaySeconds must be a whole number from 0 to ${MAX_DELAY_SECONDS}.`, 400);
  if (delay > 0) {
    const scheduled = simulateLater(customerId, id, delay);
    if (!scheduled.ok) return jsonError(scheduled.reason, scheduled.status);
    return Response.json({ scheduledFor: scheduled.scheduledFor, simulated: true }, { status: 202 });
  }
  const result = await simulateAndAlert(customerId, id);
  if (!result.ok) return jsonError(result.reason, result.status);
  return Response.json({ notification: result.notification, alert: result.alert ?? null, simulated: true });
});
