import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { scheduleSimulatedChange } from "@/lib/watch/simulate";
import { simulatePriceDrop } from "@/lib/watch";

export const runtime = "nodejs";
export const maxDuration = 60; // a delayed simulation waits on the server (after()), within this limit

// For the demo: pretends the cheapest watched flat that is over budget dropped to just under it, and runs that
// through the same comparison a real change goes through. The notification and its audit line say "simulated".
// Real listing pages do not change on cue, so this is how the notification step is shown. Body: { customerId }.
// v2 push: { customerId, delaySeconds: 1..50 } answers 202 at once and makes the change on the server after the
// delay, then pushes "Your … has an update." to the phone, so it can be filmed with the phone locked. A project
// paused or stopped before then gets nothing.
export const POST = withVisitor(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId) return jsonError("Choose a customer first.", 400);
  if (body.delaySeconds !== undefined) {
    const delay = body.delaySeconds;
    if (typeof delay !== "number" || !Number.isFinite(delay) || delay < 1 || delay > 50) return jsonError("delaySeconds must be a number from 1 to 50.", 400);
    const scheduled = scheduleSimulatedChange(customerId, id, Math.round(delay));
    if (!scheduled.ok) return jsonError(scheduled.reason, scheduled.status);
    return Response.json({ scheduled: true, at: scheduled.at, simulated: true }, { status: 202 });
  }
  const result = simulatePriceDrop(customerId, id);
  if (!result.ok) return jsonError(result.reason, result.status);
  return Response.json({ notification: result.notification });
});
