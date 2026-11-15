import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { markRead } from "@/lib/watch/project";

export const runtime = "nodejs";

const MAX_IDS = 60;

// Marks a Project's findings as read. Body: { customerId, notificationIds? }: the ids given, or every finding of
// the project when none are given. Answers { marked, unread }.
export const POST = withVisitor(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const raw = body.notificationIds;
  if (raw !== undefined && (!Array.isArray(raw) || raw.length > MAX_IDS || !raw.every((value) => typeof value === "string"))) return jsonError(`notificationIds must be a list of at most ${MAX_IDS} ids.`, 400);
  const result = markRead(customerId, id, (raw as string[] | undefined) ?? null);
  if (!result.ok) return jsonError(result.reason, result.status);
  return Response.json({ marked: result.marked, unread: result.unread });
});
