import { TOO_MANY, allowRequest, jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import { parseSearch, runHousingSearch } from "@/lib/housing/search";

export const runtime = "nodejs";
export const maxDuration = 60;

// The housing intake card's Search button. Body: { customerId, city, budgetEur, budgetFrom: "customer" |
// "sisu-suggested", minRooms?, requirements?: { minAreaM2?, commuteTo?, maxCommuteMinutes?, moveBy?,
// savingsGoalEurPerMonth?, movingCostEur?, ... }, question?, conversationId? }.
// Exa gets only the city; everything else is applied here in code. Answers a HousingSearchResult (lib/types.ts),
// with a Project proposal (`action`, awaiting approval) when there is something to monitor.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "housing", 10)) return TOO_MANY();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError("Send the requirements as JSON.", 400);
  const customerId = parseCustomerId(body.customerId);
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  const parsed = parseSearch(body, customerId);
  if (!parsed.ok) return jsonError(parsed.reason, 400);
  const outcome = await runHousingSearch(parsed.input, request.signal);
  if (!outcome.ok) return jsonError(outcome.reason, outcome.status);
  return Response.json(outcome.result);
});
