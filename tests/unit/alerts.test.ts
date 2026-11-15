// v3: phone notifications for Projects ("as soon as a match is found" only), the demo's simulated change, and reset.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AINO, SANNA, freshState } from "./helpers";
import { approveAction, saveDraft } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { buildWatchDraft } from "@/lib/actions/watch";
import { type ListingSearch, listingQuery } from "@/lib/agent/research/listings";
import { alertBody, alertPayload } from "@/lib/push/payload";
import { type PushSender, setPushSender } from "@/lib/push/send";
import { listSubscriptions, parseSubscription, saveSubscription } from "@/lib/push/subscriptions";
import { auditFor } from "@/lib/store/audit";
import { inSession, newSessionId } from "@/lib/store/session";
import { forgetStoredState, readState, updateState } from "@/lib/store/state";
import type { Listing, PropertyWatch, WatchNotification, WatchRequirements } from "@/lib/types";
import { listNotifications, listWatches, simulatePriceDrop, startWatch, stopWatch } from "@/lib/watch";
import { applyNotifyPolicy, listAlerts } from "@/lib/watch/alerts";
import { monitoringSentence, nextScheduledCheck, schedulerInfo, validateSchedule } from "@/lib/watch/scheduler";
import { simulateAndAlert, simulateLater } from "@/lib/watch/simulate";
import { POST as resetRoute } from "@/app/api/demo/reset/route";

const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/espoo";
const flat = (overrides: Partial<Listing> = {}): Listing => ({ title: "Leppävaarankatu 3", priceEur: 980, rooms: 2, areaM2: 45, district: "Leppävaara", city: "Espoo", availableFrom: null, url: "https://www.vuokraovi.com/kohde/a1", pageUrl: PAGE, ...overrides });
const SMALL = flat({ title: "Tapiontori 1", priceEur: 940, areaM2: 31, url: "https://www.vuokraovi.com/kohde/a2" }); // cheaper, but under 40 m²
const BIG = flat({ title: "Matinkatu 8", priceEur: 1_010, areaM2: 52, district: "Matinkylä", url: "https://www.vuokraovi.com/kohde/a3" });
const searchOf = (listings: Listing[]): ListingSearch => ({ city: "Espoo", topic: null, query: listingQuery("Espoo"), pages: [{ url: PAGE, title: "Vuokraovi", listings, dropped: 0, cacheAgeMs: 0, tookMs: 1, mock: false }], found: [{ url: PAGE, title: "Vuokraovi" }], errors: [], retrievedAt: "2026-11-15T06:00:00.000Z", tookMs: 1, mock: false });
const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/device-1", keys: { p256dh: `B${"A".repeat(86)}`, auth: "A".repeat(22) } };

let sent: { endpoint: string; payload: string }[] = [];
const sender: PushSender = async (subscription, payload) => {
  sent.push({ endpoint: subscription.endpoint, payload });
  return { ok: true };
};

async function startProject(requirements: WatchRequirements = { minAreaM2: 40 }, listings: Listing[] = [SMALL, flat(), BIG], customerId = AINO): Promise<PropertyWatch> {
  const built = buildWatchDraft(customerId, { city: "Espoo", budgetEur: 900, minRooms: null, search: searchOf(listings), preparedBy: "user", requirements });
  assert.ok(built.ok, built.ok ? "" : built.reason);
  const saved = saveDraft(customerId, built.draft);
  assert.ok(saved.ok);
  const approved = approveAction(customerId, saved.action.id, impactOf);
  assert.ok(approved.ok);
  const watch = await startWatch(customerId, approved.action);
  assert.ok(watch);
  return watch;
}

function addFinding(watch: PropertyWatch, verdict: WatchNotification["verdict"]): WatchNotification {
  const note: WatchNotification = { id: crypto.randomUUID(), watchId: watch.id, customerId: AINO, kind: "new_listing", title: "New listing", summary: "", listing: flat(), previousPriceEur: null, budgetEur: 900, underBudgetByEur: 0, leftOverAfterEur: null, balanceAfterEur: null, detectedAt: new Date().toISOString(), detectedBy: "context.dev re-read", simulated: false, facts: [], verdict, checks: [] };
  updateState((state) => ({ ...state, notifications: [note, ...(state.notifications ?? [])] }));
  return note;
}

beforeEach(() => {
  freshState();
  forgetStoredState();
  sent = [];
  setPushSender(sender);
  saveSubscription(SUB);
});
afterEach(() => {
  setPushSender(null);
  delete process.env.CRON_SECRET;
  delete process.env.WATCH_CHECK_EVERY_MINUTES;
});

describe("notification timing: only what the server can keep", () => {
  it("defaults to 'as soon as a match is found' for 14 days and refuses daily summaries and deadlines", () => {
    const now = new Date("2026-11-15T06:30:00.000Z");
    const plain = validateSchedule(undefined, undefined, now);
    assert.ok(plain.ok);
    assert.equal(plain.schedule.notify, "on_match");
    assert.equal(plain.schedule.monitorUntil, "2026-11-29T06:30:00.000Z");
    assert.ok(validateSchedule({ notify: "on_match" }, undefined, now).ok);
    assert.equal(validateSchedule({ notify: "daily_summary", dailyAt: "08:00" }, undefined, now).ok, false);
    assert.equal(validateSchedule({ notify: "deadline", deadlineAt: "2026-11-20T10:00:00Z" }, undefined, now).ok, false);
  });

  it("reports the real cadence: none without CRON_SECRET, once a day by default, or the configured minutes", () => {
    const now = new Date("2026-11-15T06:31:00.000Z");
    assert.deepEqual(schedulerInfo(), { kind: "on-open", checkEveryMinutes: null, dailyTimes: [], deadline: false, push: false, timeZone: "Europe/Helsinki" });
    assert.equal(nextScheduledCheck(now), null);
    assert.match(monitoringSentence(2, true), /does not check on its own while the app is closed/);
    process.env.CRON_SECRET = "test";
    assert.equal(schedulerInfo().checkEveryMinutes, 1440);
    assert.equal(nextScheduledCheck(now), "2026-11-16T06:00:00.000Z");
    process.env.WATCH_CHECK_EVERY_MINUTES = "15";
    assert.equal(schedulerInfo().checkEveryMinutes, 15);
    assert.equal(nextScheduledCheck(now), "2026-11-15T06:45:00.000Z");
    assert.match(monitoringSentence(2, true), /every 15 minutes.*periodic, not continuous/);
  });
});

describe("alerts: one per new match, never twice, never for a stopped project", () => {
  it("alerts a new match once, after the finding is stored, with a payload that holds no money", async () => {
    const watch = await startProject();
    const note = addFinding(watch, "match");
    const alert = await applyNotifyPolicy(AINO, watch, [note], new Date());
    assert.ok(alert);
    assert.equal(alert.pushed, "sent");
    assert.equal(sent.length, 1);
    const payload = JSON.parse(sent[0].payload);
    assert.deepEqual(payload, { title: "Sisu", body: "Your Espoo housing search has an update.", url: `/app?source=homescreen&project=${watch.id}&finding=${note.id}`, tag: watch.id });
    assert.doesNotMatch(JSON.parse(sent[0].payload).body, /€|\d/);
    assert.ok(listNotifications(AINO).find((item) => item.id === note.id)?.alertedAt);
    assert.equal(await applyNotifyPolicy(AINO, watch, [note], new Date()), null);
    assert.equal(sent.length, 1);
  });

  it("saves a listing that needs verification without pushing it", async () => {
    const watch = await startProject();
    const note = addFinding(watch, "needs_verification");
    assert.equal(await applyNotifyPolicy(AINO, watch, [note], new Date()), null);
    assert.equal(sent.length, 0);
    assert.ok(listNotifications(AINO).some((item) => item.id === note.id));
  });

  it("sends nothing once the project is stopped", async () => {
    const watch = await startProject();
    const note = addFinding(watch, "match");
    await stopWatch(AINO, watch.id);
    assert.equal(await applyNotifyPolicy(AINO, watch, [note], new Date()), null);
    assert.equal(sent.length, 0);
    assert.equal(listAlerts(AINO).length, 0);
  });

  it("keeps the alert for the app when phone notifications are off", async () => {
    setPushSender(null); // no VAPID keys in tests: push is off
    const watch = await startProject();
    const alert = await applyNotifyPolicy(AINO, watch, [addFinding(watch, "match")], new Date());
    assert.equal(alert?.pushed, "push-off");
    assert.equal(listAlerts(AINO).length, 1);
  });

  it("only accepts subscriptions on known push services", () => {
    assert.ok(parseSubscription(SUB).ok);
    assert.equal(parseSubscription({ ...SUB, endpoint: "https://evil.example/push" }).ok, false);
    assert.equal(parseSubscription({ ...SUB, endpoint: "http://fcm.googleapis.com/x" }).ok, false);
  });

  it("words the body without money or listing details", () => {
    assert.equal(alertBody({ city: "Espoo", topic: null }, "match"), "Your Espoo housing search has an update.");
    assert.equal(alertBody({ city: null, topic: "iPhone 15 under 450" }, "match"), "Your price watch has an update.");
    assert.equal(alertPayload({ watchId: "w1", findingIds: [], body: "x" }).url, "/app?source=homescreen&project=w1");
  });
});

describe("the simulated change: the project's real requirements, the real path, labelled", () => {
  it("drops the listing that would then meet every requirement, not the cheapest one", async () => {
    const watch = await startProject({ minAreaM2: 40 });
    const result = await simulateAndAlert(AINO, watch.id);
    assert.ok(result.ok);
    assert.equal(result.notification.listing.title, "Leppävaarankatu 3"); // SMALL is cheaper but 31 m² < 40 m²
    assert.equal(result.notification.verdict, "match");
    assert.equal(result.notification.simulated, true);
    assert.ok(result.notification.listing.priceEur <= 900);
    assert.equal(result.alert?.simulated, true);
    assert.equal(sent.length, 1);
    const change = (listWatches(AINO)[0].changes ?? [])[0];
    assert.equal(change.simulated, true);
    assert.equal(change.before?.priceEur, 980);
    assert.equal(change.after.priceEur, result.notification.listing.priceEur);
    assert.equal(change.findingId, result.notification.id);
    assert.ok(auditFor(AINO).events.some((event) => event.type === "watch_notified" && event.detail.startsWith("SIMULATED for demo")));
  });

  it("judges with the one Project rule, savings goal included (CUST02003 keeping €100 a month)", async () => {
    const watch = await startProject({ minAreaM2: 40, monthlySavingsEur: 100 }, [SMALL, flat(), BIG], SANNA);
    const result = await simulateAndAlert(SANNA, watch.id);
    assert.ok(result.ok, result.ok ? "" : result.reason);
    assert.equal(result.notification.verdict, "match");
    assert.ok(result.notification.checks?.some((check) => check.requirement === "Savings goal" && check.status === "met"));
  });

  it("refuses when no listing could meet the requirements", async () => {
    const watch = await startProject({ minAreaM2: 80 });
    const result = simulatePriceDrop(AINO, watch.id);
    assert.equal(result.ok, false);
    assert.equal(simulateLater(AINO, watch.id, 5).ok, false);
  });

  it("with a delay, runs on the server after the answer and notifies then", async () => {
    const watch = await startProject();
    const scheduled = simulateLater(AINO, watch.id, 1);
    assert.ok(scheduled.ok);
    assert.equal(listNotifications(AINO).length, 0);
    await new Promise((resolve) => setTimeout(resolve, 1_400));
    assert.equal(listNotifications(AINO).length, 1);
    assert.equal(sent.length, 1);
  });
});

describe("reset clears only the caller's own visitor state", () => {
  it("clears this visitor's projects, findings and alerts, keeps their phone subscription, and leaves others alone", async () => {
    process.env.SISU_SESSIONS = "visitor";
    try {
      const mine = newSessionId();
      const theirs = newSessionId();
      for (const session of [mine, theirs]) {
        await inSession(session, async () => {
          saveSubscription(SUB);
          const watch = await startProject();
          await simulateAndAlert(AINO, watch.id);
        });
      }
      const response = await resetRoute(new Request("http://localhost/api/demo/reset", { method: "POST", headers: { "x-sisu-session": mine } }));
      assert.equal(response.status, 200);
      inSession(mine, () => {
        assert.equal(listWatches(AINO).length, 0);
        assert.equal(listNotifications(AINO).length, 0);
        assert.equal(listAlerts(AINO).length, 0);
        assert.equal(listSubscriptions().length, 1);
      });
      inSession(theirs, () => {
        assert.equal(listWatches(AINO).length, 1);
        assert.equal(listAlerts(AINO).length, 1);
        assert.equal((readState().notifications ?? []).length, 1);
      });
    } finally {
      delete process.env.SISU_SESSIONS;
    }
  });
});
