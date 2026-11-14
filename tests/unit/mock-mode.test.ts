import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { AINO, collect, freshState, ofType } from "./helpers";
import { setMockScript } from "@/lib/agent/mock";
import { runTurn } from "@/lib/agent/orchestrator";
import { ensureResearch, waitForUsable } from "@/lib/agent/research";

// Mock mode is what the frontend teammate builds against, with no keys. It has to exercise every card.
describe("mock mode: every feature works with no keys and no network", () => {
  before(async () => {
    setMockScript(null);
    await waitForUsable(ensureResearch("electricity", "Helsinki").key, 3_000);
  });
  beforeEach(() => void freshState());

  const QUESTIONS: [string, string][] = [
    ["Can you find me a cheaper electricity deal?", "search_offers"],
    ["Can I afford a 300 euro phone repair?", "check_affordability"],
    ["Will I make it to payday?", "get_cash_flow"],
    ["Have my bills gone up?", "list_bills"],
    ["Where is my money going?", "find_patterns"],
    ["What if I save 50 euros a month?", "run_scenario"],
    ["Explain the three baskets to me", "explain_concept"],
    ["How much did I spend on restaurants?", "get_spending"],
    ["My electricity use is 3500 kWh a year, remember that", "remember"],
  ];

  for (const [question, tool] of QUESTIONS) {
    it(`"${question}" calls ${tool} and answers with sourced numbers`, async () => {
      const events = await collect(runTurn({ customerId: AINO, text: question, mode: "text" }));
      assert.deepEqual(ofType(events, "tool_end").map((e) => [e.trace.name, e.trace.ok]), [[tool, true]]);
      const done = ofType(events, "done")[0];
      assert.match(done.text, /^Mock answer\./);
      assert.equal(ofType(events, "grounding")[0].grounding.ok, true, `ungrounded: ${ofType(events, "grounding")[0].grounding.unverified} in "${done.text}"`);
      assert.equal(ofType(events, "start")[0].mock, true);
    });
  }

  it("a plain question is answered from the summary with no tool", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "Hello", mode: "voice" }));
    assert.equal(ofType(events, "tool_end").length, 0);
    assert.match(ofType(events, "done")[0].text, /164\.09 euros a week/);
  });

  it("search and prepare in one message leaves an action awaiting approval", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "Find a cheaper electricity deal and prepare the switch", mode: "text" }));
    assert.deepEqual(ofType(events, "tool_end").map((e) => e.trace.name), ["search_offers", "prepare_action"]);
    assert.equal(ofType(events, "action")[0].action.status, "awaiting_approval");
  });

  it("an investigation produces every stage, a teaching card and an action to approve", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "Investigate", mode: "text", investigate: true }));
    assert.deepEqual(ofType(events, "stage").map((e) => e.stage.kind), ["lead", "research", "extraction", "calculation", "impact", "teaching", "action"]);
    assert.equal(ofType(events, "teaching").length, 1);
    assert.equal(ofType(events, "action")[0].action.status, "awaiting_approval");
    assert.equal(ofType(events, "research")[0].result.mock, true);
    assert.equal(ofType(events, "grounding")[0].grounding.ok, true);
    assert.equal(ofType(events, "done").length, 1);
  });
});
