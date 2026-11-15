// v2 push: background research, Context.dev webhooks and phone notifications.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AINO, freshState, stubFetch } from "./helpers";
import { approveAction, saveDraft } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { buildWatchDraft } from "@/lib/actions/watch";
import { listingQuery } from "@/lib/agent/research/listings";
import type { ListingSearch } from "@/lib/agent/research/listings";
import { settleBackground } from "@/lib/background";
import { type PushSender, setPushSender } from "@/lib/push/send";
import { inSession, newSessionId } from "@/lib/store/session";
import { readState } from "@/lib/store/state";
import type { AgentAction, Listing, PropertyWatch } from "@/lib/types";
import { checkWatches, listNotifications, listWatches } from "@/lib/watch";
import { pauseWatch } from "@/lib/watch/project";
import { receiveWebhook } from "@/lib/watch/receive";
import { setSimulationClock } from "@/lib/watch/simulate";
import { decryptRef, encryptRef, signPayload, verifySignature } from "@/lib/watch/webhook";
import { POST as approveRoute } from "@/app/api/actions/[id]/approve/route";
import { POST as simulateRoute } from "@/app/api/watch/[id]/simulate-drop/route";
import { GET as watchRoute } from "@/app/api/watch/route";
import { POST as subscribeRoute } from "@/app/api/push/subscribe/route";

const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/espoo";
const flat = (overrides: Partial<Listing> = {}): Listing => ({ title: "Tapiontori 3", priceEur: 919, rooms: 1, areaM2: 37, district: "Tapiola", availableFrom: null, url: "https://www.vuokraovi.com/kohde/e1", pageUrl: PAGE, ...overrides });
const OTHER = flat({ title: "Leppävaarankatu 9", priceEur: 1_239, rooms: 3, url: "https://www.vuokraovi.com/kohde/e2" });
const search = (listings: Listing[]): ListingSearch => ({ city: "Espoo", topic: null, query: listingQuery("Espoo"), pages: [{ url: PAGE, title: "Vuokraovi", listings, dropped: 0, cacheAgeMs: 0, tookMs: 1, mock: false }], found: [{ url: PAGE, title: "Vuokraovi" }], errors: [], retrievedAt: "2026-11-15T10:00:00.000Z", tookMs: 1, mock: false });
const SUBSCRIPTION = { endpoint: "https://web.push.apple.com/QGx-test", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXy7ZNRS8ZW1nUdmNfbxAfr6Rw1eZ0YC3o", auth: "tBHItJI5svbpez7KI4CCXg" } };

function prepared(): AgentAction {
  const built = buildWatchDraft(AINO, { city: "Espoo", budgetEur: 900, minRooms: null, search: search([flat(), OTHER]), preparedBy: "sisu-agent" });
  assert.ok(built.ok);
  const saved = saveDraft(AINO, built.draft);
  assert.ok(saved.ok);
  return saved.action;
}
const post = (path: string, session: string, body: unknown) => new Request(`https://sisu-api.test${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-sisu-session": session, "x-forwarded-for": "198.51.100.9" }, body: JSON.stringify(body) });
const get = (path: string, session: string) => new Request(`https://sisu-api.test${path}`, { headers: { "x-sisu-session": session, "x-forwarded-for": "198.51.100.9" } });

describe("v2 push: background research, webhooks and notifications", () => {
  const keys = ["MODEL_PROVIDER", "CONTEXT_DEV_API_KEY", "SISU_SESSIONS", "SISU_WEBHOOK_KEY", "SISU_PUBLIC_API_ORIGIN", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let restore = () => {};
  let changes: Record<string, unknown[]> = {};
  let pageNow: Partial<Listing>[] = [];
  let pushes: { endpoint: string; payload: Record<string, unknown> }[] = [];
  let session = "";

  beforeEach(() => {
    freshState();
    Object.assign(process.env, { MODEL_PROVIDER: "nvidia", CONTEXT_DEV_API_KEY: "test", SISU_SESSIONS: "visitor", SISU_WEBHOOK_KEY: "test-webhook-key", SISU_PUBLIC_API_ORIGIN: "https://sisu-api.example", VAPID_PUBLIC_KEY: "BPublicKeyForTests", VAPID_PRIVATE_KEY: "private-key-for-tests" });
    changes = {};
    pageNow = [flat(), OTHER];
    pushes = [];
    session = newSessionId();
    let created = 0;
    restore = stubFetch((url, init) => {
      const { pathname, searchParams } = new URL(url);
      const method = init?.method ?? "GET";
      if (pathname === "/v1/web/scrape") return Response.json({ json: { success: true, data: { listings: pageNow } }, cache_metadata: { age_ms: 0 } });
      if (pathname === "/v1/monitors" && method === "POST") return Response.json({ id: `mon_${++created}`, status: "active", webhook: { secret: `whsec_${created}` } }, { status: 201 });
      const id = pathname.split("/")[3];
      if (pathname.endsWith("/changes")) return Response.json({ data: (changes[id] ?? []).filter((change) => (change as { detected_at: string }).detected_at >= (searchParams.get("since") ?? "")) });
      if (pathname.endsWith("/run")) return Response.json({ run_id: "run_now" }, { status: 202 });
      if (method === "DELETE") return new Response(null, { status: 204 });
      return Response.json({ id, status: "active", last_run_at: null, next_run_at: "2026-11-15T12:15:00.000Z", last_error: null, baseline: {} });
    });
    const sender: PushSender = async (subscription, payload) => {
      pushes.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
      return { statusCode: 201 };
    };
    setPushSender(sender);
    setSimulationClock(0);
  });
  afterEach(() => {
    restore();
    setPushSender(null);
    setSimulationClock(1_000);
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  // Approves through the route (background start), subscribes this phone, and waits for the background job.
  async function startProject(): Promise<PropertyWatch> {
    const action = inSession(session, () => prepared());
    inSession(session, () => approveAction(AINO, action.id, impactOf)); // decided here; the route is tested below
    const sub = await subscribeRoute(post("/api/push/subscribe", session, { customerId: AINO, subscription: SUBSCRIPTION }));
    assert.equal(sub.status, 200);
    const { startWatch } = await import("@/lib/watch");
    const approved = inSession(session, () => readState().actions.find((a) => a.id === action.id))!;
    const watch = (await inSession(session, () => startWatch(AINO, approved, new Date(), { background: true })))!;
    assert.equal(watch.phase, "researching");
    const { finishStart } = await import("@/lib/watch/start");
    await inSession(session, () => finishStart(AINO, watch.id, {}));
    return inSession(session, () => listWatches(AINO)[0]);
  }

  async function deliver(watch: PropertyWatch, id: string, event = "change.detected", monitorId = "mon_1", at = new Date()) {
    const ref = new URL(webhookUrlOf(watch)).searchParams.get("ref");
    const rawBody = JSON.stringify({ event, id, created_at: at.toISOString(), data: { change: { monitor_id: monitorId, title: "Rent lowered", summary: "One flat is cheaper", detected_at: at.toISOString() } } });
    const t = Math.floor(at.getTime() / 1000);
    const result = await receiveWebhook({ ref, signature: `t=${t},v1=${signPayload("whsec_1", t, rawBody)}`, deliveryId: id, event, rawBody }, at);
    await settleBackground();
    return result;
  }
  const webhookUrlOf = (watch: PropertyWatch) => `https://sisu-api.example/api/watch/webhook?ref=${encryptRef({ sessionId: session, customerId: AINO, watchId: watch.id })}`;

  it("the approve route answers at once with the watch researching, and the background job makes it ready and pushes once", async () => {
    const action = inSession(session, () => prepared());
    await subscribeRoute(post("/api/push/subscribe", session, { customerId: AINO, subscription: SUBSCRIPTION }));
    const response = await approveRoute(post(`/api/actions/${action.id}/approve`, session, { customerId: AINO, confirm: true }), { params: Promise.resolve({ id: action.id }) });
    const body = (await response.json()) as { watch: PropertyWatch };
    assert.equal(body.watch.phase, "researching");
    await settleBackground();
    const watch = inSession(session, () => listWatches(AINO)[0]);
    assert.deepEqual([watch.phase, watch.mode, watch.webhooks, watch.pages[0].monitorId], ["initial_ready", "monitor", true, "mon_1"]);
    assert.ok(watch.initialReadyAt && watch.nextReviewAt);
    assert.equal(pushes.length, 1);
    assert.deepEqual(pushes[0].payload, { title: "Sisu", body: "Your Espoo housing search: first results are ready.", url: `/app?source=homescreen&customer=${AINO}&project=${watch.id}`, tag: watch.id });
    // A later check moves it on to ongoing monitoring.
    await inSession(session, () => checkWatches(AINO, { now: new Date(Date.now() + 60_000) }));
    assert.equal(inSession(session, () => listWatches(AINO)[0].phase), "monitoring");
  });

  it("the subscription and the webhook secrets stay on the server: never in an API answer", async () => {
    const watch = await startProject();
    assert.equal(inSession(session, () => readState().push?.[0].endpoint), SUBSCRIPTION.endpoint);
    assert.equal(watch.pages[0].webhookSecret, "whsec_1");
    const listed = await (await watchRoute(get(`/api/watch?customerId=${AINO}`, session))).text();
    assert.ok(!listed.includes("whsec_"), "no webhook secret");
    assert.ok(!listed.includes(SUBSCRIPTION.endpoint) && !listed.includes(SUBSCRIPTION.keys.auth), "no subscription");
    assert.equal((await subscribeRoute(post("/api/push/subscribe", session, { customerId: AINO, subscription: { endpoint: "http://insecure.example", keys: SUBSCRIPTION.keys } }))).status, 400);
  });

  it("the webhook ref round-trips and a tampered or foreign one is refused", () => {
    const ref = { sessionId: session, customerId: AINO, watchId: "w1" };
    const token = encryptRef(ref)!;
    assert.deepEqual(decryptRef(token), ref);
    assert.ok(!token.includes(session), "the session id is not readable in the URL");
    const flipped = token.slice(0, 20) + (token[20] === "A" ? "B" : "A") + token.slice(21);
    assert.equal(decryptRef(flipped), null);
    process.env.SISU_WEBHOOK_KEY = "another-key";
    assert.equal(decryptRef(token), null);
  });

  it("a signature is valid only for this body and secret, within five minutes", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const t = Math.floor(now.getTime() / 1000);
    const body = '{"event":"run.completed","id":"evt_1"}';
    const header = `t=${t},v1=${signPayload("whsec_a", t, body)}`;
    assert.ok(verifySignature(header, body, ["whsec_b", "whsec_a"], now));
    assert.ok(!verifySignature(header, `${body} `, ["whsec_a"], now), "another body");
    assert.ok(!verifySignature(header, body, ["whsec_b"], now), "another secret");
    assert.ok(!verifySignature(header, body, ["whsec_a"], new Date(now.getTime() + 6 * 60_000)), "stale");
    assert.ok(!verifySignature("garbage", body, ["whsec_a"], now));
  });

  it("a webhook makes the finding and pushes it once; a retried delivery is a duplicate; a bad signature is refused", async () => {
    const watch = await startProject();
    pushes = [];
    changes.mon_1 = [{ id: "chg_1", title: "Rent lowered", summary: "", detected_at: new Date(Date.now() + 1_000).toISOString(), url: PAGE }];
    pageNow = [flat({ priceEur: 880 }), OTHER];
    const first = await deliver(watch, "evt_1", "change.detected", "mon_1", new Date(Date.now() + 2_000));
    assert.equal(first.status, 202);
    const notes = inSession(session, () => listNotifications(AINO));
    assert.equal(notes.length, 1);
    assert.ok(notes[0].pushedAt);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].payload.body, "Your Espoo housing search has an update.");
    assert.ok(!/880|900|€/.test(JSON.stringify(pushes[0].payload)), "nothing financial in the push");
    assert.equal(inSession(session, () => listWatches(AINO)[0].pages[0].lastChange?.title), "Rent lowered");
    assert.equal((await deliver(watch, "evt_1")).body.duplicate, true);
    // A new delivery with nothing new: checked, nothing pushed again.
    assert.equal((await deliver(watch, "evt_2", "run.completed")).status, 202);
    assert.equal(pushes.length, 1);
    const bad = await receiveWebhook({ ref: new URL(webhookUrlOf(watch)).searchParams.get("ref"), signature: "t=1,v1=00", deliveryId: "evt_3", event: "run.completed", rawBody: "{}" });
    assert.equal(bad.status, 401);
  });

  it("a paused project ignores webhooks and scheduled checks", async () => {
    const watch = await startProject();
    await inSession(session, () => pauseWatch(AINO, watch.id));
    const result = await deliver(watch, "evt_p");
    assert.deepEqual([result.status, result.body.ignored], [200, "paused"]);
    assert.equal((await inSession(session, () => checkWatches(AINO, { trigger: "schedule" }))).checked, 0);
    assert.equal(inSession(session, () => listWatches(AINO)[0].pages.every((page) => !page.monitorId && !page.webhookSecret)), true);
  });

  it("a failed check is counted and retried with backoff, and a clean one resets it", async () => {
    await startProject();
    restore();
    restore = stubFetch(() => Response.json({ error: "down" }, { status: 500 }));
    await inSession(session, () => checkWatches(AINO, { trigger: "schedule" }));
    const failing = inSession(session, () => listWatches(AINO)[0]);
    assert.equal(failing.failedChecks, 1);
    assert.ok(failing.lastFailure?.message && failing.retryAt);
    assert.ok(Date.parse(failing.retryAt!) - Date.parse(failing.lastFailure!.at) === 60_000);
    await inSession(session, () => checkWatches(AINO, { trigger: "schedule" }));
    const twice = inSession(session, () => listWatches(AINO)[0]);
    assert.equal(twice.failedChecks, 2);
    assert.equal(Date.parse(twice.retryAt!) - Date.parse(twice.lastFailure!.at), 5 * 60_000);
    restore();
    const asked: string[] = [];
    restore = stubFetch((url, init) => {
      asked.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
      if (url.endsWith("/run")) return Response.json({ run_id: "r" }, { status: 202 });
      return url.includes("/changes") ? Response.json({ data: [] }) : Response.json({ id: "mon_1", status: "active", last_error: null, next_run_at: null });
    });
    // The retry is due: the monitors are asked to run now, and the clean check resets the count.
    await inSession(session, () => checkWatches(AINO, { trigger: "schedule", now: new Date(Date.parse(twice.retryAt!) + 1_000) }));
    assert.ok(asked.includes("POST /v1/monitors/mon_1/run"));
    const clean = inSession(session, () => listWatches(AINO)[0]);
    assert.deepEqual([clean.failedChecks, clean.lastFailure, clean.retryAt], [0, null, null]);
  });

  it("the delayed demo change records a finding labelled simulated and pushes it, unless paused first", async () => {
    const watch = await startProject();
    pushes = [];
    const response = await simulateRoute(post(`/api/watch/${watch.id}/simulate-drop`, session, { customerId: AINO, delaySeconds: 30 }), { params: Promise.resolve({ id: watch.id }) });
    assert.equal(response.status, 202);
    await settleBackground();
    const [note] = inSession(session, () => listNotifications(AINO));
    assert.equal(note.simulated, true);
    assert.equal(inSession(session, () => listWatches(AINO)[0].pages[0].lastChange?.simulated), true);
    assert.equal(pushes.length, 1);
    assert.equal((await simulateRoute(post(`/api/watch/${watch.id}/simulate-drop`, session, { customerId: AINO, delaySeconds: 999 }), { params: Promise.resolve({ id: watch.id }) })).status, 400);
    await inSession(session, () => pauseWatch(AINO, watch.id));
    assert.equal((await simulateRoute(post(`/api/watch/${watch.id}/simulate-drop`, session, { customerId: AINO, delaySeconds: 5 }), { params: Promise.resolve({ id: watch.id }) })).status, 409);
  });
});
