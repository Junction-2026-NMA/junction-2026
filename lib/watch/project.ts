// A watch seen as a Project: its status derived from what really happened, the findings with read state, the
// listings that meet the requirements right now, and the controls (pause, resume, edit requirements, mark read).
// Every control belongs to the visitor and customer that own the watch; someone else's looks like a missing one.
import { listingKey } from "@/lib/agent/research/listings";
import { housingEffect } from "@/lib/finance/housing";
import { buildOverview } from "@/lib/finance/overview";
import { RENT_BUDGET_LIMITS } from "@/lib/finance/rent";
import { withAudit } from "@/lib/store/audit";
import { readState, updateState } from "@/lib/store/state";
import type { Listing, ProjectStatus, PropertyWatch, WatchNotification, WatchProject, WatchRequirements } from "@/lib/types";
import { fits, ruleFor, withCurrentRequirements } from "./detect";
import { currentSession } from "@/lib/store/session";
import { findWatch, lastSuccessOf, listNotifications, nextCheckOf, replaceWatch, watchSubject } from "./index";
import { REVIEW_FALLBACK_MS } from "./health";
import { closeMonitors, openMonitors } from "./monitoring";
import { publicOrigin, webhookUrl } from "./webhook";
import { mergeRequirements } from "./requirements";
import { watchScheduler } from "./scheduler";

const ONE_OFF_LIMITS: [number, number] = [5, 100_000];
const MAX_MATCHES = 5;
const SEEN_EVERY_MS = 60 * 60_000; // a visitor's GET marks the watch as seen at most this often (it costs a save)

// failing: it should be running, but on the last check no page could be read or watched.
export function projectStatusOf(watch: PropertyWatch): ProjectStatus {
  if (watch.status !== "active") return watch.status;
  return watch.lastCheckedAt && watch.pages.length > 0 && watch.pages.every((page) => page.lastError) ? "failing" : "active";
}

// The watch as the API answers it: every Project field set, for watches stored before they existed too.
// v2 push: the webhook secrets never leave the server; the status fields are always set.
export const withoutSecrets = (watch: PropertyWatch): PropertyWatch => {
  const { searchWebhookSecret: _search, ...rest } = watch;
  void _search;
  return { ...rest, pages: watch.pages.map(({ webhookSecret: _secret, ...page }) => (void _secret, { ...page, lastChange: page.lastChange ?? null })) };
};

export const asProject = (watch: PropertyWatch): PropertyWatch => ({
  ...withoutSecrets(watch),
  phase: watch.phase ?? "monitoring",
  initialReadyAt: watch.initialReadyAt ?? null,
  nextReviewAt: watch.status === "active" ? (watch.nextReviewAt ?? watch.nextCheckAt ?? nextCheckOf(watch.pages)) : null,
  failedChecks: watch.failedChecks ?? 0,
  lastFailure: watch.lastFailure ?? null,
  retryAt: watch.status === "active" ? (watch.retryAt ?? null) : null,
  webhooks: watch.webhooks ?? false,
  goal: watch.goal ?? null,
  requirements: watch.requirements ?? {},
  projectStatus: projectStatusOf(watch),
  lastSuccessAt: watch.lastSuccessAt ?? lastSuccessOf(watch.pages),
  nextCheckAt: watch.status === "active" ? (watch.nextCheckAt ?? nextCheckOf(watch.pages)) : null,
  visitorSeenAt: watch.visitorSeenAt ?? null,
  pausedAt: watch.pausedAt ?? null,
  stoppedAt: watch.stoppedAt ?? null,
  stoppedBecause: watch.stoppedBecause ?? null,
});

const notesOf = (watch: PropertyWatch): WatchNotification[] => listNotifications(watch.customerId).filter((note) => note.watchId === watch.id).map((note) => ({ ...note, readAt: note.readAt ?? null }));

// The listings last read that meet the requirements now, cheapest first, each with its housing effect (flats).
export function currentMatches(watch: PropertyWatch): WatchProject["currentMatches"] {
  const overview = buildOverview(watch.customerId);
  const rule = ruleFor(watch);
  const seen = new Set<string>();
  const unique = watch.pages.flatMap((page) => page.listings).filter((listing) => !seen.has(listingKey(listing)) && !!seen.add(listingKey(listing)));
  return unique
    .filter((listing) => fits(listing, rule))
    .sort((a, b) => a.priceEur - b.priceEur)
    .slice(0, MAX_MATCHES)
    .map((listing: Listing) => ({ listing, housing: overview && watch.priceUnit === "EUR/month" ? housingEffect(overview, listing, watch.requirements ?? {}, `project:${watch.id}:${listingKey(listing)}`) : null }));
}

export function getProject(customerId: string, watchId: string): WatchProject | null {
  const watch = findWatch(customerId, watchId);
  if (!watch) return null;
  const notifications = notesOf(watch);
  return { customerId, watch: asProject(watch), notifications, unread: notifications.filter((note) => !note.readAt).length, currentMatches: currentMatches(watch), scheduler: watchScheduler() };
}

// The visitor's app looked at its watches: keeps them from stopping for inactivity. Saved at most once an hour.
export function noteVisitor(customerId: string, now: Date = new Date()): void {
  const stale = (readState().watches ?? []).filter((watch) => watch.customerId === customerId && watch.status !== "stopped" && now.getTime() - Date.parse(watch.visitorSeenAt ?? watch.createdAt) >= SEEN_EVERY_MS);
  if (!stale.length) return;
  const ids = new Set(stale.map((watch) => watch.id));
  updateState((state) => ({ ...state, watches: (state.watches ?? []).map((watch) => (ids.has(watch.id) ? { ...watch, visitorSeenAt: now.toISOString() } : watch)) }));
}

export type Controlled = { ok: true; watch: PropertyWatch } | { ok: false; status: 404 | 409; reason: string };
const missing = { ok: false, status: 404, reason: "We could not find that project." } as const;

// Pause: the Context.dev monitors are deleted (nothing runs or costs credits) and Sisu stops checking.
export async function pauseWatch(customerId: string, watchId: string, now: Date = new Date()): Promise<Controlled> {
  const watch = findWatch(customerId, watchId);
  if (!watch) return missing;
  if (watch.status === "stopped") return { ok: false, status: 409, reason: "This project has been stopped. Ask Sisu to start a new one." };
  if (watch.status === "paused") return { ok: true, watch: asProject(watch) };
  const { removed, failed } = await closeMonitors(watch);
  const paused: PropertyWatch = { ...watch, status: "paused", pausedAt: now.toISOString(), nextCheckAt: null, nextReviewAt: null, retryAt: null, webhooks: false, searchWebhookSecret: null, pages: watch.pages.map((page) => ({ ...page, monitorId: null, monitorNextRunAt: null, webhookSecret: null })), searchMonitorId: null, problems: failed ? [`${failed} Context.dev monitor${failed === 1 ? "" : "s"} could not be removed.`] : [] };
  updateState((state) => withAudit(replaceWatch(state, paused), { customerId, type: "watch_paused", actor: "user", actionId: watch.actionId, detail: `Paused watching ${watchSubject(watch)}; ${removed} Context.dev monitor${removed === 1 ? "" : "s"} removed.` }, now));
  return { ok: true, watch: asProject(paused) };
}

// Resume: new Context.dev monitors are created for the same pages; the last reading stays the baseline.
export async function resumeWatch(customerId: string, watchId: string, now: Date = new Date(), origin: string | null = null): Promise<Controlled> {
  const watch = findWatch(customerId, watchId);
  if (!watch) return missing;
  if (watch.status === "stopped") return { ok: false, status: 409, reason: "This project has been stopped. Ask Sisu to start a new one." };
  if (watch.status === "active") return { ok: true, watch: asProject(watch) };
  const hook = webhookUrl(publicOrigin(origin ?? undefined), { sessionId: currentSession(), customerId, watchId });
  const opened = await openMonitors(watch, watch.pages.map((page) => page.url), { webhookUrl: hook });
  const pages = watch.pages.map((page, index) => ({ ...page, monitorId: opened.monitorIds[index], lastChangeAt: null, lastError: opened.errors[index], monitorNextRunAt: null, webhookSecret: opened.webhookSecrets[index] }));
  // Changes are counted from now, so whatever happened while paused is not reported as a burst of old news.
  const webhooks = !!hook && [...opened.webhookSecrets, opened.searchWebhookSecret].some(Boolean);
  const resumed: PropertyWatch = { ...watch, status: "active", mode: opened.mode, pages, searchMonitorId: opened.searchMonitorId, searchWebhookSecret: opened.searchWebhookSecret, webhooks, pausedAt: null, problems: opened.problems, visitorSeenAt: now.toISOString(), lastCheckedAt: now.toISOString(), phase: watch.phase === "researching" ? "researching" : "monitoring", failedChecks: 0, lastFailure: null, retryAt: null, nextReviewAt: new Date(now.getTime() + REVIEW_FALLBACK_MS).toISOString() };
  updateState((state) => withAudit(replaceWatch(state, resumed), { customerId, type: "watch_resumed", actor: "user", actionId: watch.actionId, detail: `Resumed watching ${watchSubject(watch)}: ${opened.monitorIds.filter(Boolean).length} Context.dev monitor${opened.monitorIds.filter(Boolean).length === 1 ? "" : "s"} created.` }, now));
  return { ok: true, watch: asProject(resumed) };
}

export type Edit = { budgetEur?: number; minRooms?: number | null; goal?: string | null; requirements?: WatchRequirements };
export type Edited = { ok: true; project: WatchProject } | { ok: false; status: 400 | 404 | 409; reason: string };

// Edits the requirements and re-evaluates the listings already read against them (no new page reads).
export function updateWatch(customerId: string, watchId: string, edit: Edit, now: Date = new Date()): Edited {
  const watch = findWatch(customerId, watchId);
  if (!watch) return missing;
  if (watch.status === "stopped") return { ok: false, status: 409, reason: "This project has been stopped. Ask Sisu to start a new one." };
  const limits = watch.priceUnit === "EUR/month" ? RENT_BUDGET_LIMITS : ONE_OFF_LIMITS;
  if (edit.budgetEur !== undefined && (!Number.isFinite(edit.budgetEur) || edit.budgetEur < limits[0] || edit.budgetEur > limits[1])) return { ok: false, status: 400, reason: `The price limit must be between €${limits[0]} and €${limits[1].toLocaleString("en-US")}.` };
  if (edit.minRooms !== undefined && edit.minRooms !== null && (!Number.isInteger(edit.minRooms) || edit.minRooms < 1 || edit.minRooms > 6)) return { ok: false, status: 400, reason: "Rooms must be a whole number from 1 to 6." };
  const next: PropertyWatch = {
    ...watch,
    budgetEur: edit.budgetEur === undefined ? watch.budgetEur : Math.round(edit.budgetEur),
    minRooms: edit.minRooms === undefined ? watch.minRooms : edit.minRooms,
    goal: edit.goal === undefined ? (watch.goal ?? null) : edit.goal,
    requirements: edit.requirements ? mergeRequirements(watch.requirements, edit.requirements) : (watch.requirements ?? {}),
  };
  const changed = [edit.budgetEur !== undefined ? `limit €${next.budgetEur}` : null, edit.minRooms !== undefined ? `rooms ${next.minRooms ?? "any"}` : null, edit.goal !== undefined ? "goal" : null, ...Object.keys(edit.requirements ?? {})].filter(Boolean).join(", ");
  // The findings already made are worked out again with the new requirements, so a finding never says "moving
  // costs not given" next to the moving costs the customer just saved.
  const overview = edit.requirements ? buildOverview(customerId) : null;
  const refresh = (note: WatchNotification): WatchNotification => (overview && note.watchId === watch.id && note.customerId === customerId ? withCurrentRequirements(note, next, overview, now) : note);
  updateState((state) => withAudit({ ...replaceWatch(state, next), notifications: (state.notifications ?? []).map(refresh) }, { customerId, type: "watch_updated", actor: "user", actionId: watch.actionId, detail: `Changed the requirements for ${watchSubject(watch)}: ${changed || "nothing"}.` }, now));
  return { ok: true, project: getProject(customerId, watchId)! };
}

// Marks findings read: the ids given, or every finding of the project when none are given.
export function markRead(customerId: string, watchId: string, ids: string[] | null, now: Date = new Date()): { ok: true; unread: number; marked: number } | { ok: false; status: 404; reason: string } {
  const watch = findWatch(customerId, watchId);
  if (!watch) return { ok: false, status: 404, reason: "We could not find that project." };
  const wanted = (note: WatchNotification): boolean => note.watchId === watch.id && note.customerId === customerId && !note.readAt && (ids === null || ids.includes(note.id));
  const marked = (readState().notifications ?? []).filter(wanted).length;
  if (marked) updateState((state) => ({ ...state, notifications: (state.notifications ?? []).map((note) => (wanted(note) ? { ...note, readAt: now.toISOString() } : note)) }));
  return { ok: true, marked, unread: notesOf(watch).filter((note) => !note.readAt).length };
}
