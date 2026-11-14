import { listActions } from "@/lib/actions";
import { jsonError, parseCustomerId } from "@/lib/agent/http";
import { starterSuggestions } from "@/lib/agent/suggestions";
import { withVisitor } from "@/lib/agent/visitor";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import { listWatches } from "@/lib/watch";

export const runtime = "nodejs";

// What Sisu can do for this customer right now, as buttons for an empty Talk screen. No model call: instant.
// GET ?customerId=…&language=fi. Steps already done (a bill switched, a watch running) are swapped for what comes next.
export const GET = withVisitor(async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const customerId = parseCustomerId(params.get("customerId"));
  const customer = customerId ? findCustomer(customerId) : null;
  const overview = customerId ? buildOverview(customerId) : null;
  if (!customerId || !customer || !overview) return jsonError("Choose a customer first.", 400);
  const suggestions = starterSuggestions({ overview, cashFlow: buildCashFlow(overview), city: customer.area, language: params.get("language"), actions: listActions(customerId), watches: listWatches(customerId) });
  return Response.json({ customerId, suggestions });
});
