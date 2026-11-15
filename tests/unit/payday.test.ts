// v2 payday: "Hey Sisu, I'm running short before payday. How much can I spend until my next paycheck, and what could
// I cut back on?" for Jack (CUST04974). A changed payday or an added bill changes the figure; a follow-up cut keeps the
// baseline; the chat answer, the card and GET /api/coach/cash-flow say the same amounts.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AINO as JACK, collect, freshState, ofType } from "./helpers";
import { GET as cashFlowGet, POST as cashFlowPost } from "@/app/api/coach/cash-flow/route";
import { parseAgentRequest } from "@/lib/agent/http";
import { runTurn } from "@/lib/agent/orchestrator";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import { cutOf, parsePaydayOverrides } from "@/lib/finance/payday";
import type { CashFlow, ChatTurn, SisuEvent } from "@/lib/types";

const QUESTION = "Hey Sisu, I'm running short before payday. How much can I spend until my next paycheck, and what could I cut back on?";
const jack = buildOverview(JACK)!;
let visitor = 0;
const get = (query: string) => cashFlowGet(new Request(`http://test.local/api/coach/cash-flow?customerId=${JACK}${query}`, { headers: { "x-forwarded-for": `203.0.113.${++visitor % 250}` } }));
const post = (body: unknown) => cashFlowPost(new Request(`http://test.local/api/coach/cash-flow?customerId=${JACK}`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `203.0.113.${++visitor % 250}` }, body: JSON.stringify(body) }));
const answerOf = (events: SisuEvent[]) => ofType(events, "done")[0].text;
const groundingOf = (events: SisuEvent[]) => ofType(events, "grounding")[0].grounding;

describe("v2 payday: Jack's budget until payday", () => {
  beforeEach(() => void freshState());

  it("CUST04974 is Jack, 23", () => {
    assert.equal(findCustomer(JACK)?.displayName, "Jack");
    assert.equal(jack.age, 23);
  });

  it("from history: €286.37 until payday on Thu 15 Oct, 15 days, labelled an estimated budget", () => {
    const flow = buildCashFlow(jack);
    assert.equal(flow.weeklyBudget?.leftForSpendingEur, 286.37);
    assert.equal(flow.weeklyBudget?.perWeekEur, 133.64);
    assert.equal(flow.basis?.payday, "history");
    assert.equal(flow.basis?.label, "Estimated budget");
    assert.equal(flow.basis?.periodText, "until payday on Thu 15 Oct, 15 days");
    assert.deepEqual(flow.cutBack && [flow.cutBack.category, flow.cutBack.averagePerMonthEur, flow.cutBack.freesPerMonthEur], ["Restaurants", 276.52, 55.3]);
  });

  it("a payday override changes the bills before it, the days and the result", () => {
    const flow = buildCashFlow(jack, { paydayDate: "2026-10-20" });
    assert.equal(flow.nextPayday, "2026-10-20");
    assert.equal(flow.daysToNextPayday, 20);
    assert.equal(flow.basis?.payday, "confirmed");
    assert.equal(flow.billsDueBeforePayday.length, 4); // rent, mobile, and now electricity and internet on the 15th too
    assert.equal(flow.weeklyBudget?.billsBeforePaydayEur, 756.72);
    assert.equal(flow.weeklyBudget?.leftForSpendingEur, 216.18);
    assert.match(flow.weeklyBudget?.assumptions[0] ?? "", /the date you gave/);
    assert.equal(buildCashFlow(jack, { paydayDate: "2026-10-12" }).weeklyBudget?.leftForSpendingEur, 286.37); // same two bills, fewer days
    assert.equal(buildCashFlow(jack, { paydayDate: "2026-10-12" }).weeklyBudget?.perWeekEur, Math.round((286.37 / (12 / 7)) * 100) / 100);
  });

  it("an added bill due before payday reduces what is left by its amount; one due after payday does not", () => {
    const before = buildCashFlow(jack, { extraBills: [{ label: "Phone repair", amountEur: 80, dueDate: "2026-10-12" }] });
    assert.equal(before.weeklyBudget?.leftForSpendingEur, 206.37);
    assert.equal(before.basis?.bills, "history+added");
    assert.ok(before.billsDueBeforePayday.some((bill) => bill.billId === "added-1" && bill.amount === 80));
    const after = buildCashFlow(jack, { extraBills: [{ label: "Gym", amountEur: 30, dueDate: "2026-10-15" }] });
    assert.equal(after.weeklyBudget?.leftForSpendingEur, 286.37);
    assert.equal(after.basis?.addedBills[0].counted, false);
  });

  it("validates the overrides with friendly messages", () => {
    assert.deepEqual(parsePaydayOverrides({ paydayDate: "2026-10-20" }), { paydayDate: "2026-10-20" });
    assert.match(String(parsePaydayOverrides({ paydayDate: "2026-09-01" })), /paydayDate must be a date/);
    assert.match(String(parsePaydayOverrides({ paydayDate: "15.10." })), /paydayDate must be a date/);
    assert.match(String(parsePaydayOverrides({ extraBills: [{ label: "", amountEur: 5, dueDate: "2026-10-02" }] })), /extraBills must be/);
    assert.match(String(parsePaydayOverrides({ extraBills: "not json" })), /extraBills must be/);
    assert.equal(typeof parseAgentRequest({ customerId: JACK, text: "hi", paydayDate: "tomorrow" }, "text"), "string");
    const ok = parseAgentRequest({ customerId: JACK, text: "hi", paydayDate: "2026-10-20", extraBills: [{ label: "Phone repair", amountEur: 80, dueDate: "2026-10-12" }] }, "text");
    assert.ok(typeof ok !== "string" && ok.paydayDate === "2026-10-20" && ok.extraBills?.length === 1);
  });

  it("GET and POST /api/coach/cash-flow take the overrides; a bad one is a 400", async () => {
    const plain = (await (await get("")).json()) as CashFlow;
    assert.equal(plain.weeklyBudget?.leftForSpendingEur, 286.37);
    const bills = encodeURIComponent(JSON.stringify([{ label: "Phone repair", amountEur: 80, dueDate: "2026-10-12" }]));
    const changed = (await (await get(`&paydayDate=2026-10-20&extraBills=${bills}`)).json()) as CashFlow;
    assert.equal(changed.weeklyBudget?.leftForSpendingEur, 136.18);
    const posted = (await (await post({ paydayDate: "2026-10-20", extraBills: [{ label: "Phone repair", amountEur: 80, dueDate: "2026-10-12" }] })).json()) as CashFlow;
    assert.equal(posted.weeklyBudget?.leftForSpendingEur, 136.18);
    const bad = await get("&paydayDate=2027-01-01");
    assert.equal(bad.status, 400);
    assert.match(((await bad.json()) as { error: string }).error, /paydayDate must be a date/);
    assert.equal((await post([1, 2])).status, 400);
  });

  it("the exact question, in mock mode: amount, period and one cut-back, the same as /api/coach/cash-flow", async () => {
    const flow = (await (await get("")).json()) as CashFlow;
    const events = await collect(runTurn({ customerId: JACK, text: QUESTION, mode: "text" }));
    assert.deepEqual(ofType(events, "tool_end").map((e) => e.trace.name), ["get_cash_flow"]);
    const text = answerOf(events);
    const budget = flow.weeklyBudget!;
    assert.ok(text.includes(`Estimated budget: about €${budget.leftForSpendingEur.toFixed(2)} to spend ${flow.basis?.periodText}`), text);
    assert.ok(text.includes(`about €${budget.perWeekEur.toFixed(2)} a week`), text);
    assert.ok(text.includes(`20% less at restaurants would free about €${flow.cutBack?.freesPerMonthEur.toFixed(2)} a month`), text);
    assert.match(text, /Is your payday still that day/); // payday is only inferred: one question that would change the answer
    assert.equal(groundingOf(events).ok, true, `ungrounded: ${groundingOf(events).unverified}`);
    const card = ofType(events, "stage").find((e) => e.stage.kind === "calculation")!.stage;
    assert.ok(card.data.kind === "calculation" && card.data.resultLabel === "Estimated budget" && card.data.resultValue === budget.leftForSpendingEur);
  });

  it("the payday and bill set in the app reach the chat answer, so chat and Today agree", async () => {
    const events = await collect(runTurn({ customerId: JACK, text: QUESTION, mode: "text", paydayDate: "2026-10-20", extraBills: [{ label: "Phone repair", amountEur: 80, dueDate: "2026-10-12" }] }));
    const text = answerOf(events);
    assert.match(text, /about €136\.18 to spend until payday on Tue 20 Oct, 20 days/);
    assert.doesNotMatch(text, /Is your payday still that day/);
    assert.equal(groundingOf(events).ok, true, `ungrounded: ${groundingOf(events).unverified}`);
  });

  it("20% less at restaurants, then 'What about 10%?': the same baseline, exactly half the saving", async () => {
    const first = await collect(runTurn({ customerId: JACK, text: "What if I spent 20% less at restaurants?", mode: "text" }));
    const firstText = answerOf(first);
    assert.match(firstText, /free about €55\.30 a month, or €663\.60 a year\. Based on €276\.52 a month at restaurants, Oct 2025–Sep 2026/);
    const history: ChatTurn[] = [{ role: "user", content: "What if I spent 20% less at restaurants?" }, { role: "assistant", content: firstText }];
    const second = await collect(runTurn({ customerId: JACK, text: "What about 10%?", mode: "text", history }));
    assert.deepEqual(ofType(second, "tool_end").map((e) => [e.trace.name, e.trace.args]), [["run_scenario", { category: "Restaurants", categoryCutPct: 10 }]]);
    const secondText = answerOf(second);
    assert.match(secondText, /10% less on restaurants would free about €27\.65 a month, or €331\.80 a year\. Based on €276\.52 a month at restaurants/);
    assert.match(secondText, /exactly half of the €55\.30 a 20% cut frees/);
    assert.equal(groundingOf(second).ok, true, `ungrounded: ${groundingOf(second).unverified}`);
    assert.equal(cutOf(276.52, 10) * 2, cutOf(276.52, 20));
  });

  it("the real tool path also finds the category from earlier in the chat when the model leaves it out", async () => {
    const { executeTool } = await import("@/lib/agent/tools");
    const { getMemory } = await import("@/lib/memory");
    const ctx = { customerId: JACK, overview: jack, city: "Helsinki", memory: getMemory(JACK), cashFlow: () => buildCashFlow(jack), userTexts: ["What if I spent 20% less at restaurants?", "What about 10%?"], sisuTexts: [] };
    const result = await executeTool({ id: "c1", type: "function", function: { name: "run_scenario", arguments: JSON.stringify({ categoryCutPct: 10 }) } }, ctx);
    const cut = (JSON.parse(result.content) as { categoryCut: { category: string; freesPerMonthEur: number; comparedWithEarlier: { thisIsTimesThat: number } } }).categoryCut;
    assert.deepEqual([cut.category, cut.freesPerMonthEur, cut.comparedWithEarlier.thisIsTimesThat], ["Restaurants", 27.65, 0.5]);
  });
});
