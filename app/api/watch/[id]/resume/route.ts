import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { resumeWatch } from "@/lib/watch/project";

export const runtime = "nodejs";

// Resumes a paused Project: new Context.dev monitors are created for the same pages (the last reading stays the
// baseline, and changes are counted from now). Body: { customerId }. Answers { watch }. Safe to call twice.
export const POST = withVisitor(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const result = await resumeWatch(customerId, id);
  if (!result.ok) return jsonError(result.reason, result.status);
  return Response.json({ watch: result.watch });
});
