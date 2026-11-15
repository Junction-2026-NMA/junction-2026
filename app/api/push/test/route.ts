import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { sendToSession } from "@/lib/push/send";

export const runtime = "nodejs";

// Sends "Sisu notifications are on." to this visitor's devices, to check delivery (lock the phone first).
// Body: { customerId }. Answers { status, sent, failed }.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "push-test", 6)) return TOO_MANY();
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!parseCustomerId(body.customerId)) return jsonError("Choose a customer first.", 400);
  const delivery = await sendToSession({ title: "Sisu", body: "Sisu notifications are on.", url: "/app?source=homescreen", tag: "sisu-test" });
  return Response.json(delivery);
});
