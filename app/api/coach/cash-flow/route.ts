import { coachContext } from "@/lib/agent/coach";

export const runtime = "nodejs";

// Pay cycles, bills due before the next payday and the balance expected just before it.
// GET /api/coach/cash-flow?customerId=
export async function GET(request: Request) {
  const context = coachContext(request);
  if (context instanceof Response) return context;
  return Response.json({ ...context.cashFlow, currency: "EUR" });
}
