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
import { PaydayBudget } from "@/web/core/AppLogic/PaydayBudget";

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

group("Buffer fields: one rule for Today and Settings, capped where the server stops", () => {
  const parse = WeeklyBudget.parseBuffer;
  eq(["150", "€ 1 500", "99,50", "0", "100000", "100 000"].map(parse), [150, 1500, 100, 0, 100_000, 100_000], "accepted, as whole euros");
  // The server refuses a buffer over 100,000 (lib/finance/budget.ts), which made every question fail.
  eq(["100001", "150000", "1000000", "-5", "1e3", "abc", "", "12.345"].map(parse), [null, null, null, null, null, null, null, null], "refused");
  eq(WeeklyBudget.maxBufferEur, 100_000, "the server's limit");
  ok(WeeklyBudget.bufferInputError.includes("100,000"), "the message names the limit");
  const settings = readFileSync(join(process.cwd(), "web/features/Sheets/SettingsSheet.tsx"), "utf8");
  const sheet = readFileSync(join(process.cwd(), "web/features/Today/BufferSheet.tsx"), "utf8");
  ok([settings, sheet].every((source) => source.includes("WeeklyBudget.parseBuffer") || source.includes("{ parseBuffer } = WeeklyBudget")), "both fields use the shared rule");
  ok([settings, sheet].every((source) => source.includes("WeeklyBudget.bufferInputError")), "both fields show the same message");
  ok(!settings.includes("1_000_000"), "no separate, larger Settings limit");
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

group("Covered headline: a weekly figure far above the usual pace is not shown as spending money", () => {
  const headline = (id: string, buffer: number | null = null) =>
    WeeklyBudgetText.headline(ready(WeeklyBudget.compute(WeeklyBudget.inputs(overview(id), cashFlow(id), buffer))));
  // Sanna: €27,162 balance, €948 of bills, about €3.48 a day of everyday spending. Not capped, just said plainly.
  const sanna = ready(WeeklyBudget.compute(WeeklyBudget.inputs(overview("CUST02003"), cashFlow("CUST02003"), 250)));
  ok(WeeklyBudget.covered(sanna), "Sanna: covered");
  near(sanna.leftEur, 27161.81 - 948.09 - 250, "Sanna: what is left is not capped");
  eq(WeeklyBudgetText.headline(sanna), {
    kind: "covered", title: "Bills before payday are covered",
    detail: "About €25,964 left after bills and your buffer · you usually spend about €24 a week on everyday things",
  }, "Sanna: covered headline with her usual pace");
  eq(headline("CUST02003").kind === "covered" && headline("CUST02003").detail.includes("the assumed buffer"), true, "an assumed buffer is called assumed");
  eq(headline("CUST04414").kind, "covered", "Eetu: about €1,590 a week against about €459 of usual spending");
  const aino = headline("CUST04974");
  eq(aino, { kind: "weekly", amount: "€202", unit: "a week until payday", detail: "After €687 of bills due before payday and a €100 buffer (assumed)." }, "Aino: the weekly figure");
  const r = ready(WeeklyBudget.compute(base));
  eq(WeeklyBudget.covered(r), false, "€150 against €140 a week: a weekly figure");
  eq(WeeklyBudget.covered(ready(WeeklyBudget.compute({ ...base, balanceEur: 1600 }))), true, "€450 a week against €140: covered (above 3x)");
  eq(WeeklyBudget.covered(ready(WeeklyBudget.compute({ ...base, balanceEur: 1540 }))), false, "€420 a week against €140: exactly 3x is still a weekly figure");
  eq(WeeklyBudget.covered(ready(WeeklyBudget.compute({ ...base, balanceEur: 5000, averageDailyEverydayEur: null }))), false, "unknown pace: a weekly figure");
  eq(WeeklyBudget.covered(ready(WeeklyBudget.compute({ ...base, balanceEur: 650 }))), false, "nothing left: never covered");
  const still = WeeklyBudgetText.headline(ready(WeeklyBudget.compute({ ...base, balanceEur: 5000, averageDailyEverydayEur: 0 })));
  eq(still, { kind: "covered", title: "Bills before payday are covered", detail: "About €4,300 left after bills and the assumed buffer" }, "no everyday spending: no pace clause");
});

group("Budget text", () => {
  const r = ready(WeeklyBudget.compute(base));
  eq(WeeklyBudgetText.title, "Estimated weekly budget", "title");
  ok(!/safe to spend/i.test(JSON.stringify([WeeklyBudgetText.lines(r, "2026-09-30"), WeeklyBudgetText.basis(r), WeeklyBudgetText.pace(r)])), "never 'safe to spend'");
  eq(WeeklyBudgetText.basis(r), "After €600 of bills due before payday and a €100 buffer (assumed).", "basis");
  eq(WeeklyBudgetText.payday(r), "Payday in 14 days", "payday");
  eq(WeeklyBudgetText.lines(r, "2026-09-30").map((l) => l.amount), ["€1,000.00", "−€600.00", "−€100.00", "€300.00", "÷ 2 weeks", "€150.00"], "maths lines (to the cent, as the chat says them)");
  const weeksLine = (days: number) => WeeklyBudgetText.lines(ready(WeeklyBudget.compute({ ...base, daysToPayday: days })), "2026-09-30").find((l) => l.id === "weeks");
  eq([weeksLine(15)?.amount, weeksLine(15)?.basis], ["÷ 2.1 weeks", "15 days to 15 Oct 2026 (15 ÷ 7)"], "the divisor sits in the value column");
  eq([weeksLine(3)?.amount, weeksLine(3)?.basis], ["÷ 1 week", "under a week: all of it is this week's"], "under a week");
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

group("Transactions total: never a net figure called payments", () => {
  const row = (amount: number, category = "Restaurants") => ({ date: "2026-09-30", time: "12:00", amount, category, mcc: "5812", balanceAfter: 100, channel: "card" });
  const list = (amounts: number[], count = amounts.length) => ({
    customerId: "CUST04974", dataTimestamp: "2026-09-30", currency: "EUR", count, truncated: false,
    total: amounts.reduce((a, b) => a + b, 0), transactions: amounts.map((amount) => row(amount)),
  }) as unknown as Parameters<typeof TodayPresenter.transactionsTotal>[0];
  eq(TodayPresenter.transactionsTotal(list([-100.5, -20.25])), { headline: "€121 in 2 payments", detail: null }, "only spending");
  eq(TodayPresenter.transactionsTotal(list([-9.99])), { headline: "€10 in 1 payment", detail: null }, "one payment");
  eq(TodayPresenter.transactionsTotal(list([2000, 400])), { headline: "€2,400 received in 2 payments", detail: null }, "only money in");
  // The live "All transactions" list for Aino: −€21,546.00 of spending and +€21,399.93 of income, net −€146.07.
  const mixed = list([-21000, -546, 21399.93]);
  eq(TodayPresenter.transactionsTotal({ ...mixed, count: 3 }), { headline: "Spent €21,546 · received €21,400", detail: "3 transactions" }, "mixed: both sums, never the net");
  ok(!TodayPresenter.transactionsTotal(mixed).headline.includes("€146"), "the net €146 never shows");
  eq(TodayPresenter.transactionsTotal(list([-10, -20], 406)), { headline: "406 transactions", detail: null }, "a cut list: only the count");
  const all = read<Parameters<typeof TodayPresenter.transactionsTotal>[0]>("transactions-CUST04974-all.json");
  eq(TodayPresenter.transactionsTotal(all).headline, "406 transactions", "recorded file holds 300 of 406 rows: count only");
  const narrowed = { ...all, count: all.transactions.length };
  ok(TodayPresenter.transactionsTotal(narrowed).headline.startsWith("Spent €"), "recorded rows mix salary and spending: split by sign");
});

group("Basket wording", () => {
  eq(BasketKind.allCases.map((k) => BasketKind.label(k, "en")), ["Regular essentials", "Occasional essentials", "Everyday spending"], "labels");
  ok(OnboardingCopy.promiseBaskets.every((row) => !/leak|waste|must pay/i.test(`${row.examples} ${row.meaning}`)), "onboarding rows");
  ok(OnboardingReading.loadingDetail.includes("regular essentials"), "reading copy");
  eq(TodayPresenter.peerNote, "Compared with other profiles in the synthetic demo data", "peer note");
});

group("v2 payday: estimated budget, period, overrides", () => {
  // The server's figures for Jack (CUST04974): 1220.35 − 686.53 − 247.45 = 286.37 until Thu 15 Oct, 133.64 a week.
  const server: CashFlow = { ...cashFlow("CUST04974"), weeklyBudget: { bufferEur: 247.45, bufferSource: "default" } };
  const jack = ready(WeeklyBudget.compute(WeeklyBudget.inputs(overview("CUST04974"), server, null)));
  eq(WeeklyBudgetText.budgetHeadline(jack, null), { kind: "budget", amount: "€286.37", period: "until payday on Thu 15 Oct, 15 days", weekly: "About €133.64 a week", detail: "After €686.53 of bills and a €247.45 buffer (assumed)." }, "Jack: the same figures as the chat");
  eq(WeeklyBudgetText.budgetTitle, "Estimated budget", "headline label");
  eq(PaydayBudget.periodText("2026-10-20", 20), "until payday on Tue 20 Oct, 20 days", "period words match the server");
  // An older backend or the sample: the overrides are applied here by the same rule.
  const moved = PaydayBudget.apply(server, { paydayDate: "2026-10-08", extraBills: [{ label: "Phone repair", amountEur: 80, dueDate: "2026-10-05" }, { label: "Gym", amountEur: 30, dueDate: "2026-10-09" }] });
  eq([moved.nextPayday, moved.daysToNextPayday, moved.billsDueBeforePayday.map((b) => b.billId), moved.basis?.payday], ["2026-10-08", 8, ["added-1", "housing-1"], "confirmed"], "earlier payday drops the mobile bill, counts the repair, not the gym");
  const left = ready(WeeklyBudget.compute(WeeklyBudget.inputs(overview("CUST04974"), PaydayBudget.apply(server, { extraBills: [{ label: "Phone repair", amountEur: 80, dueDate: "2026-10-12" }] }), null)));
  near(left.leftEur, 206.37, "an added bill comes off what is left");
  eq(PaydayBudget.apply({ ...server, basis: { payday: "history" } }, { paydayDate: "2026-10-08" }).nextPayday, "2026-10-15", "a backend that sends basis already applied them");
  eq(PaydayBudget.decode({ paydayDate: "nope", extraBills: [{ label: " ", amountEur: 5, dueDate: "2026-10-02" }] }), null, "invalid overrides are dropped");
  eq(PaydayBudget.bill("Repair", "80,50", "2026-10-12", "2026-09-30"), { label: "Repair", amountEur: 80.5, dueDate: "2026-10-12" }, "typed bill");
  eq(PaydayBudget.paydayError("2026-09-30", "2026-09-30"), "Pick a date within 62 days after 2026-09-30.", "payday must be after the data date");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
