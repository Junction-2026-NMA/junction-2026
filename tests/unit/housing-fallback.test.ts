import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AINO, EETU, freshState, stubFetch } from "./helpers";
import { approveAction, saveDraft } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { buildWatchDraft } from "@/lib/actions/watch";
import { searchFlats } from "@/lib/agent/tools/flats";
import type { ToolContext } from "@/lib/agent/tools/types";
import { buildOverview } from "@/lib/finance/overview";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { getMemory } from "@/lib/memory";
import { listNotifications, listWatches, startWatch } from "@/lib/watch";
import { getProject } from "@/lib/watch/project";
import { GET as demoDrop } from "@/app/api/watch/demo-drop/route";

const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/helsinki";
const QUESTION = "Find me a three-room flat in Helsinki under 700 euros a month, and keep watching if nothing fits.";
const params = { city: "Helsinki", minRooms: 3, budgetEur: 700, watch: true };
function context(): ToolContext {
  const overview = buildOverview(AINO)!;
  return { customerId: AINO, overview, city: "Helsinki", memory: getMemory(AINO), cashFlow: () => buildCashFlow(overview), userTexts: [QUESTION], sisuTexts: [] };
}

describe("housing monitoring when source extraction is unavailable", () => {
  const env = { MODEL_PROVIDER: process.env.MODEL_PROVIDER, EXA_API_KEY: process.env.EXA_API_KEY, CONTEXT_DEV_API_KEY: process.env.CONTEXT_DEV_API_KEY };
  let restore = () => {};
  let urls: string[] = [];
  beforeEach(() => {
    freshState();
    urls = [PAGE];
    Object.assign(process.env, { MODEL_PROVIDER: "nvidia", EXA_API_KEY: "test", CONTEXT_DEV_API_KEY: "test" });
    restore = stubFetch((url, init) => {
      if (url.includes("api.exa.ai")) return Response.json({ results: urls.map(url => ({ url, title: "Rental source" })) });
      if (url.endsWith("/v1/web/scrape")) return Response.json({ json: { success: false, message: "Context.dev extraction temporarily unavailable" } });
      if (url.endsWith("/v1/monitors") && init?.method === "POST") return Response.json({ id: "monitor_test", initial_run_id: "run_test" }, { status: 201 });
      throw new Error(`Unexpected request ${url}`);
    });
  });
  afterEach(() => {
    restore();
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("offers approval over real source URLs, then saves a matching labelled simulation in that project", async () => {
    const result = await searchFlats(params, context());
    assert.ok(result.action?.watch);
    const action = result.action;
    assert.deepEqual(action.watch?.urls, [PAGE]);
    assert.deepEqual(action.watch?.seen, []);
    assert.equal(action.status, "awaiting_approval");
    assert.equal(listWatches(AINO).length, 0, "no monitoring before approval");
    assert.match(action.warning ?? "", /No listing could be verified yet.*extraction temporarily unavailable/);
    assert.match(action.summary, /Whether any home fits is unknown/);
    assert.equal(action.sources[0].readBy, "exa", "a found source is never claimed as a Context.dev extraction");
    const content = JSON.parse(result.content);
    assert.deepEqual([content.flatsRead, content.noVerifiedListings, content.nothingFits, content.withinBudget, content.nearestAboveBudget], [0, true, null, [], []]);
    const extraction = result.stages.find(stage => stage.data.kind === "extraction");
    assert.ok(extraction?.data.kind === "extraction");
    assert.equal(extraction.data.pagesRead, 0);
    assert.match(extraction.data.problems.join(" "), /extraction temporarily unavailable/);
    const approved = approveAction(AINO, action.id, impactOf);
    assert.ok(approved.ok);
    const watch = await startWatch(AINO, approved.action);
    assert.ok(watch);
    assert.equal(watch.lastSuccessAt, null, "finding source URLs is not a successful listing read");
    const response = await demoDrop(new Request(`http://sisu.test/api/watch/demo-drop?customerId=${AINO}&watchId=${watch.id}`, { headers: { "x-forwarded-for": "198.51.100.19" } }));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Simulated monitoring update/);
    const project = getProject(AINO, watch.id)!;
    assert.equal(project.notifications[0].watchId, watch.id);
    assert.ok(project.notifications[0].simulated);
    assert.ok(project.notifications[0].listing.priceEur <= 700 && project.notifications[0].listing.rooms! >= 3);
    assert.equal(project.notifications[0].listing.city, "Helsinki");
    assert.equal(project.currentMatches.length, 0, "the synthetic demo home is not a verified live match");
  });

  it("never proposes a watch without a valid rental source URL", async () => {
    for (const found of [[], ["https://unrelated.example/listings"], ["file:///private/data"], ["https://www.vuokraovi.com@unrelated.example/flats"]]) {
      urls = found;
      const result = await searchFlats(params, context());
      assert.equal(result.action, undefined);
      assert.match(result.content, /No valid rental source URLs were found/);
      assert.equal(listWatches(AINO).length, 0);
    }
  });

  it("the default demo trigger prefers Aino's housing project over a newer other-customer project", async () => {
    const result = await searchFlats(params, context());
    const approved = approveAction(AINO, result.action!.id, impactOf);
    assert.ok(approved.ok);
    const aino = await startWatch(AINO, approved.action);
    assert.ok(aino);
    const search = { city: "Helsinki", topic: null, query: "Helsinki rentals", pages: [], found: [{ url: PAGE, title: "Rental source" }], errors: ["No initial listings verified"], retrievedAt: new Date().toISOString(), tookMs: 1, mock: false };
    const built = buildWatchDraft(EETU, { city: "Helsinki", minRooms: 3, budgetEur: 700, search, preparedBy: "sisu-agent" });
    assert.ok(built.ok);
    const saved = saveDraft(EETU, built.draft);
    assert.ok(saved.ok);
    const otherApproved = approveAction(EETU, saved.action.id, impactOf);
    assert.ok(otherApproved.ok);
    const eetu = await startWatch(EETU, otherApproved.action, new Date(Date.now() + 10_000));
    assert.ok(eetu);
    assert.equal((await demoDrop(new Request("http://sisu.test/api/watch/demo-drop", { headers: { "x-forwarded-for": "198.51.100.19" } }))).status, 200);
    assert.equal(listNotifications(AINO)[0].watchId, aino.id);
    assert.equal(listNotifications(EETU).length, 0);
    assert.equal((await demoDrop(new Request(`http://sisu.test/api/watch/demo-drop?watchId=${eetu.id}`, { headers: { "x-forwarded-for": "198.51.100.19" } }))).status, 200, "an explicit selector overrides preference");
    assert.equal(listNotifications(EETU)[0].watchId, eetu.id);
  });
});
