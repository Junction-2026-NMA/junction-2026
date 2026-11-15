// The rules of Projects that need no store: which routes a backend has, which watches are active, whether a
// scheduler runs, and the finding ids seen on this device (kept per customer in the app's defaults).
import { SisuError } from "@/web/core/API";
import { type PropertyWatch, type WatchList, WatchStatus, projectStatusOf } from "@/web/core/WatchModels";
import { Keys } from "./AppState";
import type { SisuDefaults } from "./Defaults";

/** Controls whose routes the hosted backend may not have yet. */
export type ProjectFeature = "pause" | "resume" | "update" | "read" | "project";
export type ProjectBusy = "stop" | "pause" | "resume" | "update" | "check";

export const NO_SUPPORT: Readonly<Record<ProjectFeature, boolean>> = { pause: false, resume: false, update: false, read: false, project: false };
export const ALL_SUPPORT: Readonly<Record<ProjectFeature, boolean>> = { pause: true, resume: true, update: true, read: true, project: true };

export const ProjectFeatureText: Record<ProjectFeature, string> = { pause: "Pausing is not available on this server yet.",
  resume: "Resuming is not available on this server yet.", update: "Editing requirements is not available on this server yet.", read: "", project: "" };

/** The backend with project routes (pause, resume, PATCH, read, GET /api/watch/:id) marks its list: `scheduler` on
 *  the list and `projectStatus` on each watch. Today's hosted backend sends neither. */
export const hasProjectRoutes = (list: Pick<WatchList, "scheduler" | "watches">): boolean =>
  typeof list.scheduler === "string" || list.watches.some((w) => typeof w.projectStatus === "string");

/** A route the server does not have: a 404 without the server's own sentence (an HTML page). */
export const missingRoute = (error: unknown): boolean =>
  error instanceof SisuError && error.info.kind === "server" && error.info.status === 404 && error.info.message === "";

export const isActiveWatch = (watch: PropertyWatch): boolean => {
  const status = projectStatusOf(watch);
  return status === WatchStatus.active || status === WatchStatus.failing;
};

/** `watchScheduler: "cron"` (rework/api-projects) or the first draft's `services.watchScheduler: true`. */
export function schedulerRuns(report: unknown): boolean {
  if (!report || typeof report !== "object") return false;
  const r = report as { watchScheduler?: unknown; services?: { watchScheduler?: unknown } | null };
  return r.watchScheduler === "cron" || r.services?.watchScheduler === true;
}

// MARK: Seen ids (per customer, in the app's defaults)

export const MAX_SEEN = 300;

export function readSeen(defaults: SisuDefaults | null, customerId: string): string[] {
  const all = defaults?.json(Keys.projectsSeen);
  const mine = all && typeof all === "object" && !Array.isArray(all) ? (all as Record<string, unknown>)[customerId] : null;
  return Array.isArray(mine) ? mine.filter((id): id is string => typeof id === "string").slice(-MAX_SEEN) : [];
}

export function writeSeen(defaults: SisuDefaults | null, customerId: string, seen: readonly string[]): void {
  if (!defaults) return;
  const all = defaults.json(Keys.projectsSeen);
  const rest = all && typeof all === "object" && !Array.isArray(all) ? (all as Record<string, unknown>) : {};
  defaults.setJSON(Keys.projectsSeen, { ...rest, [customerId]: seen });
}
