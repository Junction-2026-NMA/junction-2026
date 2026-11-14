import { resetCustomers } from "@/lib/actions";
import { TOO_MANY, allowRequest, jsonError } from "@/lib/agent/http";
import { DEMO_CUSTOMERS } from "@/lib/finance/data";

export const runtime = "nodejs";

// Booth reset: clears actions, remembered items and the audit log for the demo customers.
// On a laptop (development) it is open, so the booth's reset button just works. On a deployed site it wipes
// everyone's state, so it needs the token in SISU_RESET_TOKEN, sent as the x-sisu-reset-token header.
export async function POST(request: Request) {
  if (!allowRequest(request, "reset", 10)) return TOO_MANY();
  const token = process.env.SISU_RESET_TOKEN?.trim();
  const deployed = process.env.NODE_ENV === "production";
  if (deployed && (!token || request.headers.get("x-sisu-reset-token") !== token)) return jsonError("Resetting the demo is switched off on this site.", 403);
  const cleared = resetCustomers(DEMO_CUSTOMERS.map((customer) => customer.customerId));
  return Response.json({ ok: true, cleared });
}
