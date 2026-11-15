// Projects (15 Nov): a watch with a goal and requirements, a housing effect worked out in code, honest wording about
// what runs, pause/resume/edit/read controls, dedupe against earlier findings, and the daily scheduled review.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AINO, EETU, collect, freshState, ofType, stubFetch } from "./helpers";
import { runTurn } from "@/lib/agent/orchestrator";

import { approveAction, saveDraft } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { buildWatchDraft } from "@/lib/actions/watch";
import { type ListingSearch, listingQuery } from "@/lib/agent/research/listings";
import { housingEffect } from "@/lib/finance/housing";
import { buildOverview } from "@/lib/finance/overview";
import { auditFor } from "@/lib/store/audit";
import { inSession, newSessionId } from "@/lib/store/session";
import { forgetStoredState } from "@/lib/store/state";
import type { AgentAction, HealthReport, Listing, WatchProject, WatchRequirements } from "@/lib/types";
import { checkWatches, listNotifications, listWatches, simulatePriceDrop, startWatch } from "@/lib/watch";
import { runScheduledChecks } from "@/lib/watch/cron";
import { getProject, markRead, pauseWatch, projectStatusOf, resumeWatch, updateWatch } from "@/lib/watch/project";
import { checkRequirements, cleanRequirements } from "@/lib/watch/requirements";
import { GET as projectRoute, PATCH as patchRoute } from "@/app/api/watch/[id]/route";
import { POST as pauseRoute } from "@/app/api/watch/[id]/pause/route";
import { POST as readRoute } from "@/app/api/watch/[id]/read/route";
import { GET as cronRoute } from "@/app/api/watch/cron/route";
import { GET as health } from "@/app/api/health/route";
import { POST as approveRoute } from "@/app/api/actions/[id]/approve/route";
import { POST as approveAllRoute } from "@/app/api/actions/approve-all/route";

const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/espoo";
const flat = (overrides: Partial<Listing> = {}): Listing => ({ title: "Tapiontori 1", priceEur: 940, rooms: 2, areaM2: 45, district: "Tapiola", availableFrom: "1.12.2026", url: "https://www.vuokraovi.com/kohde/a1", pageUrl: PAGE, ...overrides });
const OTHER = flat({ title: "Leppävaarankatu 3", priceEur: 1_190, district: "Leppävaara", url: "https://www.vuokraovi.com/kohde/b2" });
const searchOf = (listings: Listing[]): ListingSearch => ({ city: "Espoo", topic: null, query: listingQuery("Espoo"), pages: [{ url: PAGE, title: "Vuokraovi: Espoo", listings, dropped: 0, cacheAgeMs: 0, tookMs: 1, mock: false }], found: [{ url: PAGE, title: "Vuokraovi: Espoo" }], errors: [], retrievedAt: "2026-11-15T08:00:00.000Z", tookMs: 1, mock: false });

function approvedProject(requirements: WatchRequirements = {}, budgetEur = 900, customerId = AINO): AgentAction {
  const built = buildWatchDraft(customerId, { city: "Espoo", budgetEur, minRooms: null, search: searchOf([flat(), OTHER]), preparedBy: "sisu-agent", goal: "Move to Espoo to save for a deposit", requirements });
  assert.ok(built.ok, built.ok ? "" : built.reason);
  const saved = saveDraft(customerId, built.draft);
  assert.ok(saved.ok);
  const approved = approveAction(customerId, saved.action.id, impactOf);
  assert.ok(approved.ok);
  return approved.action;
}

describe("the housing effect of a listing is worked out in code, and nothing unknown is filled in", () => {
  const overview = buildOverview(AINO)!;

  it("splits recurring from upfront, labels the usual deposit as an assumption and lists what is missing", () => {
    const effect = housingEffect(overview, flat());
    assert.equal(effect.recurring.rentChangeEur, Math.round((940 - effect.recurring.currentHousingEur) * 100) / 100);
    assert.deepEqual([effect.recurring.utilitiesChangeEur, effect.recurring.transportChangeEur, effect.upfront.depositEur, effect.upfront.movingCostEur], [null, null, null, null]);
    assert.deepEqual(effect.upfront.depositAssumedEur, { low: 940, high: 2_820 });
    assert.deepEqual(effect.upfront.rangeEur, { low: 940, high: 2_820 });
    assert.match(effect.assumptions.join(" "), /Assumption, not from the listing: deposits are usually 1 to 3 months' rent/);
    for (const gap of [/Water and other monthly charges/, /Transport after the move/, /The deposit/, /Moving costs/, /keep in the account/]) assert.match(effect.missing.join(" "), gap);
    assert.ok(effect.facts.filter((fact) => fact.source === "assumption").every((fact) => /assumption/.test(fact.label)));
    assert.equal(effect.savingsGoal, null);
  });

  it("uses what the listing and the customer stated: deposit, charges, moving cost, buffer and savings goal", () => {
    const effect = housingEffect(overview, flat({ depositEur: 1_880, utilitiesPerMonthEur: 22 }), { movingCostEur: 300, bufferToKeepEur: 100_000, savingsGoalEur: 3_000 });
    assert.equal(effect.upfront.depositAssumedEur, null);
    assert.deepEqual([effect.upfront.knownEur, effect.upfront.rangeEur.low, effect.upfront.rangeEur.high], [2_180, 2_180, 2_180]);
    assert.equal(effect.recurring.knownChangeEur, Math.round((effect.recurring.rentChangeEur + 22) * 100) / 100);
    assert.equal(effect.buffer.keeps, "no");
    assert.equal(effect.buffer.afterUpfrontEur.low, Math.round((overview.balance - 2_180) * 100) / 100);
    assert.equal(effect.savingsGoal?.goalEur, 3_000);
    assert.ok(!effect.missing.some((gap) => /deposit|Moving|charges|keep/i.test(gap)));
    assert.ok(effect.facts.some((fact) => fact.source === "customer-stated" && fact.value === 300));
  });

  it("a simulated rent is never receipted as read from the listing, and no transport spending is said plainly", () => {
    const effect = housingEffect(overview, flat(), {}, "sim", { simulated: true });
    assert.deepEqual([effect.facts[0].source, effect.facts[0].basis], ["assumption", "made up by the demo's simulate button"]);
    assert.match(effect.missing.join(" "), /your bank data shows no transport spending today/); // Aino has none
  });
});

describe("requirements are cleaned and applied to listings", () => {
  it("drops a money figure the customer did not say, and a malformed date", () => {
    const { requirements, dropped } = cleanRequirements({ maxDepositEur: 2_000, movingCostEur: 450, moveBy: "next month", districts: ["Tapiola", "https://evil.example"] }, (value) => value === 2_000);
    assert.deepEqual(requirements, { maxDepositEur: 2_000, districts: ["Tapiola"] });
    assert.deepEqual(dropped, ["moving cost", "move-by date (use YYYY-MM-DD)"]);
  });

  it("excludes a listing that breaks a requirement; one that does not state the field is kept and flagged", () => {
    const req: WatchRequirements = { districts: ["Tapiola"], moveBy: "2026-12-15", maxDepositEur: 1_500, maxCommuteMinutes: 30 };
    assert.deepEqual(checkRequirements(flat(), req, "2026-11-15"), { ok: true, reasons: [], unchecked: ["deposit not stated", "commute time not measured"] });
    assert.ok(!checkRequirements(OTHER, req, "2026-11-15").ok);
    assert.match(checkRequirements(flat({ availableFrom: "1.2.2027" }), req, "2026-11-15").reasons.join(), /after 2026-12-15/);
    assert.ok(checkRequirements(flat({ district: null }), req, "2026-11-15").unchecked.includes("district not stated"));
  });
});

describe("the Project proposal asks for consent and says exactly what will run", () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => void freshState());
  afterEach(() => (saved === undefined ? delete process.env.CRON_SECRET : (process.env.CRON_SECRET = saved)));

  it("without the scheduler it says Sisu reviews changes only when the app is opened, and never 'tells you when'", () => {
    delete process.env.CRON_SECRET;
    const built = buildWatchDraft(AINO, { city: "Espoo", budgetEur: 900, minRooms: null, search: searchOf([flat(), OTHER]), preparedBy: "sisu-agent", goal: "Move to Espoo", requirements: { districts: ["Tapiola"] } });
    assert.ok(built.ok);
    const { draft } = built;
    assert.match(draft.summary, /^Would you like me to keep checking for homes that match these requirements\?/);
    assert.match(draft.summary, /Goal: Move to Espoo\./);
    assert.match(draft.summary, /every 6 hours on its own servers\. Sisu reviews what changed when you open the app; it does not check on its own/);
    assert.match(draft.summary, /The nearest, Tapiontori 1: Rent €940/);
    assert.ok(!/tells you when|The watching is real/.test(draft.summary + draft.title));
    assert.deepEqual([draft.watch?.goal, draft.watch?.requirements], ["Move to Espoo", { districts: ["Tapiola"] }]);
    assert.ok(draft.assumptions.some((line) => /^Missing: /.test(line)));
  });

  it("with the scheduler switched on it says so, and health reports it", async () => {
    process.env.CRON_SECRET = "test-secret";
    const built = buildWatchDraft(AINO, { city: "Espoo", budgetEur: 900, minRooms: null, search: searchOf([flat()]), preparedBy: "sisu-agent" });
    assert.ok(built.ok);
    assert.match(built.draft.summary, /once a day on its own schedule and whenever you open the app/);
    assert.equal(((await (await health(new Request("http://localhost/api/health"))).json()) as HealthReport).watchScheduler, "cron");
    delete process.env.CRON_SECRET;
    assert.equal(((await (await health(new Request("http://localhost/api/health"))).json()) as HealthReport).watchScheduler, "on-open");
  });
});

describe("a Project with Context.dev monitors: status, controls and dedupe", () => {
  const saved = { MODEL_PROVIDER: process.env.MODEL_PROVIDER, CONTEXT_DEV_API_KEY: process.env.CONTEXT_DEV_API_KEY };
  let restore = () => {};
  let calls: { method: string; path: string }[] = [];
  let changes: Record<string, unknown[]> = {};
  let pageNow: Partial<Listing>[] = [];
  let pageFails = false;
  let ranAt = "";
  let nextAt = "";

  beforeEach(() => {
    ranAt = new Date(Date.now() + 4 * 60_000).toISOString(); // the monitor ran just after the watch started
    nextAt = new Date(Date.now() + 6 * 3_600_000).toISOString();
    freshState();
    Object.assign(process.env, { MODEL_PROVIDER: "nvidia", CONTEXT_DEV_API_KEY: "test" });
    calls = [];
    changes = {};
    pageNow = [flat(), OTHER];
    pageFails = false;
    let created = 0;
    restore = stubFetch((url, init) => {
      const { pathname, searchParams } = new URL(url);
      const method = init?.method ?? "GET";
      calls.push({ method, path: pathname });
      if (pathname === "/v1/web/scrape") return pageFails ? Response.json({ error: "blocked" }, { status: 500 }) : Response.json({ json: { success: true, data: { listings: pageNow } }, cache_metadata: { age_ms: 0 } });
      if (pathname === "/v1/monitors" && method === "POST") return Response.json({ id: `mon_${++created}`, status: "active" }, { status: 201 });
      const id = pathname.split("/")[3];
      if (pathname.endsWith("/changes")) return Response.json({ data: (changes[id] ?? []).filter((change) => (change as { detected_at: string }).detected_at >= (searchParams.get("since") ?? "")) });
      if (method === "DELETE") return new Response(null, { status: 204 });
      return Response.json({ id, status: "active", last_run_at: ranAt, next_run_at: nextAt, last_error: pageFails ? { message: "blocked" } : null });
    });
  });
  afterEach(() => {
    restore();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
  const change = (id: string, minutes: number) => ({ id, title: "", summary: "", detected_at: later(minutes).toISOString() });

  it("a check stores the last successful read and Context.dev's next run; every page failing shows as failing", async () => {
    const watch = (await startWatch(AINO, approvedProject()))!;
    assert.deepEqual([watch.goal, watch.pages[0].title, projectStatusOf(watch)], ["Move to Espoo to save for a deposit", "Vuokraovi: Espoo", "active"]);
    await checkWatches(AINO, { now: later(5) });
    const project = getProject(AINO, watch.id)!;
    assert.deepEqual([project.watch.projectStatus, project.watch.lastSuccessAt, project.watch.nextCheckAt, project.scheduler], ["active", ranAt, nextAt, "on-open"]);
    pageFails = true;
    await checkWatches(AINO, { now: later(10) });
    assert.equal(getProject(AINO, watch.id)!.watch.projectStatus, "failing");
  });

  it("pause deletes the monitors and stops checks; resume creates new ones", async () => {
    const watch = (await startWatch(AINO, approvedProject()))!;
    const paused = await pauseWatch(AINO, watch.id);
    assert.ok(paused.ok && paused.watch.status === "paused" && paused.watch.projectStatus === "paused" && paused.watch.nextCheckAt === null);
    assert.deepEqual(calls.filter((call) => call.method === "DELETE").map((call) => call.path).sort(), ["/v1/monitors/mon_1", "/v1/monitors/mon_2"]);
    assert.equal((await checkWatches(AINO)).checked, 0);
    const resumed = await resumeWatch(AINO, watch.id);
    assert.ok(resumed.ok && resumed.watch.status === "active");
    assert.deepEqual([resumed.watch.pages[0].monitorId, resumed.watch.searchMonitorId], ["mon_3", "mon_4"]);
    assert.deepEqual(auditFor(AINO).events.slice(-2).map((event) => event.type), ["watch_paused", "watch_resumed"]);
    assert.ok(!(await pauseWatch(EETU, watch.id)).ok, "another customer cannot pause it");
  });

  it("editing the requirements re-evaluates the listings already read, with the housing effect", async () => {
    const watch = (await startWatch(AINO, approvedProject()))!;
    assert.equal(getProject(AINO, watch.id)!.currentMatches.length, 0, "nothing at €900");
    const edited = updateWatch(AINO, watch.id, { budgetEur: 1_200, requirements: { districts: ["Tapiola"], movingCostEur: 400 } });
    assert.ok(edited.ok);
    assert.deepEqual(edited.project.currentMatches.map((match) => match.listing.title), ["Tapiontori 1"]);
    assert.equal(edited.project.currentMatches[0].housing?.upfront.movingCostEur, 400);
    assert.equal(listWatches(AINO)[0].budgetEur, 1_200);
    assert.ok(!updateWatch(AINO, watch.id, { budgetEur: 50 }).ok);
  });

  // Regression: QA 15 Nov. After saving moving costs and a buffer to keep, the finding still said both were "not given"
  // and its balance after moving left the moving costs out, while Fits now used them.
  it("saving requirements works the findings' housing effect out again, with the new figures", async () => {
    const watch = (await startWatch(AINO, approvedProject()))!;
    const dropped = simulatePriceDrop(AINO, watch.id);
    assert.ok(dropped.ok);
    const before = dropped.notification;
    assert.ok(before.housing?.missing.some((line) => /^Moving costs/.test(line)) && before.housing.missing.some((line) => /keep in the account/.test(line)));
    const budgetOnly = updateWatch(AINO, watch.id, { budgetEur: 950 });
    assert.ok(budgetOnly.ok);
    assert.deepEqual(budgetOnly.project.notifications[0].housing, before.housing, "a price limit change leaves the finding as it was found");
    const edited = updateWatch(AINO, watch.id, { requirements: { movingCostEur: 400, bufferToKeepEur: 1_500 } });
    assert.ok(edited.ok);
    const [note] = edited.project.notifications;
    assert.equal(note.id, before.id);
    assert.equal(note.housing?.upfront.movingCostEur, 400);
    assert.equal(note.housing?.buffer.keepEur, 1_500);
    assert.ok(note.housing && !note.housing.missing.some((line) => /^Moving costs|keep in the account/.test(line)), note.housing?.missing.join(" | "));
    assert.equal(note.housing?.upfront.rangeEur.low, before.housing!.upfront.rangeEur.low + 400, "the moving costs are in the upfront total");
    assert.equal(note.housing?.buffer.afterUpfrontEur.low, before.housing!.buffer.afterUpfrontEur.low - 400);
    assert.ok(note.housing?.facts.some((f) => f.id === `watch:${note.id}:housing:moving` && f.value === 400));
    assert.ok(note.summary.includes(note.housing!.sentence) && !note.summary.includes(before.housing!.sentence));
    assert.match(note.summary, /Simulated for the demo/);
    assert.deepEqual([note.listing.priceEur, note.budgetEur, note.detectedAt], [before.listing.priceEur, before.budgetEur, before.detectedAt], "what was found and when stays");
    assert.equal(listNotifications(AINO)[0].housing?.upfront.movingCostEur, 400, "stored, so GET /api/watch shows it too");
    const cleared = updateWatch(AINO, watch.id, { requirements: { movingCostEur: null } });
    assert.ok(cleared.ok && cleared.project.notifications[0].housing?.missing.some((line) => /^Moving costs/.test(line)));
  });

  it("a listing told about once is not told again when it comes back, and findings can be marked read", async () => {
    const watch = (await startWatch(AINO, approvedProject({}, 950)))!;
    changes.mon_1 = [change("c1", 1)];
    pageNow = [flat({ title: "Uusi 5", priceEur: 900, url: "https://www.vuokraovi.com/kohde/new" }), OTHER];
    assert.equal((await checkWatches(AINO, { now: later(5) })).notifications.length, 1);
    changes.mon_1 = [...changes.mon_1, change("c2", 6)];
    pageNow = [OTHER]; // it drops off the page...
    await checkWatches(AINO, { now: later(10) });
    changes.mon_1 = [...changes.mon_1, change("c3", 11)];
    pageNow = [flat({ title: "Uusi 5", priceEur: 900, url: "https://www.vuokraovi.com/kohde/new" }), OTHER]; // ...and comes back
    assert.equal((await checkWatches(AINO, { now: later(15) })).notifications.length, 0);
    const [note] = listNotifications(AINO);
    assert.equal(note.housing?.rentEur, 900);
    assert.equal(getProject(AINO, watch.id)!.unread, 1);
    assert.deepEqual(markRead(AINO, watch.id, null), { ok: true, marked: 1, unread: 0 });
    assert.ok(getProject(AINO, watch.id)!.notifications[0].readAt);
  });
});

describe("Project routes and the scheduled review", () => {
  const savedEnv = { SISU_SESSIONS: process.env.SISU_SESSIONS, CRON_SECRET: process.env.CRON_SECRET };
  beforeEach(() => {
    forgetStoredState();
    freshState();
    process.env.SISU_SESSIONS = "visitor";
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const req = (path: string, session: string, method = "GET", body?: unknown) => new Request(`https://sisu.test${path}`, { method, headers: { "Content-Type": "application/json", "x-sisu-session": session, "x-forwarded-for": "198.51.100.21" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it("GET, PATCH, pause and read answer the owner and 4xx everyone else", async () => {
    const [anna, ben] = [newSessionId(), newSessionId()];
    const watch = (await inSession(anna, async () => startWatch(AINO, approvedProject())))!;
    const project = (await (await projectRoute(req(`/api/watch/${watch.id}?customerId=${AINO}`, anna), ctx(watch.id))).json()) as WatchProject;
    assert.deepEqual([project.watch.id, project.watch.projectStatus, project.unread, project.scheduler], [watch.id, "active", 0, "on-open"]);
    assert.equal((await projectRoute(req(`/api/watch/${watch.id}?customerId=${AINO}`, ben), ctx(watch.id))).status, 404);
    assert.equal((await projectRoute(req(`/api/watch/${watch.id}`, anna), ctx(watch.id))).status, 400);
    assert.equal((await patchRoute(req(`/api/watch/${watch.id}`, anna, "PATCH", { customerId: AINO }), ctx(watch.id))).status, 400);
    assert.equal((await patchRoute(req(`/api/watch/${watch.id}`, anna, "PATCH", { customerId: AINO, requirements: { moveBy: "soon" } }), ctx(watch.id))).status, 400);
    const patched = await patchRoute(req(`/api/watch/${watch.id}`, anna, "PATCH", { customerId: AINO, goal: "Find a two-room flat in Tapiola", requirements: { moveBy: "2026-12-31" } }), ctx(watch.id));
    assert.equal(patched.status, 200);
    assert.equal(((await patched.json()) as WatchProject).watch.requirements?.moveBy, "2026-12-31");
    assert.equal((await pauseRoute(req(`/api/watch/${watch.id}/pause`, ben, "POST", { customerId: AINO }), ctx(watch.id))).status, 404);
    assert.equal((await pauseRoute(req(`/api/watch/${watch.id}/pause`, anna, "POST", { customerId: AINO }), ctx(watch.id))).status, 200);
    assert.equal((await readRoute(req(`/api/watch/${watch.id}/read`, anna, "POST", { customerId: AINO, notificationIds: "all" }), ctx(watch.id))).status, 400);
    assert.equal((await readRoute(req(`/api/watch/${watch.id}/read`, anna, "POST", { customerId: AINO }), ctx(watch.id))).status, 200);
  });

  it("approve and approve-all answer the new watch as a Project, with its derived fields", async () => {
    const anna = newSessionId();
    const prepared = (budgetEur: number) =>
      inSession(anna, () => {
        const built = buildWatchDraft(AINO, { city: "Espoo", budgetEur, minRooms: null, search: searchOf([flat(), OTHER]), preparedBy: "sisu-agent", goal: "Move to Espoo to save for a deposit", requirements: {} });
        assert.ok(built.ok, built.ok ? "" : built.reason);
        const saved = saveDraft(AINO, built.draft);
        assert.ok(saved.ok);
        return saved.action;
      });
    const one = prepared(900);
    const single = (await (await approveRoute(req(`/api/actions/${one.id}/approve`, anna, "POST", { customerId: AINO, confirm: true }), ctx(one.id))).json()) as { watch: WatchProject["watch"]; scheduler: string };
    assert.deepEqual([single.watch.projectStatus, single.watch.goal, single.scheduler], ["active", "Move to Espoo to save for a deposit", "on-open"]);
    assert.ok(single.watch.lastSuccessAt && "nextCheckAt" in single.watch && single.watch.requirements);
    const two = prepared(950);
    const all = (await (await approveAllRoute(req("/api/actions/approve-all", anna, "POST", { customerId: AINO, actionIds: [two.id], confirm: true }))).json()) as { approved: AgentAction[]; watches: WatchProject["watch"][]; scheduler: string };
    assert.equal(all.approved.length, 1);
    assert.deepEqual([all.watches.length, all.watches[0].projectStatus, all.watches[0].budgetEur, all.scheduler], [1, "active", 950, "on-open"]);
  });

  it("the cron route is off without CRON_SECRET and refuses a wrong one", async () => {
    delete process.env.CRON_SECRET;
    assert.equal((await cronRoute(new Request("https://sisu.test/api/watch/cron"))).status, 503);
    process.env.CRON_SECRET = "right";
    assert.equal((await cronRoute(new Request("https://sisu.test/api/watch/cron", { headers: { authorization: "Bearer wrong" } }))).status, 401);
  });

  it("the scheduled run reviews each session with an active watch, and stops one whose app has been away 14 days", async () => {
    process.env.CRON_SECRET = "right";
    const [anna, ben] = [newSessionId(), newSessionId()];
    const fresh = (await inSession(anna, async () => startWatch(AINO, approvedProject())))!;
    const old = (await inSession(ben, async () => startWatch(EETU, approvedProject({}, 900, EETU), new Date(Date.now() - 20 * 86_400_000))))!;
    const response = await cronRoute(new Request("https://sisu.test/api/watch/cron", { headers: { authorization: "Bearer right" } }));
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.ok(!text.includes(anna) && !text.includes(ben), "session ids are never returned");
    const run = JSON.parse(text) as Awaited<ReturnType<typeof runScheduledChecks>>;
    assert.deepEqual([run.sessions, run.watchesChecked, run.stoppedInactive], [2, 1, 1]);
    assert.equal(inSession(anna, () => listWatches(AINO)[0].status), "active");
    assert.equal(inSession(anna, () => listWatches(AINO)[0].visitorSeenAt), fresh.visitorSeenAt, "a scheduled check does not count as the visitor");
    const stopped = inSession(ben, () => listWatches(EETU)[0]);
    assert.deepEqual([stopped.id, stopped.status, stopped.stoppedBecause], [old.id, "stopped", "inactive"]);
    assert.match(inSession(ben, () => auditFor(EETU).events.at(-1)?.detail ?? ""), /had not checked in for 14 days/);
  });
});

describe("mock mode can start a Project from a question, and the buttons speak the same language", () => {
  beforeEach(() => void freshState());

  it("'keep an eye on flats in Espoo under 900 euros' prepares a property watch that asks for consent", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "Can you keep an eye on flats in Espoo under 900 euros?", mode: "text" }));
    const action = ofType(events, "action")[0]?.action;
    assert.equal(action?.kind, "property_watch");
    assert.equal(action?.watch?.city, "Espoo");
    assert.match(ofType(events, "done")[0].text, /Would you like me to keep checking for homes that match these requirements\?/);
    assert.doesNotMatch(ofType(events, "done")[0].text, /tell you the moment|instantly|right away/);
  });

  it("buttons compare with other demo profiles, never 'people my age', and call a watch a project", () => {
    const source = readFileSync("lib/agent/suggestions.ts", "utf8").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(source, /people my age|ikätoverit|my watch/);
    assert.match(source, /Me vs other demo profiles/);
  });
});
