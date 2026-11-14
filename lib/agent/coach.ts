// Shared by the /api/coach routes: turns a request into a customer and their overview, or an error response.
import { buildCashFlow } from "@/lib/finance/cashflow";
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import type { CashFlow, DemoCustomer, Overview } from "@/lib/types";
import { jsonError, parseCustomerId } from "./http";

export type CoachContext = { customer: DemoCustomer; overview: Overview; cashFlow: CashFlow; params: URLSearchParams };

export function coachContext(request: Request): CoachContext | Response {
  const params = new URL(request.url).searchParams;
  const customerId = parseCustomerId(params.get("customerId"));
  const customer = customerId ? findCustomer(customerId) : null;
  const overview = customerId ? buildOverview(customerId) : null;
  if (!customer || !overview) return jsonError("Choose a customer first.", 400);
  return { customer, overview, cashFlow: buildCashFlow(overview), params };
}

export const stamp = (overview: Overview) => ({ customerId: overview.customerId, dataTimestamp: overview.dataTimestamp, currency: "EUR" as const });
