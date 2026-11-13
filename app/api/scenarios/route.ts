import { buildOverview } from "@/lib/finance/overview";
import { cleanInput, runScenario } from "@/lib/finance/scenario";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.customerId !== "string") return Response.json({ error: "Send a customerId and scenario values." }, { status: 400 });
  const overview = buildOverview(body.customerId);
  if (!overview) return Response.json({ error: "We could not find that customer." }, { status: 404 });
  const input = cleanInput(body);
  if (typeof input === "string") return Response.json({ error: input }, { status: 400 });
  return Response.json({ customerId: overview.customerId, dataTimestamp: overview.dataTimestamp, currency: "EUR", input, ...runScenario(overview, input) });
}
