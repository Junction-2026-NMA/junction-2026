// v2 housing: the recorded question gets the intake card (no model), requirements are applied in code, a listing
// that fails one is never the best match, an unknown fact keeps a listing out of "best match", a rent that breaks
// the month is excluded, the no-match path says why, and the project keeps the conversation it came from.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AINO, collect, freshState, ofType } from "./helpers";
import { runTurn } from "@/lib/agent/orchestrator";
import { approveAction } from "@/lib/actions";
import { impactOf } from "@/lib/actions/drafts";
import { buildOverview } from "@/lib/finance/overview";
import { suggestedBudget } from "@/lib/housing/budget";
import { evaluateListings } from "@/lib/housing/evaluate";
import { INTAKE_TEXT } from "@/lib/housing/intake";
import { isHousingQuestion } from "@/lib/housing/intent";
import { parseSearch, runHousingSearch } from "@/lib/housing/search";
import type { HousingCriteria, Listing } from "@/lib/types";
import { simulatePriceDrop, startWatch } from "@/lib/watch";
import { fits, ruleFor } from "@/lib/watch/detect";
import { getProject, updateWatch } from "@/lib/watch/project";
import { POST as searchRoute } from "@/app/api/housing/search/route";

const QUESTION = "Hey, I'm wondering if I am able to afford a larger house in Espoo as a student. Could you find me some possible listings for me? Thank you.";
const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/espoo";
const flat = (overrides: Partial<Listing> = {}): Listing => ({ title: "Tapiontori 1", priceEur: 560, rooms: 2, areaM2: 45, district: "Tapiola", availableFrom: "1.12.2026", url: "https://www.vuokraovi.com/kohde/a1", pageUrl: PAGE, ...overrides });
const criteria = (overrides: Partial<HousingCriteria> = {}, requirements: HousingCriteria["requirements"] = {}): HousingCriteria => ({ city: "Espoo", budgetEur: 595, budgetFrom: "sisu-suggested", minRooms: null, requirements: { savingsGoalEurPerMonth: 50, ...requirements }, ...overrides });
const TODAY = "2026-11-15";

describe("housing v2", () => {
  beforeEach(() => void freshState());

  it("the recorded question gets the intake card in mock mode, with a rent suggested in code", async () => {
    assert.equal(isHousingQuestion(QUESTION), true);
    const events = await collect(runTurn({ customerId: AINO, text: QUESTION, mode: "voice" }));
    const stage = ofType(events, "stage").find((e) => e.stage.kind === "housing_intake")?.stage;
    assert.ok(stage && stage.data.kind === "housing_intake");
    const { intake } = stage.data;
    assert.deepEqual([intake.tenure, intake.city], ["rent", "Espoo"]);
    const budget = suggestedBudget(buildOverview(AINO)!, 50);
    assert.equal(intake.budget.maxRentEur, budget.maxRentEur);
    assert.ok(budget.maxRentEur !== null && budget.maxRentEur % 5 === 0);
    assert.equal(ofType(events, "done")[0].text, INTAKE_TEXT);
    assert.equal(ofType(events, "tool_start").length, 0, "no tool, no model step");
    // Once asked, a follow-up in words goes to the model.
    const again = await collect(runTurn({ customerId: AINO, text: QUESTION, mode: "text", history: [{ role: "user", content: QUESTION }, { role: "assistant", content: INTAKE_TEXT }] }));
    assert.equal(ofType(again, "stage").filter((e) => e.stage.kind === "housing_intake").length, 0);
  });

  it("a question that names a budget or buying keeps its old path", () => {
    assert.equal(isHousingQuestion("Find me a flat in Helsinki under 900 euros a month"), false);
    assert.equal(isHousingQuestion("Am I ready to buy an apartment?"), false);
  });

  it("requirements change which listings qualify", () => {
    const overview = buildOverview(AINO)!;
    const listings = [flat(), flat({ title: "Pieni 2", areaM2: 30, url: "https://www.vuokraovi.com/kohde/b2" })];
    const loose = evaluateListings(overview, listings, criteria(), TODAY);
    assert.equal(loose.fitting.length, 2);
    const strict = evaluateListings(overview, listings, criteria({}, { minAreaM2: 40 }), TODAY);
    assert.deepEqual(strict.fitting.map((one) => one.listing.title), ["Tapiontori 1"]);
    assert.match(strict.excluded[0].reasons[0], /30 m², smaller than 40 m²/);
  });

  it("a listing that fails a requirement is never the best match, and an unknown fact is not a pass", () => {
    const overview = buildOverview(AINO)!;
    const cheapButSmall = flat({ title: "Pieni 2", priceEur: 500, areaM2: 25, url: "https://www.vuokraovi.com/kohde/b2" });
    const unknownSize = flat({ title: "Ei kokoa 3", priceEur: 520, areaM2: null, url: "https://www.vuokraovi.com/kohde/c3" });
    const result = evaluateListings(overview, [cheapButSmall, unknownSize, flat()], criteria({}, { minAreaM2: 40 }), TODAY);
    assert.equal(result.best?.listing.title, "Tapiontori 1");
    assert.deepEqual(result.needsChecking.map((one) => one.listing.title), ["Ei kokoa 3"]);
    const onlyUnknown = evaluateListings(overview, [unknownSize], criteria({}, { minAreaM2: 40 }), TODAY);
    assert.equal(onlyUnknown.best, null);
    assert.equal(onlyUnknown.closest?.listing.title, "Ei kokoa 3");
    // A commute limit can never be measured: it does not block a best match, but stays flagged "not measured".
    const commute = evaluateListings(overview, [flat()], criteria({}, { maxCommuteMinutes: 30, commuteTo: "Aalto University" }), TODAY);
    assert.equal(commute.best?.listing.title, "Tapiontori 1");
    assert.match(commute.best!.unknowns.join(" "), /not measured/);
  });

  it("a rent that breaks the month or the savings goal is excluded, also by fits()", () => {
    const overview = buildOverview(AINO)!;
    const generous = criteria({ budgetEur: 1_500, budgetFrom: "customer" });
    const result = evaluateListings(overview, [flat({ priceEur: 1_200 })], generous, TODAY);
    assert.equal(result.best, null);
    assert.ok(result.excluded[0].checks.some((check) => check.id === "month" && check.status === "fail"));
    const rule = ruleFor({ budgetEur: 1_500, minRooms: null, topic: null, requirements: { savingsGoalEurPerMonth: 50 }, customerId: AINO });
    assert.equal(fits(flat({ priceEur: 1_200 }), rule), false);
    assert.equal(fits(flat({ priceEur: 560 }), rule), true);
  });

  it("no match: the answer says so and why, and still offers a project", async () => {
    const parsed = parseSearch({ city: "Espoo", budgetEur: 595, budgetFrom: "sisu-suggested", requirements: { minAreaM2: 40, savingsGoalEurPerMonth: 50 }, question: QUESTION, conversationId: "conv-1" }, AINO);
    assert.ok(parsed.ok);
    const outcome = await runHousingSearch(parsed.input);
    assert.ok(outcome.ok);
    const { result } = outcome;
    assert.equal(result.best, null);
    assert.equal(result.closest, null);
    assert.match(result.verdict, /None of the 3 listings read fits/);
    assert.ok(result.excluded.every((one) => one.reasons.length > 0));
    assert.equal(result.research.exaQuery, "vuokra-asunnot Espoo vapaat vuokrattavat asunnot", "only the city goes to Exa");
    assert.ok(result.action && result.action.kind === "property_watch");
  });

  it("the project keeps the conversation and the research, and editing requirements changes what qualifies", async () => {
    const response = await searchRoute(new Request("http://localhost/api/housing/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId: AINO, city: "Espoo", budgetEur: 595, budgetFrom: "sisu-suggested", requirements: { savingsGoalEurPerMonth: 50 }, question: QUESTION, conversationId: "conv-42" }) }));
    assert.equal(response.status, 200);
    const result = await response.json();
    const approved = approveAction(AINO, result.action.id, impactOf);
    assert.ok(approved.ok);
    const watch = await startWatch(AINO, approved.action);
    assert.ok(watch);
    const project = getProject(AINO, watch.id)!;
    assert.equal(project.watch.conversation?.conversationId, "conv-42");
    assert.equal(project.watch.conversation?.question, QUESTION);
    assert.match(project.watch.research?.exaQuery ?? "", /Espoo/);
    // A simulated drop picks a listing that can really fit, and the project says what it changed.
    const drop = simulatePriceDrop(AINO, watch.id);
    assert.ok(drop.ok, drop.ok ? "" : drop.reason);
    const after = getProject(AINO, watch.id)!;
    assert.match(after.evaluation?.changes?.[0].line ?? "", /Rent dropped .* → /);
    assert.equal(after.evaluation?.changes?.[0].simulated, true);
    // A minimum size bigger than every listing: the edit leaves nothing that qualifies.
    const edited = updateWatch(AINO, watch.id, { requirements: { minAreaM2: 100 } });
    assert.ok(edited.ok);
    assert.equal(edited.project.evaluation?.fitting.length, 0);
    assert.equal(edited.project.evaluation?.needsChecking.length, 0);
  });
});
