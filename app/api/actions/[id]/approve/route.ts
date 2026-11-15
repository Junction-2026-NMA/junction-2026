import { approveActionStored } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { isWatchKind, startWatch } from "@/lib/watch";
import { asProject } from "@/lib/watch/project";
import { watchScheduler } from "@/lib/watch/scheduler";

export const runtime = "nodejs";

// The ONLY way an action is approved: a request that names the customer and says confirm: true, sent by the
// Approve button. The agent has no tool that reaches this. Even then the action is simulated, and logged.
export const POST = withVisitor(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId) return jsonError("Choose a customer first.", 400);
  if (body.confirm !== true) return jsonError("Approval needs confirm: true. Nothing was done.", 400);
  // Answers with the decision as stored: if another tap reached another server instance first, it is checked again.
  const result = await approveActionStored(customerId, id, impactOf);
  if (!result.ok) return jsonError(result.reason, result.status);
  // A property watch is the one action that is not a simulation: the approval just stored is what starts it.
  // The watch comes back as a Project (projectStatus, lastSuccessAt, nextCheckAt...), like GET /api/watch/:id.
  const watch = isWatchKind(result.action.kind) ? await startWatch(customerId, result.action) : null;
  return Response.json({ action: result.action, ...(watch ? { watch: asProject(watch), scheduler: watchScheduler() } : {}) });
});
