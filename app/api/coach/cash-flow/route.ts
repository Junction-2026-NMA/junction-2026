import { coachContext } from "@/lib/agent/coach";
import { withVisitor } from "@/lib/agent/visitor";
import { parseBuffer } from "@/lib/finance/budget";
import { buildCashFlow } from "@/lib/finance/cashflow";

export const runtime = "nodejs";

// Pay cycles, bills due before the next payday, the balance expected just before it, and the estimated weekly budget.
// GET /api/coach/cash-flow?customerId=&bufferEur= (bufferEur optional: the amount the customer wants to keep untouched)
export const GET = withVisitor(async function GET(request: Request) {
  const context = coachContext(request);
  if (context instanceof Response) return context;
  const raw = context.params.get("bufferEur");
  const bufferEur = raw === null || raw.trim() === "" ? null : parseBuffer(Number(raw));
  if (raw !== null && raw.trim() !== "" && bufferEur === null) return Response.json({ error: "bufferEur must be a number of euros between 0 and 100000." }, { status: 400 });
  const cashFlow = bufferEur === null ? context.cashFlow : buildCashFlow(context.overview, { bufferEur, bufferFrom: "app" }); // the app sends the buffer set on Today or in Settings
  return Response.json({ ...cashFlow, currency: "EUR" });
});
