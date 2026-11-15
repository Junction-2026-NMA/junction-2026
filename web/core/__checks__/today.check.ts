// Checks for Today's figures: the estimated weekly budget (WeeklyBudget), its text, the primary insight
// (TodayFocus) and the basket wording. Run: npx tsx web/core/__checks__/today.check.ts (must print `0 failed`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CashFlow } from "@/web/core/CoachModels";
import type { Overview } from "@/web/core/Models";
import { BasketKind } from "@/web/core/Presentation";
import { TodayFocus, TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { OnboardingCopy, OnboardingReading } from "@/web/core/AppLogic/OnboardingCopy";
import { WeeklyBudget, WeeklyBudgetText } from "@/web/core/AppLogic/WeeklyBudget";

let failures = 0, passes = 0;
function eq(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
const ok = (value: boolean, label: string) => eq(value, true, label);
const near = (actual: number, expected: number, label: string, accuracy = 0.005) => ok(Math.abs(actual - expected) <= accuracy, `${label} (${actual} ≈ ${expected})`);
function group(name: string, body: () => void): void {
  const before = failures;
  try { body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

const root = join(process.cwd(), "public/sisu-fixtures");
const read = <T>(path: string): T => JSON.parse(readFileSync(join(root, path), "utf8")) as T;
const overview = (id: string) => read<Overview>(`overview-${id}.json`);
const cashFlow = (id: string) => read<CashFlow>(`coach/cash-flow-${id}.json`);
const ready = (result: WeeklyBudget.Result): WeeklyBudget.Ready => {
  if (result.kind !== "ready") throw new Error(`not ready: ${JSON.stringify(result)}`);
  return result;
};
const base: WeeklyBudget.Inputs = {
  balanceEur: 1000, nextPayday: "2026-10-15", daysToPayday: 14, cashFlowLoaded: true,
  bills: [{ label: "Rent", amountEur: 600, expectedOn: "2026-10-06" }], averageDailyEverydayEur: 20, bufferEur: null,
};

group("Weekly budget formula", () => {
  const r = ready(WeeklyBudget.compute(base));
  // (1000 − 600 − 100 default buffer) / (14 / 7) = 150 a week.
  eq([r.billsEur, r.bufferEur, r.bufferIsDefault, r.weeks, r.leftEur, r.weeklyEur], [600, 100, true, 2, 300, 150], "default buffer");
  eq([r.usualWeeklyEur, r.projectedEur, r.status], [140, 120, "onTrack"], "usual pace and projection");
  const own = ready(WeeklyBudget.compute({ ...base, bufferEur: 200 }));
  eq([own.bufferIsDefault, own.weeklyEur], [false, 100], "own buffer");
  const zero = ready(WeeklyBudget.compute({ ...base, bufferEur: 0 }));
  eq([zero.bufferEur, zero.bufferIsDefault, zero.weeklyEur], [0, false, 200], "a buffer of 0 is the person's choice, not the default");
  const short = ready(WeeklyBudget.compute({ ...base, balanceEur: 650 }));
  eq([short.weeklyEur, short.leftEur, short.status], [0, -50, "shortfall"], "never below 0; shortfall at the usual pace");
  eq(ready(WeeklyBudget.compute({ ...base, balanceEur: 900 })).status, "belowBuffer", "dips into the buffer");
  const soon = ready(WeeklyBudget.compute({ ...base, daysToPayday: 3 }));
  eq([soon.weeks, soon.weeklyEur], [1, 300], "under a week: all of it is this week's");
  const noBills = ready(WeeklyBudget.compute({ ...base, bills: [] }));
  eq(noBills.weeklyEur, 450, "no bills due");
  const noPace = ready(WeeklyBudget.compute({ ...base, averageDailyEverydayEur: null }));
  eq([noPace.projectedEur, noPace.status, WeeklyBudget.adjustment(noPace)], [null, null, null], "no pace: no projection, no adjustment");
});

group("Missing inputs are named, not guessed", () => {
  const notLoaded = WeeklyBudget.compute(WeeklyBudget.inputs(overview("CUST04974"), null, null));
  eq(notLoaded, { kind: "missing", missing: ["payday", "bills"], cashFlowLoaded: false }, "cash flow did not load");
  if (notLoaded.kind === "missing") ok(WeeklyBudgetText.missing(notLoaded).includes("could not load"), "says it did not load");
  const noSalary = WeeklyBudget.compute({ ...base, nextPayday: null, daysToPayday: null });
  eq(noSalary.kind === "missing" ? noSalary.missing : null, ["payday"], "no payday");
  if (noSalary.kind === "missing") ok(WeeklyBudgetText.missing(noSalary).includes("No regular salary"), "says there is no salary");
  eq(WeeklyBudget.compute({ ...base, balanceEur: null }).kind, "missing", "no balance");
  eq(WeeklyBudget.inputs(null, cashFlow("CUST04974"), Number.NaN).bufferEur, null, "an invalid buffer is the default");
});

group("Recorded profiles", () => {
  const aino = ready(WeeklyBudget.compute(WeeklyBudget.inputs(overview("CUST04974"), cashFlow("CUST04974"), null)));
  near(aino.balanceEur, 1220.35, "Aino balance");
  near(aino.billsEur, 686.53, "Aino bills before payday");
  near(aino.projectedEur ?? NaN, cashFlow("CUST04974").projectedLowPointEur ?? NaN, "projection matches the backend's low point", 0.02);
  near(aino.weeklyEur, (1220.35 - 686.53 - 100) / (15 / 7), "Aino weekly budget");
  for (const id of ["CUST04974", "CUST04414", "CUST02003"]) {
    const r = WeeklyBudget.compute(WeeklyBudget.inputs(overview(id), cashFlow(id), null));
    ok(r.kind === "ready" && r.weeklyEur >= 0 && Number.isFinite(r.weeklyEur), `${id} has a finite weekly budget`);
  }
});

group("Budget text", () => {
  const r = ready(WeeklyBudget.compute(base));
  eq(WeeklyBudgetText.title, "Estimated weekly budget", "title");
  ok(!/safe to spend/i.test(JSON.stringify([WeeklyBudgetText.lines(r, "2026-09-30"), WeeklyBudgetText.basis(r), WeeklyBudgetText.pace(r)])), "never 'safe to spend'");
  eq(WeeklyBudgetText.basis(r), "After €600 of bills due before payday and a €100 buffer (assumed).", "basis");
  eq(WeeklyBudgetText.payday(r), "Payday in 14 days", "payday");
  eq(WeeklyBudgetText.lines(r, "2026-09-30").map((l) => l.amount), ["€1,000", "−€600", "−€100", "€300", "÷", "€150"], "maths lines");
  eq(WeeklyBudget.adjustment(r), { cutEur: 30, leftEur: 150 }, "adjustment: a fifth of €140, rounded up to €5");
  eq(WeeklyBudgetText.adjustment(r), "Spend €30 less on everyday spending this week → about €150 left just before payday.", "adjustment text");
});

group("Primary insight", () => {
  const aino = overview("CUST04974"), flow = cashFlow("CUST04974");
  const budget = WeeklyBudget.compute(WeeklyBudget.inputs(aino, flow, null));
  const focus = TodayFocus.primary(aino, budget, flow, null);
  eq([focus?.id, focus?.tone, focus?.question], ["short-months", "info", TodayFocus.paydayQuestion], "Aino: months below zero");
  const tight = TodayFocus.primary(aino, WeeklyBudget.compute(WeeklyBudget.inputs(aino, flow, 500)), flow, null);
  eq([tight?.id, tight?.tone], ["below-buffer", "warning"], "a bigger buffer makes it a warning");
  const shortFlow = { ...flow, billsDueBeforePayday: [...flow.billsDueBeforePayday, { billId: "x", label: "Big bill", amount: 400, expectedOn: "2026-10-12" }] };
  const short = TodayFocus.primary(aino, WeeklyBudget.compute(WeeklyBudget.inputs(aino, shortFlow, null)), shortFlow, null);
  eq([short?.id, short?.tone, short?.title.includes("short before payday")], ["shortfall", "warning", true], "projected shortfall is the single warning");
  const eetu = overview("CUST04414"), eetuFlow = cashFlow("CUST04414");
  const bill = TodayFocus.primary(eetu, WeeklyBudget.compute(WeeklyBudget.inputs(eetu, eetuFlow, null)), eetuFlow, null);
  ok(bill?.id.startsWith("bill-") === true && bill.title.startsWith("Looks like"), "Eetu: the biggest bill, named as a guess");
  const noFlow = TodayFocus.primary(aino, WeeklyBudget.compute(WeeklyBudget.inputs(aino, null, null)), null, "Helen");
  eq(noFlow?.title.startsWith("Helen"), true, "without a cash flow: the bill, with the confirmed name");
  const quiet = TodayFocus.primary({ ...aino, recurringBills: [], insights: [{ id: "over-peers", title: "p", body: "b", evidence: { from: "a", to: "b" } }] }, null, null, null);
  eq(quiet, null, "a peer comparison is never the primary insight");
});

group("Basket wording", () => {
  eq(BasketKind.allCases.map((k) => BasketKind.label(k, "en")), ["Regular essentials", "Occasional essentials", "Everyday spending"], "labels");
  ok(OnboardingCopy.promiseBaskets.every((row) => !/leak|waste|must pay/i.test(`${row.examples} ${row.meaning}`)), "onboarding rows");
  ok(OnboardingReading.loadingDetail.includes("regular essentials"), "reading copy");
  eq(TodayPresenter.peerNote, "Compared with other profiles in the synthetic demo data", "peer note");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
