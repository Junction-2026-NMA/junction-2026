/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// The estimated weekly budget on Today (web addition, no Swift counterpart yet): what is left of the current balance
// after the bills due before the next payday and a protected buffer, spread over the weeks until that payday.
//   weekly = max(0, (balance − bills due before payday − buffer) / max(days to payday / 7, 1))
// Pure. The balance comes from the overview, the payday, the bills and the everyday pace from
// GET /api/coach/cash-flow (bank data, 12-month averages), the buffer from the person (AppPrefs.bufferEur) or a
// labelled default. The default is the backend's own when it sends one (`CashFlow.weeklyBudget`, newer backends: one
// week of regular and occasional essentials), so Today and Sisu's answers agree; otherwise €100. It is an estimate,
// never "safe to spend". A missing input is named, never guessed.
import type { CashFlow, CashFlowBasis } from "@/web/core/CoachModels";
import { PaydayBudget } from "./PaydayBudget";
import type { Overview } from "@/web/core/Models";
import { Dates, Money } from "@/web/core/Presentation";

export namespace WeeklyBudget {
  /** The buffer assumed until the person sets their own (shown as an assumption with a "Set your buffer" control). */
  export const defaultBufferEur = 100;
  /** The realistic adjustment Today offers: about a fifth of a usual week's everyday spending, in steps of €5. */
  export const adjustmentShare = 0.2;
  /** The largest buffer a field accepts: the server refuses more (lib/finance/budget.ts BUFFER_LIMITS), and a
   *  refused buffer would make every question fail while the setting stays. */
  export const maxBufferEur = 100_000;
  /** What every buffer field says when the typed text is not a buffer it accepts. */
  export const bufferInputError = "Type an amount in euros from 0 to 100,000, for example 150.";

  /** Typed buffer text ("150", "€ 1 500", "99,50") as whole euros, or null when it is not a number from 0 to
   *  `maxBufferEur`. Empty text is null too: the caller decides whether that clears the setting. */
  export function parseBuffer(text: string): number | null {
    const clean = text.replace(/[€\s ]/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
    const value = Math.round(Number(clean));
    return Number.isFinite(value) && value >= 0 && value <= maxBufferEur ? value : null;
  }

  /** `billId` starts with `added-` for a bill the person added (v2 payday). */
  export interface Bill { readonly label: string; readonly amountEur: number; readonly expectedOn: string; readonly billId?: string }

  export interface Inputs {
    readonly balanceEur: number | null;
    readonly nextPayday: string | null;
    readonly daysToPayday: number | null;
    /** The bills expected before the next payday; null when they are not known (the cash flow did not load). */
    readonly bills: readonly Bill[] | null;
    readonly averageDailyEverydayEur: number | null;
    /** The person's own buffer, or null to use the default. */
    readonly bufferEur: number | null;
    /** The default buffer (`defaultBuffer(cashFlow)`); `defaultBufferEur` when left out. */
    readonly defaultBufferEur?: number;
    /** False when the cash-flow answer never arrived (so payday and bills are unknown, not absent). */
    readonly cashFlowLoaded: boolean;
  }

  export type Missing = "balance" | "payday" | "bills";
  /** `shortfall`: at the usual pace the balance runs out before payday. `belowBuffer`: it stays above zero but dips
   *  into the buffer. `onTrack`: it stays above the buffer. */
  export type Status = "shortfall" | "belowBuffer" | "onTrack";

  export interface Ready {
    readonly kind: "ready";
    readonly balanceEur: number;
    readonly bills: readonly Bill[];
    readonly billsEur: number;
    readonly bufferEur: number;
    readonly bufferIsDefault: boolean;
    readonly nextPayday: string;
    readonly daysToPayday: number;
    /** Days to payday in weeks, at least 1 (under a week the whole amount is this week's). */
    readonly weeks: number;
    /** Balance − bills − buffer. Negative when the bills and buffer need more than the balance. */
    readonly leftEur: number;
    readonly weeklyEur: number;
    /** The usual everyday spending a week (12-month average), or null when it is not known. */
    readonly usualWeeklyEur: number | null;
    /** Balance − bills − the usual everyday spending until payday: what would be left just before it. */
    readonly projectedEur: number | null;
    readonly status: Status | null;
  }
  export interface Unavailable { readonly kind: "missing"; readonly missing: readonly Missing[]; readonly cashFlowLoaded: boolean }
  export type Result = Ready | Unavailable;

  const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

  /** The buffer assumed until the person sets one: the backend's default when it sends one, else `defaultBufferEur`. */
  export function defaultBuffer(cashFlow: CashFlow | null): number {
    const server = cashFlow?.weeklyBudget;
    return server && server.bufferSource === "default" && finite(server.bufferEur) && server.bufferEur >= 0
      ? Math.round(server.bufferEur * 100) / 100 : defaultBufferEur;
  }

  /** The inputs from what Today has loaded. `cashFlow` is null while it is missing. */
  export function inputs(overview: Overview | null, cashFlow: CashFlow | null, bufferEur: number | null): Inputs {
    const days = cashFlow?.daysToNextPayday;
    return {
      balanceEur: overview && finite(overview.balance) ? overview.balance : null,
      nextPayday: cashFlow?.nextPayday ?? null,
      daysToPayday: finite(days) && days >= 0 ? days : null,
      bills: cashFlow ? (cashFlow.billsDueBeforePayday ?? []).filter((bill) => finite(bill.amount))
        .map((bill) => ({ label: bill.label, amountEur: Math.abs(bill.amount), expectedOn: bill.expectedOn, billId: bill.billId })) : null,
      averageDailyEverydayEur: cashFlow && finite(cashFlow.averageDailyEverydayEur) && cashFlow.averageDailyEverydayEur >= 0
        ? cashFlow.averageDailyEverydayEur : null,
      bufferEur: finite(bufferEur) && bufferEur >= 0 ? bufferEur : null,
      defaultBufferEur: defaultBuffer(cashFlow),
      cashFlowLoaded: cashFlow !== null,
    };
  }

  export function compute(input: Inputs): Result {
    const missing: Missing[] = [
      ...(input.balanceEur === null ? ["balance" as const] : []),
      ...(input.nextPayday === null || input.daysToPayday === null ? ["payday" as const] : []),
      ...(input.bills === null ? ["bills" as const] : []),
    ];
    if (input.balanceEur === null || input.nextPayday === null || input.daysToPayday === null || input.bills === null) {
      return { kind: "missing", missing, cashFlowLoaded: input.cashFlowLoaded };
    }
    const billsEur = input.bills.reduce((sum, bill) => sum + bill.amountEur, 0);
    const bufferEur = input.bufferEur ?? input.defaultBufferEur ?? defaultBufferEur;
    const weeks = Math.max(input.daysToPayday / 7, 1);
    const leftEur = input.balanceEur - billsEur - bufferEur;
    const daily = input.averageDailyEverydayEur;
    const projectedEur = daily === null ? null : input.balanceEur - billsEur - daily * input.daysToPayday;
    return {
      kind: "ready", balanceEur: input.balanceEur, bills: input.bills, billsEur, bufferEur,
      bufferIsDefault: input.bufferEur === null, nextPayday: input.nextPayday, daysToPayday: input.daysToPayday, weeks,
      leftEur, weeklyEur: Math.max(leftEur / weeks, 0),
      usualWeeklyEur: daily === null ? null : daily * 7,
      projectedEur, status: projectedEur === null ? null : status(projectedEur, bufferEur),
    };
  }

  export function status(projectedEur: number, bufferEur: number): Status {
    if (projectedEur < 0) return "shortfall";
    return projectedEur < bufferEur ? "belowBuffer" : "onTrack";
  }

  /** Above this many times the usual everyday spending a week, a weekly figure stops being a budget anyone would
   *  spend: it is most of the balance. Today then says the bills before payday are covered instead. */
  export const coveredFactor = 3;

  /** True when there is money left after the bills and the buffer and the weekly budget is more than
   *  `coveredFactor` times the usual everyday spending a week. The figure itself is not capped (the maths sheet keeps
   *  the full working); only Today's headline changes. False when the usual pace is not known. */
  export function covered(ready: Ready): boolean {
    return ready.usualWeeklyEur !== null && ready.leftEur > 0 && ready.weeklyEur > coveredFactor * ready.usualWeeklyEur;
  }

  /** "Spend €X less on everyday spending this week": X and what would then be left just before payday. */
  export function adjustment(ready: Ready): { cutEur: number; leftEur: number } | null {
    if (ready.usualWeeklyEur === null || ready.projectedEur === null || !(ready.usualWeeklyEur >= 5)) return null;
    const cutEur = Math.max(Math.ceil((ready.usualWeeklyEur * adjustmentShare) / 5) * 5, 5);
    return { cutEur, leftEur: ready.projectedEur + cutEur };
  }
}

export interface BudgetLine { readonly id: string; readonly label: string; readonly amount: string; readonly basis: string; readonly isResult: boolean }

/** What Today and "How this is worked out" say about the weekly budget. */
export namespace WeeklyBudgetText {
  const money = (amount: number) => Money.format(amount, "en");
  /** To the cent, as Sisu's answers say it, so the chat, the cards and the maths show the same figure. */
  const cents = (amount: number) => Money.format(amount, "en", true);
  const date = (iso: string) => Dates.short(iso, "en");
  const line = (id: string, label: string, amount: string, basis: string, isResult = false): BudgetLine => ({ id, label, amount, basis, isResult });

  export const title = "Estimated weekly budget";
  /** v2 payday: the headline label. Always an estimate while the bills are 12-month averages. */
  export const budgetTitle = "Estimated budget";
  export const mathsTitle = "Show the maths";

  /** v2 payday: "until payday on Thu 15 Oct, 15 days", the server's words when it sends them. */
  export function period(ready: WeeklyBudget.Ready, basis: CashFlowBasis | null | undefined): string {
    return basis?.periodText && ready.nextPayday ? basis.periodText : PaydayBudget.periodText(ready.nextPayday, ready.daysToPayday);
  }

  /** v2 payday: Today's headline: what is left until payday and the period, the weekly figure as a second line. */
  export type BudgetHeadline = { readonly kind: "budget"; readonly amount: string; readonly period: string; readonly weekly: string; readonly detail: string };

  export function budgetHeadline(ready: WeeklyBudget.Ready, basis: CashFlowBasis | null | undefined): Headline | BudgetHeadline {
    if (WeeklyBudget.covered(ready)) return headline(ready);
    const bills = ready.bills.length === 0 ? "no bills due" : `${cents(ready.billsEur)} of bills`;
    return {
      kind: "budget",
      amount: cents(Math.max(ready.leftEur, 0)),
      period: period(ready, basis),
      weekly: `About ${cents(ready.weeklyEur)} a week`,
      detail: `After ${bills} and a ${cents(ready.bufferEur)} buffer${ready.bufferIsDefault ? " (assumed)" : ""}.`,
    };
  }
  export const unit = "a week until payday";
  export const coveredTitle = "Bills before payday are covered";

  /** Today's headline: the weekly figure with its basis, or, when that figure is far above the usual pace
   *  (`WeeklyBudget.covered`), "Bills before payday are covered" with what is left and the usual pace. */
  export type Headline =
    | { readonly kind: "weekly"; readonly amount: string; readonly unit: string; readonly detail: string }
    | { readonly kind: "covered"; readonly title: string; readonly detail: string };

  export function headline(ready: WeeklyBudget.Ready): Headline {
    if (!WeeklyBudget.covered(ready)) return { kind: "weekly", amount: money(ready.weeklyEur), unit, detail: basis(ready) };
    const buffer = ready.bufferIsDefault ? "the assumed buffer" : "your buffer";
    const usual = ready.usualWeeklyEur ?? 0;
    const pace = Math.round(usual) >= 1 ? ` · you usually spend about ${money(usual)} a week on everyday things` : "";
    return { kind: "covered", title: coveredTitle, detail: `About ${money(ready.leftEur)} left after bills and ${buffer}${pace}` };
  }

  export function payday(ready: WeeklyBudget.Ready): string {
    if (ready.daysToPayday === 0) return "Payday today";
    return ready.daysToPayday === 1 ? "Payday tomorrow" : `Payday in ${ready.daysToPayday} days`;
  }

  /** "After €687 of bills and a €100 buffer (assumed)". */
  export function basis(ready: WeeklyBudget.Ready): string {
    const bills = ready.bills.length === 0 ? "no bills due" : `${money(ready.billsEur)} of bills due`;
    return `After ${bills} before payday and a ${money(ready.bufferEur)} buffer${ready.bufferIsDefault ? " (assumed)" : ""}.`;
  }

  export function buffer(ready: WeeklyBudget.Ready): string {
    return ready.bufferIsDefault ? `Buffer ${money(ready.bufferEur)}, a default assumption` : `Buffer ${money(ready.bufferEur)}, your setting`;
  }

  /** What is missing, instead of a guessed figure. */
  export function missing(result: WeeklyBudget.Unavailable): string {
    if (!result.cashFlowLoaded) return "Sisu could not load the next payday and the bills due before it, so there is no weekly budget yet.";
    if (result.missing.includes("payday")) return "No regular salary shows in this data, so there is no payday to budget to yet.";
    if (result.missing.includes("balance")) return "The current balance is missing, so there is no weekly budget yet.";
    return "Some figures are missing, so there is no weekly budget yet.";
  }

  /** The adjustment as one sentence: "Spend €35 less on everyday spending this week → about €212 left before payday." */
  export function adjustment(ready: WeeklyBudget.Ready): string | null {
    const change = WeeklyBudget.adjustment(ready);
    if (!change) return null;
    return `Spend ${money(change.cutEur)} less on everyday spending this week → about ${money(change.leftEur)} left just before payday.`;
  }

  /** The maths, one line per step: balance, each bill, the buffer, what is left, the weeks, the weekly budget. */
  export function lines(ready: WeeklyBudget.Ready, dataDate: string): BudgetLine[] {
    const underWeek = ready.daysToPayday < 7;
    const tenths = Math.round(ready.weeks * 10) / 10;
    const weeks = underWeek ? "÷ 1 week" : `÷ ${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)} weeks`;
    const weeksBasis = underWeek ? "under a week: all of it is this week's"
      : `${ready.daysToPayday} days to ${date(ready.nextPayday)} (${ready.daysToPayday} ÷ 7)`;
    return [
      line("balance", "Balance", cents(ready.balanceEur), `bank data, ${date(dataDate)}`),
      ...ready.bills.map((bill, index) => line(`bill-${index}`, bill.label, `−${cents(bill.amountEur)}`, bill.billId?.startsWith("added-") ? `due ${date(bill.expectedOn)} (a bill you added)` : `usually due ${date(bill.expectedOn)} (12-month average; the name is Sisu's guess)`)),
      line("buffer", "Protected buffer", `−${cents(ready.bufferEur)}`, ready.bufferIsDefault ? "a default assumption: set your own" : "your setting"),
      line("left", "Left until payday", cents(Math.max(ready.leftEur, 0)), ready.leftEur < 0 ? `the bills and buffer need ${cents(-ready.leftEur)} more than the balance` : `for everything else until ${date(ready.nextPayday)}`, true),
      line("weeks", "Weeks until payday", weeks, weeksBasis),
      line("weekly", WeeklyBudgetText.title, cents(ready.weeklyEur), "a week", true),
    ];
  }

  /** At the usual pace: the everyday spending a week and what would be left just before payday. */
  export function pace(ready: WeeklyBudget.Ready): BudgetLine[] {
    if (ready.usualWeeklyEur === null || ready.projectedEur === null) return [];
    return [
      line("usual", "Usual everyday spending", cents(ready.usualWeeklyEur), "a week, 12-month average"),
      line("projected", "Left just before payday", cents(ready.projectedEur), "at that usual pace, after the bills", true),
    ];
  }

  export const assumptions: readonly string[] = [
    "An estimate from the bills Sisu found and your past spending, not a promise of what is safe to spend.",
    "Bills come from 12-month averages on their usual day. Bills due on payday itself are counted after it.",
    "Only this account is visible. Money held elsewhere is not counted.",
  ];
}
