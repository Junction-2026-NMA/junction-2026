import { resetCustomers } from "@/lib/actions";
import { TOO_MANY, allowRequest } from "@/lib/agent/http";
import { DEMO_CUSTOMERS } from "@/lib/finance/data";

export const runtime = "nodejs";

// Booth reset: clears actions, remembered items and the audit log for the demo customers.
export async function POST(request: Request) {
  if (!allowRequest(request, "reset", 10)) return TOO_MANY();
  const cleared = resetCustomers(DEMO_CUSTOMERS.map((customer) => customer.customerId));
  return Response.json({ ok: true, cleared });
}
