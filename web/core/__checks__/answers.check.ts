// Checks for short answers (rework of 15 Nov): one result, details said once, source labels, readable dates and
// minus signs, and offers that respect the user's requirements (never "Best" for one that misses them, "No matching
// options found" when none meets them, unknown fees never counted as known). QA of 15 Nov: requirements read from the
// question when the backend sends none, several bills in one turn, transfers worded as transfers, the synthetic
// peer label, numbers said once, and reused web results.
// Run: npx tsx web/core/__checks__/answers.check.ts
import { AnswerPresenter, CardText, SourceTags } from "@/web/core/AnswerPresentation";
import { AskedRequirements } from "@/web/core/AnswerRequirements";
import type { AgentAction, Fact, Offer, ResearchResult, Stage, ToolTrace } from "@/web/core/CoachModels";
import { ActionPresenter, GroundingPresenter, OfferPresenter } from "@/web/core/CoachPresentation";
import { StepPresenter } from "@/web/core/ChartPresentation";
import { CoachMessage, CoachStep } from "@/web/core/CoachSession";
import { Working } from "@/web/core/AnswerWorking";
import { Visual } from "@/web/core/PlanModels";
import { PaydayAnswers } from "@/web/core/AnswerPayday";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { Overview } from "@/web/core/Models";

let failures = 0, passes = 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function eq(actual: unknown, expected: unknown, label: string): void {
  if (same(actual, expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
function group(name: string, body: () => void): void {
  const before = failures;
  try { body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

const url = "https://example.com/offers";
const offer = (provider: string, months: number, saving: number, extra: Partial<Offer> = {}): Offer => ({
  provider, plan: `Fixed ${months}`, contractType: "fixed", contractMonths: months, monthlyPriceEur: 3.9, energyPriceCentsPerKwh: 8.9,
  setupFeeEur: 0, sourceUrl: url, comparable: true, estimatedMonthlyCostEur: 16.99, estimatedYearlySavingEur: saving, ...extra,
});
const research = (offers: Offer[], extra: Partial<ResearchResult> = {}): ResearchResult => ({
  key: "electricity:Helsinki", billType: "electricity", city: "Helsinki", status: "done", mock: false, query: "q", startedAt: "2026-11-15T10:00:00Z",
  finishedAt: "2026-11-15T10:00:05Z", tookMs: 5000, pagesDone: 1, pagesTotal: 1, baselineMonthlyEur: 40, offers, best: offers[0] ?? null,
  citations: [{ title: "Offers", url, retrievedAt: "2026-11-15T10:00:05Z", readBy: "exa" }], assumptions: ["Prices as stated.", "Usage 2,000 kWh a year."], errors: [], ...extra,
});
const calcStage = (id: string, title: string, label: string, value: number, unit: string, assumptions: string[], toolCallId: string | null = null): Stage => ({
  id, kind: "calculation", title, summary: "", source: "calculation", toolCallId, atMs: 0, facts: [],
  data: { kind: "calculation", steps: [{ label: "Bill", amount: 40, basis: "average since 2026-01-01" }], resultLabel: label, resultValue: value, unit, assumptions },
});

group("card text: ISO dates and minus signs", () => {
  eq(CardText.humanize("the largest was on 2026-01-01.", "en"), "the largest was on 1 Jan 2026.", "date");
  eq(CardText.humanize("read 2026-11-15 10:42 UTC", "en", "Europe/Helsinki"), "read 15 Nov 2026, 12:42", "date and time in UTC");
  eq(CardText.humanize("the lowest point was €-325.50, or -€12", "en"), "the lowest point was −€325.50, or −€12", "minus");
  eq(CardText.humanize("1-40 c/kWh", "en"), "1-40 c/kWh", "a range stays");
});

group("source labels", () => {
  eq(["bank-data", "customer-stated", "exa", "calculation", "nemotron", "peer-data", "weird"].map((s) => SourceTags.of(s)?.label ?? null),
    ["Bank data", "Your input", "Web · Exa", "Estimate", "Estimate", "Synthetic demo data comparison", null], "kinds");
  eq(SourceTags.web("context.dev", "2026-11-15T10:00:05Z", "en", "Europe/Helsinki").label, "Web · Context.dev · 15 Nov 2026, 12:00", "web with time");
  const peers = Visual.decode({ id: "vs_peers", kind: "peer_bars", title: "You and others", source: "bank-data", peerGroup: "aged 18-24", rows: [] });
  eq(SourceTags.isSynthetic(peers), true, "peer chart is synthetic even when labelled bank-data");
  eq(Visual.decode({ id: "x", kind: "budget_donut", synthetic: true, slices: [], total: 0 }).synthetic, true, "synthetic flag decoded");
  eq(SourceTags.unique([SourceTags.estimate(), SourceTags.bank(), SourceTags.estimate(), null]).map((t) => t.kind), ["bank", "estimate"], "unique, ordered");
});

group("offers: requirements, best, fees", () => {
  const long = offer("Example Energia", 24, 24, { meetsRequirements: false, misses: ["Contract is 24 months; you asked for 12 or less"] });
  const short = offer("Demo Sähkö", 12, -24, { meetsRequirements: true });
  const r = research([long, short], { requirements: { maxContractMonths: 12 }, matchingCount: 1 });
  const rows = OfferPresenter.rows(r);
  eq(rows.map((row) => [row.provider, row.isBest, row.meets]), [["Demo Sähkö", false, true], ["Example Energia", false, false]], "matching first; a missing offer is never best");
  eq(OfferPresenter.headline(r), "Nothing cheaper that meets your requirements", "headline never names a non-qualifying best");
  eq(OfferPresenter.noMatch(r), false, "one offer matches");
  eq(OfferPresenter.noMatch(research([long], { noMatch: true })), true, "backend says none");
  eq(OfferPresenter.noMatch(research([long], { requirements: { maxContractMonths: 12 }, matchingCount: 0 })), true, "matching count 0");
  eq(OfferPresenter.noMatch(research([offer("A", 24, 24)]), "None of the offers meet your 12-month requirement."), true, "the answer's own words");
  eq(OfferPresenter.noMatch(research([offer("A", 24, 24)]), "No example offer is cheaper than your current bill."), false, "not a requirement sentence");
  eq(OfferPresenter.requirementText(research([], { requirements: { maxContractMonths: 12, contractType: "fixed", noSetupFee: true } })),
    "You asked for a contract of 12 months or less, a fixed price, no setup fee.", "requirement text");
  const unknownFees = OfferPresenter.row(offer("B", 12, 24, { monthlyPriceEur: null, setupFeeEur: null }));
  eq([unknownFees.fees, unknownFees.feesUnknown, unknownFees.saving], ["Fees unknown", true, "About €24 less a year · incomplete"], "unknown fees are never €0");
  eq(OfferPresenter.row(offer("C", 12, 24)).fees, "Base fee €3.90 a month · No setup fee", "stated fees");
  eq(OfferPresenter.row(offer("C", 12, 24)).estimatedMonthlyCost, "About €16.99 a month", "the estimated monthly cost the answer uses");
});

group("answer: one result, details once", () => {
  const best = offer("Example Energia", 24, 24.12);
  const r = research([best, offer("Demo Sähkö", 12, -24)]);
  const extraction: Stage = { id: "x", kind: "extraction", title: "Read", summary: "", source: "context.dev", toolCallId: "t1", atMs: 0, facts: [],
    data: { kind: "extraction", extractedWith: "context.dev", pagesRead: 1, pagesTotal: 1, offers: r.offers, problems: [] } };
  const saving = calcStage("c", "Saving with Example Energia", "Estimated saving per year", 24.12, "EUR/year", ["Prices as stated.", "Usage 2,000 kWh a year."], "t1");
  const message = CoachMessage.make("m", "assistant", { text: "Example Energia saves about €24 a year.", research: r, stages: [extraction, saving] });
  const view = AnswerPresenter.view(message, "en", "Europe/Helsinki");
  eq([view.result?.label, view.result?.value, view.noMatch], ["Estimated saving per year", "€24.12 a year", false], "the saving is the result");
  eq(view.assumptions, ["Prices as stated.", "Usage 2,000 kWh a year."], "assumptions said once");
  eq(view.how.map((block) => block.title), ["Saving with Example Energia"], "the working");
  eq(view.how[0].lines.map((line) => line.detail), ["average since 1 Jan 2026"], "no ISO date in the working, and no repeated result line");
  eq(view.sources.map((s) => s.url), [url], "sources once");
  eq(view.offers?.rows.find((row) => row.isBest)?.provider, "Example Energia", "best match when nothing was required");

  const said = CoachMessage.make("m2", "assistant", { text: "None of the offers meet your 12-month limit.", research: r, stages: [extraction, saving] });
  const none = AnswerPresenter.view(said, "en", "Europe/Helsinki");
  eq([none.result?.label, none.result?.noMatch, none.offers?.rows.some((row) => row.isBest)], ["No matching options found", true, false], "QA bug: text says none qualifies, no Best offer");
  eq(none.how.length, 0, "the saving of a non-qualifying offer is not shown as working");
});

group("answer: other results", () => {
  const cash = calcStage("c", "Balance before the next payday", "Expected balance just before payday", 177.12, "EUR", ["Based on 12 months"]);
  const withSummary = { ...cash, summary: "About €177 expected on 2026-10-15" };
  const view = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: "x", stages: [withSummary] }), "en");
  eq([view.result?.value, view.result?.detail], ["€177.12", null], "a summary that repeats the value is dropped");
  const empty = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: "Hello" }), "en");
  eq([empty.result, empty.how.length, empty.assumptions.length], [null, 0, 0], "a plain reply has no result card");
});

// MARK: - QA of 15 Nov

const trace = (id: string, name: string, args: Record<string, string>, tookMs: number, summary: string): ToolTrace =>
  ({ id, name, args, source: name === "search_offers" ? "exa+context.dev" : "finance", startedAtMs: 0, tookMs, ok: true, summary, joinedPrefetch: tookMs === 0 });
const searched = (id: string, bill: string, at = "2026-11-15T10:00:05Z"): Stage => ({ id: `${id}-r`, kind: "research", title: `Searched today's ${bill} offers`, summary: "", source: "exa",
  toolCallId: id, atMs: 0, facts: [], data: { kind: "research", query: "q", searchedWith: "exa", pages: [{ title: `${bill} page`, url: `https://example.com/${bill}`, retrievedAt: at }], retrievedAt: at, mock: false } });
const read = (id: string, offers: Offer[]): Stage => ({ id: `${id}-x`, kind: "extraction", title: "Read the offer pages", summary: "", source: "context.dev", toolCallId: id, atMs: 0, facts: [],
  data: { kind: "extraction", extractedWith: "context.dev", pagesRead: 1, pagesTotal: 1, offers, problems: [] } });
const saving = (id: string, provider: string, bill: number, yearly: number): Stage => ({ id: `${id}-c`, kind: "calculation", title: `Saving with ${provider}`, summary: "", source: "calculation",
  toolCallId: id, atMs: 0, facts: [], data: { kind: "calculation", resultLabel: "Estimated saving per year", resultValue: yearly, unit: "EUR/year", assumptions: [],
    steps: [{ label: "Your bill per month", amount: bill, basis: "average" }, { label: "Estimated saving per year", amount: yearly, basis: "monthly saving times 12" }] } });

group("requirements read from the question when the backend sent none (live: 24-month 'Best match')", () => {
  const ask = AskedRequirements.maxContractMonths;
  eq(["Find me electricity contracts of 12 months or less", "at most 6 months please", "a plan up to 12 months", "max 24 months", "a contract of a year or less",
    "twelve-month contracts or shorter", "Find me a cheaper electricity deal", "12-month contract"].map(ask), [12, 6, 12, 24, 12, 12, null, null], "phrasings");
  eq(["The electricity offers I found are all 24-month contracts, not 12 months or less.", "None of the offers I found have a contract of 6 months or less.",
    "There are no electricity contracts of 6 months or less on the pages I read.", "No example offer is cheaper than your current bill.",
    "None of the offers are cheaper than what you pay now.", "There are no cheaper offers today."].map(OfferPresenter.textSaysNoMatch),
  [true, true, true, false, false, false], "the live sentences, and sentences that only say nothing is cheaper");

  const long = offer("Pohjois-Karjalan Sähkö Oy", 24, 66.72, { setupFeeEur: null, monthlyPriceEur: 0 });
  const offers = [long, offer("Vaasan Sähkö", 24, 35.88), offer("Hehku", 36, -55.92), offer("Väre", 0, 0, { contractMonths: null, comparable: false, estimatedYearlySavingEur: null })];
  const live = research(offers, { requirements: undefined, matchingCount: undefined, noMatch: undefined });
  const text = "The electricity offers I found are all 24-month contracts, not 12 months or less. The cheapest 24-month option saves about 66.72 euros a year.";
  const message = CoachMessage.make("m", "assistant", { text, research: live, stages: [searched("t1", "electricity"), read("t1", offers), saving("t1", long.provider, 39.83, 66.72)] });
  const view = AnswerPresenter.view(message, "en", "Europe/Helsinki", "Find me electricity contracts of 12 months or less");
  eq([view.result?.label, view.result?.value, view.result?.detail, view.noMatch], ["No matching options found", null, "You asked for a contract of 12 months or less.", true], "the No matching card");
  eq([view.offers?.rows.some((row) => row.isBest), view.offers?.rows.every((row) => row.meets === false)], [false, true], "nothing is Best match; every offer is listed as missing");
  eq(view.offers?.rows.map((row) => row.misses[0]), ["24-month contract (you asked for 12 months or less)", "24-month contract (you asked for 12 months or less)",
    "36-month contract (you asked for 12 months or less)", "contract length not stated"], "a length not stated is not a match");
  eq([view.how.length, view.offers?.requirement], [0, null], "no saving of a 24-month offer, and the requirement said once (on the card)");
  eq(view.steps.length, 0, "no tool steps in this fixture");

  const short = offer("Lyhyt Sähkö", 12, 20, { estimatedMonthlyCostEur: 38.16 });
  const mixed = research([long, short], { requirements: undefined, best: long });
  const some = AnswerPresenter.view(CoachMessage.make("m2", "assistant", { text: "x", research: mixed, stages: [read("t1", [long, short]), saving("t1", long.provider, 39.83, 66.72)] }),
    "en", "Europe/Helsinki", "Find me electricity contracts of 12 months or less");
  eq([some.result?.label, some.result?.value, some.offers?.rows.find((row) => row.isBest)?.provider], ["Estimated saving with Lyhyt Sähkö", "€20 a year", "Lyhyt Sähkö"],
    "the 12-month offer leads; the 24-month saving is not shown");
  eq(some.offers?.rows.map((row) => [row.provider, row.meets]), [["Lyhyt Sähkö", true], [long.provider, false]], "the miss is listed apart");
  const unasked = AnswerPresenter.view(CoachMessage.make("m3", "assistant", { text: "x", research: mixed }), "en", "Europe/Helsinki", "Find me a cheaper deal");
  eq(unasked.offers?.rows.find((row) => row.isBest)?.provider, long.provider, "nothing asked, nothing judged");
  const stated = research([long], { requirements: { minContractMonths: 24 }, matchingCount: 1 });
  eq(AskedRequirements.apply(stated, "12 months or less"), stated, "the backend's own requirements stand");
});

group("several bills in one turn: one result, offers per bill (live: €47.76 'With Valoo')", () => {
  const elec = offer("Vaasan Sähkö Myynti Oy", 24, 47.76);
  const mobile = offer("Moi", 12, 112.92, { plan: "Moi 5G", energyPriceCentsPerKwh: null });
  const net = offer("Valoo", 12, 136.32, { plan: "Netti L 1000M", energyPriceCentsPerKwh: null });
  const tools = [trace("e", "search_offers", { billType: "electricity" }, 4300, "15 offers from 3 pages in 4.3 s"),
    trace("m", "search_offers", { billType: "mobile" }, 4500, "18 offers"), trace("i", "search_offers", { billType: "internet" }, 4500, "18 offers")];
  const stages = (order: string[]) => order.flatMap((id) => {
    const [bill, o, base] = id === "e" ? ["electricity", elec, 39.83] as const : id === "m" ? ["mobile", mobile, 24.83] as const : ["internet", net, 30.36] as const;
    return [searched(id, bill), read(id, [o]), saving(id, o.provider, base, o.estimatedYearlySavingEur!)];
  });
  const text = "The biggest saving is on internet: Valoo Netti L 1000M, about 136 euros a year.";
  const last = research([net], { billType: "internet", baselineMonthlyEur: 30.36, best: net });
  const view = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text, research: last, tools, stages: stages(["e", "m", "i"]) }), "en", "Europe/Helsinki", "Find a cheaper plan that meets my needs.");
  eq([view.result?.value, view.result?.detail], ["€136.32 a year", "With Valoo (Netti L 1000M)"], "value and offer from the same bill");
  eq(view.offers?.sections.map((section) => [section.title, section.baseline, section.rows.map((row) => row.provider).join()]),
    [["Electricity offers", "Your bill now: about €40 a month", elec.provider], ["Mobile offers", "Your bill now: about €25 a month", "Moi"], ["Internet offers", "Your bill now: about €30 a month", "Valoo"]],
    "every bill, each with its own bill now");
  eq(view.how.map((block) => block.title), ["Saving with Vaasan Sähkö Myynti Oy", "Saving with Moi", "Saving with Valoo"], "every bill's working");
  eq(view.how[2].lines.map((line) => line.label), ["Your bill per month"], "the result's own total is not repeated");
  const electricityLast = research([elec], { billType: "electricity", best: elec });
  const reordered = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text, research: electricityLast, tools, stages: stages(["i", "m", "e"]) }), "en");
  eq([reordered.result?.value, reordered.result?.detail], ["€136.32 a year", "With Valoo (Netti L 1000M)"], "the largest saving leads whichever bill came last");
});

group("transfers are worded as transfers (live: '€50 a month freed')", () => {
  const action = (kind: string, amount: number, status = "executed_simulated"): AgentAction => ({ id: kind, kind, status, simulated: true, title: "t", summary: "s",
    checklist: ["a", "b", "c"], monthlyAmountEur: amount, facts: [], sources: [], assumptions: [], expiresAt: "2026-11-15T12:00:00Z", destination: kind === "switch_contract" ? null : "savings" });
  const once = ActionPresenter.card(action("one_off_transfer", 50), "en", "Europe/Helsinki");
  eq([once.monthly, once.amountNote, once.statusSentence, once.simulatedTag, once.checklistLabel, once.approvedLine],
    ["€50", "to your savings", "Approved. Simulated, no money moved.", "Simulated, no money moves", "What a real transfer takes (3 steps)", "€50 to your savings. Simulated, no money moved."], "one-off");
  eq(ActionPresenter.card(action("standing_transfer", 50), "en").approvedLine, "€50 a month to your savings. Simulated, no money moved.", "standing");
  const sw = ActionPresenter.card(action("switch_contract", 2.01), "en");
  eq([sw.monthly, sw.statusSentence, sw.checklistLabel, sw.approvedLine], ["€2.01 a month", "Approved. Simulated, no real switch was made.", "What a real switch takes (3 steps)",
    "€2.01 a month freed. Simulated, no real switch."], "switch");
});

group("peer comparisons carry the synthetic label (live: 'people your age')", () => {
  const fact = (id: string, label: string, value: number, unit = "EUR"): Fact => ({ id, label, value, unit, source: "bank-data", basis: "ages 18-24" });
  const grounding = { ok: true, checked: 1, unverified: [], numbers: [{ value: 419, status: "receipt", factId: "overview:peers" }], corrections: [] };
  const peers = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: "Your peer group is 419 customers aged 18-24.", grounding, facts: [fact("overview:peers", "Customers in the same age band", 419, "count")] }), "en");
  eq(peers.tags.map((tag) => tag.kind), ["bank", "synthetic"], "synthetic tag in Sources");
  eq(peers.how.map((block) => [block.title, block.lines.map((line) => [line.label, line.value, line.detail])]),
    [["Figures behind this answer", [["Customers in the same age band", "419", "ages 18-24"]]]], "an answer without a calculation shows its figures");
  const plain = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: "Your balance is 1220.35 euros.", facts: [fact("overview:balance", "Balance", 1220.35), fact("overview:peers", "Customers in the same age band", 419)] }), "en");
  eq([plain.tags.some((tag) => tag.kind === "synthetic"), plain.how[0]?.lines.map((line) => line.label)], [false, ["Balance"]], "unused peer facts add no tag; a figure the text never says is left out");
});

group("each number said once; readable working", () => {
  const budget: Stage = { id: "c", kind: "calculation", title: "Estimated weekly budget until payday", summary: "About €134 a week until 2026-10-15", source: "calculation", toolCallId: "p", atMs: 0, facts: [],
    data: { kind: "calculation", resultLabel: "Estimated weekly budget", resultValue: 133.82, unit: "EUR", assumptions: ["Payday is expected on 2026-10-15."],
      steps: [{ label: "Balance today", amount: 1220.35, basis: "on 2026-09-30" }, { label: "Estimated weekly budget", amount: 133.82, basis: "divided by 2.14 weeks" },
        { label: "If you spend as usual: balance just before payday", amount: 177.12, basis: "after usual spending" }] } };
  const steps = [{ ...CoachStep.make("p", "Working out your balance from now until payday"), done: true, tookMs: 1, result: "Next payday 2026-10-15; expected balance just before it €177.12; estimated weekly budget €133.82" }];
  const view = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: "Your estimated weekly budget is about 133.82 euros.", stages: [budget], steps,
    tools: [trace("p", "get_cash_flow", {}, 1, "")] }), "en");
  eq([view.result?.value, view.result?.detail], ["€133.82", null], "a summary that says the result rounded is left out");
  eq(view.how[0].lines.map((line) => line.label), ["Balance today", "If you spend as usual: balance just before payday"], "the result step goes wherever it stands");
  eq([view.steps[0].label, view.steps[0].result], ["Worked out your balance from now until payday", null], "past tense; a tool line that only repeats numbers is left out");
  eq(view.assumptions, ["Payday is expected on 15 Oct 2026."], "readable assumptions");
  eq([CardText.humanize("€2010.63 on Restaurants"), CardText.humanize("about 1220.35 euros, then -22.88 euros"), CardText.humanize("Utilities in 2026-09"), CardText.humanize("1,783.33 euros")],
    ["€2,010.63 on Restaurants", "about €1,220.35, then −€22.88", "Utilities in Sep 2026", "€1,783.33"], "amounts and months");
  eq([CardText.words("Must-pay costs in a month"), CardText.words("regular plus now-and-then baskets"), CardText.words("Safe to spend per week")],
    ["Essential costs in a month", "regular plus occasional essentials", "Weekly room in an average month"], "the app's words");
  eq(GroundingPresenter.line({ ok: true, checked: 1, unverified: [], numbers: [], corrections: [] })?.text, "1 number has a source", "badge wording");
});

group("fees and reused results", () => {
  const stated = offer("A", 12, 24, { setupFeeEur: null, monthlyPriceEur: 3.9 });
  eq([OfferPresenter.feesUnknown(stated), OfferPresenter.row(stated).saving, OfferPresenter.row(stated).fees], [false, "About €24 less a year", "Base fee €3.90 a month · Setup fee unknown"],
    "electricity: an unstated setup fee is shown as unknown but does not make the saving incomplete");
  eq(OfferPresenter.feesUnknown(offer("B", 12, 24, { monthlyPriceEur: null })), true, "a missing base fee does");
  eq(OfferPresenter.feesUnknown(offer("C", 12, 24, { energyPriceCentsPerKwh: null, setupFeeEur: null })), true, "another bill spreads its setup fee: unknown, incomplete");
  const step = { ...CoachStep.make("s", "Searching today's electricity offers with Exa and reading the pages with Context.dev"), done: true, tookMs: 0, result: "3 offers from 1 page in 0.9 s" };
  const message = CoachMessage.make("m", "assistant", { steps: [step], tools: [trace("s", "search_offers", { billType: "electricity" }, 0, step.result)], stages: [searched("s", "electricity", "2026-11-15T00:43:07Z")] });
  eq(StepPresenter.rows(message, "en", "Europe/Helsinki").map((row) => [row.label, row.result, row.duration]),
    [["Searched today's electricity offers with Exa and read the pages with Context.dev", "3 offers from 1 page · reused results from 02:43", null]], "one honest time");
  const fresh = { ...step, tookMs: 3671, result: "15 offers from 3 pages in 3.6 s; best saves €67 a year" };
  const live = CoachMessage.make("m", "assistant", { steps: [fresh], tools: [trace("s", "search_offers", { billType: "electricity" }, 3671, fresh.result)] });
  eq(StepPresenter.rows(live, "en").map((row) => [row.result, row.duration]), [["15 offers from 3 pages; best saves €67 a year", "3.7 s"]], "a fresh search: its own duration once");
});

// MARK: - Final round of 15 Nov

const f = (id: string, label: string, value: number, unit: string, source = "calculation", extra: Partial<Fact> = {}): Fact => ({ id, label, value, unit, source, basis: "b", ...extra });
const restaurantFacts: Fact[] = [
  f("scenario:freed", "Freed per month", 55.3, "EUR/month"), f("scenario:years", "Years ahead", 5, "years", "customer-stated"),
  f("scenario:category-avg", "Restaurants, average per month", 276.52, "EUR/month", "bank-data", { basis: "average of the last 12 months", evidence: { from: "2025-10-01", to: "2026-09-30", category: "Restaurants" } }),
  f("scenario:category-cut-pct", "Cut asked for", 20, "percent", "customer-stated"),
  f("scenario:category-freed", "Cutting Restaurants by 20% frees, per month", 55.3, "EUR/month"),
  f("scenario:category-freed-yearly", "Cutting Restaurants by 20% frees, per year", 663.6, "EUR/year"),
  f("scenario:gain", "Extra after the period if the money is kept", 3318, "EUR"), f("scenario:save:end", "Make the change, keep the cash: total at the end", 3808.75, "EUR"),
];
const restaurantImpact = (monthly = 55.3): Stage => ({ id: "i", kind: "impact", title: "5 years ahead", summary: "About €3318 more after 5 years if the freed money is kept.", source: "calculation",
  toolCallId: "s", atMs: 0, facts: restaurantFacts, data: { kind: "impact", impact: { monthlyEur: monthly, yearlyEur: monthly * 12, horizonYears: 5, gainVsNothingEur: 3318,
    summary: "About €3318 more after 5 years if the freed money is kept.", branches: [{ id: "nothing", label: "Change nothing", endTotal: 490.75, endLow: 490.75, endHigh: 490.75 },
      { id: "save", label: "Make the change, keep the cash", endTotal: 3808.75, endLow: 3808.75, endHigh: 3808.75 },
      { id: "invest", label: "Make the change, invest it", endTotal: 4247.32, endLow: 3877.11, endHigh: 4559.18 }] } } });
const restaurantText = "Spending 20% less on restaurants would free about 55.3 euros a month, or 663.6 euros a year, from your 12-month average.";
const restaurantGrounding = { ok: true, checked: 4, unverified: [], corrections: [], numbers: [{ value: 20, status: "receipt", factId: "scenario:category-cut-pct" },
  { value: 55.3, status: "receipt", factId: "scenario:freed" }, { value: 663.6, status: "receipt", factId: "scenario:category-freed-yearly" }, { value: 12, status: "context", factId: null }] };
const restaurantAnswer = (text = restaurantText, monthly = 55.3) => {
  const step = { ...CoachStep.make("s", "Projecting the next years ahead from your real averages"), done: true, tookMs: 1, result: "€55 a month freed, projected over 5 years" };
  return CoachMessage.make("m", "assistant", { text, stages: [restaurantImpact(monthly)], facts: restaurantFacts, grounding: restaurantGrounding, steps: [step],
    tools: [trace("s", "run_scenario", {}, 1, step.result)] });
};

group("a monthly saving leads with the month, the years are optional (QA: 'More after 5 years if you keep it €3,318')", () => {
  const view = AnswerPresenter.view(restaurantAnswer(), "en", "Europe/Helsinki", "What would spending 20% less at restaurants save?");
  eq([view.result?.label, view.result?.value, view.result?.detail], ["Monthly saving if you spend 20% less on Restaurants", "€55.30 a month", "€663.60 a year · from your Restaurants average of €276.52 a month over 12 months"],
    "v3: a monthly saving with its baseline, per month then per year");
  eq(view.result?.tags.map((tag) => tag.kind), ["bank", "input", "estimate"], "where it comes from");
  eq(view.how.map((block) => [block.title, block.lines.map((line) => [line.label, line.value])]),
    [["What the saving is worked out from", [["Restaurants, average per month", "€276.52 a month"], ["Cut asked for", "20%"]]]], "the basis once, no 'Figures behind' repeats");
  eq(view.how[0].evidence?.filter.category, "Restaurants", "with the transactions behind the average");
  eq(view.futures, null, "v3: a plain category cut shows no projection at all, not even an optional one");
  eq([view.steps[0].label, view.steps[0].result], ["Projected the next years ahead from your real averages", null], "the tool line adds no figure");
  const said = [view.result?.value, view.result?.detail, ...view.how.flatMap((block) => block.lines.map((line) => line.value))].filter((one) => one?.includes("55.30"));
  eq(said.length, 1, "€55.30 is on the card only");
  eq(["Drawing a chart from your account", "Scanning twelve months of your transactions for what stands out", "Saving that so I remember it next time"].map(StepPresenter.pastTense),
    ["Drew a chart from your account", "Scanned twelve months of your transactions for what stands out", "Saved that so I remember it next time"], "finished steps in the past tense");

  const years = AnswerPresenter.view(restaurantAnswer(), "en", "Europe/Helsinki", "How much more would I have after 5 years if I cut restaurants by 20%?");
  eq([years.result?.label, years.result?.value, years.futures?.optional, years.futures?.label, years.futures?.summary, years.futures?.series.map((line) => line.id)],
    ["More after 5 years if you keep it", "€3,318", false, "If you keep the money", "", ["nothing", "save"]], "asked about the years: they lead, the chart's sentence is not repeated");
  const invest = AnswerPresenter.view(restaurantAnswer(), "en", "Europe/Helsinki", "What if I cut restaurants by 20% and invest it?");
  eq([invest.result?.label, invest.futures?.series.map((line) => line.id)], ["More after 5 years if you keep it", ["nothing", "save", "invest"]], "asked about investing: the invest line");
  const own = AnswerPresenter.view(restaurantAnswer("Saving 50 euros a month adds up.", 50), "en", "Europe/Helsinki", "What if I save €50 a month?");
  eq(own.result?.label, "More after 5 years if you keep it", "the person's own monthly amount is not echoed as the result");
  eq(AnswerPresenter.view(restaurantAnswer(), "en", "Europe/Helsinki").result?.value, "€55.30 a month", "question unknown: the month leads");
  eq([Working.asksLongTerm("What would spending 20% less at restaurants save per year?"), Working.asksLongTerm("Where will I be in 10 years?"),
    Working.asksLongTerm("Should I put it in an index fund?")], [false, true, true], "what counts as asking about the years ahead");
});

group("'Figures behind this answer' lists only figures the text says as the same kind (live: 'ages 18 to 24' as 18% and €24.83)", () => {
  eq(Working.claims("€64 a month more than ages 18 to 24, 20% less, 419 customers, 6 months, in 2026, −€22.88 and 276.52 a month").map((c) => [c.value, c.kind]),
    [[64, "euro"], [18, null], [24, null], [20, "percent"], [419, "count"], [6, "time"], [2026, null], [22.88, "euro"], [276.52, "euro"]], "kinds read from the words around");
  const live = "You spend more than people your age on Home & Tech and Restaurants. The biggest gap is Restaurants, where you spend 64 euros a month more than the average for ages 18 to 24.";
  const facts = [f("chart:peers:Restaurants:gap", "Restaurants, you against people your age, per month", 64, "EUR/month"),
    f("overview:basket:irregular:share", "Must pay, now and then, share of spending", 18, "percent"), f("overview:bill:utilities-3", "Mobile plan, per month", 24.83, "EUR/month", "bank-data"),
    f("overview:bill:utilities-1", "Utilities in Sep 2026", 64.78, "EUR", "bank-data")];
  const grounding = { ok: true, checked: 3, unverified: [], corrections: [], numbers: [{ value: 64, status: "receipt", factId: "chart:peers:Restaurants:gap" },
    { value: 18, status: "receipt", factId: "overview:basket:irregular:share" }, { value: 24, status: "receipt", factId: "overview:bill:utilities-3" }, { value: 64, status: "receipt", factId: "overview:bill:utilities-1" }] };
  const view = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: live, facts, grounding }), "en");
  eq(view.how.map((block) => block.lines.map((line) => [line.label, line.value])), [[["Restaurants, you against people your age, per month", "€64 a month"]]],
    "the restaurant gap only: no 18% share, no €24.83 bill, no €64.78 that rounds to 65");
  eq(view.tags.some((tag) => tag.kind === "synthetic"), true, "still labelled as a synthetic comparison");
  const bare = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: "You paid it on day 24, 3 times.", facts: [f("x", "Mobile plan", 24, "EUR"), f("y", "Payments", 3, "count")],
    grounding: { ok: true, checked: 2, unverified: [], corrections: [], numbers: [{ value: 24, status: "receipt", factId: "x" }, { value: 3, status: "receipt", factId: "y" }] } }), "en");
  eq(bare.how.map((block) => block.lines.map((line) => [line.label, line.value])), [[["Payments", "3"]]], "a bare day of the month backs nothing; '3 times' is a count");
});

group("no matching offer: the requirement is said once (QA: in What Sisu did and in an assumption)", () => {
  const long = offer("Example Energia", 24, 24.12, { meetsRequirements: false, misses: ["24-month contract (you asked for 6 months or less)"] });
  const r = research([long], { requirements: { maxContractMonths: 6 }, noMatch: true, matchingCount: 0,
    assumptions: ["Only offers that meet what you asked for (contract of 6 months or less) can be the best offer. An offer whose page does not state one of these counts as not meeting it."] });
  const step = { ...CoachStep.make("s", "Searching today's electricity offers with Exa and reading the pages with Context.dev"), done: true, tookMs: 900,
    result: "3 offers from 1 page in 0.9 s; No matching options found (contract of 6 months or less)" };
  const view = AnswerPresenter.view(CoachMessage.make("m", "assistant", { text: "No matching options found for contract of 6 months or less.", research: r, steps: [step],
    tools: [trace("s", "search_offers", { billType: "electricity" }, 900, step.result)], stages: [read("s", [long])] }), "en", "Europe/Helsinki", "Find me electricity contracts of 6 months or less");
  eq([view.result?.label, view.result?.detail], ["No matching options found", "You asked for a contract of 6 months or less."], "the card says it");
  eq(view.steps.map((row) => row.result), ["3 offers from 1 page"], "not again in What Sisu did");
  eq(view.assumptions, ["Only offers that meet what you asked for can be the best offer. An offer whose page does not state one of these counts as not meeting it."], "nor in the assumptions");
});

// MARK: - v3: the S-Pankki payday story (15 Nov)

// The category cut as the newer backend sends it: one calculation card, its receipts, no impact (lib/agent/tools/category-cut.ts).
const cutFacts = (pct: number, monthly: number): Fact[] => [
  f("scenario:category-avg", "Restaurants, average per month", 276.52, "EUR/month", "bank-data", { basis: "average of the last 12 months", evidence: { from: "2025-10-01", to: "2026-09-30", category: "Restaurants" } }),
  f("scenario:category-cut-pct", "Cut asked for", pct, "percent", "customer-stated"),
  f("scenario:category-freed", `Cutting Restaurants by ${pct}% frees, per month`, monthly, "EUR/month"),
  f("scenario:category-freed-yearly", `Cutting Restaurants by ${pct}% frees, per year`, Math.round(monthly * 12 * 100) / 100, "EUR/year"),
];
const cutStage = (pct: number, monthly: number): Stage => ({ ...calcStage("c", `Spending ${pct}% less on Restaurants`, "Freed per month", monthly, "EUR/month", ["From your 12-month average for Restaurants, not any single month."]), facts: cutFacts(pct, monthly) });
const transfer = { id: "t1", kind: "standing_transfer", status: "awaiting_approval", title: "Move €55.30 a month to savings", simulated: true, assumptions: [], sources: [] } as unknown as AgentAction;
const futuresChart = Visual.decode({ id: "fl", kind: "futures_lines", title: "5 years ahead", source: "calculation", years: 5, series: [] });
const cutAnswer = (pct: number, monthly: number) => CoachMessage.make("cut", "assistant", { text: `Spending ${pct}% less on eating out frees about ${monthly} euros a month.`,
  stages: [cutStage(pct, monthly), { id: "a", kind: "action", title: "Transfer", summary: "", source: "calculation", toolCallId: null, atMs: 0, facts: [], data: { kind: "action", action: transfer } } as Stage],
  facts: cutFacts(pct, monthly), visuals: [futuresChart] });

group("v3: eating out 20% less is a monthly saving, with no projection, futures chart or transfer", () => {
  const view = AnswerPresenter.view(cutAnswer(20, 55.3), "en", "Europe/Helsinki", "What if I spend 20 percent less eating out?");
  eq([view.result?.label, view.result?.value, view.result?.detail], ["Monthly saving if you spend 20% less on Restaurants", "€55.30 a month", "€663.60 a year · from your Restaurants average of €276.52 a month over 12 months"], "the saving and its baseline");
  eq(view.result?.label.includes("payday"), false, "never worded as money available before payday");
  eq([view.futures, view.visuals.map((v) => v.content.kind)], [null, []], "no projection and no futures chart");
  eq(view.hiddenActionIds, ["t1"], "a transfer prepared next to the cut is not shown");
  eq([view.lesson?.concept, view.lesson?.label], ["three-baskets", "Open the lesson: Three baskets"], "links to the existing lesson");
  eq(view.scenarioDated, true, "names the synthetic scenario date");
  const years = AnswerPresenter.view(cutAnswer(20, 55.3), "en", "Europe/Helsinki", "What if I cut eating out by 20% and invest it for 5 years?");
  eq(years.hiddenActionIds, [], "asked about investing: nothing is hidden");
});

group("v3: asking again with 10% halves the saving the card shows", () => {
  const twenty = PaydayAnswers.cut(cutAnswer(20, 55.3));
  const ten = PaydayAnswers.cut(cutAnswer(10, 27.65));
  eq([twenty?.baselineEur, ten?.baselineEur], [276.52, 276.52], "the same baseline in the follow-up");
  eq(ten && twenty ? Math.abs(ten.monthlyEur * 2 - twenty.monthlyEur) < 0.005 : false, true, "10% is half of 20%");
  eq(AnswerPresenter.view(cutAnswer(10, 27.65), "en", "Europe/Helsinki", "And 10 percent?").result?.value, "€27.65 a month", "the card shows the halved figure");
});

group("v3: the payday answer says the period, links the lesson and uses Today's date line", () => {
  const steps = [{ label: "Balance today", amount: 412.5, basis: "account balance on 2025-09-30" }, { label: "Left for spending until payday", amount: 184, basis: "never below zero" }];
  const stage: Stage = { id: "p", kind: "calculation", title: "Estimated weekly budget until payday", summary: "About €86 a week until 2025-10-15", source: "calculation", toolCallId: null, atMs: 0, facts: [],
    data: { kind: "calculation", steps, resultLabel: "Estimated weekly budget", resultValue: 85.87, unit: "EUR", assumptions: ["Payday is expected on 2025-10-15, the usual salary day in your history."] } };
  const facts = [f("cash:days-to-payday", "Days to the next payday", 15, "days", "calculation", { basis: "next payday expected on 2025-10-15" }),
    f("cash:budget:per-week", "Estimated weekly budget until payday", 85.87, "EUR"), f("cash:budget:left", "Left for spending until payday", 184, "EUR"),
    f("cash:budget:weeks", "Weeks until payday", 2.14, "count", "calculation", { basis: "15 days to 2025-10-15, divided by 7" })];
  const view = AnswerPresenter.view(CoachMessage.make("pay", "assistant", { text: "About 86 euros a week until payday.", stages: [stage], facts }), "en", "Europe/Helsinki",
    "Why do I keep running out of money before payday, and what can I change?");
  eq([view.result?.label, view.result?.value, view.result?.detail], ["Estimated weekly budget", "€85.87", "€184 in total until payday on 15 Oct 2025 (15 days)"], "the figure and the period it covers");
  eq([view.lesson?.concept, view.lesson?.label], ["safe-to-spend", "Open the lesson: Weekly room in an average month"], "links the weekly-room lesson");
  eq(view.scenarioDated, true, "names the synthetic scenario date");
  eq(view.how.length > 0, true, "the maths is behind Show the maths");
  const overview = { dataTimestamp: "2025-09-30" } as unknown as Overview;
  eq(TodayPresenter.dataDate(overview), "Synthetic demo data · as of 30 Sep 2025", "one date line for Today and the answer");
  eq(AnswerPresenter.view(CoachMessage.make("x", "assistant", { text: "Hello." })).lesson, null, "no lesson link on other answers");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
