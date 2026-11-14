// Charts the agent puts on screen, and the one-value "what Sisu is doing" state that drives the mascot.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AINO, ALL, call, collect, freshState, ofType, scriptedModel } from "./helpers";
import { LIITO_POSE, IDLE, nextActivity, nextPlanActivity } from "@/lib/agent/activity";
import { checkGrounding } from "@/lib/agent/grounding";
import { asksForChart } from "@/lib/agent/guards";
import { setMockScript } from "@/lib/agent/mock";
import { runTurn } from "@/lib/agent/orchestrator";
import { runPlan } from "@/lib/agent/plan";
import { CHART_KINDS, budgetVisual, chartFor, futuresVisual } from "@/lib/agent/visuals";
import { buildOverview } from "@/lib/finance/overview";
import { cleanInput, runScenario } from "@/lib/finance/scenario";
import type { ScenarioInput, SisuActivity, SisuEvent, Visual } from "@/lib/types";

describe("charts", () => {
  it("the budget ring has at most six parts that add up to its total", () => {
    for (const customerId of ALL) {
      const visual = budgetVisual(buildOverview(customerId)!);
      assert.ok(visual.kind === "budget_donut" && visual.slices.length <= 6 && visual.slices.length >= 2);
      assert.ok(Math.abs(visual.slices.reduce((sum, slice) => sum + slice.value, 0) - visual.total) < 0.02);
      assert.ok(Math.abs(visual.slices.reduce((sum, slice) => sum + slice.share, 0) - 100) < 0.5);
    }
  });

  it("every chart's summary says only numbers that have a receipt in the chart", () => {
    for (const customerId of ALL) {
      const overview = buildOverview(customerId)!;
      const scenario = runScenario(overview, cleanInput({ billSavingPerMonth: 80, everydayCutPct: 0, years: 5 }) as ScenarioInput);
      const visuals = [...CHART_KINDS.map((kind) => chartFor(kind, overview)), futuresVisual(scenario, 5)].filter((v): v is Visual => v !== null);
      assert.ok(visuals.length >= 4);
      for (const visual of visuals) {
        const check = checkGrounding(visual.summary, visual.facts, [visual.caption], []);
        assert.ok(check.ok, `${customerId} ${visual.kind}: "${visual.summary}" has unsourced ${check.unverified.join(", ")}`);
      }
    }
  });

  it("recognises a request for a picture, but not a what-if", () => {
    for (const text of ["Show me a pie chart of my budget.", "Can you visualise my spending?", "Give me a graph of my months."]) assert.ok(asksForChart(text), text);
    for (const text of ["What if I save 50 a month for five years?", "How much can I spend this week?", "Show me how cutting restaurants would add up over time."]) assert.ok(!asksForChart(text), text);
  });

  it("asking for a chart puts one on the stream, built in code", async () => {
    freshState();
    const { script } = scriptedModel([[call("show_chart", { chart: "budget" })], "Housing is your largest cost."]);
    setMockScript(script);
    const events = await collect(runTurn({ customerId: AINO, text: "Show me a pie chart of my budget.", mode: "text" }));
    const visuals = ofType(events, "visual");
    assert.equal(visuals.length, 1);
    assert.equal(visuals[0].visual.kind, "budget_donut");
    assert.ok(ofType(events, "tool_start").some((event) => event.name === "show_chart" && /chart/i.test(event.label ?? "")));
  });
});

describe("what Sisu is doing, for the mascot", () => {
  it("every state has one of Liito's eight poses", () => {
    const poses = new Set(["sleepy", "curious", "focused", "gliding", "found-something", "cheering", "proud", "cosy"]);
    for (const pose of Object.values(LIITO_POSE)) assert.ok(poses.has(pose), pose);
  });

  it("follows a turn: thinking, searching, reading, waiting for approval", () => {
    const run = (events: SisuEvent[]): SisuActivity[] => events.reduce<SisuActivity[]>((all, event) => [...all, nextActivity(all.at(-1) ?? IDLE, event)], []);
    const states = run([
      { type: "start", turnId: "t", provider: "mock", model: "m", mock: true },
      { type: "tool_start", id: "1", name: "search_offers", args: {}, label: "Searching today's electricity offers" },
      { type: "tool_start", id: "2", name: "run_scenario", args: {} },
      { type: "tool_start", id: "3", name: "prepare_action", args: {} },
    ]);
    assert.deepEqual(states.map((s) => s.state), ["thinking", "searching_web", "calculating", "setting_up"]);
    assert.equal(states[1].liito, "gliding");
    assert.equal(states[1].label, "Searching today's electricity offers");
  });

  it("follows the money plan from the account to the approval", async () => {
    freshState();
    const seen: string[] = [];
    let now = IDLE;
    for await (const event of runPlan(AINO, { fresh: true })) {
      now = nextPlanActivity(now, event);
      if (seen.at(-1) !== now.state) seen.push(now.state);
    }
    assert.equal(seen[0], "thinking");
    assert.ok(seen.indexOf("reading_account") < seen.indexOf("searching_web") && seen.indexOf("searching_web") < seen.indexOf("calculating"));
    assert.equal(seen.at(-1), "waiting_for_approval");
  });
});
