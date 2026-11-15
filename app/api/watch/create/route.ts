import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { inBackground } from "@/lib/watch/background";
import { createProject, parseCreate, runInitialResearch } from "@/lib/watch/create";

export const runtime = "nodejs";
export const maxDuration = 60; // the first check runs after the answer, inside this budget

// "Make this a project": starts a Project from the conversation's draft home search, after the customer tapped
// Start on its confirmation card (that tap is the approval). Body (ProjectCreateRequest): { customerId,
// confirm: true, fromActionId, goal?, city?, budgetEur?, minRooms?, minAreaM2?, requirements?, schedule? }.
// Answers 201 with the Project at once (initialResearch "running"); the first check, its findings and the phone
// notification then happen on the server, so they arrive even if the app is closed straight away.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError("Send the project as JSON.", 400);
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const parsed = parseCreate(body, customerId);
  if (!parsed.ok) return jsonError(parsed.reason, 400);
  const created = await createProject(parsed.input);
  if (!created.ok) return jsonError(created.reason, created.status);
  if (created.started) inBackground(() => runInitialResearch(customerId, created.project.watch.id, { search: false }));
  return Response.json(created.project, { status: created.started ? 201 : 200 });
});
