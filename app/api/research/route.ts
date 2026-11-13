import { TOO_MANY, allowRequest, jsonError, parseBillType, parseCustomerId } from "@/lib/agent/http";
import { toResult } from "@/lib/agent/research/compare";
import { ensureResearch, peekResearch, waitForUsable } from "@/lib/agent/research";
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import type { BillType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const WAIT_LIMIT_MS = 9_000;
const GUESS_LABEL: Record<BillType, string> = { electricity: "Electricity", mobile: "Mobile plan", internet: "Home internet" };

function baselineFor(customerId: string, billType: BillType): number | null {
  const bill = buildOverview(customerId)?.recurringBills.find((b) => b.guessLabel === GUESS_LABEL[billType]);
  return bill?.monthlyAvg ?? null;
}

// Starts (or joins) offer research. The frontend calls this with wait:false the moment a user confirms
// a bill, so the offers are usually ready before they ask. See context/orchestration.md, rule 2.
export async function POST(request: Request) {
  if (!allowRequest(request, "research", 20)) return TOO_MANY();
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const customerId = parseCustomerId(body.customerId);
  const billType = parseBillType(body.billType);
  const customer = customerId ? findCustomer(customerId) : null;
  if (!customerId || !customer) return jsonError("Choose a customer first.", 400);
  if (!billType) return jsonError("billType must be electricity, mobile or internet.", 400);

  const { key } = ensureResearch(billType, customer.area);
  const raw = body.wait === false ? peekResearch(key) : await waitForUsable(key, WAIT_LIMIT_MS, request.signal);
  if (!raw) return jsonError("Research could not start.", 500);
  return Response.json(toResult(raw, baselineFor(customerId, billType)));
}

// The current snapshot, for polling while pages are still arriving.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const customerId = parseCustomerId(params.get("customerId"));
  const billType = parseBillType(params.get("billType"));
  const customer = customerId ? findCustomer(customerId) : null;
  if (!customerId || !customer || !billType) return jsonError("Send a customerId and a billType.", 400);
  const raw = peekResearch(`${billType}:${customer.area.toLowerCase()}`);
  if (!raw) return jsonError("No research has been started for this bill yet.", 404);
  return Response.json(toResult(raw, baselineFor(customerId, billType)));
}
