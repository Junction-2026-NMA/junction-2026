// Checks for Projects (watches) on the web: the ProjectStore against a fake server shaped like today's backend
// (no pause/resume/PATCH/read routes) and a newer one, and the presenter's wording (titles, status, the honest
// schedule line, findings, the housing effect with its missing items), and the requirements editor's rules.
// Run: npx tsx web/core/__checks__/projects.check.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CoachClient } from "@/web/core/CoachClient";
import { CoachEndpoints } from "@/web/core/CoachEndpoints";
import { PropertyWatch, WatchNotification } from "@/web/core/WatchModels";
import { WatchProject, sameListing } from "@/web/core/WatchProject";
import { memoryDefaults } from "@/web/app/Defaults";
import { ProjectStore } from "@/web/app/ProjectStore";
import { FindingText, HousingText, ProjectText } from "@/web/features/Projects/ProjectPresenter";
import { fieldError, formErrors, readNumber, requirementFields, requirementPatch } from "@/web/features/Projects/RequirementForm";
import { EvaluatedListing, ProjectAlert, SchedulerInfo } from "@/web/core/WatchExtras";
import { AlertRules, CheckFrequency, ListingGroups, affordabilityLines, confirmRows, parseProjectLink } from "@/web/features/Projects/ProjectJourney";

let failures = 0, passes = 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function eq(actual: unknown, expected: unknown, label: string): void {
  if (same(actual, expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
async function group(name: string, body: () => void | Promise<void>): Promise<void> {
  const before = failures;
  try { await body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

const watchJSON = {
  id: "w1", actionId: "a1", customerId: "C1", city: "Espoo", topic: null, priceUnit: "EUR/month", budgetEur: 900, minRooms: null,
  status: "active", mode: "monitor", createdAt: "2026-11-15T08:00:00.000Z", lastCheckedAt: "2026-11-15T09:00:00.000Z", problems: [],
  pages: [{ url: "https://www.vuokraovi.com/espoo", monitorId: "m1", listings: [], lastReadAt: "2026-11-15T08:30:00.000Z", lastChangeAt: null, lastError: null }],
};
const findingJSON = {
  id: "n1", watchId: "w1", customerId: "C1", kind: "price_drop", title: "Price drop: Tapiontori 3", summary: "Simulated for the demo: the page did not really change.",
  listing: { title: "Tapiontori 3", priceEur: 870, rooms: 2, areaM2: 48, district: "Tapiola", url: "https://www.vuokraovi.com/espoo/1", pageUrl: "https://www.vuokraovi.com/espoo" },
  previousPriceEur: 950, budgetEur: 900, underBudgetByEur: 30, leftOverAfterEur: 412, balanceAfterEur: null,
  detectedAt: "2026-11-15T09:00:00.000Z", detectedBy: "simulation", simulated: true, facts: [],
};

const matchJSON = { listing: { title: "Testikuja 7", priceEur: 965, rooms: 2, url: "https://www.vuokraovi.com/espoo/7", pageUrl: "https://www.vuokraovi.com/espoo" },
  housing: { rentEur: 965, recurring: { knownChangeEur: 100 }, upfront: { depositEur: null, depositAssumedEur: { low: 965, high: 2895 } }, missing: [] } };

/** A fake server: today's hosted backend (no project routes: they answer an HTML 404), or with `newer` the backend
 *  that marks its list (`scheduler`, `projectStatus`) and has pause, resume, PATCH, read and `GET /api/watch/:id`. */
function fakeServer({ newer = false }: { newer?: boolean } = {}) {
  const calls: string[] = [];
  let watch: Record<string, unknown> = { ...watchJSON, ...(newer ? { projectStatus: "active", requirements: {} } : {}) };
  let notifications: unknown[] = [];
  let patches: unknown[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const parsed = new URL(String(url), "http://x");
    const path = parsed.pathname;
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}${parsed.search}`);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const project = () => json({ customerId: "C1", watch, notifications, unread: 0, currentMatches: [matchJSON], scheduler: "on-open" });
    if (method === "GET" && path === "/api/watch") return json({ customerId: "C1", watches: [watch], notifications, ...(newer ? { scheduler: "on-open" } : {}) });
    if (method === "POST" && path === "/api/watch/check") { notifications = [findingJSON]; return json({ customerId: "C1", checked: 1, changesSeen: 1, pagesReread: 1, notifications, problems: [] }); }
    if (method === "POST" && path === "/api/watch/w1/stop") { watch = { ...watch, status: "stopped", projectStatus: newer ? "stopped" : undefined }; return json({ watch }); }
    if (newer && method === "POST" && path === "/api/watch/w1/pause") { watch = { ...watch, status: "paused", projectStatus: "paused" }; return json({ watch }); }
    if (newer && method === "POST" && path === "/api/watch/w1/read") return json({ watch, notifications });
    if (newer && method === "GET" && path === "/api/watch/w1") return parsed.searchParams.get("customerId") === "C1" ? project() : json({ error: "Choose a customer first." }, 400);
    if (newer && method === "PATCH" && path === "/api/watch/w1") {
      const body = JSON.parse(String(init?.body)) as { budgetEur?: number };
      patches = [...patches, body];
      if (body.budgetEur !== undefined && (body.budgetEur < 200 || body.budgetEur > 10_000)) return json({ error: "The price limit must be between €200 and €10,000." }, 400);
      watch = { ...watch, ...(body.budgetEur !== undefined ? { budgetEur: body.budgetEur } : {}) };
      return project();
    }
    if (path === "/api/health") return json({ ok: true, mock: false, model: { provider: "mock", name: "m" }, services: { watchScheduler: false } });
    return new Response("<!DOCTYPE html><title>404</title>", { status: 404, headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;
  return { calls, fetchImpl, patches: () => patches };
}
/** Calls that a browser would log as an error status (the probes did, on every load). */
const optionalRouteCalls = (calls: string[]) => calls.filter((c) => /^GET \/api\/watch\/w1\/(pause|resume|read)|^GET \/api\/watch\/w1$/.test(c));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function main() {
  await group("store on today's backend: list, check, findings, unread, controls hidden", async () => {
    const server = fakeServer();
    const defaults = memoryDefaults();
    const store = new ProjectStore("C1", CoachClient.live("", server.fetchImpl), defaults);
    await store.load();
    await settle(); await settle();
    const s = store.getSnapshot();
    eq([s.loaded, s.watches.map((w) => w.id), s.error], [true, ["w1"], null], "loaded");
    eq(s.support, { pause: false, resume: false, update: false, read: false, project: false }, "no project routes on today's backend: hidden");
    eq(optionalRouteCalls(server.calls), [], "nothing probed, so no 404 in the console");
    const close = store.open("w1");
    await settle();
    eq([server.calls.some((c) => c.startsWith("GET /api/watch/w1")), store.getSnapshot().matches], [false, {}], "no project detail asked where the route is missing");
    close();
    eq(store.hasActive, true, "an active project");
    await store.check();
    eq(store.findings("w1").map((n) => n.id), ["n1"], "check found one");
    eq(ProjectStore.unreadCount(store.getSnapshot()), 1, "one unread");
    eq(server.calls.filter((c) => c === "POST /api/watch/check").length, 1, "one check sent");
    await store.markRead("w1", true);
    eq([ProjectStore.unreadCount(store.getSnapshot()), store.getSnapshot().fresh.w1], [0, ["n1"]], "seen on this device, still marked new");
    eq(server.calls.some((c) => c.startsWith("POST /api/watch/w1/read")), false, "no read call without the route");
    const again = new ProjectStore("C1", CoachClient.live("", server.fetchImpl), defaults);
    await again.load();
    eq(ProjectStore.unreadCount(again.getSnapshot()), 0, "seen ids survive a new store");
    eq(await store.pause("w1"), false, "pause on today's backend fails");
    eq(store.getSnapshot().notices.w1, "Pausing is not available on this server yet.", "pause notice");
    eq(await store.stop("w1"), true, "stop");
    eq(store.watch("w1")?.status, "stopped", "stopped");
    eq(store.hasActive, false, "nothing active: polling sends nothing");
  });

  await group("store on a newer backend: routes read from the list, what fits now, pause works, read sent", async () => {
    const server = fakeServer({ newer: true });
    const store = new ProjectStore("C1", CoachClient.live("", server.fetchImpl), memoryDefaults());
    const close = store.open("w1");
    await store.load();
    await settle(); await settle();
    eq(store.getSnapshot().support, { pause: true, resume: true, update: true, read: true, project: true }, "the list's marks say the routes exist");
    eq(optionalRouteCalls(server.calls), [], "no probe of a POST-only route, so no 405 in the console");
    eq(server.calls.filter((c) => c.startsWith("POST")).length, 0, "loading sends no POST");
    eq(server.calls.includes("GET /api/watch/w1?customerId=C1"), true, "the open project is read with its customer");
    eq(store.getSnapshot().matches.w1?.map((m) => [m.listing.title, m.listing.priceEur, m.housing !== null]), [["Testikuja 7", 965, true]], "what fits now, with its housing effect");
    const reads = () => server.calls.filter((c) => c === "GET /api/watch/w1?customerId=C1").length;
    const before = reads();
    await store.check();
    eq(reads(), before + 1, "read again after a check");
    eq(await store.updateRequirements("w1", { budgetEur: 1100 }), true, "an edit saves");
    eq([server.patches().at(-1), reads(), store.watch("w1")?.budgetEur], [{ budgetEur: 1100, customerId: "C1" }, before + 2, 1100], "only the change is sent, then the project is read again");
    eq(await store.updateRequirements("w1", { budgetEur: 50 }), false, "a refused edit");
    eq([store.getSnapshot().notices[ProjectStore.noticeKey("w1", "update")], store.getSnapshot().notices.w1],
      ["The price limit must be between €200 and €10,000.", undefined], "the refusal is kept for the requirements card, not the controls");
    eq(await store.pause("w1"), true, "pause");
    eq(store.watch("w1")?.status, "paused", "paused");
    await store.markRead("w1", true);
    eq(server.calls.includes("POST /api/watch/w1/read"), true, "read sent");
    close();
    const after = reads();
    await store.check();
    eq(reads(), after, "a closed project is not read again");
  });

  await group("store: a failed Check now is kept next to its button; a failed list asks for a retry (15 Nov QA)", async () => {
    const server = fakeServer();
    let down: "check" | "list" | null = null;
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(url), "http://x").pathname;
      if (down === "check" && path === "/api/watch/check") throw new TypeError("Failed to fetch");
      if (down === "list" && path === "/api/watch") return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
      return server.fetchImpl(url, init);
    }) as typeof fetch;
    const store = new ProjectStore("C1", CoachClient.live("", fetchImpl), memoryDefaults());
    await store.load();
    eq([store.getSnapshot().listFailed, store.getSnapshot().error], [false, null], "loaded");
    down = "check";
    await store.checkNow("w1");
    const failed = store.getSnapshot();
    eq([failed.busy.w1, failed.checking], [undefined, false], "the button is back");
    eq(typeof failed.notices.w1 === "string" && failed.notices.w1 !== "" && failed.notices.w1 === failed.error, true, "the failure shows with the controls, not only in the Checks card");
    eq(failed.listFailed, false, "a failed check is not a failed list");
    down = null;
    await store.checkNow("w1");
    eq([store.getSnapshot().notices.w1, store.getSnapshot().error], [undefined, null], "a check that works clears it");
    down = "list";
    await store.load();
    eq([store.getSnapshot().listFailed, store.getSnapshot().watches.map((w) => w.id)], [true, ["w1"]], "a failed list is marked; the projects known stay");
    down = null;
    await store.load();
    eq([store.getSnapshot().listFailed, store.getSnapshot().error], [false, null], "Retry: the list loads again");
    const fresh = new ProjectStore("C1", CoachClient.live("", fetchImpl), memoryDefaults());
    down = "list";
    await fresh.load();
    eq([fresh.getSnapshot().loaded, fresh.getSnapshot().listFailed, fresh.getSnapshot().watches.length], [true, true, 0], "first load fails: marked, nothing invented");
    const section = readFileSync(join(process.cwd(), "web/features/Projects/ProjectsSection.tsx"), "utf8");
    eq(["Sisu could not load your projects.", "projects.retry", "store?.load()", "Ask Sisu to keep an eye on something"].map((text) => section.includes(text)),
      [true, true, true, true], "the drawer names the list failure, offers Retry and keeps the hint");
  });

  await group("store on the sample: empty, no checks, no project calls", async () => {
    const store = new ProjectStore("C1", CoachClient.sample(), null);
    await store.load();
    await store.check();
    const s = store.getSnapshot();
    eq([s.loaded, s.watches.length, s.error, s.lastCheckAt], [true, 0, null, null], "empty and quiet");
  });

  await group("presenter: titles, status, honest schedule", () => {
    const w = PropertyWatch.decode(watchJSON)!;
    eq(ProjectText.title(w), "Homes in Espoo under €900", "rent title");
    eq(ProjectText.title({ ...w, city: null, topic: "iPhone 15", priceUnit: "EUR", budgetEur: 500 }), "iPhone 15 under €500", "price title");
    eq(ProjectText.title({ ...w, goal: "Move closer to work" }), "Move closer to work", "goal wins");
    eq(ProjectText.status(w), { label: "Active", tone: "active" }, "active");
    eq(ProjectText.status({ ...w, problems: ["Example data"] }).label, "Needs attention", "a problem");
    eq(ProjectText.status({ ...w, status: "paused" }).label, "Paused", "paused");
    eq(ProjectText.status({ ...w, status: "stopped" }).label, "Stopped", "stopped");
    eq(ProjectText.lastSuccess(w), "2026-11-15T08:30:00.000Z", "last success is the newest page read, not the last poll");
    eq(ProjectText.schedule(w, false), "Context.dev re-checks these pages about every 6 hours. Sisu reviews the changes when you open the app.", "monitor line");
    eq(ProjectText.schedule({ ...w, pages: [{ ...w.pages[0], monitorId: null }] }, false).startsWith("Sisu re-reads these pages itself"), true, "reread line");
    const now = new Date("2026-11-15T09:00:00.000Z");
    eq(ProjectText.schedule({ ...w, nextCheckAt: "2026-11-15T09:20:00.000Z" }, false, now), "Next check in 20 min.", "next check when sent");
    eq(ProjectText.requirements(w), [{ label: "Where", value: "Espoo" }, { label: "Rent at most", value: "€900 a month" }], "requirements");
    eq(ProjectText.requirements({ ...w, requirements: { moveDate: "2027-01-01", budgetEur: 900, pets: true } }).slice(2),
      [{ label: "Move date", value: "2027-01-01" }, { label: "Pets", value: "Yes" }], "extra requirements, no duplicates");
    eq(ProjectText.sources({ ...w, pages: [...w.pages, { url: "javascript:alert(1)", listings: [] }] }).map((s) => s.host), ["vuokraovi.com"], "only http links");
  });

  await group("presenter: findings and the housing effect", () => {
    const n = WatchNotification.decode(findingJSON)!;
    eq(FindingText.isSimulated(n), true, "simulated");
    eq(FindingText.listingLine(n.listing, true), "€870 a month · 2 rooms · 48 m² · Tapiola", "listing line");
    eq(FindingText.why(n, true).map((r) => r.value), ["€950 a month", "€30", "about €412"], "why it matters, server figures only");
    const view = HousingText.view(n, true)!;
    eq([view.fromServer, view.monthly, view.totals, view.missing], [false, [], [], ["Deposit", "Utilities (water, electricity)", "Transport change", "Moving costs"]], "only what is missing (the rent is shown above)");
    eq(HousingText.view(n, false), null, "no housing effect for a price watch");
    const server = HousingText.view({ ...n, housingEffect: { items: [{ label: "Rent", amountEur: 870, timing: "monthly" }, { label: "Deposit", amountEur: null, timing: "once" }, { label: "Moving van", amountEur: 150, timing: "once" }], recurringMonthlyEur: 870, upfrontEur: 150, missing: ["Water"] } }, true)!;
    eq([server.monthly.length, server.upfront, server.missing, server.totals.map((t) => t.value)], [1, [{ label: "Moving van", value: "€150" }], ["Water", "Deposit"], ["€870", "€150"]], "server effect: unknown stays unknown");
    eq(FindingText.enquiry(n).includes("deposit"), true, "the enquiry asks for the deposit");
    eq(/CUST|C1|€412/.test(FindingText.enquiry(n)), false, "the enquiry carries nothing private");
  });

  await group("presenter: check now and stop say what really happens (15 Nov QA)", () => {
    const w = PropertyWatch.decode(watchJSON)!;
    const reread = { ...w, pages: [{ ...w.pages[0], monitorId: null }] };
    eq(ProjectText.checking(w, null), "Asking Context.dev to read the pages again. New results can take a few minutes to show.", "monitored: Context.dev");
    eq(ProjectText.checking(w, "Mock data"), "Sisu is reading the example pages again.", "mock: no Context.dev, whatever the pages say");
    eq(ProjectText.checking(reread, null), "Sisu is reading the pages again.", "re-read on the live backend");
    eq(ProjectText.stopQuestion(w, null).includes("Context.dev monitors are removed"), true, "monitored stop names the monitors");
    eq(ProjectText.stopQuestion(w, "Mock data"), "Stop this project? Sisu stops re-reading its pages. Findings so far stay here.", "mock stop");
    eq(ProjectText.stopQuestion(reread, null).includes("monitor"), false, "re-read stop: no monitors");
    eq(ProjectText.requirements({ ...w, requirements: { maxDepositEur: 2000, maxCommuteMinutes: 40, moveBy: "2027-01-31", districts: ["Tapiola", "Otaniemi"] } }).slice(2),
      [{ label: "Deposit at most", value: "€2,000" }, { label: "Commute at most", value: "40 minutes" }, { label: "Move in by", value: "2027-01-31" },
        { label: "Districts", value: "Tapiola, Otaniemi" }], "known requirements named as the editor names them");
  });

  await group("project detail: currentMatches decoded tolerantly, the same home found once", () => {
    const project = WatchProject.decode({ customerId: "C1", watch: watchJSON, notifications: [findingJSON, { nope: 1 }], unread: 1, scheduler: "on-open",
      currentMatches: [matchJSON, { listing: null }, "x", { listing: { title: "Esimerkkikatu 4 A", priceEur: 1040 }, housing: "bad" }] });
    eq([project.watch?.id, project.notifications.length, project.currentMatches.map((m) => [m.listing.title, m.housing === null])],
      ["w1", 1, [["Testikuja 7", false], ["Esimerkkikatu 4 A", true]]], "bad entries skipped, a bad housing effect is null");
    eq(WatchProject.decode({}).currentMatches, [], "missing: none");
    const page = "https://site.fi/espoo";
    eq(sameListing({ title: "A 1", rooms: 2, pageUrl: page, url: page, priceEur: 900 }, { title: "a 1", rooms: 2, pageUrl: page, url: page, priceEur: 850 }), true, "a rent drop is the same home");
    eq(sameListing({ url: "https://site.fi/1", pageUrl: page }, { url: "https://site.fi/2", pageUrl: page }), false, "two own links: two homes");
    eq(CoachEndpoints.watchProject("", "w/1", "C1").url, "/api/watch/w%2F1?customerId=C1", "GET with the customer");
  });

  await group("requirements editor: every field the PATCH takes, checked in place (15 Nov QA)", () => {
    const w = PropertyWatch.decode({ ...watchJSON, requirements: { moveBy: "2027-01-31" } })!;
    const fields = requirementFields(w, true);
    eq(fields.map((f) => f.key), ["budgetEur", "minAreaM2", "minRooms", "moveBy", "districts", "maxDepositEur", "movingCostEur", "bufferToKeepEur", "monthlySavingsEur", "savingsGoalEur",
      "maxCommuteMinutes", "commuteTo", "goal"], "every field the PATCH takes, for a rent");
    eq(fields[0].label, "Rent at most (€ a month)", "the limit is named as a rent");
    eq(requirementFields(w, false).map((f) => [f.key, f.label]), [["budgetEur", "Price at most (€)"], ["goal", "The goal, in your words"]], "a price watch: its limit and goal");
    const budget = fields[0];
    eq([fieldError(budget, "", true), fieldError(budget, "150", true), fieldError(budget, "1 100", true), fieldError(budget, "abc", true)],
      ["Enter the most you would pay a month.", "Enter an amount between €200 and €10,000.", null, "Enter an amount between €200 and €10,000."], "a blank limit is invalid, never €0");
    eq(formErrors(fields, { budgetEur: "" }, true), { budgetEur: "Enter the most you would pay a month." }, "the blank limit blocks Save");
    eq(formErrors(fields, {}, true), {}, "nothing changed: nothing to fix");
    const rooms = fields.find((f) => f.key === "minRooms")!;
    eq([fieldError(rooms, "2", true), fieldError(rooms, "2.5", true), fieldError(rooms, "9", true)], [null, "Enter a whole number from 1 to 6.", "Enter a whole number from 1 to 6."], "rooms");
    eq(fieldError(fields.find((f) => f.key === "districts")!, "Tapiola, <b>", true), "Use district names only (letters, spaces, hyphens).", "districts are names");
    eq(fieldError(fields.find((f) => f.key === "maxCommuteMinutes")!, "200", true), "Enter 5 to 180 minutes.", "commute limit");
    eq(requirementPatch(fields, { budgetEur: "1100", minRooms: "2", moveBy: "", districts: "Tapiola, Otaniemi", movingCostEur: "300", commuteTo: "Aalto" }),
      { budgetEur: 1100, minRooms: 2, moveBy: null, districts: ["Tapiola", "Otaniemi"], movingCostEur: 300, commuteTo: "Aalto" }, "only what changed; a cleared field is null");
    eq(requirementPatch(fields, { budgetEur: "900", savingsGoalEur: "" }), {}, "typing the same value, or nothing, changes nothing");
    eq([readNumber("1 100"), readNumber("€950"), readNumber("12,5"), readNumber("1e3"), readNumber("-5")], [1100, 950, 12.5, null, null], "numbers as typed");
    const req = CoachEndpoints.watchUpdate("", "w1", "C1", { minRooms: null, moveBy: null, maxDepositEur: 2000 });
    eq(JSON.parse(String(req.body)), { customerId: "C1", minRooms: null, requirements: { maxDepositEur: 2000, moveBy: null } }, "a cleared field is sent as null, not dropped");
  });


  await group("v3: verdict groups, a failing listing is never a match, No matches yet", () => {
    const l = (title: string, priceEur: number) => ({ title, priceEur, url: `https://x.fi/${title}`, pageUrl: "https://x.fi" });
    const evaluated = EvaluatedListing.many([
      { listing: l("A", 850), verdict: "match", checks: [{ requirement: "Maximum rent", status: "met", detail: "" }] },
      { listing: l("B", 800), verdict: "needs_verification", checks: [{ requirement: "Minimum floor area", status: "unknown", detail: "" }] },
      { listing: l("C", 700), verdict: "fails", checks: [{ requirement: "Minimum floor area", status: "failed", detail: "" }] },
      { listing: l("D", 750), verdict: "match", checks: [{ requirement: "Savings goal", status: "failed", detail: "" }] },
      { listing: l("E", 1), verdict: "maybe", checks: [] },
    ]);
    const groups = ListingGroups.of(evaluated);
    eq(groups.matches.map((e) => e.listing.title), ["A"], "only listings meeting every requirement are matches");
    eq(groups.verify.map((e) => e.listing.title), ["B"], "a missing detail needs verification");
    eq(groups.alternatives.map((e) => e.listing.title), ["C", "D"], "a failed check is an alternative, even if labelled match");
    eq(ListingGroups.missing(groups.verify[0].checks), ["Minimum floor area"], "the missing detail is named");
    eq(ListingGroups.of([]).matches.length === 0 && ListingGroups.noMatches === "No matches yet", true, "nothing qualifies: No matches yet");
    eq(affordabilityLines([{ requirement: "Maximum rent", status: "met", detail: "" }, { requirement: "Savings goal", status: "failed", detail: "" }]).map((x) => x.label),
      ["Within your rent limit", "Would not leave your monthly savings"], "rent limit and savings goal are two lines");
  });

  await group("v3: check frequency is said honestly, never continuous", () => {
    const daily = SchedulerInfo.decode({ kind: "cron", checkEveryMinutes: 1440, dailyTimes: ["08:00"], deadline: true, push: true, timeZone: "Europe/Helsinki" });
    const onOpen = SchedulerInfo.decode({ kind: "on-open", checkEveryMinutes: null, dailyTimes: [], deadline: false, push: false });
    const quarter = SchedulerInfo.decode({ kind: "cron", checkEveryMinutes: 15, dailyTimes: [], push: true });
    const lines = [CheckFrequency.text(daily), CheckFrequency.text(onOpen), CheckFrequency.text(quarter), CheckFrequency.text(null)];
    eq(lines[0], "Sisu checks right after you approve, then once a day at 08:00 on its server, also while the app is closed. Context.dev re-checks the pages about every 6 hours.", "daily");
    eq(lines[1], "Sisu checks right after you approve and whenever you open the app. Context.dev re-checks the pages about every 6 hours.", "on-open");
    eq(lines[2].includes("about every 15 minutes"), true, "every 15 minutes");
    eq(lines.some((t) => /continuous|real-time|realtime|instantly/i.test(t)), false, "never continuous or real-time");
    eq(CheckFrequency.next({ nextScheduledCheckAt: null, nextCheckAt: "2026-11-15T12:00:00.000Z" })?.label, "Context.dev's next run", "Context.dev's run is labelled as its own");
    eq(SchedulerInfo.decode({}), null, "the old backend sends no scheduler info");
  });

  await group("v3: confirmation rows, deep links, alerts", () => {
    const rows = confirmRows({ city: "Espoo", budgetEur: 900, minRooms: null, requirements: { minAreaM2: 40, monthlySavingsEur: 100, savingsGoalEur: 2000 } });
    eq(rows.map((r) => r.label), ["Location", "Maximum rent", "Minimum floor area", "Keep saving each month", "Savings goal"], "every requirement from the conversation");
    eq(rows[3].value.includes("no money is moved"), true, "monthly savings is a limit, not a transfer");
    eq(parseProjectLink(new URLSearchParams("project=w1&finding=n1&source=homescreen")), { project: "w1", finding: "n1" }, "project and finding");
    eq(parseProjectLink(new URLSearchParams("project=w1")), { project: "w1", finding: null }, "project only");
    eq(parseProjectLink(new URLSearchParams("finding=n1")), null, "no project, no link");
    eq(parseProjectLink(new URLSearchParams("project=<script>")), null, "an id is a plain id");
    const alerts = ProjectAlert.many([
      { id: "a1", watchId: "w1", findingIds: ["n1"], title: "Sisu", body: "Your Espoo housing search has an update.", reason: "match", createdAt: "2026-11-15T09:00:00Z", pushed: "sent", simulated: true },
      { id: "a2", watchId: "w1", findingIds: [], title: "Sisu", body: "x", reason: "match", createdAt: "2026-11-15T08:00:00Z", pushed: "sent", simulated: false, readAt: "2026-11-15T08:05:00Z" },
      { watchId: "w1" },
    ]);
    eq(alerts.length, 2, "an alert without an id is skipped");
    eq(AlertRules.unread(alerts, []).map((a) => a.id), ["a1"], "read alerts are not shown again");
    eq(AlertRules.unread(alerts, ["a1"]).length, 0, "seen on this device");
    eq(alerts[0].simulated && AlertRules.simulatedLabel === "Simulated for demo", true, "simulated alerts are labelled");
  });

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

void main();
