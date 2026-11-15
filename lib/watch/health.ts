// v2 push: how a check went, for the status shown on a project. A check that had a problem is retried after 1, 5,
// then every 15 minutes (the next webhook, cron or app check after that time asks Context.dev to run the monitors
// now); a clean check resets the count. The next review is the earliest monitor run, else the last check + 15 min.
import type { PropertyWatch } from "@/lib/types";

export const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];
export const REVIEW_FALLBACK_MS = 15 * 60_000;
export const retryDelay = (failedChecks: number): number => RETRY_BACKOFF_MS[Math.min(Math.max(failedChecks, 1), RETRY_BACKOFF_MS.length) - 1];

export function healthOf(watch: PropertyWatch, problems: string[], nextMonitorRun: string | null, now: Date): Pick<PropertyWatch, "failedChecks" | "lastFailure" | "retryAt" | "nextReviewAt"> {
  const next = nextMonitorRun ?? new Date(now.getTime() + REVIEW_FALLBACK_MS).toISOString();
  if (!problems.length) return { failedChecks: 0, lastFailure: null, retryAt: null, nextReviewAt: next };
  const failedChecks = (watch.failedChecks ?? 0) + 1;
  const retryAt = new Date(now.getTime() + retryDelay(failedChecks)).toISOString();
  return { failedChecks, lastFailure: { at: now.toISOString(), message: problems[0] }, retryAt, nextReviewAt: retryAt < next ? retryAt : next };
}
