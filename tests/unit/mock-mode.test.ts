import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { AINO, SANNA, collect, freshState, ofType } from "./helpers";
import { setMockScript } from "@/lib/agent/mock";
import { runTurn } from "@/lib/agent/orchestrator";
import { ensureResearch, waitForUsable } from "@/lib/agent/research";
const ELECTRICITY_INPUTS = "I use 2000 kWh a year, currently pay 15 c/kWh and a monthly fee of €5.";

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

  // Regression: QA on the mock backend, 15 Nov. Three suggested questions, the payday question and the move question
  // got the generic answer, a bills total or a lesson instead of an answer to what was asked.
  const SUGGESTED: [string, string, RegExp][] = [
    ["I keep running short before payday. What can I spend this week without missing my bills?", "get_cash_flow", /estimated weekly budget until payday .* is about 133\.64 euros/],
    ["What can I spend this week without missing my bills?", "get_cash_flow", /estimated weekly budget/],
    ["Why does my balance go below zero, and how do I stop it?", "get_cash_flow", /went below zero in \d+ of the last 12 months/],
    ["Find a cheaper plan that meets my needs.", "search_offers", /supported comparison.*yearly electricity use/i],
    ["What would spending 20% less at restaurants save?", "run_scenario", /20% less on restaurants would free about [\d.]+ euros a month, or [\d.]+ euros a year/],
  ];
  for (const [question, tool, answer] of SUGGESTED) {
    it(`"${question}" calls ${tool} and answers what was asked`, async () => {
      const events = await collect(runTurn({ customerId: AINO, text: question, mode: "text" }));
      assert.deepEqual(ofType(events, "tool_end").map((e) => e.trace.name), [tool]);
      const done = ofType(events, "done")[0];
      assert.match(done.text, answer);
      assert.equal(ofType(events, "grounding")[0].grounding.ok, true, `ungrounded: ${ofType(events, "grounding")[0].grounding.unverified} in "${done.text}"`);
    });
  }

  // Regression: QA 15 Nov. The restaurant suggestion led with "More after 5 years if you keep it" and an "invest it" line.
  it("a category cut asked per month gets a per-month card and no projection; asked over years, it gets one", async () => {
    const monthly = await collect(runTurn({ customerId: AINO, text: "What would spending 20% less at restaurants save?", mode: "text" }));
    const stages = ofType(monthly, "stage").map((e) => e.stage);
    assert.deepEqual(stages.map((stage) => stage.kind), ["calculation"]);
    assert.ok(stages[0].data.kind === "calculation" && stages[0].data.resultLabel === "Freed per month");
    assert.equal(ofType(monthly, "visual").length, 0);
    assert.match(ofType(monthly, "done")[0].text, /^Mock answer\. Spending 20% less on restaurants would free about [\d.]+ euros a month, or [\d.]+ euros a year, from your 12-month average\.\s*$/);
    assert.doesNotMatch(ofType(monthly, "done")[0].text, /years|invest|undefined|over the period/i);
    const yearly = await collect(runTurn({ customerId: AINO, text: "What would cutting restaurants by 20% add up to in 3 years?", mode: "text" }));
    assert.deepEqual(ofType(yearly, "stage").map((e) => e.stage.kind), ["impact"]);
    assert.equal(ofType(yearly, "visual")[0]?.visual.kind, "futures_lines");
    assert.match(ofType(yearly, "done")[0].text, /Kept for 3 years, that adds up to about [\d.]+ euros more/);
    assert.equal(ofType(yearly, "grounding")[0].grounding.ok, true, `ungrounded: ${ofType(yearly, "grounding")[0].grounding.unverified}`);
  });

  for (const question of ["Could I afford to move to Espoo?", "Could moving from Helsinki to Espoo help me reach my savings goal?"]) {
    it(`"${question}" gets one clarifying question, with no tool and no proposal`, async () => {
      const events = await collect(runTurn({ customerId: AINO, text: question, mode: "text" }));
      assert.equal(ofType(events, "tool_end").length, 0);
      assert.equal(ofType(events, "action").length, 0);
      const text = ofType(events, "done")[0].text;
      assert.match(text, /most rent/);
      assert.match(text, /when would you like to move/);
      assert.match(text, /buffer/);
      assert.equal((text.match(/\?/g) ?? []).length, 1, "one question");
    });
  }

  it("the buffer set in the app is the one the weekly budget keeps", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "I keep running short before payday. What can I spend this week without missing my bills?", mode: "text", bufferEur: 300 }));
    assert.match(ofType(events, "done")[0].text, /about 109\.12 euros, after your bills and a protected buffer of 300 euros/); // (1220.35 - 686.53 - 300) / (15 / 7)
    const card = ofType(events, "stage").find((e) => e.stage.kind === "calculation")!.stage;
    assert.equal(card.data.kind === "calculation" && card.data.resultValue, 109.12);
    assert.ok(card.data.kind === "calculation" && card.data.steps.some((step) => step.label === "Protected buffer" && step.amount === -300 && step.basis === "the amount you set in the app"));
    assert.ok(card.data.kind === "calculation" && !card.data.assumptions.some((line) => /Tell Sisu if you want to keep a different amount/.test(line)), "no invitation to set a buffer that is already set");
    assert.equal(ofType(events, "grounding")[0].grounding.ok, true);
  });

  it("for a balance far above the usual week, the payday answer says the bills are covered, not a weekly figure", async () => {
    const events = await collect(runTurn({ customerId: SANNA, text: "I keep running short before payday. What can I spend this week without missing my bills?", mode: "text" }));
    const text = ofType(events, "done")[0].text;
    assert.match(text, /bills before payday on 2026-10-15 are covered: about 25964\.13 euros is left after them/);
    assert.doesNotMatch(text, /12116/);
    const card = ofType(events, "stage").find((e) => e.stage.kind === "calculation")!.stage;
    assert.ok(card.data.kind === "calculation" && card.data.resultLabel === "Left for spending until payday");
    assert.equal(ofType(events, "grounding")[0].grounding.ok, true, `ungrounded: ${ofType(events, "grounding")[0].grounding.unverified}`);
    const hello = await collect(runTurn({ customerId: SANNA, text: "Hello", mode: "voice" }));
    assert.match(ofType(hello, "done")[0].text, /bills before payday are covered: about 25964\.13 euros is left/);
  });

  it("a plain question is answered from the summary with no tool", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "Hello", mode: "voice" }));
    assert.equal(ofType(events, "tool_end").length, 0);
    assert.match(ofType(events, "done")[0].text, /estimated weekly budget until payday is about 133\.64 euros/);
  });

  it("search and prepare in one message leaves an action awaiting approval", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: `Find a cheaper electricity deal and prepare the switch. ${ELECTRICITY_INPUTS}`, mode: "text" }));
    assert.deepEqual(ofType(events, "tool_end").map((e) => e.trace.name), ["search_offers", "prepare_action"]);
    assert.equal(ofType(events, "action")[0].action.status, "awaiting_approval");
  });

  it("an investigation produces every stage, a teaching card and an action to approve", async () => {
    const events = await collect(runTurn({ customerId: AINO, text: "Investigate", mode: "text", investigate: true, history: [{ role: "user", content: ELECTRICITY_INPUTS }] }));
    assert.deepEqual(ofType(events, "stage").map((e) => e.stage.kind), ["lead", "research", "extraction", "calculation", "impact", "teaching", "action"]);
    assert.equal(ofType(events, "teaching").length, 1);
    assert.equal(ofType(events, "action")[0].action.status, "awaiting_approval");
    assert.equal(ofType(events, "research")[0].result.mock, true);
    assert.equal(ofType(events, "grounding")[0].grounding.ok, true);
    assert.equal(ofType(events, "done").length, 1);
  });
});
