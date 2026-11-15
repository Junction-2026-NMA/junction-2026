// The rework of Sisu's answers: requirements reach every card, honest fees, the weekly budget, neutral labels,
// synthetic peer comparisons, lesson follow-ups and fillers that do not repeat.
import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { AINO, ALL, EETU, SANNA, freshState } from "./helpers";
import { buildSwitchDraft } from "@/lib/actions/drafts";
import { remember } from "@/lib/memory";
import { allFillers, investigationFiller, offerFiller, researchFiller } from "@/lib/agent/fillers";
import { buildSystemPrompt, customerSummary } from "@/lib/agent/prompt";
import { ensureResearch, waitForUsable } from "@/lib/agent/research";
import { toResult } from "@/lib/agent/research/compare";
import { missesFor, parseRequirements, requirementsText } from "@/lib/agent/research/requirements";
import type { RawOffer, RawResearch } from "@/lib/agent/research/types";
import { executeTool, type ToolContext } from "@/lib/agent/tools";
import { offersVisual, peersVisual, safeToSpendVisual } from "@/lib/agent/visuals";
import { BASKETS } from "@/lib/finance/baskets";
import { buildWeeklyBudget, defaultBufferEur } from "@/lib/finance/budget";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { buildOverview } from "@/lib/finance/overview";
import { CONCEPTS, direction, teachingCard } from "@/lib/finance/teaching";
import type { Overview, ResearchResult, Stage, Visual } from "@/lib/types";

const offer = (o: Partial<RawOffer>): RawOffer => ({ provider: "P", plan: null, contractType: "fixed", contractMonths: 12, monthlyPriceEur: 4, energyPriceCentsPerKwh: 9, setupFeeEur: null, sourceUrl: "https://example.com/a", ...o });
const raw = (offers: RawOffer[], billType: RawResearch["billType"] = "electricity"): RawResearch => ({ key: `${billType}:testville`, billType, city: "Testville", status: "done", mock: false, query: "q", startedAt: 1_000, finishedAt: 3_000, pagesDone: 1, pagesTotal: 1, offers, citations: [], errors: [] });
// The bug from the brief: the cheapest offer is a 24-month contract, the customer asked for 12 months or less.
const LONG_CHEAP = offer({ provider: "Long Cheap", plan: "Fixed 24", contractMonths: 24, energyPriceCentsPerKwh: 7, monthlyPriceEur: 3 });
const SHORT_DEAR = offer({ provider: "Short Dear", plan: "Fixed 12", contractMonths: 12, energyPriceCentsPerKwh: 8.5, monthlyPriceEur: 3.5 });
const aino = buildOverview(AINO) as Overview;
const eetu = buildOverview(EETU) as Overview;
const sanna = buildOverview(SANNA) as Overview;
const context = (userTexts: string[] = []): ToolContext => ({ customerId: AINO, overview: aino, city: "Helsinki", memory: { customerId: AINO, consent: true, items: [] }, cashFlow: () => buildCashFlow(aino), userTexts, sisuTexts: [] });
const toolCall = (name: string, args: Record<string, unknown>) => ({ id: `call_${name}`, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });

describe("requirements decide which offer can be best, on every card", () => {
  it("reads only the requirements that were asked for, and drops nonsense", () => {
    assert.equal(parseRequirements({ billType: "electricity" }), null);
    assert.deepEqual(parseRequirements({ maxContractMonths: 12, contractType: "fixed", greenOnly: true, maxMonthlyCostEur: -4, noSetupFee: "yes" }), { maxContractMonths: 12, contractType: "fixed", greenOnly: true });
    assert.deepEqual(parseRequirements({ requirements: { minContractMonths: 6 } }), { minContractMonths: 6 });
    assert.equal(requirementsText({ maxContractMonths: 12, contractType: "fixed" }), "contract of 12 months or less, fixed price");
  });

  it("a value the page does not state counts as a miss, never as fine", () => {
    assert.deepEqual(missesFor(offer({ contractMonths: null }), { maxContractMonths: 12 }, 30), ["contract length not stated"]);
    assert.deepEqual(missesFor(offer({ contractMonths: 24 }), { maxContractMonths: 12 }, 30), ["24-month contract (you asked for 12 months or less)"]);
    assert.deepEqual(missesFor(offer({}), { greenOnly: true }, 30), ["energy source not stated"]);
    assert.deepEqual(missesFor(offer({ greenEnergy: true, setupFeeEur: 0 }), { greenOnly: true, noSetupFee: true }, 30), []);
  });

  it("12 months or less: the 24-month contract is never best, even though it is cheapest", () => {
    const without = toResult(raw([LONG_CHEAP, SHORT_DEAR]), 40, 2_000);
    assert.equal(without.best?.provider, "Long Cheap");
    const result = toResult(raw([LONG_CHEAP, SHORT_DEAR]), 40, 2_000, { maxContractMonths: 12 });
    assert.equal(result.best?.provider, "Short Dear");
    assert.equal(result.matchingCount, 1);
    assert.equal(result.noMatch, false);
    assert.deepEqual(result.offers.map((o) => [o.provider, o.meetsRequirements]), [["Short Dear", true], ["Long Cheap", false]]);
    assert.ok(result.assumptions.some((line) => line.includes("contract of 12 months or less")));
  });

  it("when nothing qualifies there is no best, and the result says no match", () => {
    const result = toResult(raw([LONG_CHEAP, SHORT_DEAR]), 40, 2_000, { maxContractMonths: 6 });
    assert.equal(result.best, null);
    assert.equal(result.noMatch, true);
    assert.equal(offersVisual(result), null, "no chart of offers the customer ruled out");
  });

  it("the offer chart draws only matching offers and says so", () => {
    const visual = offersVisual(toResult(raw([LONG_CHEAP, SHORT_DEAR]), 40, 2_000, { maxContractMonths: 12 })) as Extract<Visual, { kind: "offer_bars" }>;
    assert.deepEqual(visual.offers.map((o) => [o.provider, o.contractMonths]), [["Short Dear", 12]]);
    assert.match(visual.summary, /cheapest matching offer is Short Dear/);
    assert.equal(visual.requirementsText, "contract of 12 months or less");
  });

  it("an unknown fee is not counted as zero: a fully priced offer is preferred, and an incomplete saving says so", () => {
    const noFee = offer({ provider: "No Fee Stated", energyPriceCentsPerKwh: 7, monthlyPriceEur: null });
    const priced = offer({ provider: "Priced", energyPriceCentsPerKwh: 7.5, monthlyPriceEur: 2 });
    const both = toResult(raw([noFee, priced]), 40, 2_000);
    assert.equal(both.best?.provider, "Priced");
    assert.equal(both.offers.find((o) => o.provider === "No Fee Stated")?.monthlyPriceEur, null, "the fee stays unknown");
    assert.equal(both.offers.find((o) => o.provider === "No Fee Stated")?.feesUnknown, true);
    const only = toResult(raw([noFee]), 40, 2_000);
    assert.equal(only.best?.provider, "No Fee Stated");
    assert.equal(only.savingIncomplete, true);
    assert.ok(only.assumptions.some((line) => /does not state its monthly fee/.test(line)));
  });
});

describe("search_offers and prepare_action carry the requirements (mock offers: the cheapest is 24 months)", () => {
  before(async () => void (await waitForUsable(ensureResearch("electricity", "Helsinki").key, 3_000)));
  beforeEach(() => void freshState());

  it("every card from the search agrees: best, stages, chart and the words for the model", async () => {
    const result = await executeTool(toolCall("search_offers", { billType: "electricity", yearlyKwh: 3000, maxContractMonths: 12 }), context(["I use 3000 kWh. Find electricity, 12 months or less"]));
    const research = result.research as ResearchResult;
    assert.equal(research.best?.contractMonths, 12);
    assert.ok(research.offers.filter((o) => o.meetsRequirements === false).every((o) => o.provider !== research.best?.provider));
    const calc = result.stages.find((s) => s.kind === "calculation") as Stage | undefined;
    assert.match(calc?.title ?? "", new RegExp(research.best?.provider ?? "none"));
    const visual = result.visual as Extract<Visual, { kind: "offer_bars" }>;
    assert.ok(visual.offers.every((o) => o.contractMonths !== null && (o.contractMonths ?? 99) <= 12));
    const content = JSON.parse(result.content) as { requirements: string; best: { provider: string } | null; stillToConfirm?: string[] };
    assert.equal(content.requirements, "contract of 12 months or less");
    assert.equal(content.best?.provider, research.best?.provider);
    assert.ok(content.stillToConfirm?.some((line) => /price per kWh and monthly fee/.test(line)), "electricity: the current tariff is still to be confirmed");
    assert.ok(!content.stillToConfirm?.some((line) => /yearly electricity use/.test(line)), "the use was given, so it is not asked again");
    assert.equal(research.bill?.confirmed, false, "the bill name is a guess");
  });

  it("no match: the answer is told to say so, nothing is best, and nothing can be prepared", async () => {
    const result = await executeTool(toolCall("search_offers", { billType: "electricity", maxContractMonths: 6 }), context(["6 months or less please"]));
    const content = JSON.parse(result.content) as { best: unknown; note: string };
    assert.equal(content.best, null);
    assert.match(content.note, /No matching options found/);
    assert.ok(!result.stages.some((s) => s.kind === "calculation"));
    assert.match(result.summary, /No matching options found/);
    const draft = buildSwitchDraft(AINO, "electricity", { preparedBy: "sisu-agent", requirements: { maxContractMonths: 6 } });
    assert.ok(!draft.ok && /No matching options found/.test(draft.reason));
  });

  it("a prepared switch uses the matching offer, and refuses a named offer that misses the requirements", () => {
    remember(AINO, { kind: "yearly_kwh", key: "electricity", value: "3000", billType: null, source: "user-said-in-chat" });
    const draft = buildSwitchDraft(AINO, "electricity", { preparedBy: "sisu-agent", requirements: { maxContractMonths: 12 } });
    assert.ok(draft.ok);
    assert.equal(draft.draft.offer?.contractMonths, 12);
    assert.deepEqual(draft.draft.requirements, { maxContractMonths: 12 });
    const named = buildSwitchDraft(AINO, "electricity", { preparedBy: "sisu-agent", provider: "Example Energia", requirements: { maxContractMonths: 12 } });
    assert.ok(!named.ok && /does not meet what you asked for/.test(named.reason));
  });
});

describe("estimated weekly budget until payday", () => {
  it("is (balance - bills due - buffer) / weeks to payday, with its inputs shown", () => {
    const budget = buildCashFlow(aino).weeklyBudget;
    assert.ok(budget);
    assert.equal(budget.bufferSource, "default");
    assert.equal(budget.bufferEur, defaultBufferEur(aino));
    // Divided by the exact weeks (15 days = 15/7 weeks), as Today does; 2.14 is only the rounded figure in the working.
    const expected = Math.round(((budget.balanceEur - budget.billsBeforePaydayEur - budget.bufferEur) / Math.max(budget.daysToPayday / 7, 1)) * 100) / 100;
    assert.equal(budget.perWeekEur, expected);
    assert.equal(budget.weeksToPayday, 2.14);
    assert.match(budget.steps.at(-1)?.basis ?? "", /divided by 2\.14 weeks/);
    assert.deepEqual(budget.steps.map((step) => step.label), ["Balance today", "Bills expected before payday (2)", "Protected buffer", "Left for spending until payday", "Estimated weekly budget"]);
    assert.ok(budget.assumptions.some((line) => /assumption/.test(line)));
  });

  // Regression: QA, 15 Nov. Sisu divided by weeks rounded to 2.14, so Today said €1,515 and Sisu €1,517.33 for Eetu.
  it("is the figure Today shows: the same exact division for every profile", () => {
    const today = (o: typeof aino) => {
      const b = buildCashFlow(o).weeklyBudget!;
      return Math.round(b.leftForSpendingEur / Math.max(b.daysToPayday / 7, 1));
    };
    assert.deepEqual([aino, eetu, sanna].map((o) => Math.round(buildCashFlow(o).weeklyBudget!.perWeekEur)), [aino, eetu, sanna].map(today));
    assert.deepEqual([aino, eetu, sanna].map((o) => Math.round(buildCashFlow(o).weeklyBudget!.perWeekEur)), [134, 1515, 12117]);
    assert.equal(buildCashFlow(aino).weeklyBudget!.perWeekEur, 133.64);
  });

  it("is never below zero, and says when bills already reach into the buffer", () => {
    const poor = { ...aino, balance: 300 };
    const budget = buildWeeklyBudget(poor, { nextPayday: "2026-10-15", daysToNextPayday: 15, billsBeforePaydayEur: 686.53, billCount: 2, averageDailyEverydayEur: 20 });
    assert.equal(budget?.perWeekEur, 0);
    assert.equal(budget?.shortBeforePayday, true);
    assert.equal(buildWeeklyBudget(aino, { nextPayday: null, daysToNextPayday: null, billsBeforePaydayEur: 0, billCount: 0, averageDailyEverydayEur: 20 }), null);
  });

  it("a payday within the week is one week of budget, not a bigger one", () => {
    const budget = buildWeeklyBudget(aino, { nextPayday: "2026-10-02", daysToNextPayday: 2, billsBeforePaydayEur: 0, billCount: 0, averageDailyEverydayEur: 20 }, 100);
    assert.equal(budget?.weeksToPayday, 1);
    assert.equal(budget?.perWeekEur, Math.round((aino.balance - 100) * 100) / 100);
  });

  it("get_cash_flow uses a buffer only when the customer said it, and shows one card", async () => {
    const stated = await executeTool(toolCall("get_cash_flow", { bufferEur: 300 }), context(["Keep 300 euros untouched. What can I spend this week?"]));
    const unsaid = await executeTool(toolCall("get_cash_flow", { bufferEur: 300 }), context(["What can I spend this week?"]));
    const budgetOf = (content: string) => (JSON.parse(content) as { estimatedWeeklyBudgetUntilPayday: { protectedBufferEur: number } }).estimatedWeeklyBudgetUntilPayday.protectedBufferEur;
    assert.equal(budgetOf(stated.content), 300);
    assert.equal(budgetOf(unsaid.content), defaultBufferEur(aino));
    assert.equal(stated.stages.length, 1);
    assert.equal(stated.stages[0].title, "Estimated weekly budget until payday");
    assert.ok(stated.facts.some((f) => f.id === "cash:budget:per-week"));
    assert.doesNotMatch(stated.content, /safeToSpend/);
  });

  // Regression: QA, 15 Nov. Today used the €300 buffer set in the app; Sisu assumed one week of essentials instead.
  it("uses the buffer set in the app, unless the customer names another amount in the chat", async () => {
    const inApp = (texts: string[]): ToolContext => ({ ...context(texts), bufferEur: 300, cashFlow: () => buildCashFlow(aino, { bufferEur: 300, bufferFrom: "app" }) });
    const read = (content: string) => (JSON.parse(content) as { estimatedWeeklyBudgetUntilPayday: { protectedBufferEur: number; bufferIs: string; perWeekEur: number } }).estimatedWeeklyBudgetUntilPayday;
    const app = read((await executeTool(toolCall("get_cash_flow", {}), inApp(["What can I spend this week?"]))).content);
    assert.deepEqual([app.protectedBufferEur, app.bufferIs, app.perWeekEur], [300, "the amount the customer set in the app", 109.12]);
    const said = read((await executeTool(toolCall("get_cash_flow", { bufferEur: 50 }), inApp(["What if I keep only 50 euros as my buffer?"]))).content);
    assert.deepEqual([said.protectedBufferEur, said.bufferIs], [50, "what the customer said"]);
    const summary = JSON.parse(customerSummary(aino, "Helsinki", 300)) as { estimatedWeeklyBudgetUntilPayday: { perWeekEur: number; protectedBufferEur: number; bufferIs: string } };
    assert.deepEqual([summary.estimatedWeeklyBudgetUntilPayday.perWeekEur, summary.estimatedWeeklyBudgetUntilPayday.protectedBufferEur], [109.12, 300]);
    assert.match(summary.estimatedWeeklyBudgetUntilPayday.bufferIs, /the amount you set in the app/);
    assert.match((JSON.parse(customerSummary(aino, "Helsinki")) as { estimatedWeeklyBudgetUntilPayday: { bufferIs: string } }).estimatedWeeklyBudgetUntilPayday.bufferIs, /assumption/);
  });

  // Regression: QA, 15 Nov. "Can I afford a €200 jacket?" showed only "Your input" and "Estimate": every line of the
  // working was tagged as a calculation, though the balance, the bills and the everyday spending are bank data.
  it("the affordability working says which lines are bank data, which is the customer's input and which is worked out", async () => {
    const result = await executeTool(toolCall("check_affordability", { amountEur: 200, what: "a jacket" }), context(["Can I afford a €200 jacket this month?"]));
    const steps = result.facts.filter((f) => f.id.startsWith("afford:step:")).map((f) => [f.label.replace(/\s\(\d+\)$/, "").replace(/\d+ days/, "N days"), f.source]);
    assert.deepEqual(steps, [
      ["Balance today", "bank-data"],
      ["This cost", "customer-stated"],
      ["Bills expected before payday", "bank-data"],
      ["Everyday spending for N days", "bank-data"],
      ["Expected balance just before payday", "calculation"],
      ["Essential costs in a month", "bank-data"],
    ]);
    assert.deepEqual([...new Set(result.facts.map((f) => f.source))].sort(), ["bank-data", "calculation", "customer-stated"]);
  });

  it("the chart is the weekly budget, never 'safe to spend'", () => {
    const visual = safeToSpendVisual(aino);
    assert.match(visual.title, /estimated weekly budget/i);
    assert.doesNotMatch(JSON.stringify(visual), /safe to spend|safe-to-spend/i);
  });
});

describe("labels say what the baskets are, and peers are demo profiles", () => {
  it("the baskets are Regular essentials, Occasional essentials and Everyday spending", () => {
    assert.deepEqual(Object.values(BASKETS).map((b) => b.label), ["Regular essentials", "Occasional essentials", "Everyday spending"]);
    assert.deepEqual(aino.baskets.map((b) => b.label), ["Regular essentials", "Occasional essentials", "Everyday spending"]);
    assert.match(BASKETS.everyday.description, /Groceries are essential/);
  });

  it("no lesson, prompt or chart uses the old names or 'safe to spend'", () => {
    const text = [JSON.stringify(CONCEPTS.map((concept) => teachingCard(concept, aino))), buildSystemPrompt({ overview: aino, city: "Helsinki", mode: "text", memory: { customerId: AINO, consent: true, items: [] } })].join(" ");
    assert.doesNotMatch(text.replace(/Never say 'people your age', 'young adults'/, ""), /Must pay|Everyday choices|everyday choices|people your age|young adults/);
    assert.doesNotMatch(text.replace(/never call any figure 'safe to spend'/, ""), /safe to spend/i);
  });

  it("peer charts and facts are marked synthetic and worded as demo data", () => {
    const visual = peersVisual(aino) as Extract<Visual, { kind: "peer_bars" }>;
    assert.equal(visual.synthetic, true);
    assert.match(visual.summary, /other profiles in the demo data/);
    assert.ok(visual.facts.filter((f) => f.id.endsWith(":peers")).every((f) => f.synthetic === true));
    assert.ok(aino.insights.every((i) => !/people your age/.test(i.title)));
  });
});

describe("lessons check understanding with kind explanations and a follow-up", () => {
  for (const id of ALL) {
    const overview = buildOverview(id) as Overview;
    for (const concept of CONCEPTS) {
      it(`${id} ${concept}: one reason per option and a follow-up with a valid answer`, () => {
        const card = teachingCard(concept, overview);
        assert.equal(card.whyWrong?.length, card.options.length);
        assert.ok(card.whyWrong?.every((line) => line.length > 10));
        assert.ok(card.followUp);
        assert.equal(card.followUp.options.length, 3);
        assert.ok(card.followUp.correctIndex >= 0 && card.followUp.correctIndex < card.followUp.options.length);
        assert.equal(new Set(card.followUp.options).size, card.followUp.options.length);
        assert.ok(card.followUp.reveal.length > 20);
        assert.deepEqual(teachingCard(concept, overview), card, "the same customer always gets the same card");
      });
    }
  }
});

// Regression: QA, 15 Nov. Aino chose "About 15%" for a real share of 40% and heard "Close, but the real share is higher".
describe("a wrong guess hears which way it was off, and 'Close' only when it was", () => {
  it("is 'Not quite' for a guess off by half or double, and 'Close' within about a fifth", () => {
    assert.equal(direction(15, 40, "share"), "Not quite: the real share is higher than that.");
    assert.equal(direction(35, 40, "share"), "Close, but the real share is higher than that.");
    assert.equal(direction(80, 40, "share"), "Not quite: that is more than the real share.");
    assert.equal(direction(45, 40, "share"), "Close, but that is more than the real share.");
  });

  it("no lesson calls a guess 'Close' when it is far from the real figure", () => {
    const card = teachingCard("three-baskets", aino);
    const share = Number(/About (\d+)%/.exec(card.options[card.correctIndex])![1]);
    card.options.forEach((option, index) => {
      if (index === card.correctIndex) return;
      const guess = Number(/About (\d+)%/.exec(option)![1]);
      if (Math.abs(guess - share) > share * 0.2) assert.match(card.whyWrong![index], /^Not quite/, `${option} for ${share}%`);
    });
    const bills = teachingCard("switching-bills", aino);
    assert.ok(bills.whyWrong!.every((line) => !/^Close/.test(line)), "half or 1.7 times the yearly total is not close");
  });
});

describe("fillers vary by turn and never repeat back to back", () => {
  it("consecutive turns hear different lines, and the same turn always the same", () => {
    for (const make of [(turn: number) => offerFiller("electricity", "Helsinki", "en", { turn }), (turn: number) => researchFiller("en", { turn }), (turn: number) => investigationFiller("Aino", "fi", { turn })]) {
      const lines = [0, 1, 2, 3, 4, 5].map(make);
      lines.slice(1).forEach((line, index) => assert.notEqual(line, lines[index]));
      assert.equal(make(3), make(3));
    }
  });

  it("skips a line Sisu has just said, and unknown languages stay quiet", () => {
    const first = offerFiller("mobile", "Helsinki", "en", { turn: 2 }) as string;
    assert.notEqual(offerFiller("mobile", "Helsinki", "en", { turn: 2, recent: [`${first} Here is what I found.`] }), first);
    assert.equal(offerFiller("mobile", "Helsinki", "ja"), null);
    assert.equal(offerFiller("electricity", "Helsinki"), "Let me check today's electricity deals in Helsinki.");
    assert.ok(allFillers("Espoo").length >= 12);
  });
});

describe("the prompt asks for short answers that do not repeat the cards", () => {
  const prompt = (mode: "voice" | "text") => buildSystemPrompt({ overview: aino, city: "Helsinki", mode, memory: { customerId: AINO, consent: true, items: [] } });
  it("text: a direct answer, one number, one next step; the cards carry the working", () => {
    assert.match(prompt("text"), /one most useful number first, then one next step/);
    assert.match(prompt("text"), /do not repeat them/);
    assert.match(prompt("text"), /ask ONE short clarifying question/);
    assert.match(prompt("text"), /No matching options found/);
  });
  it("voice: spoken words, contractions and a question back", () => {
    assert.match(prompt("voice"), /contractions/);
    assert.match(prompt("voice"), /short, natural question back/);
  });
});
