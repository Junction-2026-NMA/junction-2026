// Checks for the joins made when the Sisu rework streams were merged (2026-11-15): the field names of the newer
// backend branches (rework/api-answers, rework/api-projects) read beside today's hosted backend, the default buffer,
// the PATCH body of a project edit, and what starting over clears.
// Run: npx tsx web/core/__checks__/integration.check.ts (must print `0 failed`).
import { Keys, clearPersonalData } from "@/web/app/AppState";
import { memoryDefaults } from "@/web/app/Defaults";
import { ProjectStore, type ProjectsState, schedulerRuns } from "@/web/app/ProjectStore";
import { WeeklyBudget } from "@/web/core/AppLogic/WeeklyBudget";
import { CoachEndpoints } from "@/web/core/CoachEndpoints";
import type { CashFlow, Offer, ResearchResult } from "@/web/core/CoachModels";
import { OfferPresenter } from "@/web/core/CoachPresentation";
import { PropertyWatch, WatchList, WatchNotification, projectStatusOf } from "@/web/core/WatchModels";
import { HousingText, ProjectText } from "@/web/features/Projects/ProjectPresenter";

let failures = 0, passes = 0;
function eq(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
function group(name: string, body: () => void): void {
  const before = failures;
  try { body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

group("weekly budget: the buffer", () => {
  const flow = (weeklyBudget?: unknown) => ({ daysToNextPayday: 14, nextPayday: "2026-10-15", billsDueBeforePayday: [], averageDailyEverydayEur: 20, weeklyBudget } as unknown as CashFlow);
  eq(WeeklyBudget.defaultBuffer(null), 100, "no cash flow: €100");
  eq(WeeklyBudget.defaultBuffer(flow()), 100, "today's hosted backend: €100");
  eq(WeeklyBudget.defaultBuffer(flow({ bufferEur: 166.456, bufferSource: "default" })), 166.46, "the newer backend's default buffer");
  eq(WeeklyBudget.defaultBuffer(flow({ bufferEur: 300, bufferSource: "customer-stated" })), 100, "a buffer said in the chat is not a default");
  const overview = { balance: 1000 } as Parameters<typeof WeeklyBudget.inputs>[0];
  const own = WeeklyBudget.compute(WeeklyBudget.inputs(overview, flow({ bufferEur: 166.46, bufferSource: "default" }), 300));
  eq(own.kind === "ready" ? [own.bufferEur, own.bufferIsDefault, own.leftEur] : own, [300, false, 700], "the person's buffer wins");
  const assumed = WeeklyBudget.compute(WeeklyBudget.inputs(overview, flow({ bufferEur: 166.46, bufferSource: "default" }), null));
  eq(assumed.kind === "ready" ? [assumed.bufferEur, assumed.bufferIsDefault, assumed.weeklyEur] : assumed, [166.46, true, (1000 - 166.46) / 2], "else the server's default, marked assumed");
});

group("offers: the shipped backend's field names", () => {
  const offer = (extra: Partial<Offer>): Offer => ({ provider: "A", sourceUrl: "https://a.fi", comparable: true, monthlyPriceEur: 3, setupFeeEur: 0, ...extra });
  eq(OfferPresenter.feesUnknown(offer({ feesUnknown: true })), true, "feesUnknown true");
  eq(OfferPresenter.feesUnknown(offer({ feesUnknown: false, setupFeeEur: null })), false, "feesUnknown false wins over the guess");
  eq(OfferPresenter.feesUnknown(offer({ feesKnown: false })), true, "feesKnown false still read");
  eq(OfferPresenter.feesUnknown(offer({ setupFeeEur: null })), true, "no flag: a missing fee is unknown");
  const research = (extra: Partial<ResearchResult>) => ({ offers: [offer({})], ...extra } as ResearchResult);
  eq(OfferPresenter.noMatch(research({ matchingCount: 0, requirementsText: "contract of 6 months or less" })), true, "matchingCount 0 with requirementsText");
  eq(OfferPresenter.noMatch(research({ matchingCount: 0 })), false, "matchingCount 0 alone says nothing");
  eq(OfferPresenter.requirementText(research({ requirements: { greenOnly: true, maxMonthlyCostEur: 40 } })),
    "You asked for an estimated cost of €40 a month or less, green energy.", "greenOnly and maxMonthlyCostEur");
  eq(OfferPresenter.requirementText(research({ requirementsText: "contract of 12 months or less, fixed price" })),
    "You asked for: contract of 12 months or less, fixed price.", "the backend's words when nothing else is named");
  eq(OfferPresenter.requirementText(research({})), null, "nothing asked");
});

group("projects: status, scheduler, read, housing", () => {
  const watch = PropertyWatch.decode({ id: "w1", status: "active", projectStatus: "failing", pages: [], problems: [] })!;
  eq([projectStatusOf(watch), ProjectText.status(watch).label], ["failing", "Needs attention"], "projectStatus drawn");
  const mockNote = PropertyWatch.decode({ id: "w3", status: "active", projectStatus: "active", pages: [], problems: ["Example data: no key is set, so nothing is being watched on the web."] })!;
  eq(ProjectText.status(mockNote).label, "Active", "a note on a watch the server calls active is not trouble");
  eq(ProjectText.status({ ...mockNote, projectStatus: null }).label, "Needs attention", "without projectStatus a problem still is");
  eq(projectStatusOf(PropertyWatch.decode({ id: "w2", status: "paused", pages: [] })!), "paused", "status when no projectStatus");
  eq(projectStatusOf({}), "active", "neither: active");
  eq([schedulerRuns({ watchScheduler: "cron" }), schedulerRuns({ watchScheduler: "on-open" }), schedulerRuns({}), schedulerRuns(null),
    schedulerRuns({ services: { watchScheduler: true } })], [true, false, false, false, true], "scheduler: missing is on-open");
  eq(WatchList.decode({ watches: [], notifications: [], scheduler: "cron" }).scheduler, "cron", "list scheduler decoded");
  const n = WatchNotification.decode({ id: "n1", watchId: "w1", readAt: "2026-11-15T08:00:00Z", facts: [], housing: { rentEur: 900 } })!;
  const state = { seen: [], notifications: [n] } as unknown as ProjectsState;
  eq(ProjectStore.isUnread(state, n), false, "readAt counts as read");
  eq(ProjectStore.isUnread(state, { ...n, readAt: null }), true, "no readAt: unread");
  const housing = {
    rentEur: 900,
    recurring: { currentHousingEur: 700, rentChangeEur: 200, utilitiesChangeEur: null, transportChangeEur: null, knownChangeEur: 200, leftOverNowEur: 400, leftOverAfterEur: 200 },
    upfront: { depositEur: null, depositAssumedEur: { low: 900, high: 2700 }, movingCostEur: 300, knownEur: 300, rangeEur: { low: 1200, high: 3000 } },
    buffer: { balanceNowEur: 4000, afterUpfrontEur: { low: 1000, high: 2800 }, keepEur: 1500, keeps: "depends" },
    savingsGoal: { goalEur: 2000, monthsNow: 5, monthsAfter: 10 },
    missing: ["The deposit: the listing does not state it."],
    assumptions: ["Housing today is a 12-month average.", "Assumption, not from the listing: deposits are usually 1 to 3 months' rent."],
    sentence: "x", facts: [],
  };
  const view = HousingText.view({ ...n, housing, leftOverAfterEur: 200 }, true)!;
  eq(view.monthly.map((l) => l.label), ["Rent", "Your housing today", "Compared with your housing today"],
    "monthly rows, the change with them (unknown changes and what a month leaves are not repeated)");
  eq(view.upfront.map((l) => `${l.label}: ${l.value}`), ["Deposit (assumed): €900 to €2,700", "Moving costs (your estimate): €300"], "upfront rows");
  eq(view.totals.map((l) => l.label), ["Upfront in total", "Your balance after the upfront costs",
    "The €1,500 you want to keep", "Months to your €2,000 savings goal"], "totals after the upfront rows");
  const depositOnly = { ...housing, upfront: { ...housing.upfront, movingCostEur: null, knownEur: 0, rangeEur: { low: 900, high: 2700 } } };
  const single = HousingText.view({ ...n, housing: depositOnly, leftOverAfterEur: 200 }, true)!;
  eq(single.totals.map((l) => l.label)[0], "Your balance after the upfront costs", "one upfront item: its total is not repeated");
  const noLeftOver = HousingText.view({ ...n, housing, leftOverAfterEur: null }, true)!;
  eq(noLeftOver.monthly.at(-1)?.label, "An average month would leave you", "what a month leaves, with the monthly rows when the finding lacks it");
  eq(view.missing, [], "the deposit once: shown as the assumed range, so not also listed as not known (15 Nov QA)");
  const withMore = HousingText.view({ ...n, housing: { ...housing, missing: [...housing.missing, "Moving costs: you have not given an estimate."] }, leftOverAfterEur: 200 }, true)!;
  eq(withMore.missing, ["Moving costs: you have not given an estimate."], "other missing sentences as sent");
  const stated = HousingText.view({ ...n, housing: { ...housing, upfront: { ...housing.upfront, depositEur: null, depositAssumedEur: null } }, leftOverAfterEur: 200 }, true)!;
  eq(stated.missing, housing.missing, "no assumed range: the deposit stays not known");
  eq(view.note, "Assumption, not from the listing: deposits are usually 1 to 3 months' rent.", "only the assumption as the note");
  eq(HousingText.view({ ...n, housing: null }, true)?.fromServer, false, "no housing: only what is missing");
});

group("project edit: the PATCH body the backend takes", () => {
  const req = CoachEndpoints.watchUpdate("", "w1", "C1", { budgetEur: 950, minRooms: 2, maxDepositEur: 2000, districts: ["Tapiola"] });
  eq([req.method, req.url, JSON.parse(String(req.body))], ["PATCH", "/api/watch/w1",
    { budgetEur: 950, customerId: "C1", minRooms: 2, requirements: { districts: ["Tapiola"], maxDepositEur: 2000 } }], "limits beside the requirements");
});

group("starting over clears the personal data", () => {
  const defaults = memoryDefaults();
  [Keys.baseURL, Keys.prefs, Keys.voiceLanguages, Keys.conversations, Keys.billNames, Keys.projectsSeen, "sisu.lessons.CUST1", "sisu.lessonAttempt.CUST1", "sisu.lessons.CUST2"]
    .forEach((key) => defaults.setString(key, "x"));
  clearPersonalData(defaults);
  eq([Keys.prefs, Keys.voiceLanguages, Keys.conversations, Keys.billNames, Keys.projectsSeen, "sisu.lessons.CUST1", "sisu.lessonAttempt.CUST1", "sisu.lessons.CUST2"]
    .filter((key) => defaults.has(key)), [], "every personal key gone");
  eq(defaults.has(Keys.baseURL), true, "the backend address stays");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
