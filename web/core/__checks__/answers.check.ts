// Checks for short answers (rework of 15 Nov): one result, details said once, source labels, readable dates and
// minus signs, and offers that respect the user's requirements (never "Best" for one that misses them, "No matching
// options found" when none meets them, unknown fees never counted as known).
// Run: npx tsx web/core/__checks__/answers.check.ts
import { AnswerPresenter, CardText, SourceTags } from "@/web/core/AnswerPresentation";
import type { Offer, ResearchResult, Stage } from "@/web/core/CoachModels";
import { OfferPresenter } from "@/web/core/CoachPresentation";
import { CoachMessage } from "@/web/core/CoachSession";
import { Visual } from "@/web/core/PlanModels";

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

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
