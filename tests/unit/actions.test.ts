import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { before, beforeEach, describe, it } from "node:test";
import { AINO, EETU, SANNA, freshState } from "./helpers";
import { approveAction, declineAction, listActions, resetCustomers, saveDraft } from "@/lib/actions";
import { buildSwitchDraft, buildTransferDraft, impactOf } from "@/lib/actions/drafts";
import { ensureResearch, waitForUsable } from "@/lib/agent/research";
import { forget, getMemory, remember } from "@/lib/memory";
import { auditFor, verifyChain } from "@/lib/store/audit";
import { readState } from "@/lib/store/state";

const prepareSwitch = (customerId: string) => {
  const built = buildSwitchDraft(customerId, "electricity", { preparedBy: "sisu-agent" });
  assert.ok(built.ok, built.ok ? "" : built.reason);
  const saved = saveDraft(customerId, built.draft);
  assert.ok(saved.ok);
  return saved.action;
};

describe("actions: nothing happens without an approval", () => {
  before(async () => {
    // Offer research in mock mode: example offers, no network.
    for (const city of ["Helsinki", "Espoo"]) await waitForUsable(ensureResearch("electricity", city).key, 3_000);
  });
  beforeEach(() => void freshState());

  it("cannot prepare a switch before offers have been looked up", () => {
    const built = buildSwitchDraft(AINO, "internet", { preparedBy: "sisu-agent" });
    assert.ok(!built.ok && built.status === 409);
    assert.equal(listActions(AINO).length, 0);
  });

  it("a prepared action is only a draft: awaiting approval, simulated, with receipts and a checklist", () => {
    const action = prepareSwitch(AINO);
    assert.equal(action.status, "awaiting_approval");
    assert.equal(action.simulated, true);
    assert.equal(action.impact, null);
    assert.equal(action.decidedAt, null);
    assert.ok(action.checklist.length >= 3 && action.draftMessage?.includes(action.offer!.provider));
    assert.ok(action.monthlyAmountEur > 0 && action.facts.some((f) => f.id === "action:saving-yearly"));
    // The saving is the server's own arithmetic on the stored offer, not anything a caller supplied.
    assert.equal(action.monthlyAmountEur, Math.round((action.offer!.estimatedYearlySavingEur! / 12) * 100) / 100);
    assert.deepEqual(auditFor(AINO).events.map((e) => e.type), ["action_prepared"]);
  });

  it("approval executes a simulation, records who approved, and projects the impact", () => {
    const action = prepareSwitch(AINO);
    const result = approveAction(AINO, action.id, impactOf);
    assert.ok(result.ok);
    assert.equal(result.action.status, "executed_simulated");
    assert.ok(result.action.impact && result.action.impact.gainVsNothingEur > 0);
    assert.equal(Math.round(result.action.impact.gainVsNothingEur), Math.round(action.monthlyAmountEur * 60));
    const audit = auditFor(AINO);
    assert.deepEqual(audit.events.map((e) => `${e.type}:${e.actor}`), ["action_prepared:sisu-agent", "action_approved:user", "action_executed_simulated:system"]);
    assert.equal(audit.chainValid, true);
  });

  it("one customer cannot see, approve or decline another customer's action", () => {
    const action = prepareSwitch(AINO);
    for (const other of [EETU, SANNA, "CUST99999"]) {
      const approved = approveAction(other, action.id, impactOf);
      assert.ok(!approved.ok && approved.status === 404);
      const declined = declineAction(other, action.id);
      assert.ok(!declined.ok && declined.status === 404);
      assert.equal(listActions(other).length, 0);
    }
    assert.equal(listActions(AINO)[0].status, "awaiting_approval");
  });

  it("an action can be decided only once", () => {
    const action = prepareSwitch(AINO);
    assert.ok(approveAction(AINO, action.id, impactOf).ok);
    const again = approveAction(AINO, action.id, impactOf);
    assert.ok(!again.ok && again.status === 409);
    const decline = declineAction(AINO, action.id);
    assert.ok(!decline.ok && decline.status === 409);
    assert.equal(auditFor(AINO).events.filter((e) => e.type === "action_approved").length, 1);
  });

  it("declining leaves nothing executed", () => {
    const action = prepareSwitch(EETU);
    const result = declineAction(EETU, action.id);
    assert.ok(result.ok && result.action.status === "declined" && result.action.impact === null);
    assert.deepEqual(auditFor(EETU).events.map((e) => e.type), ["action_prepared", "action_declined"]);
  });

  it("an unanswered action expires and can no longer be approved", () => {
    const built = buildSwitchDraft(AINO, "electricity", { preparedBy: "sisu-agent" });
    assert.ok(built.ok);
    const saved = saveDraft(AINO, built.draft, new Date("2026-11-14T10:00:00Z"));
    assert.ok(saved.ok);
    const late = approveAction(AINO, saved.action.id, impactOf, new Date("2026-11-14T10:31:00Z"));
    assert.ok(!late.ok && late.status === 410);
    assert.equal(listActions(AINO)[0].status, "expired");
    assert.ok(auditFor(AINO).events.some((e) => e.type === "action_expired"));
  });

  it("asking twice for the same thing does not create duplicates", () => {
    const first = prepareSwitch(AINO);
    const second = prepareSwitch(AINO);
    assert.equal(first.id, second.id);
    assert.equal(listActions(AINO).length, 1);
  });

  it("a transfer bigger than what the customer has left over is refused", () => {
    assert.ok(!buildTransferDraft(AINO, 5_000, { preparedBy: "user" }).ok);
    assert.ok(!buildTransferDraft(AINO, 1, { preparedBy: "user" }).ok);
    assert.ok(!buildTransferDraft(AINO, Number.NaN, { preparedBy: "user" }).ok);
    const fine = buildTransferDraft(SANNA, 100, { preparedBy: "user" });
    assert.ok(fine.ok && fine.draft.monthlyAmountEur === 100);
  });

  it("the audit log is tamper-evident: editing or removing an entry breaks the chain", () => {
    const file = process.env.SISU_STATE_FILE as string;
    const action = prepareSwitch(AINO);
    approveAction(AINO, action.id, impactOf);
    const events = readState().audit;
    assert.equal(verifyChain(events), true);
    assert.equal(verifyChain(events.map((e, i) => (i === 1 ? { ...e, detail: "Approved by the user: something else" } : e))), false);
    assert.equal(verifyChain(events.filter((_, i) => i !== 1)), false);
    assert.equal(verifyChain([events[1], events[0], events[2]]), false);
    // And the same check on what is actually on disk.
    const stored = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(verifyChain(stored.audit), true);
    stored.audit[0].actor = "user";
    writeFileSync(file, JSON.stringify(stored));
    assert.equal(verifyChain(JSON.parse(readFileSync(file, "utf8")).audit), false);
  });

  it("many actions prepared at once all land, with an unbroken audit chain", async () => {
    await Promise.all([AINO, EETU, SANNA].map(async (id) => prepareSwitch(id)));
    await Promise.all([AINO, EETU, SANNA].map(async (id) => approveAction(id, listActions(id)[0].id, impactOf)));
    const state = readState();
    assert.equal(state.actions.length, 3);
    assert.equal(state.audit.length, 9);
    assert.equal(verifyChain(state.audit), true);
    assert.deepEqual(state.audit.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("the booth reset clears actions and memory and starts a new audit chain", () => {
    prepareSwitch(AINO);
    remember(AINO, { kind: "goal", key: "goal", value: "Save for a trip", source: "user-confirmed-in-app" });
    const cleared = resetCustomers([AINO, EETU, SANNA]);
    assert.deepEqual(cleared, { actions: 1, memoryItems: 1 });
    assert.equal(listActions(AINO).length, 0);
    assert.equal(getMemory(AINO).items.length, 0);
    assert.deepEqual(readState().audit.map((e) => e.type), ["demo_reset"]);
    assert.equal(forget(AINO, null), 0);
  });
});
