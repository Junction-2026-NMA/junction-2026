// "Make this a project": the conversation's draft home search becomes a running Project once the customer taps
// Start on its confirmation card (that tap is the approval). The draft's requirements are kept exactly (city, the
// maximum rent, the minimum floor area, the monthly savings and any savings goal); edits made on the card are
// validated and applied on top. The answer goes back at once, and the first check runs on the server afterwards
// (runInitialResearch), so it finishes and can notify the phone even when the app is closed straight away.
import { approveActionStored } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { getConfig } from "@/lib/agent/config";
import { FLAT_PAGE_INSTRUCTIONS, createPageMonitor } from "@/lib/agent/research/monitors";
import { cleanCity, hostName, listingKey, readListings, searchListings } from "@/lib/agent/research/listings";
import { buildOverview } from "@/lib/finance/overview";
import { RENT_BUDGET_LIMITS } from "@/lib/finance/rent";
import { withAudit } from "@/lib/store/audit";
import { readState, updateState } from "@/lib/store/state";
import type { Listing, Overview, ProjectSchedule, PropertyWatch, WatchNotification, WatchProject, WatchRequirements, WatchedPage } from "@/lib/types";
import { applyNotifyPolicy } from "./alerts";
import { toNotification } from "./detect";
import { evaluateListings } from "./evaluate";
import { findWatch, lastSuccessOf, listNotifications, listWatches, startWatch, watchSubject } from "./index";
import { getProject } from "./project";
import { cleanGoal, cleanRequirements, mergeRequirements } from "./requirements";
import { watchEvaluationRule } from "./rule";
import { nextScheduledCheck, schedulerInfo, validateSchedule } from "./scheduler";

const MAX_NOTIFICATIONS = 60;
const MAX_INITIAL_FINDINGS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateInput = { customerId: string; actionId: string; city: string | null; goal?: string | null; budgetEur?: number; minRooms?: number | null; requirements: WatchRequirements; schedule: ProjectSchedule };
export type Parsed = { ok: true; input: CreateInput } | { ok: false; reason: string };

// Checks the body of POST /api/watch/create. Every figure here was typed or confirmed by the customer on the card.
export function parseCreate(body: Record<string, unknown>, customerId: string, now: Date = new Date()): Parsed {
  if (body.confirm !== true) return { ok: false, reason: "Starting a project needs confirm: true. Nothing was done." };
  if (typeof body.fromActionId !== "string" || !UUID.test(body.fromActionId)) return { ok: false, reason: "Start the project from Sisu's suggestion in the conversation (fromActionId)." };
  const input: CreateInput = { customerId, actionId: body.fromActionId, city: null, requirements: {}, schedule: { notify: "on_match", monitorUntil: now.toISOString() } };
  if ("city" in body && body.city !== null && body.city !== undefined) {
    const city = cleanCity(body.city);
    if (!city) return { ok: false, reason: "Write the city as a place name." };
    input.city = city;
  }
  if ("goal" in body && body.goal !== undefined) {
    const goal = body.goal === null ? null : cleanGoal(body.goal);
    if (goal === null && body.goal !== null) return { ok: false, reason: "Write the goal as a short sentence (3 to 160 characters)." };
    input.goal = goal;
  }
  if ("budgetEur" in body && body.budgetEur !== undefined) {
    if (typeof body.budgetEur !== "number" || body.budgetEur < RENT_BUDGET_LIMITS[0] || body.budgetEur > RENT_BUDGET_LIMITS[1]) return { ok: false, reason: `The maximum rent must be between €${RENT_BUDGET_LIMITS[0]} and €${RENT_BUDGET_LIMITS[1].toLocaleString("en-US")} a month.` };
    input.budgetEur = Math.round(body.budgetEur);
  }
  if ("minRooms" in body && body.minRooms !== undefined) {
    if (body.minRooms !== null && (typeof body.minRooms !== "number" || !Number.isInteger(body.minRooms) || body.minRooms < 1 || body.minRooms > 6)) return { ok: false, reason: "Rooms must be a whole number from 1 to 6, or null for any." };
    input.minRooms = body.minRooms as number | null;
  }
  const raw = { ...((body.requirements && typeof body.requirements === "object" ? body.requirements : {}) as Record<string, unknown>), ...("minAreaM2" in body && body.minAreaM2 !== undefined ? { minAreaM2: body.minAreaM2 } : {}) };
  const { requirements, dropped } = cleanRequirements(raw);
  if (dropped.length) return { ok: false, reason: `Some requirements could not be used: ${dropped.join(", ")}.` };
  const schedule = validateSchedule(body.schedule, schedulerInfo(), now);
  if (!schedule.ok) return { ok: false, reason: schedule.reason };
  return { ok: true, input: { ...input, requirements, schedule: schedule.schedule } };
}

export type Created = { ok: true; project: WatchProject; started: boolean } | { ok: false; status: 400 | 404 | 409 | 410; reason: string };

// Approves the conversation's draft (with the card's edits) and starts the watch. Calling it again for the same
// draft answers the Project already running (started: false), so a double tap never starts two.
export async function createProject(input: CreateInput, now: Date = new Date()): Promise<Created> {
  const { customerId } = input;
  const action = readState().actions.find((candidate) => candidate.id === input.actionId && candidate.customerId === customerId);
  if (!action?.watch) return { ok: false, status: 404, reason: "We could not find that suggestion. Ask Sisu to search again." };
  if (action.kind !== "property_watch") return { ok: false, status: 400, reason: "Only a home search can become a project here." };
  if (input.city && action.watch.city && input.city.toLowerCase() !== action.watch.city.toLowerCase()) return { ok: false, status: 400, reason: `This search was for ${action.watch.city}. Ask Sisu to search in ${input.city} first.` };
  const running = listWatches(customerId).find((watch) => watch.actionId === action.id);
  if (action.status === "executed_simulated" && running) return { ok: true, project: getProject(customerId, running.id)!, started: false };
  if (action.status === "expired") return { ok: false, status: 410, reason: "This suggestion has expired because listings change. Ask Sisu to search again." };
  if (action.status !== "awaiting_approval") return { ok: false, status: 409, reason: "This suggestion was already answered." };

  const plan = { ...action.watch, budgetEur: input.budgetEur ?? action.watch.budgetEur, minRooms: input.minRooms === undefined ? action.watch.minRooms : input.minRooms, goal: input.goal === undefined ? (action.watch.goal ?? null) : input.goal, requirements: mergeRequirements(action.watch.requirements ?? {}, input.requirements) };
  updateState((state) => ({ ...state, actions: state.actions.map((candidate) => (candidate.id === action.id && candidate.status === "awaiting_approval" ? { ...candidate, watch: plan } : candidate)) }));
  const approved = await approveActionStored(customerId, action.id, impactOf, now);
  if (!approved.ok) return approved;
  const watch = await startWatch(customerId, approved.action, now);
  if (!watch) return { ok: false, status: 409, reason: "The project could not be started. Ask Sisu to search again." };
  const extra: Partial<PropertyWatch> = { schedule: input.schedule, initialResearch: "running", nextScheduledCheckAt: nextScheduledCheck(now), discovery: plan.discovery ?? null };
  updateState((state) => ({ ...state, watches: (state.watches ?? []).map((candidate) => (candidate.id === watch.id ? { ...candidate, ...extra } : candidate)) }));
  return { ok: true, project: getProject(customerId, watch.id)!, started: true };
}

type Reading = { pages: WatchedPage[]; problems: string[]; discovery?: PropertyWatch["discovery"]; mode?: PropertyWatch["mode"] };
const problemsOf = (pages: WatchedPage[]): string[] => pages.flatMap((page) => (page.lastError ? [`${hostName(page.url)}: ${page.lastError}`] : []));

// The pages the conversation read, read again as they are now. A page that cannot be read keeps its last reading
// (minutes old) and says why, so the first check still has something true to judge.
async function rereadPages(watch: PropertyWatch, now: Date): Promise<Reading> {
  const pages = await Promise.all(
    watch.pages.map(async (page): Promise<WatchedPage> => {
      try {
        const read = await readListings(page.url, { fresh: true, city: watch.city ?? undefined });
        return read.listings.length ? { ...page, listings: read.listings, lastReadAt: now.toISOString(), lastError: null } : { ...page, lastError: "The page had nothing Sisu could read." };
      } catch (error) {
        return { ...page, lastError: (error as Error).message };
      }
    }),
  );
  return { pages, problems: problemsOf(pages) };
}

// A fresh search (a Project with no pages yet): Exa finds the pages, Context.dev reads them, and a monitor is
// opened on each page that was read.
async function searchAgain(watch: PropertyWatch, now: Date): Promise<Reading> {
  const search = await searchListings(watch.city ?? "");
  const mock = getConfig().isMock;
  const monitors = mock ? [] : await Promise.allSettled(search.pages.map((page) => createPageMonitor(page.url, `Sisu flat watch: ${watch.city}`, FLAT_PAGE_INSTRUCTIONS)));
  const pages = search.pages.map((page, index): WatchedPage => {
    const monitor = monitors[index];
    return { url: page.url, monitorId: monitor?.status === "fulfilled" ? monitor.value.id : null, listings: page.listings, lastReadAt: now.toISOString(), lastChangeAt: null, lastError: monitor?.status === "rejected" ? (monitor.reason as Error).message : null, title: page.title };
  });
  const discovery = { query: search.query, searchedAt: search.retrievedAt, sources: search.found.map((page) => ({ title: page.title, url: page.url, retrievedAt: search.retrievedAt, cacheAgeMs: null, readBy: "exa" as const })), mock: search.mock };
  return { pages, problems: search.errors, discovery, mode: pages.some((page) => page.monitorId) ? "monitor" : "reread" };
}

const unique = (pages: WatchedPage[]): Listing[] => {
  const seen = new Set<string>();
  return pages.flatMap((page) => page.listings).filter((listing) => !seen.has(listingKey(listing)) && !!seen.add(listingKey(listing)));
};
const euros = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;

// A finding for every listing that matches or needs verification, never for one that fails; each listing once.
export function initialFindings(watch: PropertyWatch, overview: Overview, now: Date): WatchNotification[] {
  const told = new Set(listNotifications(watch.customerId).filter((note) => note.watchId === watch.id).map((note) => listingKey(note.listing)));
  const example = getConfig().isMock ? " Example data: no key is set, so these are not real listings." : "";
  return evaluateListings(unique(watch.pages), watchEvaluationRule(watch, overview, now))
    .filter((entry) => entry.verdict !== "fails" && !told.has(listingKey(entry.listing)))
    .slice(0, MAX_INITIAL_FINDINGS)
    .map((entry) => {
      const note = toNotification(watch, overview, { kind: "initial_match", listing: entry.listing, previousPriceEur: null }, "context.dev re-read", now);
      const label = entry.verdict === "match" ? "Matches your requirements" : "Needs verification";
      return { ...note, title: `${label}: ${entry.listing.title} at ${euros(entry.listing.priceEur)} a month`, summary: `${note.summary}${example}`, verdict: entry.verdict, checks: entry.checks, changeId: null, alertedAt: null };
    });
}

// The first check of a new Project, on the server: read, judge every listing with the Project's one rule, save the
// findings, then let the notification rule decide whether the phone hears about it. Stops quietly if the Project
// was paused or stopped meanwhile, and never writes or notifies for a Project that is no longer active.
export async function runInitialResearch(customerId: string, watchId: string, options: { search: boolean; now?: Date }): Promise<void> {
  const now = options.now ?? new Date();
  const watch = findWatch(customerId, watchId);
  const overview = buildOverview(customerId);
  if (!watch || watch.status !== "active" || !overview) return;
  try {
    const reading = options.search || !watch.pages.length ? await searchAgain(watch, now) : await rereadPages(watch, now);
    const current = findWatch(customerId, watchId);
    if (!current || current.status !== "active") return;
    const read = reading.pages.some((page) => page.listings.length > 0);
    const next: PropertyWatch = { ...current, pages: reading.pages, discovery: reading.discovery ?? current.discovery ?? null, mode: reading.mode ?? current.mode, lastCheckedAt: now.toISOString(), lastSuccessAt: lastSuccessOf(reading.pages) ?? current.lastSuccessAt ?? null, problems: reading.problems, initialResearch: read ? "done" : "failed" };
    const findings = read ? initialFindings(next, overview, now) : [];
    const matched = findings.filter((note) => note.verdict === "match").length;
    const detail = `First check for ${watchSubject(next)}: ${unique(next.pages).length} listings judged against your requirements, ${matched} match, ${findings.length - matched} need verification.${read ? "" : " No page could be read."}`;
    updateState((state) => {
      const live = (state.watches ?? []).find((candidate) => candidate.id === watchId && candidate.customerId === customerId);
      if (!live || live.status !== "active") return state;
      const stored = { ...state, watches: (state.watches ?? []).map((candidate) => (candidate.id === watchId ? { ...live, ...next, status: live.status } : candidate)), notifications: [...findings, ...(state.notifications ?? [])].slice(0, MAX_NOTIFICATIONS) };
      return withAudit(stored, { customerId, type: "watch_checked", actor: "system", actionId: live.actionId, detail }, now);
    });
    const saved = findWatch(customerId, watchId);
    if (!saved || saved.status !== "active") return;
    await applyNotifyPolicy(customerId, saved, findings, now, "initial_findings");
  } catch (error) {
    const problem = `The first check could not finish: ${(error as Error).message}`;
    updateState((state) => ({ ...state, watches: (state.watches ?? []).map((candidate) => (candidate.id === watchId && candidate.customerId === customerId ? { ...candidate, initialResearch: "failed", problems: [problem] } : candidate)) }));
  }
}
