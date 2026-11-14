import { jsonError, parseCustomerId } from "@/lib/agent/http";
import { CHART_KINDS, chartFor, futuresVisual } from "@/lib/agent/visuals";
import { buildOverview } from "@/lib/finance/overview";
import { cleanInput, runScenario } from "@/lib/finance/scenario";
import type { Visual } from "@/lib/types";

export const runtime = "nodejs";

// Every chart Sisu can draw from a customer's account, at once and with no model call. For a screen that wants
// a chart without asking the agent, and for the gallery at /visuals. GET ?customerId=…
export async function GET(request: Request) {
  const customerId = parseCustomerId(new URL(request.url).searchParams.get("customerId"));
  const overview = customerId ? buildOverview(customerId) : null;
  if (!overview) return jsonError("We could not find that customer.", 404);
  const input = cleanInput({ billSavingPerMonth: 100, everydayCutPct: 0, years: 5 });
  const visuals: Visual[] = [...CHART_KINDS.map((kind) => chartFor(kind, overview)).filter((visual): visual is Visual => visual !== null), ...(typeof input === "string" ? [] : [futuresVisual(runScenario(overview, input), input.years)])];
  return Response.json({ customerId: overview.customerId, visuals });
}
