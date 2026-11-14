/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/AppPresenters.swift. What the app's screens say: every figure and every sentence with
// a number in it is built here, so the views only lay text out. English copy (the app is English for now). Money
// goes through `Money.format`, dates through `Dates.short`.
import type { BasketId, BasketSummary, Branch, BranchId, Overview, RecurringBill, ScenarioResponse, Transaction, TransactionList } from "@/web/core/Models";
import { BasketKind, BasketMath, Dates, Money, rawOf, roundAway } from "@/web/core/Presentation";

/** Swift `max(by:)`: the first element with the largest key, or null when empty. */
function firstMax<T>(items: readonly T[], key: (item: T) => number): T | null {
  return items.reduce<T | null>((best, item) => (best === null || key(best) < key(item) ? item : best), null);
}

/** Small number formats the screens need besides money. */
export namespace NumberText {
  /** A 0...1 share as a whole percent: `0.42` → `42%`. Non-finite values count as 0. */
  export function percent(share: number): string {
    const value = Number.isFinite(share) ? share : 0;
    return `${roundAway(value * 100) || 0}%`;
  }

  /** A number with one decimal: `1.14` → `1.1`. Non-finite values count as 0. */
  export function oneDecimal(value: number): string {
    const safe = Number.isFinite(value) ? value : 0;
    const tenths = roundAway(safe * 10) || 0;
    const sign = tenths < 0 ? "−" : "";
    const magnitude = Math.abs(tenths);
    return `${sign}${Math.floor(magnitude / 10)}.${magnitude % 10}`;
  }

  /** `2025-10` → `Oct`. Anything else is returned unchanged. */
  export function monthShort(yearMonth: string): string {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = yearMonth.split("-").filter((part) => part !== "");
    if (parts.length < 2 || !/^[+-]?\d+$/.test(parts[1])) return yearMonth;
    const month = Number(parts[1]);
    return month >= 1 && month <= 12 ? names[month - 1] : yearMonth;
  }
}

export interface MathsLine { readonly id: string; readonly label: string; readonly amount: string; readonly basis: string; readonly isResult: boolean }
export interface BasketCategoryState { readonly id: string; readonly category: string; readonly monthly: string; readonly reason: string; readonly peer: string | null }
export interface BasketCardState {
  readonly id: BasketId;
  readonly kind: BasketKind;
  readonly name: string;
  readonly subtitle: string;
  readonly monthly: string;
  readonly share: string;
  readonly categories: BasketCategoryState[];
}
export interface BillCardState {
  readonly headline: string;
  readonly isConfirmed: boolean;
  readonly nameNote: string;
  readonly monthly: string;
  readonly monthlyUnit: string;
  readonly range: string;
  readonly confidence: string;
  readonly basis: string;
}
export interface TransactionRowState { readonly date: string; readonly category: string; readonly amount: string }

const mathsLine = (label: string, amount: string, basis: string, isResult: boolean): MathsLine => ({ id: label, label, amount, basis, isResult });

/** The figures and copy of the Today screen. */
export namespace TodayPresenter {
  export function money(amount: number): string { return Money.format(amount, "en"); }

  /** `Hei Aino`. */
  export function greeting(name: string): string { return `Hei ${name}`; }

  /** The hero's context line, short enough for one line of the Rive hero. */
  export function heroContext(overview: Overview): string {
    const gap = overview.safeToSpend.gapPerMonth;
    const amount = money(Math.abs(Number.isFinite(gap) ? gap : 0));
    return gap < 0 ? `About ${amount} a month above this` : `About ${amount} a month of room to save`;
  }

  /** `Data up to 30 Sep 2026`. */
  export function dataDate(overview: Overview): string { return `Data up to ${Dates.short(overview.dataTimestamp, "en")}`; }

  /** The recurring bill with the largest monthly average outside housing. Null when there is none. */
  export function flaggedBill(overview: Overview): RecurringBill | null {
    return firstMax(overview.recurringBills.filter((bill) => bill.category.toLowerCase() !== "housing"), (bill) => bill.monthlyAvg);
  }

  /** The safe-to-spend maths, one line per step, then what is left and what is actually spent. */
  export function mathsLines(overview: Overview): MathsLine[] {
    const s = overview.safeToSpend;
    return [
      ...s.steps.map((step) => mathsLine(step.label, money(step.amount), step.basis, false)),
      mathsLine("Left for everyday choices", money(s.perMonth), `about ${money(s.perWeek)} a week`, true),
      mathsLine("What you actually spend on them", money(s.actualEverydayPerMonth), `average of the last ${overview.windowMonths} months`, false),
    ];
  }

  /** The month labels the cash-flow chart writes under its bars: every other month, starting with the first. */
  export function chartMonthTicks(overview: Overview): string[] {
    return overview.months.filter((_, offset) => offset % 2 === 0).map((month) => NumberText.monthShort(month.month));
  }

  /** The top of the cash-flow chart's euro axis: the largest month plus a tenth. At least 100. */
  export function chartTop(overview: Overview): number {
    const values = overview.months.map((m) => Math.max(m.income, m.regular + m.irregular + m.everyday));
    const largest = values.length ? Math.max(...values) : 0;
    return Math.max(Number.isFinite(largest * 1.1) ? largest * 1.1 : 0, 100);
  }

  /** The legend under the basket bar: (`fixed`, `Fixed 42%`), …, then (`jars`, `Saved 0%`). */
  export function basketLegendItems(overview: Overview): { kind: BasketKind; text: string }[] {
    const baskets = overview.baskets.map((basket) => {
      const kind = BasketKind.of(basket.id);
      return { kind, text: `${BasketKind.label(kind, "en")} ${NumberText.percent(basket.share)}` };
    });
    return [...baskets, { kind: "jars", text: `Saved ${NumberText.percent(BasketMath.shares(overview).jars)}` }];
  }

  /** `Fixed 42% · Curveballs 18% · Leaks 40%`. */
  export function basketLegend(overview: Overview): string {
    return overview.baskets.map((basket) => `${BasketKind.label(BasketKind.of(basket.id), "en")} ${NumberText.percent(basket.share)}`).join(" · ");
  }

  /** One basket card. */
  export function basket(basket: BasketSummary, _peerCount: number): BasketCardState {
    const kind = BasketKind.of(basket.id);
    return {
      id: basket.id, kind, name: BasketKind.label(kind, "en"), subtitle: basket.label,
      monthly: `${money(basket.monthlyAvg)} a month`,
      share: `${NumberText.percent(basket.share)} of spending`,
      categories: basket.categories.map((category) => ({
        id: category.category, category: category.category,
        monthly: `${money(category.monthlyAvg)} a month`,
        reason: category.reason,
        peer: category.peerMonthlyAvg != null ? `People your age: about ${money(category.peerMonthlyAvg)} a month` : null,
      })),
    };
  }

  /** The flagged bill's card. */
  export function bill(bill: RecurringBill, confirmedName: string | null | undefined): BillCardState {
    const confidence = ({ high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as Record<string, string>)[rawOf(bill.confidence)] ?? "Low confidence";
    const confirmed = confirmedName ?? null;
    return {
      headline: confirmed ?? `Looks like ${bill.guessLabel}`,
      isConfirmed: confirmed != null,
      nameNote: confirmed == null ? "The name is Sisu's guess. Confirm it or change it." : "Name confirmed by you.",
      monthly: money(bill.monthlyAvg),
      monthlyUnit: "a month on average",
      range: `Between ${money(bill.min)} and ${money(bill.max)}`,
      confidence,
      basis: bill.basis,
    };
  }

  /** The figure title and the total line of a transactions sheet. */
  export function transactionsTotal(list: TransactionList): string {
    const total = Number.isFinite(list.total) ? Math.abs(list.total) : 0;
    return list.count === 1 ? `${money(total)} in 1 payment` : `${money(total)} in ${list.count} payments`;
  }

  /** One transaction row. */
  export function transactionRow(transaction: Transaction): TransactionRowState {
    return { date: Dates.short(transaction.date, "en"), category: transaction.category, amount: Money.format(transaction.amount, "en", true) };
  }

  /** The note under a truncated list. */
  export function truncatedNote(list: TransactionList): string | null {
    if (!list.truncated) return null;
    if (list.transactions.length < list.count) return `Showing the newest ${list.transactions.length} of ${list.count}.`;
    return "Only the newest payments are included, so older ones may be missing.";
  }
}

/** The figures and copy of the Jars screen. */
export namespace JarsPresenter {
  const money = TodayPresenter.money;

  /** The buffer target in months of must-pay costs. */
  export const bufferTargetMonths = 3.0;

  /** The buffer jar's fill: `runwayMonths` out of three months, 0...1. */
  export function bufferFill(runwayMonths: number): number {
    if (!Number.isFinite(runwayMonths)) return 0;
    return Math.min(Math.max(runwayMonths / bufferTargetMonths, 0), 1);
  }

  /** The buffer jar's figure: `1.1 months`. */
  export function bufferFigure(runwayMonths: number): string {
    const raw = NumberText.oneDecimal(runwayMonths);
    const text = raw.endsWith(".0") ? raw.slice(0, -2) : raw;
    return text === "1" ? "1 month" : `${text} months`;
  }

  /** The line under the buffer figure. */
  export const bufferDetail = "of must-pay costs covered by your balance. The goal is 3.";

  /** The switches jar's figure: `€0 a month`. */
  export function freedFigure(approvedMonthlySaving: number): string {
    return `${money(Math.max(Number.isFinite(approvedMonthlySaving) ? approvedMonthlySaving : 0, 0))} a month`;
  }

  /** The line under the switches figure. */
  export function freedDetail(approvedMonthlySaving: number): string {
    return approvedMonthlySaving > 0 ? "freed by switches you approved." : "freed so far. Approve a switch in Ask and it lands here.";
  }

  export function bufferCaption(runwayMonths: number): string {
    return `Your balance covers about ${NumberText.oneDecimal(runwayMonths)} months of must-pay costs. The goal is 3.`;
  }

  /** The approved monthly saving against the flagged bill's average. 0 when nothing is approved yet. */
  export function freedFill(approvedMonthlySaving: number, billMonthly: number): number {
    if (!(approvedMonthlySaving > 0) || !(billMonthly > 0) || !Number.isFinite(approvedMonthlySaving)) return 0;
    return Math.min(approvedMonthlySaving / billMonthly, 1);
  }

  export function freedCaption(approvedMonthlySaving: number): string {
    return approvedMonthlySaving > 0
      ? `${money(approvedMonthlySaving)} a month freed by switches you approved.`
      : "Nothing yet. Approve a switch in Ask and it lands here.";
  }

  /** `15 berries for effort`. */
  export function berriesCaption(berries: number): string { return berries === 1 ? "1 berry for effort" : `${berries} berries for effort`; }

  export function billSavingText(value: number): string { return `${money(value)} a month`; }
  export function trimText(value: number): string { return `${roundAway(value) || 0}%`; }

  /** The futures chart's x-axis label for a month index: `Now`, `1 year`, `2 years`. */
  export function axisLabel(month: number): string { return month <= 0 ? "Now" : yearsText(Math.trunc(month / 12)); }

  const allMonths = (branches: Branch[]) => branches.flatMap((branch) => branch.points.map((point) => point.month));

  /** The month indexes the futures chart labels: one per year up to six years, then one every two years. */
  export function futuresTicks(branches: Branch[]): number[] {
    const months = allMonths(branches);
    const last = months.length ? Math.max(...months) : 0;
    const step = last > 72 ? 24 : 12;
    return Array.from({ length: Math.floor(Math.max(last, 0) / step) + 1 }, (_, index) => index * step);
  }

  /** The last month of the futures chart (at least 12). */
  export function futuresLastMonth(branches: Branch[]): number {
    const months = allMonths(branches);
    return Math.max(months.length ? Math.max(...months) : 0, 12);
  }

  /** The highest point of any future (its high band included) plus a tenth. At least 100. */
  export function futuresTop(branches: Branch[]): number {
    const highs = branches.flatMap((branch) => branch.points.map((point) => Math.max(point.total, point.totalHigh)));
    const highest = highs.length ? Math.max(...highs) : 0;
    return Math.max(Number.isFinite(highest) ? highest * 1.1 : 0, 100);
  }

  /** A euro axis label: `€2,500`. */
  export function axisMoney(value: number): string { return money(value); }
  export function yearsText(value: number): string { return value === 1 ? "1 year" : `${value} years`; }
  export function endTotal(branch: Branch): string { return money(branch.endTotal); }
  export function endRange(branch: Branch): string { return `${money(branch.endLow)} to ${money(branch.endHigh)}`; }
  export function freedPerMonth(response: ScenarioResponse): string { return `${money(response.freedPerMonth)} a month freed`; }
}

/**
 * The predict-before-reveal question on the Jars screen. The answer is the branch with the most runway after one year.
 */
export namespace FuturesQuiz {
  export const question = "If your income stopped a year from now, which future keeps you afloat longest?";

  /** The three choices in order, with their labels. */
  export const choices: readonly { id: BranchId; label: string }[] = [
    { id: "nothing" as BranchId, label: "Change nothing" },
    { id: "save" as BranchId, label: "Make the change, keep the cash" },
    { id: "invest" as BranchId, label: "Make the change, invest it" },
  ];

  /** The branch with the most runway after a year. Null without branches. */
  export function answer(branches: Branch[]): BranchId | null {
    return firstMax(branches, (branch) => branch.runwayMonthsAtYear1)?.id ?? null;
  }

  /** The ChoiceCard `state`: `idle` before a guess; then `correct` for the answer, `wrong` for a different guess. */
  export function state(choice: BranchId, guess: BranchId | null | undefined, branches: Branch[]): string {
    if (guess == null) return "idle";
    const right = answer(branches);
    if (right == null) return rawOf(choice) === rawOf(guess) ? "selected" : "idle";
    if (rawOf(choice) === rawOf(right)) return "correct";
    return rawOf(choice) === rawOf(guess) ? "wrong" : "idle";
  }

  /** The sentence after the guess. */
  export function explanation(guess: BranchId, branches: Branch[]): string {
    const answerId = answer(branches);
    const best = answerId == null ? undefined : branches.find((branch) => rawOf(branch.id) === rawOf(answerId));
    if (answerId == null || !best) return "Your futures are loading.";
    const lead = rawOf(guess) === rawOf(answerId) ? "Right." : "Good guess, and here is the twist.";
    return `${lead} Cash in the account pays the rent straight away, so “${best.label.toLowerCase()}” covers `
      + `must-pay costs for about ${JarsPresenter.bufferFigure(best.runwayMonthsAtYear1)}.`;
  }
}
