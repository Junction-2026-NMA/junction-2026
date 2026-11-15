import { approveActionsStored } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import type { AgentAction, PropertyWatch } from "@/lib/types";
import { withVisitor } from "@/lib/agent/visitor";
import { isWatchKind } from "@/lib/watch";
import { asProject } from "@/lib/watch/project";
import { schedulerInfo, watchScheduler } from "@/lib/watch/scheduler";
import { readSchedule, startApprovedWatch } from "@/lib/watch/start";

export const runtime = "nodejs";
export const maxDuration = 120; // v3: an approved watch's first check runs on the server after the answer, inside this budget
const MAX_AT_ONCE = 6;

// One tap for a whole plan. The same rule as a single approval: the request must name the customer and say
// confirm: true, and it comes from the Approve button, never from the agent. Each action is approved, simulated
// and logged on its own, so the audit trail shows every one.
// Body: { customerId, actionIds: string[], confirm: true }.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId) return jsonError("Choose a customer first.", 400);
  if (body.confirm !== true) return jsonError("Approval needs confirm: true. Nothing was done.", 400);
  // v3: a watch's notification timing (optional; only "as soon as a match is found" is offered). Checked first, so a
  // timing the server cannot keep approves nothing.
  const timing = readSchedule(body);
  if (!timing.ok) return jsonError(`${timing.reason} Nothing was done.`, 400);
  const ids = Array.isArray(body.actionIds) ? [...new Set(body.actionIds.filter((id): id is string => typeof id === "string"))] : [];
  if (!ids.length || ids.length > MAX_AT_ONCE) return jsonError(`Name between one and ${MAX_AT_ONCE} actions to approve. Nothing was done.`, 400);

  // Each is checked against the ones before it, and the answers are the decisions as stored.
  const results = await approveActionsStored(customerId, ids, impactOf);
  const approved: AgentAction[] = [];
  const failed: { actionId: string; reason: string }[] = [];
  const watches: PropertyWatch[] = [];
  for (const [index, result] of results.entries()) {
    const watch = result.ok && isWatchKind(result.action.kind) ? await startApprovedWatch(customerId, result.action, timing.schedule) : null;
    if (watch) watches.push(asProject(watch));
    if (result.ok) approved.push(result.action);
    else failed.push({ actionId: ids[index], reason: result.reason });
  }
  // Watches started by this tap come back as Projects, like GET /api/watch/:id answers them.
  return Response.json({ approved, failed, ...(watches.length ? { watches, scheduler: watchScheduler(), schedulerInfo: schedulerInfo() } : {}) }, { status: approved.length ? 200 : 409 });
});
