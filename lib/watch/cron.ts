// The scheduled review of watches (GET /api/watch/cron, run once a day by Vercel Cron). For each visitor session
// with an active watch it does what the visitor's own app does when it checks in: loads the session, runs
// checkWatches for each customer in it and saves the result, so a finding can be waiting when they come back.
// A watch whose app has not checked in for 14 days is stopped and its monitors removed, so nothing runs (or costs
// credits) for a visitor who left. Session ids are capabilities: they are never logged or returned.
import { SHARED, inSession } from "@/lib/store/session";
import { fileSessions, openSession, readState, settleSession, storeConfig } from "@/lib/store/state";
import { watchSessionsRemote } from "@/lib/store/supabase";
import type { PropertyWatch } from "@/lib/types";
import { checkWatches, stopWatch } from "./index";

export const MAX_SESSIONS_PER_RUN = 20;
export const INACTIVE_DAYS = 14;
const TIME_BUDGET_MS = 45_000; // stop starting new sessions after this; the route has 60 s

export type CronRun = { sessions: number; watchesChecked: number; findings: number; stoppedInactive: number; problems: number; capped: boolean; tookMs: number };

const isActive = (watch: PropertyWatch): boolean => watch.status === "active";

// Sessions with at least one active watch, at most `limit`.
export async function watchSessions(limit: number): Promise<string[]> {
  const { remote } = storeConfig();
  if (remote) return watchSessionsRemote(remote, limit);
  return fileSessions()
    .filter(({ state }) => (state.watches ?? []).some(isActive))
    .map(({ sessionId }) => sessionId)
    .slice(0, limit);
}

export const isInactive = (watch: PropertyWatch, now: Date): boolean => now.getTime() - Date.parse(watch.visitorSeenAt ?? watch.createdAt) > INACTIVE_DAYS * 86_400_000;

async function reviewSession(now: Date): Promise<Omit<CronRun, "sessions" | "capped" | "tookMs">> {
  const active = (readState().watches ?? []).filter(isActive);
  const stale = active.filter((watch) => isInactive(watch, now));
  for (const watch of stale) await stopWatch(watch.customerId, watch.id, now, "inactive");
  const customers = [...new Set(active.filter((watch) => !stale.includes(watch)).map((watch) => watch.customerId))];
  const totals = { watchesChecked: 0, findings: 0, stoppedInactive: stale.length, problems: 0 };
  for (const customerId of customers) {
    const check = await checkWatches(customerId, { now, trigger: "schedule" });
    totals.watchesChecked += check.checked;
    totals.findings += check.notifications.length;
    totals.problems += check.problems.length;
  }
  return totals;
}

export async function runScheduledChecks(now: Date = new Date()): Promise<CronRun> {
  const started = Date.now();
  const ids = await watchSessions(MAX_SESSIONS_PER_RUN + 1);
  const run: CronRun = { sessions: 0, watchesChecked: 0, findings: 0, stoppedInactive: 0, problems: 0, capped: ids.length > MAX_SESSIONS_PER_RUN, tookMs: 0 };
  for (const sessionId of ids.slice(0, MAX_SESSIONS_PER_RUN)) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      run.capped = true;
      break;
    }
    try {
      await openSession(sessionId);
      const totals = await inSession(sessionId, () => reviewSession(now));
      await settleSession(sessionId);
      run.sessions += 1;
      run.watchesChecked += totals.watchesChecked;
      run.findings += totals.findings;
      run.stoppedInactive += totals.stoppedInactive;
      run.problems += totals.problems;
    } catch (error) {
      run.problems += 1;
      console.error(`[watch-cron] a session could not be reviewed${sessionId === SHARED ? " (shared)" : ""}: ${(error as Error).message}`);
    }
  }
  return { ...run, tookMs: Date.now() - started };
}
