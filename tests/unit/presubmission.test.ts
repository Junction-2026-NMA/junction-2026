// Pre-submission gauntlet (14 Nov, afternoon). Each test here failed before its fix. Mock mode: no network, no keys.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AINO, ALL, EETU, freshState } from "./helpers";
import { GET as listRoute } from "@/app/api/actions/route";
import { POST as approveAll } from "@/app/api/actions/approve-all/route";
import { POST as prepareRoute } from "@/app/api/actions/prepare/route";
import { approvedMonthlySaving, listActions, saveDraft, saveDraftOnce } from "@/lib/actions";
import { buildSwitchDraft, buildTransferDraft } from "@/lib/actions/drafts";
import { freedByApprovedSwitches } from "@/lib/actions/freed";
import { checkGrounding } from "@/lib/agent/grounding";
import { runPlan } from "@/lib/agent/plan";
import type { ActionList, AgentAction, MoneyPlan, PlanEvent } from "@/lib/types";

async function plan(customerId: string): Promise<MoneyPlan> {
  const events: PlanEvent[] = [];
  for await (const event of runPlan(customerId, { fresh: false })) events.push(event);
  const done = events.find((event): event is Extract<PlanEvent, { type: "plan_done" }> => event.type === "plan_done");
  assert.ok(done, `the plan finished: ${events.map((e) => e.type).join(", ")}`);
  return done.plan;
}

const json = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": crypto.randomUUID() }, body: JSON.stringify(body) });
const approve = (customerId: string, actions: AgentAction[]) => approveAll(json("http://localhost/api/actions/approve-all", { customerId, actionIds: actions.map((a) => a.id), confirm: true }));
const waiting = (actions: AgentAction[]) => actions.filter((action) => action.status === "awaiting_approval");

describe("the same saving is never set up, approved and counted twice", () => {
  it("a plan run again after approval sets nothing up a second time, for every demo customer", async () => {
    freshState();
    for (const customerId of ALL) {
      const first = await plan(customerId);
      assert.ok(waiting(first.actions).length >= 1, "the first plan sets something up");
      assert.equal((await approve(customerId, first.actions)).status, 200);
      const freed = approvedMonthlySaving(customerId);
      const stored = listActions(customerId).length;

      const second = await plan(customerId);
      assert.equal(waiting(second.actions).length, 0, "nothing new waits for approval");
      assert.deepEqual(second.actions.map((a) => a.id).sort(), first.actions.map((a) => a.id).sort(), "the second plan points at the actions already approved");
      assert.ok(second.actions.every((action) => action.status === "executed_simulated"));
      assert.equal(listActions(customerId).length, stored, "no new action was stored");
      assert.equal(approvedMonthlySaving(customerId), freed, "the freed amount did not grow");
      assert.equal(second.totalYearlyEur, first.totalYearlyEur, "the plan is worth what it was");
      assert.match(second.summary, /already approved/);
      assert.doesNotMatch(second.summary, /waiting for your approval/);
      assert.ok(checkGrounding(second.summary, second.facts, [], []).ok, `summary is sourced: ${second.summary}`);
      assert.ok(second.items.filter((item) => item.kind === "switch").every((item) => item.title.startsWith("Already approved: ")));
    }
  });

  it("a bill can be switched once: asking again hands back the approved switch", async () => {
    freshState();
    const first = await plan(EETU);
    const switches = first.actions.filter((action) => action.kind === "switch_contract");
    assert.ok(switches.length >= 1);
    await approve(EETU, first.actions);
    for (const done of switches) {
      const draft = buildSwitchDraft(EETU, done.billType!, { preparedBy: "sisu-agent" });
      assert.ok(draft.ok);
      const again = saveDraft(EETU, draft.draft);
      assert.ok(again.ok && again.action.id === done.id && again.action.status === "executed_simulated");
    }
    const viaRoute = await prepareRoute(json("http://localhost/api/actions/prepare", { customerId: EETU, kind: "switch_contract", billType: switches[0].billType }));
    assert.equal(viaRoute.status, 200, "200, not 201: nothing was created");
    assert.equal(((await viaRoute.json()) as { action: AgentAction }).action.id, switches[0].id);
  });

  it("a person who asks for the same transfer twice still gets two; Sisu repeating itself does not", async () => {
    freshState();
    const draft = buildTransferDraft(AINO, 25, { preparedBy: "user" });
    assert.ok(draft.ok);
    const first = saveDraft(AINO, draft.draft);
    assert.ok(first.ok);
    await approve(AINO, [first.action]);
    const repeated = saveDraftOnce(AINO, draft.draft);
    assert.ok(repeated.ok && repeated.action.id === first.action.id, "Sisu's own repeat reuses the approved transfer");
    const asked = saveDraft(AINO, draft.draft);
    assert.ok(asked.ok && asked.action.id !== first.action.id && asked.action.status === "awaiting_approval", "a person's second request is a new transfer");
  });

  it("the freed amount counts the newest approved switch per bill, and the action list reports it", async () => {
    const switchOf = (id: string, billType: AgentAction["billType"], monthly: number, decidedAt: string, status: AgentAction["status"] = "executed_simulated") => ({ id, kind: "switch_contract", billType, monthlyAmountEur: monthly, decidedAt, status }) as AgentAction;
    const actions = [
      switchOf("a", "electricity", 5, "2026-11-14T10:00:00.000Z"),
      switchOf("b", "electricity", 4.1, "2026-11-14T11:00:00.000Z"), // the same bill again: only this newer one counts
      switchOf("c", "mobile", 10.25, "2026-11-14T10:30:00.000Z"),
      switchOf("d", "internet", 30, "2026-11-14T10:30:00.000Z", "awaiting_approval"),
      { id: "e", kind: "standing_transfer", billType: null, monthlyAmountEur: 100, decidedAt: "2026-11-14T10:30:00.000Z", status: "executed_simulated" } as AgentAction,
    ];
    assert.equal(freedByApprovedSwitches(actions), 14.35);

    freshState();
    const first = await plan(AINO);
    await approve(AINO, first.actions);
    const list = (await (await listRoute(new Request(`http://localhost/api/actions?customerId=${AINO}`))).json()) as ActionList;
    const expected = Math.round(first.actions.filter((a) => a.kind === "switch_contract").reduce((total, a) => total + a.monthlyAmountEur, 0) * 100) / 100;
    assert.equal(list.approvedMonthlySavingEur, expected);
    assert.ok(list.approvedMonthlySavingEur > 0);
  });
});
