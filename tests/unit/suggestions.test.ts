// Follow-up buttons: every turn ends with 2-3 of them, they lead somewhere Sisu can act, and they never repeat what was just done.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AINO, ALL, EETU, collect, ofType } from "./helpers";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { buildOverview } from "@/lib/finance/overview";
import { followUpSuggestions, starterSuggestions } from "@/lib/agent/suggestions";
import { runTurn } from "@/lib/agent/orchestrator";
import type { ResearchResult } from "@/lib/types";

const stateFor = (customerId: string, language: string | null = null) => {
  const overview = buildOverview(customerId)!;
  return { overview, cashFlow: buildCashFlow(overview), city: "Helsinki", language, actions: [], watches: [] };
};

describe("starter suggestions", () => {
  it("offers four distinct buttons, a deep look first and at least two that make Sisu act", () => {
    for (const id of ALL) {
      const items = starterSuggestions(stateFor(id));
      assert.equal(items.length, 4, id);
      assert.equal(items[0].kind, "investigate");
      assert.equal(new Set(items.map((s) => s.id)).size, 4);
      assert.ok(items.filter((s) => s.agentic).length >= 2, `${id}: ${items.map((s) => s.id)}`);
      assert.ok(items.every((s) => s.label.length <= 32 && s.prompt.length > 0), id);
    }
  });

  it("speaks Finnish when asked", () => {
    assert.match(starterSuggestions(stateFor(AINO, "fi"))[0].label, /raha-asiani/);
  });
});

describe("follow-up suggestions", () => {
  it("after an offer search, suggests saving what the switch frees and not the same search again", () => {
    const research = { billType: "electricity", best: { estimatedYearlySavingEur: 66.72 } } as unknown as ResearchResult;
    const items = followUpSuggestions(stateFor(EETU), { question: "Find me a cheaper electricity deal", investigate: false, tools: ["search_offers"], action: null, research, affordability: null });
    assert.equal(items[0].id, "save:the-saving");
    assert.match(items[0].prompt, /\b6 euros\b/);
    assert.ok(!items.some((s) => s.id === "cheaper:electricity"));
  });

  it("after a purchase that does not fit, offers when it will and never suggests moving money out", () => {
    const items = followUpSuggestions(stateFor(AINO), { question: "Can I afford a 300 euro bike?", investigate: false, tools: ["check_affordability"], action: null, research: null, affordability: { amountEur: 300, verdict: "not-yet" } });
    assert.equal(items[0].id, "afford:until");
    assert.ok(!items.some((s) => s.id === "save:now"));
  });

  it("every turn ends with suggestions sent before grounding and done", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "How much do I spend on restaurants?", mode: "text" }));
    const types = events.map((e) => e.type);
    const items = ofType(events, "suggestions")[0]?.items ?? [];
    assert.ok(items.length >= 2 && items.length <= 3);
    assert.ok(types.indexOf("suggestions") < types.indexOf("grounding"));
  });
});
