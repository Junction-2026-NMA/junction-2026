import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AINO, collect, freshState, ofType, scriptedModel } from "./helpers";
import { firstToolFor } from "@/lib/agent/intents";
import { getRentBudget, getWatchFindings } from "@/lib/agent/tools/housing-context";
import { buildOverview } from "@/lib/finance/overview";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { getMemory } from "@/lib/memory";
import { setMockScript } from "@/lib/agent/mock";
import { runTurn } from "@/lib/agent/orchestrator";
import type { ToolContext } from "@/lib/agent/tools/types";

function context(): ToolContext {
  const overview = buildOverview(AINO)!;
  return { customerId: AINO, overview, city: "Helsinki", memory: getMemory(AINO), cashFlow: () => buildCashFlow(overview), userTexts: [], sisuTexts: [] };
}

describe("recording questions: select the right tools and keep limits distinct", () => {
  beforeEach(() => void freshState());
  it("routes the complete question sequences without converting a housing or learning request to a transfer", () => {
    const inputs = [
      ["How much rent can I afford?", "get_rent_budget"],
      ["Find me a three-room flat in Helsinki under 700 euros a month, and keep watching if nothing fits.", "search_flats"],
      ["Did my flat watch find anything?", "get_watch_findings"],
      ["Before I move, teach me how big my buffer should be.", "explain_concept"],
      ["My landlord wants to raise my rent by 10 percent next month. Is that allowed in Finland?", "web_search"],
      ["Find me a cheaper electricity deal.", "search_offers"],
      ["Should I pick a fixed or a spot electricity price?", "explain_concept"],
    ];
    for (const [text, name] of inputs) assert.equal(firstToolFor(text)?.function.name, name, text);
    const flat = firstToolFor(inputs[1][0])!;
    assert.deepEqual(JSON.parse(flat.function.arguments), { city: "Helsinki", budgetEur: 700, minRooms: 3, watch: true });
    assert.equal(firstToolFor("Transfer 500 euros to my savings"), null);
    assert.equal(firstToolFor("What is the weather like?"), null);
    const tariff = firstToolFor("I use 2000 kWh a year, currently pay 15 c/kWh and a monthly fee of €5, and want a fixed contract for 12 months or less. I can switch now.", [{ role: "user", content: "Find me a cheaper electricity deal." }]);
    assert.equal(tariff?.function.name, "search_offers", "stated tariff and contract requirement is not a lesson request");
    assert.deepEqual(JSON.parse(tariff!.function.arguments), { billType: "electricity", maxContractMonths: 12, contractType: "fixed" });
  });

  it("calculates a break-even rent from Aino's actual financial data without selecting a search budget", () => {
    const result = getRentBudget(context());
    const data = JSON.parse(result.content);
    assert.ok(data.breakEvenRentEur > 0);
    assert.equal(data.breakEvenRentEur, Math.round((data.housingTodayEur + data.monthlySurplusEur) * 100) / 100);
    assert.equal(data.searchLimitEur, undefined);
    assert.ok(data.monthlySurplusEur < 0, "Aino's current budget runs short");
    assert.match(data.tellTheCustomer, /not a comfortable recommendation/);
  });

  it("returns an empty saved-project result honestly, with no external call or fabricated finding", () => {
    const data = JSON.parse(getWatchFindings(context()).content);
    assert.deepEqual(data.projects, []);
    assert.deepEqual(data.findings, []);
  });

  it("forces the rent search and preserves explicit rooms, city and budget even if the model omits them", async () => {
    const model = scriptedModel(["The project is ready for approval."]);
    setMockScript(model.script);
    try {
      const events = await collect(runTurn({ customerId: AINO, mode: "text", text: "Find me a three-room flat in Helsinki under 700 euros a month, and keep watching if nothing fits." }));
      assert.equal(ofType(events, "tool_start")[0].name, "search_flats");
      const action = ofType(events, "action")[0]?.action;
      assert.ok(action?.watch);
      assert.equal(action.watch.budgetEur, 700);
      assert.equal(action.watch.minRooms, 3);
      assert.equal(action.watch.city, "Helsinki");
    } finally { setMockScript(null); }
  });
});
