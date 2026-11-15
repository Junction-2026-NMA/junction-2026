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
import type { AgentAction, Listing, PropertyWatch, WatchCheck, WatchNotification, WatchPlan, WatchedPage } from "@/lib/types";
import { type FitEvent, detectFits, fits, ruleFor, toNotification } from "./detect";
import { pushFindings } from "@/lib/push/notify";
import { closeMonitors, monitorIdsOf } from "./monitoring";
import { researchListing } from "./research";
import { healthOf } from "./health";
import { finishStart } from "./start";

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
// v2 push: `background: true` (the approve routes) stores the watch at once in phase "researching" and leaves the
// slow part (creating the Context.dev monitors with their webhook, reading pages the conversation could not) to
// finishStart (lib/watch/start.ts), which the route runs with after(), so it goes on with the phone locked.
// Without it (tests, scripts) finishStart runs here and the watch comes back ready.
export type StartOptions = { background?: boolean; origin?: string | null };
export const startedLine = (watch: PropertyWatch): string => `Watching ${watch.pages.length} page${watch.pages.length === 1 ? "" : "s"} for ${watchSubject(watch)} at €${watch.budgetEur}${watch.priceUnit === "EUR/month" ? " a month" : ""} or less`;

export async function startWatch(customerId: string, action: AgentAction, now: Date = new Date(), options: StartOptions = {}): Promise<PropertyWatch | null> {
  if (!isWatchKind(action.kind) || action.status !== "executed_simulated" || action.customerId !== customerId || !action.watch) return null;
  const started = listWatches(customerId).find((watch) => watch.actionId === action.id);
  if (started) return started;

  const plan = action.watch;
  const pages: WatchedPage[] = plan.urls.map((url) => ({
    url,
    monitorId: null,
    listings: plan.seen.filter((listing) => listing.pageUrl === url),
    lastReadAt: action.createdAt,
    lastChangeAt: null,
    lastError: null,
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
    mode: "reread",
    pages,
    searchMonitorId: null,
    createdAt: now.toISOString(),
    lastCheckedAt: null,
    problems: [],
    goal: plan.goal ?? null,
    requirements: plan.requirements ?? {},
    lastSuccessAt: action.createdAt, // the pages were read when the watch was prepared
    nextCheckAt: null, // known once Context.dev reports it on the first check
    visitorSeenAt: now.toISOString(),
    pausedAt: null,
    stoppedAt: null,
    stoppedBecause: null,
    phase: "researching",
    initialReadyAt: null,
    nextReviewAt: null,
    failedChecks: 0,
    lastFailure: null,
    retryAt: null,
    webhooks: false,
  };
  // In the background the start is logged now and its outcome later (watch_checked); inline, once, when it is known.
  if (!options.background) {
    updateState((state) => ({ ...state, watches: [...(state.watches ?? []), watch] }));
    return (await finishStart(customerId, watch.id, { origin: options.origin ?? null, now, audit: "watch_started" })) ?? watch;
  }
  updateState((state) => withAudit({ ...state, watches: [...(state.watches ?? []), watch] }, { customerId, type: "watch_started", actor: "system", actionId: action.id, detail: `${startedLine(watch)}: setting up the monitors in the background.` }, now));
  return watch;
}

type PageResult = { page: WatchedPage; events: FitEvent[]; reread: boolean; changes: number; problem: string | null };

// Reads a page again, as it is right now, and compares it with the last reading.
export async function reread(watch: PropertyWatch, page: WatchedPage, now: Date): Promise<Pick<PageResult, "page" | "events" | "problem">> {
  try {
    const read = watch.topic ? await readPrices(page.url, watch.topic, { fresh: true }) : await readListings(page.url, { fresh: true, city: watch.city ?? undefined });
    if (!read.listings.length) return { page: { ...page, lastError: "The page had nothing Sisu could read." }, events: [], problem: `${hostOf(page.url)}: nothing could be read` };
    return { page: { ...page, listings: read.listings, lastReadAt: now.toISOString(), lastError: null }, events: detectFits(page.listings, read.listings, ruleFor(watch)), problem: null };
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
    // Context.dev says the page changed. What changed is read again by code, not taken from the change's own text;
    // its words are kept as `lastChange`, to show (never a number taken from them).
    const newestChange = [...fresh].sort((a, b) => a.detectedAt.localeCompare(b.detectedAt)).at(-1)!;
    const newest = newestChange.detectedAt;
    const lastChange = { title: newestChange.title.slice(0, 200) || "Change detected", summary: newestChange.summary.slice(0, 600), detectedAt: newest };
    const result = await reread(watch, { ...seen, lastChangeAt: newest, lastChange }, now);
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
// Answers the notifications really stored: one told before (by a check that ran meanwhile) is left out.
function record(watch: PropertyWatch, next: PropertyWatch, notes: WatchNotification[], detail: string | null, now: Date): WatchNotification[] {
  let kept: WatchNotification[] = [];
  updateState((state) => {
    // Re-check inside the reducer too: hosted CAS retries replay it over newer state.
    const current = (state.watches ?? []).find((item) => item.id === watch.id && item.customerId === watch.customerId);
    kept = [];
    if (!current || current.status !== "active") return state;
    const earlier = state.notifications ?? [];
    kept = notes.filter((note) => note.simulated || !alreadyTold(watch.id, earlier, { kind: note.kind, listing: note.listing, previousPriceEur: note.previousPriceEur }));
    const merged: PropertyWatch = { ...next, phase: current.phase === "researching" ? current.phase : next.phase };
    const stored = { ...replaceWatch(state, merged), notifications: [...kept, ...earlier].slice(0, MAX_NOTIFICATIONS) };
    const checked = detail ? withAudit(stored, { customerId: watch.customerId, type: "watch_checked", actor: "system", actionId: watch.actionId, detail }, now) : stored;
    return kept.reduce((current, note) => withAudit(current, { customerId: watch.customerId, type: "watch_notified", actor: "system", actionId: watch.actionId, detail: `${note.simulated ? "SIMULATED (demo button), not a real change. " : ""}${note.title}, €${Math.round(note.underBudgetByEur)} under the limit of €${Math.round(note.budgetEur)}.` }, now), checked);
  });
  return kept;
}

// What this watch has told the customer before, so a listing that drops off a page and comes back, or one the
// search monitor finds again, is not reported twice. A simulated finding never hides a real one.
function alreadyTold(watchId: string, earlier: WatchNotification[], event: FitEvent): boolean {
  const key = listingKey(event.listing);
  return earlier.some((note) => note.watchId === watchId && !note.simulated && listingKey(note.listing) === key && note.listing.priceEur <= event.listing.priceEur);
}

// trigger: "visitor" (the default: the app checked in, which also keeps the watch alive), "schedule" (the cron) or
// "webhook" (Context.dev reported a run). Only "schedule" and "webhook" push to the phone: the app is not open then.
// watchId: check only that watch (the webhook).
export type CheckOptions = { runNow?: boolean; now?: Date; trigger?: "visitor" | "schedule" | "webhook"; watchId?: string };

// A start whose background job never finished (the function was cut off) is finished by the next check.
const RESEARCH_STALE_MS = 2 * 60_000;

// Polls every active watch of this customer. `runNow` also asks Context.dev to check each page now instead of
// waiting for its schedule; that run is queued, so its result is picked up by a later check.
export async function checkWatches(customerId: string, options: CheckOptions = {}): Promise<WatchCheck> {
  const now = options.now ?? new Date();
  const overview = buildOverview(customerId);
  const stale = listWatches(customerId).filter((watch) => watch.status === "active" && watch.phase === "researching" && (!options.watchId || watch.id === options.watchId) && now.getTime() - Date.parse(watch.createdAt) > RESEARCH_STALE_MS);
  for (const watch of stale) await finishStart(customerId, watch.id, { now });
  // A watch still being set up is left to its background job (it would overwrite the monitors being made).
  const watches = listWatches(customerId).filter((watch) => watch.status === "active" && watch.phase !== "researching" && (!options.watchId || watch.id === options.watchId));
  const summary: WatchCheck = { customerId, checked: watches.length, changesSeen: 0, pagesReread: 0, notifications: [], problems: [] };
  if (!overview) return summary;
  const earlier = listNotifications(customerId);

  for (const watch of watches) {
    const retryDue = !!watch.retryAt && watch.retryAt <= now.toISOString();
    const results = await Promise.all(watch.pages.map((page) => checkPage(watch, page, options.runNow === true || retryDue, now)));
    const search = await checkSearch(watch);
    const seenKeys = new Set<string>();
    const events = [...results.flatMap((result) => result.events), ...search.events].filter((event) => !seenKeys.has(listingKey(event.listing)) && !!seenKeys.add(listingKey(event.listing)) && !alreadyTold(watch.id, earlier, event));
    const by = watch.mode === "monitor" ? "context.dev monitor" : "context.dev re-read";
    // Background reading with Exa only for the first finding that needs it, so a check never fans out.
    const research = events.length ? await researchListing(watch, events[0].listing, now) : [];
    const notes = events.map((event, index) => ({ ...toNotification(watch, overview, event, by, now), ...(index === 0 && research.length ? { research } : {}) }));
    const problems = [...results.flatMap((result) => (result.problem ? [result.problem] : [])), ...(search.problem ? [search.problem] : [])];
    const changes = results.reduce((total, result) => total + result.changes, 0) + search.changes;
    const rereadCount = results.filter((result) => result.reread).length;
    const pages = results.map((result) => result.page);
    const away = options.trigger === "schedule" || options.trigger === "webhook";
    const next: PropertyWatch = { ...watch, pages, lastCheckedAt: now.toISOString(), problems, lastSuccessAt: lastSuccessOf(pages) ?? watch.lastSuccessAt ?? null, nextCheckAt: nextCheckOf(pages), phase: "monitoring", ...healthOf(watch, problems, nextCheckOf(pages), now), ...(away ? {} : { visitorSeenAt: now.toISOString() }) };
    const who = options.trigger === "schedule" ? "Scheduled check" : options.trigger === "webhook" ? "Context.dev reported a run; checked" : "Checked";
    // A stop, pause or reset can finish while the provider requests above are in flight.
    if (ownWatch(customerId, watch.id)?.status !== "active") continue;
    const kept = record(watch, next, notes, rereadCount || changes ? `${who} the watch for ${watchSubject(watch)}: Context.dev reported ${changes} change${changes === 1 ? "" : "s"}, ${rereadCount} page${rereadCount === 1 ? "" : "s"} read again, ${notes.length} new within the limit.` : null, now);
    // One push per check for this project, whatever it found; never for a finding pushed before.
    if (away && kept.length) await pushFindings(next, now);
    summary.changesSeen += changes;
    summary.pagesReread += rereadCount;
    summary.notifications.push(...kept);
    summary.problems.push(...problems);
  }
  return summary;
}

export type SimulationResult = { ok: true; notification: WatchNotification } | { ok: false; status: 404 | 409; reason: string };

// For the demo: pretends one watched offer's price fell to just under the limit and runs it through the same
// comparison a real change goes through. The notification and the audit line are both marked as simulated, and
// the stored reading of the page is left as it really is.
// fresh (v2 push, the delayed demo button): prefer a listing not simulated yet, so a second take makes a new finding.
export function simulatePriceDrop(customerId: string, watchId: string, now: Date = new Date(), options: { fresh?: boolean } = {}): SimulationResult {
  const watch = ownWatch(customerId, watchId);
  const overview = buildOverview(customerId);
  if (!watch || !overview) return { ok: false, status: 404, reason: "We could not find that watch." };
  if (watch.status !== "active") return { ok: false, status: 409, reason: "This watch has been stopped." };
  const enoughRooms = (listing: Listing): boolean => watch.minRooms === null || (listing.rooms ?? 0) >= watch.minRooms;
  // The cheapest watched flat that is over the budget, wherever it is listed; one not simulated yet first, so a
  // second take of the demo makes a new finding (v2 push), and the first one again once all have been used.
  const simulatedKeys = new Set(listNotifications(customerId).filter((note) => note.simulated && note.watchId === watch.id).map((note) => listingKey(note.listing)));
  const over = watch.pages.flatMap((candidate) => candidate.listings).filter((listing) => listing.priceEur > watch.budgetEur && enoughRooms(listing)).sort((a, b) => a.priceEur - b.priceEur);
  const target = (options.fresh ? over.find((listing) => !simulatedKeys.has(listingKey(listing))) : undefined) ?? over[0];
  const page = target ? watch.pages.find((candidate) => candidate.listings.includes(target)) : undefined;
  if (!page || !target) return { ok: false, status: 409, reason: "Nothing being watched is over the limit, so there is no price to drop." };
  const already = listNotifications(customerId).find((note) => note.simulated && note.watchId === watch.id && listingKey(note.listing) === listingKey(target));
  if (already) return { ok: true, notification: already };

  const droppedTo = Math.floor((watch.budgetEur * 0.97) / 5) * 5;
  const pretend = page.listings.map((listing) => (listing === target ? { ...listing, priceEur: droppedTo } : listing));
  const [event] = detectFits(page.listings, pretend, ruleFor(watch));
  if (!event) return { ok: false, status: 409, reason: "The simulated price did not come in under the budget." };
  const notification = toNotification(watch, overview, event, "simulation", now);
  // The page's reading stays as it is; only its last change says, in plain words, that it was made up.
  const lastChange = { title: "Simulated update", summary: "Simulated update: the page did not really change.", detectedAt: now.toISOString(), simulated: true };
  const marked: PropertyWatch = { ...watch, pages: watch.pages.map((candidate) => (candidate === page ? { ...candidate, lastChange } : candidate)) };
  record(watch, marked, [notification], null, now);
  return { ok: true, notification };
}

// Whether simulatePriceDrop would find something to drop, without doing it (the delayed demo button checks first).
export function canSimulate(customerId: string, watchId: string): { ok: true } | { ok: false; status: 404 | 409; reason: string } {
  const watch = ownWatch(customerId, watchId);
  if (!watch || !buildOverview(customerId)) return { ok: false, status: 404, reason: "We could not find that watch." };
  if (watch.status !== "active") return { ok: false, status: 409, reason: watch.status === "paused" ? "This project is paused. Resume it first." : "This watch has been stopped." };
  const over = watch.pages.flatMap((page) => page.listings).some((listing) => listing.priceEur > watch.budgetEur && (watch.minRooms === null || (listing.rooms ?? 0) >= watch.minRooms));
  return over ? { ok: true } : { ok: false, status: 409, reason: "Nothing being watched is over the limit, so there is no price to drop." };
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
  const why = because === "inactive" ? " because the app had not checked in for 14 days" : "";
  updateState((state) => withAudit(replaceWatch(state, stopped), { customerId, type: "watch_stopped", actor: because === "user" ? "user" : "system", actionId: watch.actionId, detail: `Stopped watching ${watchSubject(watch)}${why}; ${total - failed} of ${total} Context.dev monitors removed.` }, now));
  return stopped;
}

// Before a demo reset: stop every watch of these customers so their monitors do not outlive the state that knew them.
export async function stopAllWatches(customerIds: string[]): Promise<number> {
  const live = (readState().watches ?? []).filter((watch) => customerIds.includes(watch.customerId) && watch.status !== "stopped");
  await Promise.all(live.map((watch) => stopWatch(watch.customerId, watch.id, new Date(), "demo-reset")));
  return live.length;
}
