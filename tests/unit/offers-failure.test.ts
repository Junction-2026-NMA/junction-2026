import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AINO, freshState, stubFetch } from "./helpers";
import { forgetRecentPages } from "@/lib/agent/research/reader";
import { searchOffers } from "@/lib/agent/tools/web";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { buildOverview } from "@/lib/finance/overview";
import { getMemory } from "@/lib/memory";

// With Exa AND Context.dev failing, no offer is read at all. The tool must not tell the model that "no comparable
// offer is cheaper": that turned into "I checked today's offers; none is cheaper" on screen.
describe("search_offers when every source fails", () => {
  let restore = () => {};
  const saved = { ...process.env };
  beforeEach(() => {
    freshState();
    forgetRecentPages();
    Object.assign(process.env, { MODEL_PROVIDER: "nvidia", EXA_API_KEY: "test", CONTEXT_DEV_API_KEY: "test" });
    restore = stubFetch(() => new Response('{"error":"unauthorized"}', { status: 401 }));
  });
  afterEach(() => {
    restore();
    for (const key of ["MODEL_PROVIDER", "EXA_API_KEY", "CONTEXT_DEV_API_KEY"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("says nothing was compared, never that no offer is cheaper", async () => {
    const overview = buildOverview(AINO)!;
    const result = await searchOffers({ billType: "electricity" }, { customerId: AINO, overview, city: "Failville", memory: getMemory(AINO), cashFlow: () => buildCashFlow(overview), userTexts: [], sisuTexts: [] });
    assert.equal(result.ok, false);
    const content = JSON.parse(result.content) as { note?: string; best: unknown };
    assert.equal(content.best, null);
    assert.match(content.note ?? "", /nothing was compared/);
    assert.doesNotMatch(content.note ?? "", /^No comparable offer is cheaper/);
  });
});
