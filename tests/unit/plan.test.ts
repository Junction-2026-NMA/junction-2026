// The money plan: one request that scans, researches, adds up and sets up actions. Mock mode: no network, no keys.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AINO, ALL, freshState } from "./helpers";
import { POST as approveAll } from "@/app/api/actions/approve-all/route";
import { listActions } from "@/lib/actions";
import { pickHabits, runPlan } from "@/lib/agent/plan";
import { checkGrounding } from "@/lib/agent/grounding";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { buildOverview } from "@/lib/finance/overview";
import { findPatterns } from "@/lib/finance/patterns";
import { auditFor } from "@/lib/store/audit";
import type { MoneyPlan, Pattern, PlanEvent } from "@/lib/types";

async function plan(customerId: string): Promise<{ events: PlanEvent[]; plan: MoneyPlan }> {
  const events: PlanEvent[] = [];
  for await (const event of runPlan(customerId, { fresh: true })) events.push(event);
  const done = events.find((event): event is Extract<PlanEvent, { type: "plan_done" }> => event.type === "plan_done");
  assert.ok(done, `the plan finished: ${events.map((e) => e.type).join(", ")}`);
  return { events, plan: done.plan };
}

const post = (body: unknown) => approveAll(new Request("http://localhost/api/actions/approve-all", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() }, body: JSON.stringify(body) }));

describe("money plan", () => {
  it("reports each real step in order: account, searches, pages, sums, actions, words", async () => {
    freshState();
    const { events } = await plan(AINO);
    const types = events.map((event) => event.type);
    const first = (type: PlanEvent["type"]) => types.indexOf(type);
    for (const type of ["plan_start", "scan", "finding", "search_start", "search_pages", "page_read", "offers", "calc", "action", "summary", "plan_done"] as const) assert.ok(first(type) >= 0, `has a ${type} event`);
    assert.ok(first("scan") < first("search_start") && first("search_start") < first("page_read") && first("page_read") < first("offers") && first("offers") < first("calc") && first("calc") < first("summary"));
    assert.equal(types.at(-1), "plan_done");
    const scan = events.find((event) => event.type === "scan");
    assert.ok(scan?.type === "scan" && scan.transactions > 50 && scan.rows.length > 0 && scan.rows.every((row) => row.amount < 0));
  });

  it("the total is the sum of its items, and every number in the summary has a receipt", async () => {
    freshState();
    for (const customerId of ALL) {
      const { plan: result } = await plan(customerId);
      const sum = Math.round(result.items.reduce((total, item) => total + item.yearlyEur, 0) * 100) / 100;
      assert.equal(result.totalYearlyEur, sum);
      assert.equal(result.effortlessYearlyEur, Math.round(result.items.filter((item) => item.needs === "nothing").reduce((total, item) => total + item.yearlyEur, 0) * 100) / 100);
      assert.ok(checkGrounding(result.summary, result.facts, [], []).ok, `summary is sourced: ${result.summary}`);
      assert.equal(result.summaryBy, "code", "mock mode has no model, so code words the summary");
    }
  });

  it("sets actions up but approves nothing", async () => {
    freshState();
    const { plan: result } = await plan(AINO);
    assert.ok(result.actions.length >= 1);
    assert.ok(result.actions.every((action) => action.status === "awaiting_approval" && action.simulated && action.preparedBy === "sisu-agent"));
    assert.ok(listActions(AINO).every((action) => action.status === "awaiting_approval"));
    assert.ok(!auditFor(AINO).events.some((event) => event.type === "action_approved"));
    // A habit only saves money if spending changes; its transfer says so when the month has no room for it.
    const transfer = result.actions.find((action) => action.kind === "standing_transfer");
    assert.ok(transfer?.warning, "the payday transfer for Aino carries a warning");
  });

  it("counts one habit per category, and the smaller figure when two patterns describe the same spending", () => {
    const pattern = (id: string, kind: Pattern["kind"], category: string, yearly: number): Pattern => ({ id, kind, title: id, detail: "", yearlyImpactEur: yearly, confidence: "high", billType: null, evidence: { from: "2025-10-01", to: "2026-09-30", category }, facts: [], nextSteps: [] });
    const picked = pickHabits([pattern("a", "peer-gap", "Entertainment", 5943.72), pattern("b", "category-drift", "Entertainment", 4755), pattern("c", "peer-gap", "Restaurants", 768), pattern("d", "bill-creep", "Utilities", 90), pattern("e", "small-purchases", "Groceries", 100)]);
    assert.deepEqual(picked.map((p) => p.id), ["b", "c"]);
    const overview = buildOverview(AINO)!;
    const real = pickHabits(findPatterns(overview, buildCashFlow(overview)));
    assert.equal(new Set(real.map((p) => p.evidence.category)).size, real.length);
  });

  it("approve-all needs confirm: true, approves each action on its own, and logs each", async () => {
    freshState();
    const { plan: result } = await plan(AINO);
    const ids = result.actions.map((action) => action.id);
    assert.equal((await post({ customerId: AINO, actionIds: ids })).status, 400);
    assert.ok(listActions(AINO).every((action) => action.status === "awaiting_approval"), "nothing happens without confirm");
    assert.equal((await post({ customerId: "CUST02003", actionIds: ids, confirm: true })).status, 409, "another customer cannot approve them");

    const response = await post({ customerId: AINO, actionIds: ids, confirm: true });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { approved: { id: string; status: string; confirmation: string }[]; failed: unknown[] };
    assert.equal(body.approved.length, ids.length);
    assert.ok(body.approved.every((action) => action.status === "executed_simulated" && /simulation/i.test(action.confirmation)));
    const audit = auditFor(AINO);
    assert.equal(audit.events.filter((event) => event.type === "action_approved").length, ids.length);
    assert.ok(audit.chainValid);
  });
});
