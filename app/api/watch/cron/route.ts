import { timingSafeEqual } from "node:crypto";
import { jsonError } from "@/lib/agent/http";
import { runScheduledChecks } from "@/lib/watch/cron";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// The daily scheduled review of every visitor's active watches (vercel.json "crons"; daily is the Hobby plan's
// limit). Vercel sends "Authorization: Bearer <CRON_SECRET>" with each cron call; anything else is refused.
// Without CRON_SECRET the route is off, and /api/health says watchScheduler "on-open".
// Needs the Supabase function sisu_sessions_with_watches (deploy/supabase/sisu_sessions.sql) on a hosted store.
const matches = (given: string, secret: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return jsonError("The scheduled watch check is not switched on here (no CRON_SECRET).", 503);
  if (!matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return jsonError("Not allowed.", 401);
  try {
    return Response.json(await runScheduledChecks(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[watch-cron] the run failed: ${(error as Error).message}`);
    return jsonError("The scheduled watch check could not list the sessions. Has deploy/supabase/sisu_sessions.sql been run?", 503);
  }
}
