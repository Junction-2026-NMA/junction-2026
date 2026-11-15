// Phone notifications about a Project's findings (v3). Only "as soon as a match is found" is offered: after a
// completed check, a NEW finding whose verdict is "match" gets one alert. A finding that needs verification is
// saved and shown in the app, but never pushed on its own. The finding is stored before any push is sent, each
// finding carries alertedAt so it is never alerted twice, and the alert is stored even when push is off or the
// device has no subscription, so the app can show it in place of the phone notification.
// This file reads the state directly (not lib/watch/index.ts), so index.ts can call it without an import cycle.
import { sendToSession } from "@/lib/push/send";
import { alertBody, alertPayload } from "@/lib/push/payload";
import { withAudit } from "@/lib/store/audit";
import { readState, updateState } from "@/lib/store/state";
import type { ProjectAlert, PropertyWatch, WatchNotification } from "@/lib/types";

const MAX_ALERTS = 60;

const activeWatchOf = (customerId: string, watchId: string): PropertyWatch | null => (readState().watches ?? []).find((watch) => watch.id === watchId && watch.customerId === customerId && watch.status === "active") ?? null;

export const listAlerts = (customerId: string): ProjectAlert[] => (readState().alerts ?? []).filter((alert) => alert.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// One alert for these findings of one watch. Null when the watch is not running (stopped or paused, checked again
// right before sending) or when every finding has already been alerted.
export async function alertForFindings(customerId: string, watchId: string, findingIds: string[], reason: ProjectAlert["reason"], now: Date, simulated = false): Promise<ProjectAlert | null> {
  const watch = activeWatchOf(customerId, watchId);
  if (!watch) return null;
  const wanted = new Set(findingIds);
  const fresh = (readState().notifications ?? []).filter((note) => wanted.has(note.id) && note.watchId === watchId && note.customerId === customerId && !note.alertedAt);
  if (!fresh.length) return null;
  const alert: ProjectAlert = {
    id: crypto.randomUUID(),
    watchId,
    customerId,
    findingIds: fresh.map((note) => note.id),
    title: "Sisu",
    body: alertBody(watch, reason),
    reason,
    createdAt: now.toISOString(),
    pushed: "push-off",
    simulated: simulated || fresh.some((note) => note.simulated),
    readAt: null,
  };
  const ids = new Set(alert.findingIds);
  updateState((state) => {
    // Inside the reducer too: a replay over newer state must not alert a finding twice.
    const already = (state.notifications ?? []).some((note) => ids.has(note.id) && note.alertedAt);
    if (already) return state;
    const notifications = (state.notifications ?? []).map((note) => (ids.has(note.id) ? { ...note, alertedAt: alert.createdAt } : note));
    const stored = { ...state, notifications, alerts: [alert, ...(state.alerts ?? [])].slice(0, MAX_ALERTS) };
    return withAudit(stored, { customerId, type: "watch_notified", actor: "system", actionId: watch.actionId, detail: `${alert.simulated ? "SIMULATED for demo. " : ""}Phone notification for ${alert.findingIds.length} finding${alert.findingIds.length === 1 ? "" : "s"}: "${alert.body}"` }, now);
  });
  // Still running? A stop can land while the state was being written.
  if (!activeWatchOf(customerId, watchId)) return { ...alert, pushed: "push-off" };
  const delivery = await sendToSession(alertPayload(alert));
  updateState((state) => ({ ...state, alerts: (state.alerts ?? []).map((item) => (item.id === alert.id ? { ...item, pushed: delivery.status } : item)) }));
  return { ...alert, pushed: delivery.status };
}

// The Project's notification rule, applied to the findings one completed check just saved.
// on_match (the only timing offered): an alert for the new findings that fully match; nothing for the rest.
export async function applyNotifyPolicy(customerId: string, watch: PropertyWatch, newFindings: WatchNotification[], now: Date, reason: "match" | "initial_findings" = "match"): Promise<ProjectAlert | null> {
  const mode = watch.schedule?.notify ?? "on_match";
  if (mode !== "on_match") return null;
  const matches = newFindings.filter((note) => (note.verdict ?? "match") === "match" && !note.alertedAt);
  if (!matches.length) return null;
  return alertForFindings(customerId, watch.id, matches.map((note) => note.id), reason, now, matches.some((note) => note.simulated));
}

// The app opened the Project (or tapped the notification): its alerts count as read.
export function markAlertsRead(customerId: string, watchId: string | null, alertId: string | null, now: Date = new Date()): number {
  const hit = (alert: ProjectAlert): boolean => alert.customerId === customerId && !alert.readAt && (alertId ? alert.id === alertId : alert.watchId === watchId);
  const count = (readState().alerts ?? []).filter(hit).length;
  if (count) updateState((state) => ({ ...state, alerts: (state.alerts ?? []).map((alert) => (hit(alert) ? { ...alert, readAt: now.toISOString() } : alert)) }));
  return count;
}
