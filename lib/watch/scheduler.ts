// What the server can really run for a Project, so every sentence about a watch and every notification timing the
// app offers says exactly what happens. Checks run periodically, never continuously:
// - Context.dev re-checks watched pages about every 6 hours on its own servers.
// - Sisu's own scheduled check (GET /api/watch/cron) turns those changes into findings and notifications. It runs
//   when CRON_SECRET is set: once a day from Vercel Cron (vercel.json "0 6 * * *", 08:00 in Helsinki in winter),
//   or every WATCH_CHECK_EVERY_MINUTES when an outside pinger calls the route that often.
// - Without CRON_SECRET there is no scheduled check: Sisu reviews changes only when the app checks in, plus the
//   first check that runs on the server right after a Project is approved.
import type { ProjectSchedule, SchedulerInfo, WatchScheduler } from "@/lib/types";

export const SCHEDULE_TEXT = "once a day"; // kept for older callers; scheduleText() follows the real cadence
const CRON_HOUR_UTC = 6; // vercel.json "0 6 * * *"
const DAY_MINUTES = 1440;
const DEFAULT_PROJECT_DAYS = 14;

const env = (name: string): string => process.env[name]?.trim() ?? "";

export const watchScheduler = (): WatchScheduler => (env("CRON_SECRET") ? "cron" : "on-open");

function everyMinutes(): number | null {
  if (watchScheduler() !== "cron") return null;
  const raw = Number(env("WATCH_CHECK_EVERY_MINUTES"));
  return Number.isInteger(raw) && raw >= 5 && raw <= DAY_MINUTES ? raw : DAY_MINUTES;
}

export const pushConfigured = (): boolean => !!env("VAPID_PUBLIC_KEY") && !!env("VAPID_PRIVATE_KEY");

export function schedulerInfo(): SchedulerInfo {
  const kind = watchScheduler();
  const every = everyMinutes();
  // Daily summaries and deadlines are not offered (scope cut, 15 Nov): only "as soon as a match is found".
  return { kind, checkEveryMinutes: every, dailyTimes: [], deadline: false, push: pushConfigured(), timeZone: "Europe/Helsinki" };
}

// "once a day", "every hour", "every 15 minutes", "every 3 hours".
export function scheduleText(minutes: number | null = everyMinutes()): string {
  if (minutes === null) return "only when the app is open";
  if (minutes >= DAY_MINUTES) return "once a day";
  if (minutes === 60) return "every hour";
  if (minutes % 60 === 0) return `every ${minutes / 60} hours`;
  return `every ${minutes} minutes`;
}

// The next time Sisu's own scheduled check is expected to run, or null when there is none.
export function nextScheduledCheck(now: Date = new Date()): string | null {
  const every = everyMinutes();
  if (every === null) return null;
  if (every >= DAY_MINUTES) {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CRON_HOUR_UTC);
    return new Date(today > now.getTime() ? today : today + 86_400_000).toISOString();
  }
  const step = every * 60_000;
  return new Date(Math.floor(now.getTime() / step) * step + step).toISOString();
}

export const defaultSchedule = (now: Date = new Date()): ProjectSchedule => ({ notify: "on_match", dailyAt: null, deadlineAt: null, monitorUntil: new Date(now.getTime() + DEFAULT_PROJECT_DAYS * 86_400_000).toISOString() });

export type ScheduleCheck = { ok: true; schedule: ProjectSchedule } | { ok: false; reason: string };

// Only "As soon as a match is found" is offered (15 Nov): it is the one timing every server here can keep, because
// a check runs on the server right after approval and then on Sisu's schedule (or when the app checks in).
// Missing input means that default. Daily summaries and deadlines are refused with a reason, never half-run.
export function validateSchedule(input: unknown, _info: SchedulerInfo = schedulerInfo(), now: Date = new Date()): ScheduleCheck {
  if (input === undefined || input === null) return { ok: true, schedule: defaultSchedule(now) };
  if (typeof input !== "object") return { ok: false, reason: "Choose when Sisu should notify you." };
  const notify = (input as Record<string, unknown>).notify;
  if (notify !== undefined && notify !== "on_match") return { ok: false, reason: "Sisu can notify you as soon as a check finds a match. Daily summaries and deadlines are not available yet." };
  return { ok: true, schedule: defaultSchedule(now) };
}

// One sentence for a card or a tool result: what checks the pages and how often. Never "continuously".
export function monitoringSentence(pages: number, monitored: boolean): string {
  const where = monitored ? `Context.dev re-checks ${pages === 1 ? "the page" : `these ${pages} pages`} about every 6 hours on its own servers` : `Sisu re-reads ${pages === 1 ? "the page" : `these ${pages} pages`} itself when it checks`;
  return watchScheduler() === "cron"
    ? `${where}. Sisu's own check runs ${scheduleText()} on a schedule, and whenever you open the app; checks are periodic, not continuous.`
    : `${where}. Sisu reviews what changed when you open the app (and once right after you approve); it does not check on its own while the app is closed.`;
}
