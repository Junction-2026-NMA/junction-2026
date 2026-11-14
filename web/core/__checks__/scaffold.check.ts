// Checks for the shared scaffold of the Sisu rework: the tab names, the preferences, the app model's new seams and
// the watch client (models, requests, the sample's answers, a missing route on today's backend).
// Run: npx tsx web/core/__checks__/scaffold.check.ts
import { FixtureAPI, SisuError } from "@/web/core/API";
import { CoachClient } from "@/web/core/CoachClient";
import { CoachEndpoints } from "@/web/core/CoachEndpoints";
import { PropertyWatch, WatchCheck, WatchList, WatchNotification, WatchPlan, isWatchKind } from "@/web/core/WatchModels";
import { AppTab } from "@/web/app/AppTypes";
import { AppPrefs } from "@/web/app/AppPrefs";
import { AppModel } from "@/web/app/AppModel";
import { CoachStore } from "@/web/app/CoachStore";
import { Keys } from "@/web/app/AppState";
import { memoryDefaults } from "@/web/app/Defaults";
import { LaunchOptions } from "@/web/app/LaunchOptions";

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
async function rejection(work: () => Promise<unknown>): Promise<unknown> {
  try { await work(); return null; } catch (error) { return error instanceof SisuError ? error.info : String(error); }
}

async function main() {
  await group("tabs: Sisu replaces Talk; old names still open it", () => {
    eq(AppTab.allCases, ["today", "sisu", "path"], "the three tabs");
    eq(["sisu", "Talk", "ASK", "today", "path", "jars", null].map((a) => AppTab.fromArgument(a)), ["sisu", "sisu", "sisu", "today", "path", null, null], "fromArgument");
  });

  await group("prefs: defaults, defensive decoding, merge keeps valid values", () => {
    eq(AppPrefs.decode(null), { language: "auto", voiceId: null, speakReplies: true, bufferEur: null }, "nothing stored");
    eq(AppPrefs.decode([1, 2]), AppPrefs.defaults, "not an object");
    eq(AppPrefs.decode({ language: "fi", voiceId: " abc ", speakReplies: false, bufferEur: 300 }), { language: "fi", voiceId: "abc", speakReplies: false, bufferEur: 300 }, "a full set");
    eq(AppPrefs.decode({ language: "<script>", voiceId: 5, speakReplies: "yes", bufferEur: -1 }), AppPrefs.defaults, "wrong values take the defaults");
    const fi = AppPrefs.decode({ language: "fi", bufferEur: 200 });
    eq(AppPrefs.merge(fi, { language: "nope!" }).language, "fi", "an invalid change keeps the current value");
    eq(AppPrefs.merge(fi, { bufferEur: null }).bufferEur, null, "null clears the buffer");
    eq(AppPrefs.merge(fi, { voiceId: "v1" }), { language: "fi", voiceId: "v1", speakReplies: true, bufferEur: 200 }, "one field changes");
  });

  await group("app model: askSisu, drawer, project, prefs", () => {
    const defaults = memoryDefaults();
    defaults.setJSON(Keys.prefs, { language: "sv", bufferEur: "lots" });
    const model = new AppModel(LaunchOptions.parse(new URLSearchParams("sample=1&tab=today"), defaults));
    eq([model.getSnapshot().tab, model.getSnapshot().prefs], ["today", { language: "sv", voiceId: null, speakReplies: true, bufferEur: null }], "launch tab and stored prefs");
    model.setHistoryOpen(true);
    model.setOpenProjectId("w1");
    model.setConversationShown(true);
    eq([model.getSnapshot().historyOpen, model.getSnapshot().openProjectId], [true, "w1"], "drawer and project");
    model.askSisu("Will my money last until payday?");
    const s = model.getSnapshot();
    eq([s.tab, s.conversationShown, s.historyOpen, s.openProjectId], ["sisu", false, false, null], "askSisu clears what covers the conversation");
    model.setPrefs({ language: "fi", speakReplies: false });
    eq(defaults.json(Keys.prefs), { language: "fi", voiceId: null, speakReplies: false, bufferEur: null }, "prefs stored under sisu.prefs");
    model.switchCustomer();
    eq([model.getSnapshot().tab, model.getSnapshot().historyOpen], ["sisu", false], "switching customer lands on Sisu");
  });

  await group("coach store: the language applies to the session now and to the next one", async () => {
    FixtureAPI.setDefaultSource(async () => null);
    const store = new CoachStore();
    store.setLanguage("fi");
    await store.configure("CUST04974", null);
    const first = store.session;
    eq(first?.language, "fi", "a new session takes the language");
    store.setLanguage("auto");
    eq([store.session === first, first?.language], [true, "auto"], "a change keeps the session (the conversation stays)");
    store.clear();
  });

  await group("watch models: tolerant decoding", () => {
    const list = WatchList.decode({
      customerId: "CUST1",
      watches: [{ id: "w1", status: "paused", budgetEur: "900", pages: [{ url: "https://x", listings: [{ title: "A", priceEur: 800 }, 3] }], problems: ["p", 4] }, { status: "active" }, "x"],
      notifications: [{ id: "n1", watchId: "w1", read: true, housingEffect: { rentEur: 800 }, facts: [{ id: "f", label: "Rent", value: 800 }, { label: 1 }] }],
    });
    eq(list.watches.length, 1, "a watch without an id is skipped");
    const w = list.watches[0];
    eq([w.status, w.budgetEur, w.pages[0].listings.length, w.problems, w.nextCheckAt], ["paused", undefined, 1, ["p"], undefined], "wrong types dropped, arrays kept");
    eq([list.notifications[0].read, list.notifications[0].housingEffect, list.notifications[0].facts.length], [true, { rentEur: 800 }, 1], "future fields read");
    eq(WatchList.decode({}), { customerId: undefined, watches: [], notifications: [] }, "an empty object is an empty list");
    eq(WatchCheck.decode({ checked: 2 }).notifications, [], "a check without findings");
    eq(WatchPlan.decode({ city: "Espoo", budgetEur: 1100, urls: ["u", 1] }), { city: "Espoo", topic: undefined, priceUnit: undefined, budgetEur: 1100, minRooms: undefined, urls: ["u"], seen: [], goal: undefined, requirements: undefined }, "a plan");
    eq([PropertyWatch.decode({ id: "" }), WatchNotification.decode(null), WatchPlan.decode("x")], [null, null, null], "no id, not an object");
    let threw = false;
    try { WatchList.decode([]); } catch { threw = true; }
    eq(threw, true, "a body that is not an object throws (invalidResponse in the client)");
    eq([isWatchKind("property_watch"), isWatchKind("price_watch"), isWatchKind("switch_contract"), isWatchKind(null)], [true, true, false, false], "watch kinds");
  });

  await group("watch requests: paths, methods, bodies", () => {
    const r = (req: { method: string; url: string; body?: unknown }) => [req.method, req.url, req.body ?? null];
    eq(r(CoachEndpoints.watchList("", "C1")), ["GET", "/api/watch?customerId=C1", null], "list");
    eq(r(CoachEndpoints.watchCheck("", "C1")), ["POST", "/api/watch/check", '{"customerId":"C1"}'], "check");
    eq(r(CoachEndpoints.watchCheck("", "C1", true)), ["POST", "/api/watch/check", '{"customerId":"C1","runNow":true}'], "check now");
    eq(r(CoachEndpoints.watchStop("", "w/1", "C1")), ["POST", "/api/watch/w%2F1/stop", '{"customerId":"C1"}'], "stop (id escaped)");
    eq(r(CoachEndpoints.watchPause("", "w1", "C1"))[1], "/api/watch/w1/pause", "pause");
    eq(r(CoachEndpoints.watchResume("", "w1", "C1"))[1], "/api/watch/w1/resume", "resume");
    eq(r(CoachEndpoints.watchUpdate("", "w1", "C1", { maxRentEur: 1100 })), ["PATCH", "/api/watch/w1", '{"customerId":"C1","requirements":{"maxRentEur":1100}}'], "update");
    eq(r(CoachEndpoints.watchMarkRead("", "w1", "C1"))[1], "/api/watch/w1/read", "read");
    eq(r(CoachEndpoints.simulateDrop("", "w1", "C1"))[1], "/api/watch/w1/simulate-drop", "simulate drop");
  });

  await group("watch client: the sample has none; a missing route is a SisuError", async () => {
    const sample = CoachClient.sample(0, async () => null);
    eq(await sample.watchList("CUST04974"), { customerId: "CUST04974", watches: [], notifications: [] }, "sample: an empty list");
    eq(await rejection(() => sample.watchStop("w1", "CUST04974")), { kind: "notImplemented", what: "Stopping a watch needs the live server" }, "sample: stop refused");
    eq(await rejection(() => sample.watchCheck("CUST04974")), { kind: "notImplemented", what: "Checking watches needs the live server" }, "sample: check refused");
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.startsWith("/api/watch?")) return new Response('{"customerId":"C1","watches":[{"id":"w1","status":"active"}],"notifications":[]}', { status: 200 });
      if (path.endsWith("/stop")) return new Response('{"watch":{"id":"w1","status":"stopped"}}', { status: 200 });
      return new Response("<!DOCTYPE html><title>404</title>", { status: 404, headers: { "Content-Type": "text/html" } });
    }) as typeof fetch;
    const live = CoachClient.live("", fetchImpl);
    eq((await live.watchList("C1")).watches.map((w) => w.status), ["active"], "live: list");
    eq((await live.watchStop("w1", "C1")).watch?.status, "stopped", "live: stop");
    eq(await rejection(() => live.watchPause("w1", "C1")), { kind: "server", status: 404, message: "" }, "live: pause on today's backend is a 404");
    eq(await rejection(() => live.watchMarkRead("w1", "C1")), { kind: "server", status: 404, message: "" }, "live: read on today's backend is a 404");
  });

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

void main();
