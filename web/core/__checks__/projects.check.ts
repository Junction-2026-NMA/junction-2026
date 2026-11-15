// Checks for Projects (watches) on the web: the ProjectStore against a fake server shaped like today's backend
// (no pause/resume/PATCH/read routes) and a newer one, and the presenter's wording (titles, status, the honest
// schedule line, findings, the housing effect with its missing items).
// Run: npx tsx web/core/__checks__/projects.check.ts
import { CoachClient } from "@/web/core/CoachClient";
import { PropertyWatch, WatchNotification } from "@/web/core/WatchModels";
import { memoryDefaults } from "@/web/app/Defaults";
import { ProjectStore } from "@/web/app/ProjectStore";
import { FindingText, HousingText, ProjectText } from "@/web/features/Projects/ProjectPresenter";

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

/** A fake server: `routes` says which optional routes exist (a POST-only route answers a GET with 405). */
function fakeServer(routes: { pause?: boolean; read?: boolean } = {}) {
  const calls: string[] = [];
  let watch: Record<string, unknown> = { ...watchJSON };
  let notifications: unknown[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url), "http://x").pathname;
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (method === "GET" && path === "/api/watch") return json({ customerId: "C1", watches: [watch], notifications });
    if (method === "POST" && path === "/api/watch/check") { notifications = [findingJSON]; return json({ customerId: "C1", checked: 1, changesSeen: 1, pagesReread: 1, notifications, problems: [] }); }
    if (method === "POST" && path === "/api/watch/w1/stop") { watch = { ...watch, status: "stopped" }; return json({ watch }); }
    if (routes.pause && path === "/api/watch/w1/pause") {
      if (method === "GET") return new Response("", { status: 405 });
      watch = { ...watch, status: "paused" };
      return json({ watch });
    }
    if (routes.read && path === "/api/watch/w1/read") return method === "GET" ? new Response("", { status: 405 }) : json({ watch, notifications });
    if (path === "/api/health") return json({ ok: true, mock: false, model: { provider: "mock", name: "m" }, services: { watchScheduler: false } });
    return new Response("<!DOCTYPE html><title>404</title>", { status: 404, headers: { "Content-Type": "text/html" } });
  }) as typeof fetch;
  const prober = async (path: string) => (await fetchImpl(path, { method: "GET" })).status;
  return { calls, fetchImpl, prober };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function main() {
  await group("store on today's backend: list, check, findings, unread, controls hidden", async () => {
    const server = fakeServer();
    const defaults = memoryDefaults();
    const store = new ProjectStore("C1", CoachClient.live("", server.fetchImpl), defaults, server.prober);
    await store.load();
    await settle(); await settle();
    const s = store.getSnapshot();
    eq([s.loaded, s.watches.map((w) => w.id), s.error], [true, ["w1"], null], "loaded");
    eq(s.support, { pause: false, resume: false, update: false, read: false }, "optional routes not found: hidden");
    eq(store.hasActive, true, "an active project");
    await store.check();
    eq(store.findings("w1").map((n) => n.id), ["n1"], "check found one");
    eq(ProjectStore.unreadCount(store.getSnapshot()), 1, "one unread");
    eq(server.calls.filter((c) => c === "POST /api/watch/check").length, 1, "one check sent");
    await store.markRead("w1", true);
    eq([ProjectStore.unreadCount(store.getSnapshot()), store.getSnapshot().fresh.w1], [0, ["n1"]], "seen on this device, still marked new");
    eq(server.calls.some((c) => c.startsWith("POST /api/watch/w1/read")), false, "no read call without the route");
    const again = new ProjectStore("C1", CoachClient.live("", server.fetchImpl), defaults, server.prober);
    await again.load();
    eq(ProjectStore.unreadCount(again.getSnapshot()), 0, "seen ids survive a new store");
    eq(await store.pause("w1"), false, "pause on today's backend fails");
    eq(store.getSnapshot().notices.w1, "Pausing is not available on this server yet.", "pause notice");
    eq(await store.stop("w1"), true, "stop");
    eq(store.watch("w1")?.status, "stopped", "stopped");
    eq(store.hasActive, false, "nothing active: polling sends nothing");
  });

  await group("store on a newer backend: routes found by probing, pause works, read sent", async () => {
    const server = fakeServer({ pause: true, read: true });
    const store = new ProjectStore("C1", CoachClient.live("", server.fetchImpl), memoryDefaults(), server.prober);
    await store.load();
    await settle(); await settle();
    eq(store.getSnapshot().support, { pause: true, resume: false, update: false, read: true }, "probed");
    eq(server.calls.filter((c) => c.startsWith("POST")).length, 0, "probing sends no POST");
    eq(await store.pause("w1"), true, "pause");
    eq(store.watch("w1")?.status, "paused", "paused");
    await store.check();
    await store.markRead("w1", true);
    eq(server.calls.includes("POST /api/watch/w1/read"), true, "read sent");
  });

  await group("store on the sample: empty, no checks, no probes", async () => {
    const store = new ProjectStore("C1", CoachClient.sample(), null, async () => { throw new Error("no probe on the sample"); });
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

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

void main();
