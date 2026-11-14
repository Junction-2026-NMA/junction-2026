import { jsonError, parseCustomerId } from "@/lib/agent/http";
import { findCustomer } from "@/lib/finance/data";
import { auditFor } from "@/lib/store/audit";

export const runtime = "nodejs";

// The audit trail for one customer. chainValid is false if any entry in the log has been altered or removed.
export async function GET(request: Request) {
  const customerId = parseCustomerId(new URL(request.url).searchParams.get("customerId"));
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const { events, chainValid } = auditFor(customerId);
  return Response.json({ customerId, events, chainValid });
}
