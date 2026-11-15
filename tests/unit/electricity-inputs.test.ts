import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { AINO, freshState, stubFetch } from "./helpers";
import { approveAction, listActions } from "@/lib/actions";
import { getMemory, setConsent } from "@/lib/memory";
import { buildOverview } from "@/lib/finance/overview";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { ensureResearch, waitForUsable } from "@/lib/agent/research";
import { toResult } from "@/lib/agent/research/compare";
import { electricityInputs, tariffFromTexts } from "@/lib/agent/research/tariff";
import { prepareAction } from "@/lib/agent/tools/act";
import { searchOffers, webSearch } from "@/lib/agent/tools/web";
import type { ToolContext } from "@/lib/agent/tools/types";
import type { RawOffer, RawResearch } from "@/lib/agent/research/types";

const INPUTS = "I use 2000 kWh a year, currently pay 15 c/kWh and a monthly fee of €5. I want a fixed contract for 12 months or less.";
const overview = buildOverview(AINO)!;
const ctx = (userTexts: string[]): ToolContext => ({ customerId: AINO, overview, city: "Helsinki", memory: getMemory(AINO), userTexts, sisuTexts: [], cashFlow: () => buildCashFlow(overview) });

describe("electricity demo uses the customer's tariff before claiming or preparing a saving", () => {
  before(async () => { await waitForUsable(ensureResearch("electricity", "Helsinki").key, 3_000); });
  beforeEach(() => { freshState(); });

  it("keeps a housing budget and model-supplied kWh out of electricity inputs", async () => {
    const result = await searchOffers({ billType: "electricity", yearlyKwh: 2000 }, ctx(["Find a flat under 700 euros per month", "Find me a cheaper electricity deal"]));
    assert.equal(result.research?.best, null);
    assert.equal(result.research?.baselineMonthlyEur, null);
    assert.ok(result.research?.offers.length);
    assert.ok(result.research?.offers.every(offer => offer.estimatedYearlySavingEur === null));
    const content = JSON.parse(result.content);
    assert.equal(content.comparisonSupported, false);
    assert.equal(content.stillToConfirm.length >= 2, true);
    assert.ok(!result.stages.some(stage => stage.kind === "calculation"));
    assert.equal(prepareAction({ kind: "switch_contract", billType: "electricity" }, ctx([])).ok, false);
    assert.deepEqual(listActions(AINO), []);
  });

  it("extracts explicit units, decimal commas and separately supplied inputs", () => {
    const parsed = tariffFromTexts(["I use 2,000 kWh per year", "I currently pay 12,5 c/kWh", "My monthly fee is €4,50"]);
    assert.deepEqual(parsed, { yearlyKwh: 2000, tariff: { energyPriceCentsPerKwh: 12.5, monthlyFeeEur: 4.5 } });
    assert.equal(tariffFromTexts(["I use 2000 kWh per month"]).yearlyKwh, null);
    assert.deepEqual(tariffFromTexts(["Find an offer under 8 c/kWh with a monthly fee of €3"]).tariff, {});
    assert.deepEqual(tariffFromTexts(["My spot margin is 0.4 c/kWh"]).tariff, {});
    assert.equal(tariffFromTexts(["I currently pay 15 c/kWh; find an offer under 8 c/kWh"]).tariff.energyPriceCentsPerKwh, 15);
  });

  it("calculates from the current sales tariff, with grid fees excluded", () => {
    const offer: RawOffer = { provider: "Retrieved Energy", plan: "Fixed", contractType: "fixed", contractMonths: 12, energyPriceCentsPerKwh: 8, monthlyPriceEur: 4, setupFeeEur: 12, sourceUrl: "https://example.com/current-offer" };
    const raw: RawResearch = { key: "electricity:test", city: "Helsinki", billType: "electricity", status: "done", mock: false, query: "electricity Helsinki", startedAt: 1000, finishedAt: 2000, offers: [offer], citations: [], errors: [], pagesDone: 1, pagesTotal: 1 };
    const result = toResult(raw, 900, 2000, null, { energyPriceCentsPerKwh: 15, monthlyFeeEur: 5 });
    assert.equal(result.baselineMonthlyEur, 30, "€900 bank payment is not the baseline for energy sales");
    assert.equal(result.best?.estimatedMonthlyCostEur, 18.33);
    assert.equal(result.best?.estimatedYearlySavingEur, 140, "€360 current annual cost minus €220 offer first-year cost");
    assert.ok(result.assumptions.some(line => /Grid fees are excluded/.test(line)));
  });

  it("uses the same inputs and retrieved offer for the answer and approved simulated switch", async () => {
    const result = await searchOffers({ billType: "electricity", maxContractMonths: 12, contractType: "fixed" }, ctx([INPUTS]));
    assert.equal(JSON.parse(result.content).comparisonSupported, true);
    assert.ok(result.research?.best);
    const draft = prepareAction({ kind: "switch_contract", billType: "electricity", maxContractMonths: 12, contractType: "fixed" }, ctx([INPUTS]));
    assert.equal(draft.ok, true);
    assert.equal(draft.action?.status, "awaiting_approval");
    assert.equal(draft.action?.offer?.provider, result.research?.best?.provider);
    assert.equal(draft.action?.offer?.estimatedYearlySavingEur, result.research?.best?.estimatedYearlySavingEur);
    assert.equal(draft.action?.simulated, true);
    assert.match(draft.action?.summary ?? "", /Simulated switch/);
    const approval = approveAction(AINO, draft.action!.id, () => null);
    assert.equal(approval.ok, true);
    assert.ok(approval.ok && approval.action.status === "executed_simulated");
    assert.ok(approval.ok && approval.action.simulated);
    assert.ok(electricityInputs(AINO, []).tariff, "saved inputs survive the following question");
  });

  it("can prepare from the conversation with remembering disabled, without storing tariff data", async () => {
    setConsent(AINO, false);
    await searchOffers({ billType: "electricity", maxContractMonths: 12 }, ctx([INPUTS]));
    const draft = prepareAction({ kind: "switch_contract", billType: "electricity", maxContractMonths: 12 }, ctx([INPUTS]));
    assert.equal(draft.ok, true);
    assert.equal(getMemory(AINO).items.length, 0);
  });

  it("retrieves Finnish rent rules from primary sources and preserves conditional case guidance", async () => {
    const original = process.env.EXA_API_KEY;
    process.env.EXA_API_KEY = "test-only-not-a-real-key";
    let body: Record<string, unknown> | undefined;
    const restore = stubFetch((_url, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ results: [{ title: "Rent increases", url: "https://www.kkv.fi/en/consumer-affairs/housing/rental-apartments/rent-increases/", highlights: ["A tenancy agreement determines the conditions for rent adjustments."] }] });
    });
    try {
      const result = await webSearch({ query: "Finland landlord rent increase tenancy agreement notice", deep: true }, ctx(["My landlord wants to raise rent by 10 percent next month. Is that allowed in Finland?"]));
      assert.equal(result.ok, true);
      assert.deepEqual(body?.includeDomains, ["kkv.fi", "finlex.fi", "infofinland.fi"]);
      assert.match(JSON.parse(result.content).caseGuidance, /depends on the tenancy agreement/);
      assert.match(result.citations[0].url, /kkv\.fi/);
      assert.equal(result.citations[0].cacheAgeMs, null);
    } finally { restore(); if (original === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = original; }
  });
});
