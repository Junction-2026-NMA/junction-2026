// Sisu knows what its watches are doing and what they found, so "did my watch find anything?" gets an answer.
// Regression: live on 14 Nov, after a watch had found a flat, Sisu answered "I don't have a tool to check".
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AINO, collect, freshState, ofType, scriptedModel } from "./helpers";
import { approveAction, saveDraft } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { buildWatchDraft } from "@/lib/actions/watch";
import { setMockScript } from "@/lib/agent/mock";
import { runTurn } from "@/lib/agent/orchestrator";
import { type ListingSearch, listingQuery } from "@/lib/agent/research/listings";
import type { Listing, PropertyWatch } from "@/lib/types";
import { listNotifications, simulatePriceDrop, startWatch } from "@/lib/watch";
import { inSession, newSessionId } from "@/lib/store/session";
import { GET as demoDrop } from "@/app/api/watch/demo-drop/route";
import { updateState } from "@/lib/store/state";
import { getProject } from "@/lib/watch/project";
import { fits, ruleFor } from "@/lib/watch/detect";

const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/helsinki";
const flat = (title: string, priceEur: number, id: string): Listing => ({ title, priceEur, rooms: 1, areaM2: 37, district: "Taka-Töölö", availableFrom: null, url: `https://www.vuokraovi.com/kohde/${id}`, pageUrl: PAGE });
const search: ListingSearch = { city: "Helsinki", topic: null, query: listingQuery("Helsinki"), pages: [{ url: PAGE, title: "Vuokraovi", listings: [flat("Sallinkatu 2", 919, "hp8899"), flat("Kustinpolku 9", 1_239, "hq3786")], dropped: 0, cacheAgeMs: 0, tookMs: 1, mock: false }], found: [{ url: PAGE, title: "Vuokraovi" }], errors: [], retrievedAt: "2026-11-14T10:00:00.000Z", tookMs: 1, mock: false };

async function watching(budgetEur = 900, minRooms: number | null = null, listings = search.pages[0].listings, requirements = {}): Promise<PropertyWatch> {
  const selected = { ...search, pages: [{ ...search.pages[0], listings }] };
  const built = buildWatchDraft(AINO, { city: "Helsinki", budgetEur, minRooms, search: selected, preparedBy: "sisu-agent", requirements });
  assert.ok(built.ok, built.ok ? "" : built.reason);
  const saved = saveDraft(AINO, built.draft);
  assert.ok(saved.ok);
  const approved = approveAction(AINO, saved.action.id, impactOf);
  assert.ok(approved.ok);
  const watch = await startWatch(AINO, approved.action);
  assert.ok(watch);
  return watch;
}
async function ask(answer: string, question = "Tell me about my saved searches.") {
  const model = scriptedModel([answer]);
  setMockScript(model.script);
  const events = await collect(runTurn({ customerId: AINO, text: question, mode: "text" }));
  setMockScript(null);
  return { system: String(model.seen[0].messages[0].content), events };
}

describe("watches: the demo link that triggers a simulated drop", () => {
  beforeEach(() => void freshState());
  const open = (session?: string, query = "") => demoDrop(new Request(`http://test.local/api/watch/demo-drop${query}`, { headers: { "x-forwarded-for": "198.51.100.9", ...(session ? { "x-sisu-session": session } : {}) } }));

  it("says so when no watch is running in this browser", async () => {
    const response = await open();
    assert.equal(response.status, 404);
    assert.match(await response.text(), /No watch is running in this browser/);
  });

  it("drops the running watch once, as a labelled simulation, and only for the visitor who opened it", async () => {
    const [anna, ben] = [newSessionId(), newSessionId()];
    const watch = await inSession(anna, () => watching());
    const first = await open(anna);
    assert.equal(first.status, 200);
    assert.match(first.headers.get("content-type") ?? "", /text\/html/);
    const html = await first.text();
    assert.match(html, /Simulated monitoring update/);
    assert.match(html, /Simulated for the demo/);
    const notes = inSession(anna, () => listNotifications(AINO));
    assert.equal(notes.length, 1);
    assert.ok(notes[0].simulated && notes[0].watchId === watch.id);
    await open(anna); // opening it twice does not stack notifications
    assert.equal(inSession(anna, () => listNotifications(AINO)).length, 1);
    assert.equal((await open(ben)).status, 404, "another visitor has no watch to drop");
  });

  it("the exact housing demo saves a matching simulated finding to the same approved project", async () => {
    const session = newSessionId();
    const watch = await inSession(session, () => watching(700, 3));
    const query = `?customerId=${AINO}&watchId=${watch.id}`;
    assert.equal((await open(session, query)).status, 200);
    const project = inSession(session, () => getProject(AINO, watch.id));
    assert.ok(project);
    const [finding] = project.notifications;
    assert.deepEqual([project.watch.city, project.watch.budgetEur, project.watch.minRooms], ["Helsinki", 700, 3]);
    assert.equal(finding.watchId, watch.id);
    assert.ok(finding.simulated && finding.listing.priceEur <= 700 && finding.listing.rooms! >= 3 && finding.listing.areaM2! > 0);
    assert.equal(finding.listing.city, "Helsinki");
    assert.match(finding.listing.title, /Simulated/);
    assert.match(finding.summary, /Simulated monitoring update/);
    assert.match(finding.summary, /Source reference: vuokraovi\.com/);
    assert.equal(finding.listing.url, PAGE, "a synthetic home's source is a reference page, not an invented listing URL");
    assert.equal(project.currentMatches.length, 0, "a simulated finding never becomes a live page reading");
    assert.equal(inSession(session, () => listNotifications(AINO))[0].id, finding.id);
    await open(session, query);
    assert.equal(inSession(session, () => getProject(AINO, watch.id))!.notifications.length, 1, "the same recording trigger is repeatable without duplicates");
  });

  it("selects a real candidate meeting all requirements instead of the cheapest disqualified home", async () => {
    const listings = [
      { ...flat("Wrong district", 750, "wrong"), rooms: 3, district: "Kallio", city: "Helsinki" },
      { ...flat("Wrong city", 760, "other-city"), rooms: 3, district: "Kontula", city: "Vantaa" },
      { ...flat("Matching home", 990, "match"), rooms: 3, district: "Kontula", city: "Helsinki", areaM2: 71 },
    ];
    const watch = await watching(700, 3, listings, { districts: ["Kontula"] });
    const result = simulatePriceDrop(AINO, watch.id);
    assert.ok(result.ok);
    assert.equal(result.notification.listing.title, "Matching home");
    assert.ok(fits(result.notification.listing, ruleFor(watch)));
    assert.equal(result.notification.listing.city, "Helsinki");
    assert.equal(result.notification.previousPriceEur, 990);
    assert.deepEqual(getProject(AINO, watch.id)!.watch.pages[0].listings, listings, "the real source data remains intact");
  });

  it("the synthetic fallback respects saved district, move date and deposit limits", async () => {
    const watch = await watching(700, 3, search.pages[0].listings, { districts: ["Kontula"], moveBy: "2026-12-01", maxDepositEur: 500 });
    const result = simulatePriceDrop(AINO, watch.id);
    assert.ok(result.ok);
    assert.ok(fits(result.notification.listing, ruleFor(watch)));
    assert.deepEqual([result.notification.listing.district, result.notification.listing.availableFrom, result.notification.listing.depositEur], ["Kontula", "2026-12-01", 500]);
  });

  it("an explicit watch id never silently triggers another project", async () => {
    const session = newSessionId();
    await inSession(session, () => watching());
    const response = await open(session, "?watchId=missing-project");
    assert.equal(response.status, 404);
    assert.equal(inSession(session, () => listNotifications(AINO)).length, 0);
  });
});

describe("watches: Sisu knows what they are doing and what they found", () => {
  beforeEach(() => void freshState());

  it("with no watch, the prompt says nothing about watches", async () => {
    const { system } = await ask("Hello.", "Hi");
    assert.doesNotMatch(system, /WATCHES THE CUSTOMER APPROVED/);
  });

  it("a running watch that has found nothing is described as such", async () => {
    await watching();
    const { system } = await ask("Nothing has come under 900 euros yet.");
    assert.match(system, /WATCHES THE CUSTOMER APPROVED/);
    assert.match(system, /- Watching flats in Helsinki for 900 euros a month or less: 1 page watched since \d{4}-\d{2}-\d{2}/);
    assert.match(system, /WHAT THE WATCHES FOUND: nothing has come under the limit yet\./);
  });

  it("what a watch found reaches Sisu, and Sisu may say its figures", async () => {
    const watch = await watching();
    const drop = simulatePriceDrop(AINO, watch.id);
    assert.ok(drop.ok);
    const note = (drop as { notification: { title: string; summary: string; listing: Listing; underBudgetByEur: number } }).notification;
    const said = `Yes. ${note.listing.title} is now ${note.listing.priceEur} euros a month, ${note.underBudgetByEur} euros under your limit of 900 euros. It was simulated for the demo.`;
    const { system, events } = await ask(said);

    assert.match(system, /WHAT THE WATCHES FOUND \(newest first\):/);
    assert.ok(system.includes(`- ${note.title}. ${note.summary}`), "the finding is in the prompt, word for word");
    assert.match(system, /say so plainly if it was simulated for the demo/);

    const done = ofType(events, "done")[0];
    assert.ok(done.text.includes(String(note.listing.priceEur)), "the answer kept the price");
    assert.deepEqual(ofType(events, "grounding")[0].grounding.unverified, [], "the price, the gap and the limit all have receipts");
  });

  it("the exact flat-watch follow-up uses the saved result even if a model would deny access", async () => {
    const watch = await watching();
    const drop = simulatePriceDrop(AINO, watch.id);
    assert.ok(drop.ok);
    updateState(state => ({ ...state, watches: [...(state.watches ?? []), { ...watch, id: "phone-watch", topic: "phone", city: null, priceUnit: "EUR" }], notifications: [...(state.notifications ?? []), { ...drop.notification, id: "phone-finding", watchId: "phone-watch", listing: { ...drop.notification.listing, title: "Phone finding", priceEur: 999 }, detectedAt: "2099-01-01T00:00:00.000Z" }] }));
    const model = scriptedModel(["Sisu cannot access its watches."]);
    setMockScript(model.script);
    try {
      const events = await collect(runTurn({ customerId: AINO, text: "Did my flat watch find anything?", mode: "text" }));
      const answer = ofType(events, "done")[0];
      assert.equal(model.seen.length, 0, "a saved finding does not need a model guess");
      assert.equal(ofType(events, "tool_end")[0].trace.name, "get_watch_findings");
      assert.ok(answer.text.includes(drop.notification.listing.title));
      assert.ok(answer.text.includes(String(drop.notification.listing.priceEur)));
      assert.match(answer.text, /1 rooms, 37 m²/);
      assert.match(answer.text, /Simulated monitoring update/);
      assert.match(answer.text, /vuokraovi.com/);
      assert.doesNotMatch(answer.text, /cannot access/);
      assert.doesNotMatch(answer.text, /Phone finding|999/);
      assert.equal(answer.citations[0].url, drop.notification.listing.url);
    } finally { setMockScript(null); }
  });
});
