import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { type Edit, getProject, noteVisitor, updateWatch } from "@/lib/watch/project";
import { cleanGoal, cleanRequirements } from "@/lib/watch/requirements";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

// One watch as a Project: goal, requirements, sources, status, last successful read, next Context.dev run, its
// findings with read state, and the listings already read that meet the requirements now (with the housing effect).
// GET /api/watch/:id?customerId=. Reads only: it asks Context.dev nothing.
export const GET = withVisitor(async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const customerId = parseCustomerId(new URL(request.url).searchParams.get("customerId"));
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const project = getProject(customerId, id);
  if (!project) return jsonError("We could not find that project.", 404);
  noteVisitor(customerId);
  return Response.json(project);
});

// Edits the requirements and re-evaluates the listings already read (no new page reads).
// Body: { customerId, budgetEur?, minRooms?, minAreaM2?, goal?, requirements?: { districts?, moveBy?, maxCommuteMinutes?,
// commuteTo?, maxDepositEur?, movingCostEur?, bufferToKeepEur?, savingsGoalEur?, minAreaM2?, monthlySavingsEur? } }.
// null clears a field. The findings and `evaluated` are judged again with the new requirements, and they are kept
// in the stored watch, so they are there the next time the app opens.
// Answers the Project, like GET.
export const PATCH = withVisitor(async function PATCH(request: Request, { params }: Context) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError("Send the changes as JSON.", 400);
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const edit: Edit = {};
  if ("budgetEur" in body) {
    if (typeof body.budgetEur !== "number") return jsonError("The price limit must be a number of euros.", 400);
    edit.budgetEur = body.budgetEur;
  }
  if ("minRooms" in body) {
    if (body.minRooms !== null && typeof body.minRooms !== "number") return jsonError("Rooms must be a number, or null for any.", 400);
    edit.minRooms = body.minRooms as number | null;
  }
  if ("goal" in body) {
    const goal = body.goal === null ? null : cleanGoal(body.goal);
    if (goal === null && body.goal !== null) return jsonError("Write the goal as a short sentence (3 to 160 characters).", 400);
    edit.goal = goal;
  }
  if ("requirements" in body || "minAreaM2" in body) {
    const raw = { ...((body.requirements && typeof body.requirements === "object" ? body.requirements : {}) as Record<string, unknown>), ...("minAreaM2" in body ? { minAreaM2: body.minAreaM2 } : {}) };
    const { requirements, dropped } = cleanRequirements(raw);
    if (dropped.length) return jsonError(`Some requirements could not be used: ${dropped.join(", ")}.`, 400);
    edit.requirements = requirements;
  }
  if (!Object.keys(edit).length) return jsonError("Nothing to change: send budgetEur, minRooms, minAreaM2, goal or requirements.", 400);
  const result = updateWatch(customerId, id, edit);
  if (!result.ok) return jsonError(result.reason, result.status);
  return Response.json(result.project);
});
