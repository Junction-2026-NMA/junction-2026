import { jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import { suggestedBudget } from "@/lib/housing/budget";

export const runtime = "nodejs";

// The rent Sisu suggests for a monthly savings goal, worked out from the customer's own figures (the intake card
// asks again when the goal changes). Body: { customerId, savingsGoalEurPerMonth }. Answers a HousingBudget.
export const POST = withVisitor(async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const customerId = parseCustomerId(body?.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const savings = body?.savingsGoalEurPerMonth;
  if (typeof savings !== "number" || !Number.isFinite(savings) || savings < 0 || savings > 10_000) return jsonError("The savings goal must be between €0 and €10,000 a month.", 400);
  const overview = buildOverview(customerId);
  if (!overview) return jsonError("We could not find that customer.", 404);
  return Response.json(suggestedBudget(overview, savings));
});
