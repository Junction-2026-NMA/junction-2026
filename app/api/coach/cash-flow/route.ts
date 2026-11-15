import { coachContext } from "@/lib/agent/coach";
import { withVisitor } from "@/lib/agent/visitor";
import { parseBuffer } from "@/lib/finance/budget";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { parsePaydayOverrides } from "@/lib/finance/payday";

export const runtime = "nodejs";

type Inputs = { bufferEur?: unknown; paydayDate?: unknown; extraBills?: unknown };

// The same answer for GET (query) and POST (JSON body): a friendly 400 for anything that is not a valid input.
function answer(context: Exclude<ReturnType<typeof coachContext>, Response>, inputs: Inputs): Response {
  const raw = inputs.bufferEur;
  const blank = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  const bufferEur = blank ? null : parseBuffer(Number(raw));
  if (!blank && bufferEur === null) return Response.json({ error: "bufferEur must be a number of euros between 0 and 100000." }, { status: 400 });
  const overrides = parsePaydayOverrides(inputs);
  if (typeof overrides === "string") return Response.json({ error: overrides }, { status: 400 });
  const plain = bufferEur === null && !overrides.paydayDate && !overrides.extraBills;
  // The app sends the buffer set on Today or in Settings, and the payday and bills the customer confirmed there.
  const cashFlow = plain ? context.cashFlow : buildCashFlow(context.overview, { bufferEur, bufferFrom: "app", paydayDate: overrides.paydayDate ?? null, extraBills: overrides.extraBills ?? [] });
  return Response.json({ ...cashFlow, currency: "EUR" });
}

// Pay cycles, bills due before the next payday, the balance expected just before it, and the estimated budget.
// GET /api/coach/cash-flow?customerId=&bufferEur=&paydayDate=YYYY-MM-DD&extraBills=[{"label","amountEur","dueDate"}]
// (all optional but customerId: the amount to keep untouched, the confirmed payday, bills the history does not show)
export const GET = withVisitor(async function GET(request: Request) {
  const context = coachContext(request);
  if (context instanceof Response) return context;
  const { params } = context;
  return answer(context, { bufferEur: params.get("bufferEur") ?? undefined, paydayDate: params.get("paydayDate") ?? undefined, extraBills: params.get("extraBills") ?? undefined });
});

// POST /api/coach/cash-flow?customerId= with a JSON body { bufferEur?, paydayDate?, extraBills? }.
export const POST = withVisitor(async function POST(request: Request) {
  const context = coachContext(request);
  if (context instanceof Response) return context;
  const body = (await request.json().catch(() => null)) as Inputs | null;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Send a JSON object with bufferEur, paydayDate or extraBills." }, { status: 400 });
  return answer(context, body);
});
