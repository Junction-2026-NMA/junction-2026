import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AINO, EETU, freshState } from "./helpers";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import { buildOverview } from "@/lib/finance/overview";
import { billFor, billLabel, forget, getMemory, remember, setConsent, statedYearlyKwh } from "@/lib/memory";
import { auditFor } from "@/lib/store/audit";
import { forgetStoredState } from "@/lib/store/state";

const overview = buildOverview(AINO)!;

describe("memory: remembered only when allowed, and only for its own customer", () => {
  beforeEach(() => void freshState());

  it("starts empty, and Sisu's bill names are guesses", () => {
    assert.deepEqual(getMemory(AINO).items, []);
    const match = billFor(overview, getMemory(AINO), "electricity");
    assert.ok(match && match.confirmed === false && match.bill.guessLabel === "Electricity");
  });

  it("a confirmed bill name survives a restart of the server", () => {
    const saved = remember(AINO, { kind: "bill_name", key: "utilities-1", value: "Helen electricity", billType: "electricity", source: "user-confirmed-in-app" });
    assert.ok(saved.ok);
    // Simulate a new process: drop the in-memory copy so the next read comes from disk.
    forgetStoredState();
    const memory = getMemory(AINO);
    assert.equal(memory.items.length, 1);
    assert.deepEqual(billLabel(overview.recurringBills.find((b) => b.id === "utilities-1")!, memory), { label: "Helen electricity", confirmed: true });
    assert.equal(billFor(overview, memory, "electricity")?.confirmed, true);
  });

  it("when the customer says a different bill is the electricity bill, savings are compared with that one", () => {
    const guessed = billFor(overview, getMemory(AINO), "electricity")!.bill;
    remember(AINO, { kind: "bill_name", key: "utilities-2", value: "Electricity", billType: "electricity", source: "user-confirmed-in-app" });
    const corrected = billFor(overview, getMemory(AINO), "electricity")!;
    assert.equal(corrected.bill.id, "utilities-2");
    assert.notEqual(corrected.bill.monthlyAvg, guessed.monthlyAvg);
    // Moving the name to a third bill replaces the earlier answer: one bill type, one bill.
    remember(AINO, { kind: "bill_name", key: "utilities-3", value: "Electricity", billType: "electricity", source: "user-confirmed-in-app" });
    assert.equal(getMemory(AINO).items.filter((i) => i.billType === "electricity").length, 1);
    assert.equal(billFor(overview, getMemory(AINO), "electricity")!.bill.id, "utilities-3");
  });

  it("a bill renamed to something else is no longer offered as Sisu's guess", () => {
    remember(AINO, { kind: "bill_name", key: "utilities-1", value: "Home insurance", billType: null, source: "user-confirmed-in-app" });
    assert.equal(billFor(overview, getMemory(AINO), "electricity"), null);
  });

  it("validates yearly kWh and uses it afterwards", () => {
    for (const bad of ["12", "999999", "lots", "-3000"]) assert.equal(remember(AINO, { kind: "yearly_kwh", key: "electricity", value: bad, source: "user-said-in-chat" }).ok, false);
    assert.ok(remember(AINO, { kind: "yearly_kwh", key: "electricity", value: "3500", source: "user-said-in-chat" }).ok);
    assert.equal(statedYearlyKwh(getMemory(AINO)), 3500);
  });

  it("one customer's memory is invisible to another", () => {
    remember(AINO, { kind: "goal", key: "goal", value: "Save 2000 for a trip", source: "user-said-in-chat" });
    assert.equal(getMemory(EETU).items.length, 0);
    assert.ok(!buildSystemPrompt({ overview: buildOverview(EETU)!, city: "Espoo", mode: "text", memory: getMemory(EETU) }).includes("trip"));
    assert.ok(buildSystemPrompt({ overview, city: "Helsinki", mode: "text", memory: getMemory(AINO) }).includes("Save 2000 for a trip"));
  });

  it("with consent off nothing is saved, and switching it off erases what was there", () => {
    remember(AINO, { kind: "preference", key: "contract", value: "No contracts longer than 12 months", source: "user-said-in-chat" });
    const off = setConsent(AINO, false);
    assert.deepEqual(off.items, []);
    const refused = remember(AINO, { kind: "goal", key: "goal", value: "Buy a bike", source: "user-said-in-chat" });
    assert.ok(!refused.ok && /switched off/.test(refused.reason));
    assert.equal(getMemory(AINO).items.length, 0);
    assert.ok(setConsent(AINO, true).consent);
    assert.deepEqual(auditFor(AINO).events.map((e) => e.type), ["memory_saved", "consent_changed", "consent_changed"]);
  });

  it("forgets one item or everything, and logs it", () => {
    const a = remember(AINO, { kind: "goal", key: "a", value: "Trip", source: "user-said-in-chat" });
    remember(AINO, { kind: "goal", key: "b", value: "Bike", source: "user-said-in-chat" });
    assert.ok(a.ok);
    assert.equal(forget(AINO, a.item.id), 1);
    assert.deepEqual(getMemory(AINO).items.map((i) => i.value), ["Bike"]);
    assert.equal(forget(AINO, null), 1);
    assert.equal(forget(AINO, "no-such-id"), 0);
    assert.equal(auditFor(AINO).events.filter((e) => e.type === "memory_forgotten").length, 2);
  });

  it("refuses unknown customers and empty values", () => {
    assert.equal(remember("CUST00000", { kind: "goal", key: "g", value: "x", source: "user-said-in-chat" }).ok, false);
    assert.equal(remember(AINO, { kind: "goal", key: "g", value: "   ", source: "user-said-in-chat" }).ok, false);
  });

  it("the prompt never contains the customer ID, with or without memory", () => {
    remember(AINO, { kind: "bill_name", key: "utilities-1", value: "Helen", billType: "electricity", source: "user-confirmed-in-app" });
    for (const mode of ["voice", "text"] as const) {
      const prompt = buildSystemPrompt({ overview, city: "Helsinki", mode, memory: getMemory(AINO), investigate: mode === "text" });
      assert.ok(!prompt.includes(AINO) && !prompt.includes(overview.postalCode));
    }
  });
});

// Found by an automated QA pass: Eetu's rent (housing-1, €622.21) confirmed as "electricity" was then researched
// as an electricity bill of 30,000 kWh, and a switch "saving about €1541 a year" was prepared.
describe("memory: a bill type only fits a utility bill", () => {
  beforeEach(() => void freshState());

  it("the rent cannot be confirmed as the electricity, mobile or internet bill; naming it is fine", () => {
    for (const billType of ["electricity", "mobile", "internet"] as const) {
      const refused = remember(EETU, { kind: "bill_name", key: "housing-1", value: "Helen electricity", billType, source: "user-confirmed-in-app" });
      assert.deepEqual(refused, { ok: false, reason: `That bill is a housing payment, so it cannot be confirmed as the ${billType} bill. Nothing was saved.` });
    }
    assert.deepEqual(getMemory(EETU).items, []);
    assert.ok(remember(EETU, { kind: "bill_name", key: "housing-1", value: "Landlord Oy", billType: null, source: "user-confirmed-in-app" }).ok);
    assert.ok(remember(EETU, { kind: "bill_name", key: "utilities-1", value: "Helen", billType: "electricity", source: "user-confirmed-in-app" }).ok);
    const match = billFor(buildOverview(EETU)!, getMemory(EETU), "electricity");
    assert.equal(match?.bill.id, "utilities-1", "the electricity bill is still the utility one");
  });
});
