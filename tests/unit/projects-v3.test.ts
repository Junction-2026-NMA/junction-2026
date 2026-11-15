import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AINO, SANNA, freshState } from "./helpers";
import { saveDraft } from "@/lib/actions";
import { buildWatchDraft } from "@/lib/actions/watch";
import { type ListingSearch, listingQuery } from "@/lib/agent/research/listings";
import { housingEffect, savingsFigures } from "@/lib/finance/housing";
import { buildOverview } from "@/lib/finance/overview";
import { readState } from "@/lib/store/state";
import type { AgentAction, Listing } from "@/lib/types";
import { createProject, parseCreate, runInitialResearch } from "@/lib/watch/create";
import { evaluateListings, requirementChecks, verdictOf } from "@/lib/watch/evaluate";
import { getProject, updateWatch } from "@/lib/watch/project";
import { watchEvaluationRule } from "@/lib/watch/rule";

const PAGE = "https://www.vuokraovi.com/vuokra-asunnot/espoo";
const flat = (title: string, priceEur: number, areaM2: number | null, extra: Partial<Listing> = {}): Listing => ({ title, priceEur, rooms: 2, areaM2, district: "Leppävaara", city: "Espoo", availableFrom: null, url: `https://www.vuokraovi.com/kohde/${title.replace(/\W/g, "")}`, pageUrl: PAGE, ...extra });
const MATCH = flat("Sellonkatu 1", 850, 45, { utilitiesPerMonthEur: 30 });
const NO_AREA = flat("Alberganesplanadi 2", 880, null);
const TOO_DEAR = flat("Leppävaarankatu 3", 950, 50);
const TOO_SMALL = flat("Ratsukatu 4", 800, 35);
const LISTINGS = [MATCH, NO_AREA, TOO_DEAR, TOO_SMALL];
const search: ListingSearch = { city: "Espoo", topic: null, query: listingQuery("Espoo"), pages: [{ url: PAGE, title: "Vuokraovi Espoo", listings: LISTINGS, dropped: 0, cacheAgeMs: 0, tookMs: 1, mock: false }], found: [{ url: PAGE, title: "Vuokraovi Espoo" }, { url: "https://asunnot.oikotie.fi/vuokra-asunnot/espoo", title: "Oikotie Espoo" }], errors: [], retrievedAt: "2026-11-15T06:00:00.000Z", tookMs: 1, mock: false };
const REQUIREMENTS = { minAreaM2: 40, monthlySavingsEur: 100 };
const today = "2026-11-15";

function draft(customerId: string): AgentAction {
  const built = buildWatchDraft(customerId, { city: "Espoo", budgetEur: 900, minRooms: null, search, preparedBy: "sisu-agent", goal: "Rent a larger home in Espoo", requirements: REQUIREMENTS });
  assert.ok(built.ok, built.ok ? "" : built.reason);
  const saved = saveDraft(customerId, built.draft);
  assert.ok(saved.ok);
  return saved.action;
}

async function start(customerId: string, body: Record<string, unknown> = {}) {
  const action = draft(customerId);
  const parsed = parseCreate({ confirm: true, fromActionId: action.id, ...body }, customerId);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.reason);
  const created = await createProject(parsed.input);
  assert.ok(created.ok, created.ok ? "" : created.reason);
  return { action, project: created.project };
}

describe("v3 listing verdicts: one rule for results, counts and findings", () => {
  const rule = { budgetEur: 900, minRooms: null, city: "Espoo", requirements: { minAreaM2: 40 }, today };

  it("a listing that fails the rent or a requirement is never a match", () => {
    const judged = evaluateListings(LISTINGS, rule);
    assert.deepEqual(judged.map((entry) => [entry.listing.title, entry.verdict]), [["Sellonkatu 1", "match"], ["Alberganesplanadi 2", "needs_verification"], ["Ratsukatu 4", "fails"], ["Leppävaarankatu 3", "fails"]]);
  });

  it("a missing floor area needs verification, with a check that names it", () => {
    const checks = requirementChecks(NO_AREA, rule);
    const area = checks.find((check) => check.requirement === "Minimum floor area");
    assert.equal(area?.status, "unknown");
    assert.match(area?.detail ?? "", /does not state the size/);
    assert.equal(verdictOf(checks), "needs_verification");
  });

  it("the savings goal is checked apart from the rent limit, with the customer's own figures", () => {
    const sanna = watchEvaluationRule({ budgetEur: 900, minRooms: null, city: "Espoo", requirements: REQUIREMENTS }, buildOverview(SANNA), new Date("2026-11-15T08:00:00Z"));
    const aino = watchEvaluationRule({ budgetEur: 900, minRooms: null, city: "Espoo", requirements: REQUIREMENTS }, buildOverview(AINO), new Date("2026-11-15T08:00:00Z"));
    const ok = requirementChecks(MATCH, sanna);
    const short = requirementChecks(MATCH, aino);
    assert.equal(ok.find((check) => check.requirement === "Maximum rent")?.status, "met");
    assert.equal(ok.find((check) => check.requirement === "Savings goal")?.status, "met");
    assert.equal(short.find((check) => check.requirement === "Maximum rent")?.status, "met", "within the rent limit...");
    assert.equal(short.find((check) => check.requirement === "Savings goal")?.status, "failed", "...but not affordable while saving €100 a month");
    assert.equal(verdictOf(short), "fails");
    assert.equal(savingsFigures(buildOverview(SANNA)!, {}), null, "no savings check without a monthly amount");
  });

  it("the housing effect keeps recurring costs apart from upfront ones and shows the monthly saving", () => {
    const effect = housingEffect(buildOverview(SANNA)!, MATCH, REQUIREMENTS, "t");
    assert.equal(effect.recurring.utilitiesChangeEur, 30);
    assert.equal(effect.upfront.depositEur, null);
    assert.ok(effect.missing.some((gap) => /deposit/i.test(gap)));
    assert.ok(effect.facts.some((item) => item.id === "t:after-saving"));
    assert.match(effect.sentence, /after the €100 you keep saving/);
  });
});

describe("v3 Make this a project", () => {
  beforeEach(() => freshState());

  it("keeps the conversation's requirements exactly and starts with the on_match schedule", async () => {
    const { action, project } = await start(SANNA);
    const watch = project.watch;
    assert.equal(watch.actionId, action.id);
    assert.equal(watch.city, "Espoo");
    assert.equal(watch.budgetEur, 900);
    assert.equal(watch.requirements?.minAreaM2, 40);
    assert.equal(watch.requirements?.monthlySavingsEur, 100);
    assert.equal(watch.goal, "Rent a larger home in Espoo");
    assert.equal(watch.schedule?.notify, "on_match");
    assert.equal(watch.initialResearch, "running");
    assert.equal(readState().actions.find((candidate) => candidate.id === action.id)?.status, "executed_simulated");
    const again = await createProject((parseCreate({ confirm: true, fromActionId: action.id }, SANNA) as { ok: true; input: Parameters<typeof createProject>[0] }).input);
    assert.ok(again.ok && !again.started, "a second tap answers the same project");
  });

  it("refuses without confirm or a draft", () => {
    assert.equal(parseCreate({ fromActionId: crypto.randomUUID() }, SANNA).ok, false);
    assert.equal(parseCreate({ confirm: true }, SANNA).ok, false);
  });

  it("the first check saves findings for matches and listings to verify, never for those that fail", async () => {
    const { project } = await start(SANNA);
    await runInitialResearch(SANNA, project.watch.id, { search: false });
    const after = getProject(SANNA, project.watch.id)!;
    assert.equal(after.watch.initialResearch, "done");
    assert.deepEqual(after.notifications.map((note) => [note.listing.title, note.verdict, note.kind]).sort(), [["Alberganesplanadi 2", "needs_verification", "initial_match"], ["Sellonkatu 1", "match", "initial_match"]]);
    assert.deepEqual(after.currentMatches.map((entry) => entry.listing.title), ["Sellonkatu 1"]);
    assert.ok(after.evaluated?.some((entry) => entry.listing.title === "Ratsukatu 4" && entry.verdict === "fails"), "alternatives stay listed apart");
    assert.equal(after.evidence?.exa?.query, listingQuery("Espoo"));
    assert.equal(after.evidence?.exa?.sources.length, 2);
    assert.deepEqual(after.evidence?.extraction.map((row) => [row.url, row.listingsRead]), [[PAGE, 4]]);
    assert.ok(after.schedulerInfo);
    await runInitialResearch(SANNA, project.watch.id, { search: false });
    assert.equal(getProject(SANNA, project.watch.id)!.notifications.length, 2, "a listing is a finding once");
  });

  it("for a profile that cannot keep saving at this rent, nothing is a match", async () => {
    const { project } = await start(AINO);
    await runInitialResearch(AINO, project.watch.id, { search: false });
    const after = getProject(AINO, project.watch.id)!;
    assert.equal(after.currentMatches.length, 0);
    assert.equal(after.notifications.length, 0);
    assert.ok(after.evaluated?.every((entry) => entry.checks.some((check) => check.requirement === "Savings goal" && check.status === "failed")));
  });

  it("changing a requirement changes which listings qualify, and it stays saved", async () => {
    const { project } = await start(SANNA);
    await runInitialResearch(SANNA, project.watch.id, { search: false });
    const edited = updateWatch(SANNA, project.watch.id, { requirements: { minAreaM2: 30 } });
    assert.ok(edited.ok);
    assert.equal(edited.project.evaluated?.find((entry) => entry.listing.title === "Ratsukatu 4")?.verdict, "match");
    const stricter = updateWatch(SANNA, project.watch.id, { requirements: { minAreaM2: 46 } });
    assert.ok(stricter.ok);
    assert.equal(stricter.project.currentMatches.length, 0);
    assert.ok(!stricter.project.notifications.some((note) => note.listing.title === "Sellonkatu 1"), "a finding that now fails is not shown");
    assert.equal(getProject(SANNA, project.watch.id)!.watch.requirements?.minAreaM2, 46);
    assert.equal(getProject(SANNA, project.watch.id)!.watch.requirements?.monthlySavingsEur, 100);
  });
});
