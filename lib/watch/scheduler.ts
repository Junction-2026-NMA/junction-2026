// Whether Sisu reviews watched pages on its own, so every sentence about a watch can say exactly what runs.
// Context.dev always re-checks the pages every 6 hours on its own servers. Turning those changes into findings
// needs Sisu: either the visitor's app checking in (POST /api/watch/check), or the daily scheduled run
// (GET /api/watch/cron, vercel.json "crons"). The scheduled run needs CRON_SECRET on the server, which Vercel sends
// with each cron call, and the Supabase function sisu_sessions_with_watches (deploy/supabase/sisu_sessions.sql).
// Set CRON_SECRET only once both are deployed: until then this answers "on-open" and the copy says so.
import type { WatchScheduler } from "@/lib/types";

export const SCHEDULE_TEXT = "once a day";

export const watchScheduler = (): WatchScheduler => (process.env.CRON_SECRET?.trim() ? "cron" : "on-open");

// One sentence for a card or a tool result: what checks the pages and when Sisu looks at what changed.
export function monitoringSentence(pages: number, monitored: boolean): string {
  const where = monitored ? `Context.dev re-checks ${pages === 1 ? "the page" : `these ${pages} pages`} every 6 hours on its own servers` : `Sisu re-reads ${pages === 1 ? "the page" : `these ${pages} pages`} itself`;
  return watchScheduler() === "cron"
    ? `${where}. Sisu reviews what changed ${SCHEDULE_TEXT} on its own schedule and whenever you open the app.`
    : `${where}. Sisu reviews what changed when you open the app; it does not check on its own while the app is closed.`;
}
