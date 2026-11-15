// Watches: started only by an approved action, kept in the visitor's own state, and every change written to the
// audit log. A watch is for flats to rent in a city (topic null) or for anything else with a price (topic = what the
// customer asked for); everything below is the same for both. Context.dev does the watching (one monitor per page,
// plus a search monitor for flats); Sisu polls the monitors' changes, re-reads a page that changed, and code decides
// whether anything now fits the price the customer said.
// If monitors cannot be created, the same pages are re-read on a timer instead, and the watch says so (mode).
// A watch is also shown as a Project (goal, requirements, status, findings): lib/watch/project.ts.
import { LISTING_SITES, listingKey, readListings } from "@/lib/agent/research/listings";
import { getMonitor, listChanges, runMonitorNow } from "@/lib/agent/research/monitors";
import { readPrices } from "@/lib/agent/research/prices";
import { buildOverview } from "@/lib/finance/overview";
import { withAudit } from "@/lib/store/audit";
import { type SisuState, readState, updateState } from "@/lib/store/state";
import type { AgentAction, Listing, MonitorChange, ProjectAlert, PropertyWatch, WatchCheck, WatchNotification, WatchPlan, WatchedPage } from "@/lib/types";
import { applyNotifyPolicy } from "./alerts";
import { judge, linkFindings, pageChanges, withChanges } from "./changes";
import { type FitEvent, detectFits, fits, ruleFor, toNotification } from "./detect";
import { defaultSchedule, nextScheduledCheck } from "./scheduler";
import { closeMonitors, monitorIdsOf, openMonitors } from "./monitoring";
import { researchListing } from "./research";

const MAX_NOTIFICATIONS = 60;
const REREAD_EVERY_MS = 30 * 60_000; // pages without a monitor are read again at most this often
const MAX_NEW_PAGES_PER_CHECK = 2; // pages a search monitor found that Sisu will read in one check

export const listWatches = (customerId: string): PropertyWatch[] => (readState().watches ?? []).filter((watch) => watch.customerId === customerId);
export const listNotifications = (customerId: string): WatchNotification[] => (readState().notifications ?? []).filter((note) => note.customerId === customerId).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
// Finds a watch only if it belongs to this customer. Someone else's watch looks exactly like a missing one.
const ownWatch = (customerId: string, watchId: string): PropertyWatch | null => listWatches(customerId).find((watch) => watch.id === watchId) ?? null;
const same = (a: string | null, b: string | null): boolean => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
// A watch that is running or paused (a paused one can be resumed, so it is not offered again).
export const activeWatch = (customerId: string, plan: Pick<WatchPlan, "city" | "topic" | "budgetEur">): PropertyWatch | null => listWatches(customerId).find((watch) => watch.status !== "stopped" && same(watch.city, plan.city) && same(watch.topic, plan.topic) && watch.budgetEur === plan.budgetEur) ?? null;

export const isWatchKind = (kind: AgentAction["kind"]): boolean => kind === "property_watch" || kind === "price_watch";
// What a watch is for, in a few words: "flats in Helsinki" or the topic the customer named.
export const watchSubject = (watch: Pick<PropertyWatch, "city" | "topic">): string => watch.topic ?? `flats in ${watch.city ?? "your city"}`;

export const replaceWatch = (state: SisuState, watch: PropertyWatch): SisuState => ({ ...state, watches: (state.watches ?? []).map((old) => (old.id === watch.id ? watch : old)) });
export const findWatch = ownWatch;
const latest = (times: (string | null | undefined)[]): string | null => times.filter((time): time is string => !!time).sort().at(-1) ?? null;
const earliest = (times: (string | null | undefined)[]): string | null => times.filter((time): time is string => !!time).sort()[0] ?? null;
// The last time at least one page was read: by Sisu itself, or by a Context.dev monitor that ran without an error.
export const lastSuccessOf = (pages: WatchedPage[]): string | null => latest(pages.flatMap((page) => [page.lastReadAt, page.monitorId && !page.lastError ? page.monitorLastRunAt : null]));
export const nextCheckOf = (pages: WatchedPage[]): string | null => earliest(pages.map((page) => (page.monitorId ? page.monitorNextRunAt : null)));
const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

// Starts the watch an approved action describes. Called by the approve routes, straight after the user's approval;
// nothing else calls it, so there is no watch without an approval. Safe to call twice: the second call returns the first watch.
// options (v3): the Project's schedule (default: notify as soon as a match is found, for 14 days) and whether its
// first check is about to run in the background (the approve routes set "running").
export type StartOptions = { schedule?: PropertyWatch["schedule"]; initialResearch?: PropertyWatch["initialResearch"] };

export async function startWatch(customerId: string, action: AgentAction, now: Date = new Date(), options: StartOptions = {}): Promise<PropertyWatch | null> {
  if (!isWatchKind(action.kind) || action.status !== "executed_simulated" || action.customerId !== customerId || !action.watch) return null;
  const started = listWatches(customerId).find((watch) => watch.actionId === action.id);
  if (started) return started;

  const plan = action.watch;
  const opened = await openMonitors(plan, plan.urls);
  const pages: WatchedPage[] = plan.urls.map((url, index) => ({
    url,
    monitorId: opened.monitorIds[index],
    listings: plan.seen.filter((listing) => listing.pageUrl === url),
    lastReadAt: action.createdAt,
    lastChangeAt: null,
    lastError: opened.errors[index],
    title: plan.titles?.[url] ?? action.sources.find((source) => source.url === url)?.title ?? null,
  }));
  const watch: PropertyWatch = {
    id: crypto.randomUUID(),
    actionId: action.id,
    customerId,
    city: plan.city,
    topic: plan.topic,
    priceUnit: plan.priceUnit,
    budgetEur: plan.budgetEur,
    minRooms: plan.minRooms,
    status: "active",
    mode: opened.mode,
    pages,
    searchMonitorId: opened.searchMonitorId,
    createdAt: now.toISOString(),
    lastCheckedAt: null,
    problems: opened.problems,
    goal: plan.goal ?? null,
    requirements: plan.requirements ?? {},
    lastSuccessAt: action.createdAt, // the pages were read when the watch was prepared
    nextCheckAt: null, // known once Context.dev reports it on the first check
    visitorSeenAt: now.toISOString(),
    pausedAt: null,
    stoppedAt: null,
    stoppedBecause: null,
    schedule: options.schedule ?? defaultSchedule(now),
    nextScheduledCheckAt: nextScheduledCheck(now),
    ...(options.initialResearch ? { initialResearch: options.initialResearch } : {}),
    changes: [],
  };
  const how = watch.mode === "monitor" ? `Context.dev monitors ${[...pages.flatMap((page) => (page.monitorId ? [page.monitorId] : [])), ...(watch.searchMonitorId ? [`${watch.searchMonitorId} (search)`] : [])].join(", ")}` : "no monitor, so Sisu re-reads the pages itself when it checks";
  updateState((state) => withAudit({ ...state, watches: [...(state.watches ?? []), watch] }, { customerId, type: "watch_started", actor: "system", actionId: action.id, detail: `Watching ${pages.length} page${pages.length === 1 ? "" : "s"} for ${watchSubject(plan)} at €${plan.budgetEur}${plan.priceUnit === "EUR/month" ? " a month" : ""} or less: ${how}.` }, now));
  return watch;
}

type PageResult = { page: WatchedPage; events: FitEvent[]; reread: boolean; changes: number; problem: string | null; previous?: Listing[] };

// Reads a page again, as it is right now, and compares it with the last reading.
async function reread(watch: PropertyWatch, page: WatchedPage, now: Date): Promise<Pick<PageResult, "page" | "events" | "problem" | "previous">> {
  try {
    const read = watch.topic ? await readPrices(page.url, watch.topic, { fresh: true }) : await readListings(page.url, { fresh: true, city: watch.city ?? undefined });
    if (!read.listings.length) return { page: { ...page, lastError: "The page had nothing Sisu could read." }, events: [], problem: `${hostOf(page.url)}: nothing could be read` };
    return { page: { ...page, listings: read.listings, lastReadAt: now.toISOString(), lastError: null }, events: detectFits(page.listings, read.listings, ruleFor(watch)), problem: null, previous: page.listings };
  } catch (error) {
    return { page: { ...page, lastError: (error as Error).message }, events: [], problem: `${hostOf(page.url)}: ${(error as Error).message}` };
  }
}

async function checkPage(watch: PropertyWatch, page: WatchedPage, runNow: boolean, now: Date): Promise<PageResult> {
  if (!page.monitorId) {
    const due = runNow || now.getTime() - Date.parse(page.lastReadAt) >= REREAD_EVERY_MS;
    return due ? { ...(await reread(watch, page, now)), reread: true, changes: 0 } : { page, events: [], reread: false, changes: 0, problem: null };
  }
  try {
    if (runNow) await runMonitorNow(page.monitorId).catch(() => null); // a run already in progress is fine
    const [monitor, changes] = await Promise.all([getMonitor(page.monitorId), listChanges(page.monitorId, page.lastChangeAt ?? watch.createdAt)]);
    const fresh = changes.filter((change) => change.detectedAt > (page.lastChangeAt ?? ""));
    const seen = { ...page, lastError: monitor.lastError, monitorLastRunAt: monitor.lastRunAt, monitorNextRunAt: monitor.nextRunAt };
    if (!fresh.length) return { page: seen, events: [], reread: false, changes: 0, problem: monitor.lastError ? `${hostOf(page.url)}: ${monitor.lastError}` : null };
    // Context.dev says the page changed. What changed is read again by code, not taken from the change's own text.
    const newest = fresh.map((change) => change.detectedAt).sort().at(-1) ?? null;
    const result = await reread(watch, { ...seen, lastChangeAt: newest }, now);
    return { ...result, reread: true, changes: fresh.length };
  } catch (error) {
    return { page, events: [], reread: false, changes: 0, problem: `${hostOf(page.url)}: ${(error as Error).message}` };
  }
}

// New pages a search monitor found. Only pages on the known listing sites are read, so a search result cannot
// steer Sisu to a page of someone's choosing. Flats on them that fit are new listings.
async function checkSearch(watch: PropertyWatch): Promise<{ events: FitEvent[]; changes: number; problem: string | null }> {
  if (!watch.searchMonitorId) return { events: [], changes: 0, problem: null };
  try {
    const since = watch.lastCheckedAt ?? watch.createdAt;
    const changes = (await listChanges(watch.searchMonitorId, since)).filter((change) => change.detectedAt > since);
    const watched = new Set(watch.pages.map((page) => page.url));
    const urls = [...new Set(changes.flatMap((change) => change.matchedUrls))].filter((url) => !watched.has(url) && LISTING_SITES.some((site) => URL.canParse(url) && (hostOf(url) === site || hostOf(url).endsWith(`.${site}`))));
    const known = new Set(watch.pages.flatMap((page) => page.listings.map(listingKey)));
    const reads = await Promise.allSettled(urls.slice(0, MAX_NEW_PAGES_PER_CHECK).map((url) => readListings(url, { fresh: true, city: watch.city ?? undefined })));
    const found = reads.flatMap((read) => (read.status === "fulfilled" ? read.value.listings : []));
    const events = found.filter((listing) => fits(listing, ruleFor(watch)) && !known.has(listingKey(listing))).map((listing): FitEvent => ({ kind: "new_listing", listing, previousPriceEur: null }));
    return { events, changes: changes.length, problem: null };
  } catch (error) {
    return { events: [], changes: 0, problem: `search monitor: ${(error as Error).message}` };
  }
}

// Stores what a check found: the pages as they are now, a notification for each flat that fits, and the audit lines.
// v3: also the page changes (previous versus current), on the watch, newest first. The findings are stored here,
// before any phone notification about them is sent.
function record(watch: PropertyWatch, next: PropertyWatch, notes: WatchNotification[], detail: string | null, now: Date, changes: MonitorChange[] = []): void {
  updateState((state) => {
    // Re-check inside the reducer too: hosted CAS retries replay it over newer state.
    const current = (state.watches ?? []).find((item) => item.id === watch.id && item.customerId === watch.customerId);
    if (!current || current.status !== "active") return state;
    const stored = { ...replaceWatch(state, withChanges({ ...next, changes: current.changes ?? [] }, changes)), notifications: [...notes, ...(state.notifications ?? [])].slice(0, MAX_NOTIFICATIONS) };
    const checked = detail ? withAudit(stored, { customerId: watch.customerId, type: "watch_checked", actor: "system", actionId: watch.actionId, detail }, now) : stored;
    return notes.reduce((current, note) => withAudit(current, { customerId: watch.customerId, type: "watch_notified", actor: "system", actionId: watch.actionId, detail: `${note.simulated ? "SIMULATED for demo, not a real change. " : ""}${note.verdict === "needs_verification" ? "Needs verification: " : ""}${note.title}, €${Math.round(note.underBudgetByEur)} under the limit of €${Math.round(note.budgetEur)}.` }, now), checked);
  });
}

// What this watch has told the customer before, so a listing that drops off a page and comes back, or one the
// search monitor finds again, is not reported twice. A simulated finding never hides a real one.
function alreadyTold(watchId: string, earlier: WatchNotification[], event: FitEvent): boolean {
  const key = listingKey(event.listing);
  return earlier.some((note) => note.watchId === watchId && !note.simulated && listingKey(note.listing) === key && note.listing.priceEur <= event.listing.priceEur);
}

export type CheckOptions = { runNow?: boolean; now?: Date; trigger?: "visitor" | "schedule" };

// Polls every active watch of this customer. `runNow` also asks Context.dev to check each page now instead of
// waiting for its schedule; that run is queued, so its result is picked up by a later check.
// trigger: "visitor" (the default: the app checked in, which also keeps the watch alive) or "schedule" (the cron).
export async function checkWatches(customerId: string, options: CheckOptions = {}): Promise<WatchCheck & { alerts?: ProjectAlert[] }> {
  const now = options.now ?? new Date();
  const overview = buildOverview(customerId);
  const watches = listWatches(customerId).filter((watch) => watch.status === "active");
  const summary: WatchCheck & { alerts?: ProjectAlert[] } = { customerId, checked: watches.length, changesSeen: 0, pagesReread: 0, notifications: [], problems: [] };
  if (!overview) return summary;
  const earlier = listNotifications(customerId);

  for (const watch of watches) {
    const results = await Promise.all(watch.pages.map((page) => checkPage(watch, page, options.runNow === true, now)));
    const search = await checkSearch(watch);
    const seenKeys = new Set<string>();
    const events = [...results.flatMap((result) => result.events), ...search.events].filter((event) => !seenKeys.has(listingKey(event.listing)) && !!seenKeys.add(listingKey(event.listing)) && !alreadyTold(watch.id, earlier, event));
    const by = watch.mode === "monitor" ? "context.dev monitor" : "context.dev re-read";
    // Background reading with Exa only for the first finding that needs it, so a check never fans out.
    // v3: a listing that fails a requirement is never a finding; one with a missing detail is saved as "needs verification".
    const judged = events.map((event) => ({ event, ...judge(watch, event.listing, now) })).filter((item) => item.verdict !== "fails");
    const research = judged.length ? await researchListing(watch, judged[0].event.listing, now) : [];
    const notes: WatchNotification[] = judged.map((item, index) => ({ ...toNotification(watch, overview, item.event, by, now), verdict: item.verdict, checks: item.checks, ...(index === 0 && research.length ? { research } : {}) }));
    const pageChangesSeen = linkFindings(results.flatMap((result, index) => (result.reread && result.previous ? pageChanges(result.page, result.previous, result.page.listings, now.toISOString(), by) : []).map((change) => ({ ...change, pageTitle: change.pageTitle ?? watch.pages[index]?.title ?? null }))), notes);
    const changeIds = new Map(pageChangesSeen.flatMap((change) => (change.findingId ? [[change.findingId, change.id] as const] : [])));
    const linkedNotes = notes.map((note) => ({ ...note, changeId: changeIds.get(note.id) ?? null }));
    const problems = [...results.flatMap((result) => (result.problem ? [result.problem] : [])), ...(search.problem ? [search.problem] : [])];
    const changes = results.reduce((total, result) => total + result.changes, 0) + search.changes;
    const rereadCount = results.filter((result) => result.reread).length;
    const pages = results.map((result) => result.page);
    const next: PropertyWatch = { ...watch, pages, lastCheckedAt: now.toISOString(), problems, lastSuccessAt: lastSuccessOf(pages) ?? watch.lastSuccessAt ?? null, nextCheckAt: nextCheckOf(pages), nextScheduledCheckAt: nextScheduledCheck(now), ...(options.trigger === "schedule" ? {} : { visitorSeenAt: now.toISOString() }) };
    const who = options.trigger === "schedule" ? "Scheduled check" : "Checked";
    // A stop, pause or reset can finish while the provider requests above are in flight.
    if (ownWatch(customerId, watch.id)?.status !== "active") continue;
    record(watch, next, linkedNotes, rereadCount || changes ? `${who} the watch for ${watchSubject(watch)}: Context.dev reported ${changes} change${changes === 1 ? "" : "s"}, ${rereadCount} page${rereadCount === 1 ? "" : "s"} read again, ${linkedNotes.length} new that meet the requirements (or need verification).` : null, now, pageChangesSeen);
    // The findings are stored; now the Project's notification rule (it re-checks that the watch is still running).
    const alert = await applyNotifyPolicy(customerId, watch, linkedNotes, now);
    if (alert) summary.alerts = [...(summary.alerts ?? []), alert];
    summary.changesSeen += changes;
    summary.pagesReread += rereadCount;
    summary.notifications.push(...linkedNotes);
    summary.problems.push(...problems);
  }
  return summary;
}

export type SimulationResult = { ok: true; notification: WatchNotification } | { ok: false; status: 404 | 409; reason: string };
export type SimulationTarget = { page: WatchedPage; listing: Listing; droppedTo: number };

// For the demo: the cheapest watched offer that is over the limit now and would meet EVERY requirement of the Project
// (by the same rule as its results) once its price came down to just under the limit. Nothing here is hardcoded: the listing and
// the price both come from the watch. The choice is the same every time, so pressing again never stacks findings.
export function simulationTarget(watch: PropertyWatch, now: Date = new Date()): SimulationTarget | null {
  const droppedTo = Math.floor((watch.budgetEur * 0.97) / 5) * 5;
  const candidates = watch.pages
    .flatMap((page) => page.listings.map((listing) => ({ page, listing })))
    .filter(({ listing }) => listing.priceEur > watch.budgetEur && judge(watch, { ...listing, priceEur: droppedTo }, now).verdict === "match")
    .sort((a, b) => a.listing.priceEur - b.listing.priceEur);
  return candidates[0] ? { ...candidates[0], droppedTo } : null;
}

// Pretends that offer's price fell and runs it through the same comparison a real change goes through: a page
// change (previous versus current), the requirement verdict, a stored finding. The finding, the change and the audit
// line are all marked as simulated, and the stored reading of the page is left as it really is. The phone
// notification is applied by the caller (simulateAndAlert in lib/watch/simulate.ts).
export function simulatePriceDrop(customerId: string, watchId: string, now: Date = new Date()): SimulationResult {
  const watch = ownWatch(customerId, watchId);
  const overview = buildOverview(customerId);
  if (!watch || !overview) return { ok: false, status: 404, reason: "We could not find that watch." };
  if (watch.status !== "active") return { ok: false, status: 409, reason: "This watch is not running." };
  const target = simulationTarget(watch, now);
  if (!target) return { ok: false, status: 409, reason: "No watched listing would meet every requirement of this project after a price drop, so there is nothing to simulate." };
  const key = listingKey(target.listing);
  const already = listNotifications(customerId).find((note) => note.simulated && note.watchId === watch.id && listingKey(note.listing) === key);
  if (already) return { ok: true, notification: already };
  const pretend = target.page.listings.map((listing) => (listing === target.listing ? { ...listing, priceEur: target.droppedTo } : listing));
  const event = detectFits(target.page.listings, pretend, ruleFor(watch, now)).find((item) => listingKey(item.listing) === key);
  if (!event) return { ok: false, status: 409, reason: "The simulated price did not come in under the budget." };
  const change = pageChanges(target.page, target.page.listings, pretend, now.toISOString(), "simulation").find((item) => item.listingTitle === target.listing.title && item.after.priceEur === target.droppedTo);
  const notification: WatchNotification = { ...toNotification(watch, overview, event, "simulation", now), ...judge(watch, event.listing, now), changeId: change?.id ?? null };
  record(watch, watch, [notification], null, now, change ? [{ ...change, findingId: notification.id }] : []);
  return { ok: true, notification };
}

// Stops a watch and removes its Context.dev monitors, so nothing keeps running (or costing credits) after it.
// because: "user" (the stop button), "inactive" (14 days without the visitor), "demo-reset".
export async function stopWatch(customerId: string, watchId: string, now: Date = new Date(), because: NonNullable<PropertyWatch["stoppedBecause"]> = "user"): Promise<PropertyWatch | null> {
  const watch = ownWatch(customerId, watchId);
  if (!watch) return null;
  if (watch.status === "stopped") return watch;
  const total = monitorIdsOf(watch).length;
  const { failed } = await closeMonitors(watch);
  const stopped: PropertyWatch = { ...watch, status: "stopped", stoppedAt: now.toISOString(), stoppedBecause: because, nextCheckAt: null, problems: failed ? [`${failed} Context.dev monitor${failed === 1 ? "" : "s"} could not be removed.`] : [] };
  const why = because === "inactive" ? " because the app had not checked in for 14 days" : because === "ended" ? " because its monitoring period ended" : "";
  updateState((state) => withAudit(replaceWatch(state, stopped), { customerId, type: "watch_stopped", actor: because === "user" ? "user" : "system", actionId: watch.actionId, detail: `Stopped watching ${watchSubject(watch)}${why}; ${total - failed} of ${total} Context.dev monitors removed.` }, now));
  return stopped;
}

// Before a demo reset: stop every watch of these customers so their monitors do not outlive the state that knew them.
export async function stopAllWatches(customerIds: string[]): Promise<number> {
  const live = (readState().watches ?? []).filter((watch) => customerIds.includes(watch.customerId) && watch.status !== "stopped");
  await Promise.all(live.map((watch) => stopWatch(watch.customerId, watch.id, new Date(), "demo-reset")));
  return live.length;
}
