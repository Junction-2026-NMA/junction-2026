// v3 (15 Nov): the two filmed journeys. Housing: a savings amount is a requirement, never a transfer; search_flats
// always prepares the Project with every confirmed requirement; a listing that fails is never a match. Payday:
// "eating out" is the Restaurants category, and a 10% cut frees exactly half of a 20% cut.
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { AINO, collect, freshState, ofType } from "./helpers";
import { setMockScript } from "@/lib/agent/mock";
import { runTurn } from "@/lib/agent/orchestrator";
import { asksForTransfer, asksToMoveMoney } from "@/lib/agent/guards";
import { executeTool, type ToolContext } from "@/lib/agent/tools";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { buildOverview } from "@/lib/finance/overview";
import { evaluateListings } from "@/lib/watch/evaluate";
import type { Listing, Overview } from "@/lib/types";

const aino = buildOverview(AINO) as Overview;
const context = (userTexts: string[]): ToolContext => ({ customerId: AINO, overview: aino, city: "Helsinki", memory: { customerId: AINO, consent: true, items: [] }, cashFlow: () => buildCashFlow(aino), userTexts, sisuTexts: [] });
const run = (name: string, args: Record<string, unknown>, texts: string[]) => executeTool({ id: `t_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }, context(texts));
const JACK_HOUSING = "Hey, I'm wondering if I am able to afford a larger house in Espoo as a student. Could you find me some possible listings for me? Thank you.";
const JACK_REQUIREMENTS = "Yes, renting. Max 900 euros a month, at least 40 square metres, and I want to keep €100 per month for savings.";

describe("transfer guard", () => {
  beforeEach(() => void freshState());

  it("a housing conversation with a savings amount never prepares a transfer", async () => {
    const outcome = await run("prepare_action", { kind: "standing_transfer", monthlyAmountEur: 100 }, [JACK_HOUSING, JACK_REQUIREMENTS]);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.action, undefined);
    assert.match(outcome.content, /monthlySavingsEur/);
  });

  it("'keep €100 a month for savings' is not a request to move money", async () => {
    assert.equal(asksForTransfer("I want to keep €100 per month for savings."), false);
    assert.equal(asksToMoveMoney("I want to move to Espoo and put 100 euros into savings every month"), false);
    const outcome = await run("prepare_action", { kind: "standing_transfer", monthlyAmountEur: 100 }, ["I want to keep €100 per month for savings."]);
    assert.equal(outcome.ok, false);
  });

  it("an explicit request outside housing is still set up", async () => {
    const outcome = await run("prepare_action", { kind: "standing_transfer", monthlyAmountEur: 100 }, ["Please move 100 euros to savings every month."]);
    assert.equal(outcome.ok, true);
    assert.equal(outcome.action?.kind, "standing_transfer");
  });
});

describe("search_flats", () => {
  beforeEach(() => void freshState());

  it("always prepares the Project with every confirmed requirement and the search behind it", async () => {
    const outcome = await run("search_flats", { city: "Espoo", budgetEur: 900, requirements: { minAreaM2: 40, monthlySavingsEur: 100 } }, [JACK_HOUSING, JACK_REQUIREMENTS]);
    assert.equal(outcome.ok, true);
    const plan = outcome.action?.watch;
    assert.equal(outcome.action?.kind, "property_watch");
    assert.equal(outcome.action?.status, "awaiting_approval");
    assert.deepEqual([plan?.city, plan?.budgetEur, plan?.requirements?.minAreaM2, plan?.requirements?.monthlySavingsEur], ["Espoo", 900, 40, 100]);
    assert.ok(plan?.discovery?.query.includes("Espoo"));
    assert.ok((plan?.discovery?.sources.length ?? 0) > 0);
    assert.ok(plan?.evaluated?.length);
    const body = JSON.parse(outcome.content) as { matches: { address: string }[]; needsVerification: { address: string }[]; alternativesThatFailARequirement: { verdict: string }[] };
    assert.ok(body.alternativesThatFailARequirement.every((item) => item.verdict === "fails"));
    assert.ok(!body.matches.some((item) => body.alternativesThatFailARequirement.some((alt) => (alt as unknown as { address: string }).address === item.address)));
  });

  it("refuses a rent the customer did not say", async () => {
    const outcome = await run("search_flats", { city: "Espoo", budgetEur: 950 }, [JACK_HOUSING]);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.action, undefined);
  });
});

describe("listing verdicts", () => {
  const flat = (over: Partial<Listing>): Listing => ({ title: "T", priceEur: 850, rooms: 2, areaM2: 45, district: "Tapiola", city: "Espoo", availableFrom: null, url: "https://x.fi/1", pageUrl: "https://x.fi", ...over });
  const rule = { budgetEur: 900, minRooms: null, city: "Espoo", requirements: { minAreaM2: 40 }, today: "2026-11-15" };

  it("fails are never matches, and a missing size needs verification", () => {
    const [match, verify, over, small, elsewhere] = evaluateListings([flat({ title: "a" }), flat({ title: "b", areaM2: null }), flat({ title: "c", priceEur: 950 }), flat({ title: "d", areaM2: 30 }), flat({ title: "e", city: "Vantaa" })], rule).sort((a, b) => a.listing.title.localeCompare(b.listing.title));
    assert.equal(match.verdict, "match");
    assert.equal(verify.verdict, "needs_verification");
    assert.deepEqual([over.verdict, small.verdict, elsewhere.verdict], ["fails", "fails", "fails"]);
  });
});

describe("payday: eating out", () => {
  beforeEach(() => void freshState());

  it("'eating out' cuts the Restaurants category, and 10% frees exactly half of 20%", async () => {
    const twenty = await run("run_scenario", { category: "eating out", categoryCutPct: 20 }, ["What if I spend 20 percent less eating out?"]);
    const ten = await run("run_scenario", { category: "Restaurants", categoryCutPct: 10 }, ["What if I spend 20 percent less eating out?", "What about 10%?"]);
    const cutOf = (outcome: { content: string }) => (JSON.parse(outcome.content) as { categoryCut: { category: string; freesPerMonthEur: number; averagePerMonthEur: number } }).categoryCut;
    assert.equal(cutOf(twenty).category, "Restaurants");
    assert.equal(cutOf(ten).averagePerMonthEur, cutOf(twenty).averagePerMonthEur);
    assert.equal(Math.round(cutOf(ten).freesPerMonthEur * 2 * 100), Math.round(cutOf(twenty).freesPerMonthEur * 100));
    // No projection, no futures chart, no transfer for a monthly-savings question.
    assert.equal(twenty.action, undefined);
    assert.ok(!twenty.stages.some((stage) => stage.kind === "impact"));
  });
});

describe("mock model: the two journeys", () => {
  beforeEach(() => void freshState());
  after(() => setMockScript(null));

  it("Jack's question gets a clarifying answer, then his requirements run search_flats with all of them", async () => {
    const first = await collect(runTurn({ customerId: AINO, text: JACK_HOUSING, mode: "text", history: [] }));
    assert.equal(ofType(first, "tool_end").length, 0);
    const answer = ofType(first, "done")[0]?.text ?? "";
    assert.match(answer, /renting/i);
    const second = await collect(runTurn({ customerId: AINO, text: JACK_REQUIREMENTS, mode: "text", history: [{ role: "user", content: JACK_HOUSING }, { role: "assistant", content: answer }] }));
    const flats = ofType(second, "tool_end").find((event) => event.trace.name === "search_flats");
    assert.ok(flats?.trace.ok);
    const [{ action }] = ofType(second, "action");
    assert.deepEqual([action.kind, action.watch?.city, action.watch?.budgetEur, action.watch?.requirements?.minAreaM2, action.watch?.requirements?.monthlySavingsEur], ["property_watch", "Espoo", 900, 40, 100]);
    assert.ok(!ofType(second, "action").some((event) => event.action.kind === "standing_transfer"));
    // CUST04974 is already short in an average month: within the rent limit is not the same as affordable while saving.
    const said = ofType(second, "done")[0]?.text ?? "";
    assert.match(said, /No matches yet/);
    assert.match(said, /within your rent limit, but not affordable while keeping 100 euros a month/);
    assert.doesNotMatch(said, /\bmatch all your requirements\b/);
  });

  it("the payday follow-up keeps the category: 10% after 20% eating out", async () => {
    const first = await collect(runTurn({ customerId: AINO, text: "What if I spend 20 percent less eating out?", mode: "text", history: [] }));
    const firstAnswer = ofType(first, "done")[0]?.text ?? "";
    const second = await collect(runTurn({ customerId: AINO, text: "What about 10%?", mode: "text", history: [{ role: "user", content: "What if I spend 20 percent less eating out?" }, { role: "assistant", content: firstAnswer }] }));
    assert.ok(ofType(second, "tool_end").some((event) => event.trace.name === "run_scenario" && event.trace.ok));
    assert.match(ofType(second, "done")[0]?.text ?? "", /10% less on restaurants/i);
  });
});
