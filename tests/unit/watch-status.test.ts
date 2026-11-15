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

const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/helsinki";
const flat = (title: string, priceEur: number, id: string): Listing => ({ title, priceEur, rooms: 1, areaM2: 37, district: "Taka-Töölö", city: "Helsinki", availableFrom: null, url: `https://www.vuokraovi.com/kohde/${id}`, pageUrl: PAGE });
const search: ListingSearch = { city: "Helsinki", topic: null, query: listingQuery("Helsinki"), pages: [{ url: PAGE, title: "Vuokraovi", listings: [flat("Sallinkatu 2", 919, "hp8899"), flat("Kustinpolku 9", 1_239, "hq3786")], dropped: 0, cacheAgeMs: 0, tookMs: 1, mock: false }], found: [{ url: PAGE, title: "Vuokraovi" }], errors: [], retrievedAt: "2026-11-14T10:00:00.000Z", tookMs: 1, mock: false };

async function watching(): Promise<PropertyWatch> {
  const built = buildWatchDraft(AINO, { city: "Helsinki", budgetEur: 900, minRooms: null, search, preparedBy: "sisu-agent" });
  assert.ok(built.ok, built.ok ? "" : built.reason);
  const saved = saveDraft(AINO, built.draft);
  assert.ok(saved.ok);
  const approved = approveAction(AINO, saved.action.id, impactOf);
  assert.ok(approved.ok);
  const watch = await startWatch(AINO, approved.action);
  assert.ok(watch);
  return watch;
}
async function ask(answer: string, question = "Did my watch find anything?") {
  const model = scriptedModel([answer]);
  setMockScript(model.script);
  const events = await collect(runTurn({ customerId: AINO, text: question, mode: "text" }));
  setMockScript(null);
  return { system: String(model.seen[0].messages[0].content), events };
}

describe("watches: the demo link that triggers a simulated drop", () => {
  beforeEach(() => void freshState());
  const open = (session?: string) => demoDrop(new Request("http://test.local/api/watch/demo-drop", { headers: { "x-forwarded-for": "198.51.100.9", ...(session ? { "x-sisu-session": session } : {}) } }));

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
    assert.match(html, /Simulated price drop sent/);
    assert.match(html, /Simulated for the demo/);
    const notes = inSession(anna, () => listNotifications(AINO));
    assert.equal(notes.length, 1);
    assert.ok(notes[0].simulated && notes[0].watchId === watch.id);
    await open(anna); // opening it twice does not stack notifications
    assert.equal(inSession(anna, () => listNotifications(AINO)).length, 1);
    assert.equal((await open(ben)).status, 404, "another visitor has no watch to drop");
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
});
