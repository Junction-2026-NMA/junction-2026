// v2 push: the slow half of starting a watch, run after the approval has been answered (after(), lib/background.ts)
// so it carries on with the phone locked. It creates the Context.dev monitors (every 15 minutes, with Sisu's webhook
// when SISU_WEBHOOK_KEY and a public origin are set), reads again any page the conversation could not read, saves
// the first results (phase researching -> initial_ready) and pushes "first results are ready".
// Every write re-reads the watch inside the reducer: a pause or stop made meanwhile wins, and the monitors just
// made are removed again.
import { withAudit } from "@/lib/store/audit";
import { currentSession } from "@/lib/store/session";
import { updateState } from "@/lib/store/state";
import { pushInitial } from "@/lib/push/notify";
import type { PropertyWatch, WatchedPage } from "@/lib/types";
import { PROJECT_CHECK_EVERY_MINUTES } from "@/lib/agent/research/monitors";
import { findWatch, nextCheckOf, replaceWatch, reread, startedLine, watchSubject } from "./index";
import { REVIEW_FALLBACK_MS } from "./health";
import { closeMonitors, openMonitors } from "./monitoring";
import { publicOrigin, webhookUrl } from "./webhook";

const MAX_INITIAL_READS = 3;

// audit: "watch_started" when the start is done inline (one log line for it), else "watch_checked".
export type FinishOptions = { origin?: string | null; now?: Date; audit?: "watch_started" | "watch_checked" };

export async function finishStart(customerId: string, watchId: string, options: FinishOptions = {}): Promise<PropertyWatch | null> {
  const now = options.now ?? new Date();
  const watch = findWatch(customerId, watchId);
  if (!watch || watch.status !== "active" || watch.phase !== "researching") return watch;
  const hook = webhookUrl(publicOrigin(options.origin ?? undefined), { sessionId: currentSession(), customerId, watchId });
  const opened = await openMonitors(watch, watch.pages.map((page) => page.url), { webhookUrl: hook });

  // Pages the conversation found but could not read (or was cut off reading) are read now.
  const empty = watch.pages.filter((page) => !page.listings.length).slice(0, MAX_INITIAL_READS);
  const reads = await Promise.all(empty.map((page) => reread(watch, page, now)));
  const readOf = (page: WatchedPage): WatchedPage => reads[empty.indexOf(page)]?.page ?? page;

  const pages: WatchedPage[] = watch.pages.map((page, index) => ({ ...readOf(page), monitorId: opened.monitorIds[index], lastError: opened.errors[index] ?? readOf(page).lastError, webhookSecret: opened.webhookSecrets[index] }));
  const webhooks = !!hook && [...opened.webhookSecrets, opened.searchWebhookSecret].some(Boolean);
  const problems = [...opened.problems, ...reads.flatMap((read) => (read.problem ? [read.problem] : []))];
  const ready: PropertyWatch = {
    ...watch,
    pages,
    mode: opened.mode,
    searchMonitorId: opened.searchMonitorId,
    searchWebhookSecret: opened.searchWebhookSecret,
    problems,
    phase: "initial_ready",
    initialReadyAt: now.toISOString(),
    nextCheckAt: nextCheckOf(pages),
    nextReviewAt: nextCheckOf(pages) ?? new Date(now.getTime() + REVIEW_FALLBACK_MS).toISOString(),
    webhooks,
  };

  let applied = false;
  const ids = [...pages.flatMap((page) => (page.monitorId ? [page.monitorId] : [])), ...(ready.searchMonitorId ? [`${ready.searchMonitorId} (search)`] : [])];
  const how = ready.mode === "monitor" ? `Context.dev monitors ${ids.join(", ")}, every ${PROJECT_CHECK_EVERY_MINUTES} minutes${webhooks ? ", each run reported to Sisu" : "; Sisu polls them"}` : "no monitor, so Sisu re-reads the pages itself when it checks";
  const detail = options.audit === "watch_started" ? `${startedLine(ready)}: ${how}.` : `First results ready for ${watchSubject(watch)}: ${how}.`;
  updateState((state) => {
    const current = (state.watches ?? []).find((item) => item.id === watchId && item.customerId === customerId);
    applied = !!current && current.status === "active" && current.phase === "researching";
    if (!applied) return state;
    return withAudit(replaceWatch(state, ready), { customerId, type: options.audit ?? "watch_checked", actor: "system", actionId: watch.actionId, detail }, now);
  });
  if (!applied) {
    // Paused or stopped while the monitors were being made: they must not keep running.
    await closeMonitors(ready).catch(() => null);
    return findWatch(customerId, watchId);
  }
  await pushInitial(ready).catch((error: Error) => console.error(`[push] first results: ${error.message}`));
  return findWatch(customerId, watchId);
}
