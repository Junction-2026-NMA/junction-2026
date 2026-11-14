import { jsonError } from "@/lib/agent/http";
import { OFFER_QUESTION, OFFER_SCHEMA } from "@/lib/agent/research/contextdev";
import { exaReadPage, exaResearch } from "@/lib/agent/research/exa";

export const runtime = "nodejs";
export const maxDuration = 60;

// Development only: try Exa's page reading and deeper research on their own and see the raw result and timing.
// GET ?read=<url>  or  ?research=<question>. Refuses in production unless SISU_BENCH=1.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.SISU_BENCH !== "1") return jsonError("Not available here.", 404);
  const params = new URL(request.url).searchParams;
  const read = params.get("read");
  const research = params.get("research");
  try {
    if (read) return Response.json(await exaReadPage(read, OFFER_QUESTION.electricity, OFFER_SCHEMA));
    if (research) return Response.json(await exaResearch(research.slice(0, 200)));
    return jsonError("Pass ?read=<url> or ?research=<question>.", 400);
  } catch (error) {
    return jsonError((error as Error).message, 502);
  }
}
