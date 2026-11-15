/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/AppPresenters.swift. What the app's screens say: every figure and every sentence with
// a number in it is built here, so the views only lay text out. English copy (the app is English for now). Money
// goes through `Money.format`, dates through `Dates.short`.
import type { CashFlow } from "@/web/core/CoachModels";
import type { BasketId, BasketSummary, EvidenceFilter, Overview, RecurringBill, Transaction, TransactionList } from "@/web/core/Models";
import { BasketKind, Dates, Money, rawOf, roundAway } from "@/web/core/Presentation";
import { WeeklyBudget } from "./WeeklyBudget";

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

export interface BasketCategoryState { readonly id: string; readonly category: string; readonly monthly: string; readonly reason: string; readonly peer: string | null }
export interface BasketCardState {
  readonly id: BasketId;
  readonly kind: BasketKind;
  readonly name: string;
  readonly subtitle: string;
  /** What lands in this basket, in plain words (never "waste"). */
  readonly about: string;
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


/** The figures and copy of the Today screen. */
export namespace TodayPresenter {
  export function money(amount: number): string { return Money.format(amount, "en"); }

  /** `Hei Jack`. */
  export function greeting(name: string): string { return `Hei ${name}`; }

  /** `Data up to 30 Sep 2026`. */
  export function dataDate(overview: Overview): string { return `Data up to ${Dates.short(overview.dataTimestamp, "en")}`; }

  /** The recurring bill with the largest monthly average outside housing. Null when there is none. */
  export function flaggedBill(overview: Overview): RecurringBill | null {
    return firstMax(overview.recurringBills.filter((bill) => bill.category.toLowerCase() !== "housing"), (bill) => bill.monthlyAvg);
  }

  /** One basket's sheet: the amount, its share of spending and the categories. Peer figures are other profiles in
   *  the synthetic demo data of the same age band, and say so (they are not statistics about real people). */
  export function basket(basket: BasketSummary, ageBand: string): BasketCardState {
    const kind = BasketKind.of(basket.id);
    const band = ageBand.trim() === "" ? "" : ` aged ${ageBand.trim().replace("-", "–")}`;
    return {
      id: basket.id, kind, name: BasketKind.label(kind, "en"), subtitle: basket.label, about: about(kind),
      monthly: `${money(basket.monthlyAvg)} a month`,
      share: `${NumberText.percent(basket.share)} of spending`,
      categories: basket.categories.map((category) => ({
        id: category.category, category: category.category,
        monthly: `${money(category.monthlyAvg)} a month`,
        reason: category.reason,
        peer: category.peerMonthlyAvg != null ? `Profiles${band}: about ${money(category.peerMonthlyAvg)} a month` : null,
      })),
    };
  }

  /** What lands in a basket. Everyday spending holds essentials too (groceries), so it is never called a leak. */
  export function about(kind: BasketKind): string {
    switch (kind) {
      case "fixed": return "Payments that come every month, such as rent, electricity and your phone.";
      case "curveballs": return "Needed costs that come now and then, such as repairs, health and gifts.";
      case "leaks": return "Day-to-day spending such as groceries, transport and free time. Some of it is essential, some is easier to adjust.";
    }
  }

  /** The note above peer figures. */
  export const peerNote = "Compared with other profiles in the synthetic demo data";

  /** The three basket buttons: names only, no amounts until one is tapped. */
  export function basketButtons(overview: Overview): { id: BasketId; kind: BasketKind; name: string }[] {
    return overview.baskets.map((basket) => {
      const kind = BasketKind.of(basket.id);
      return { id: basket.id, kind, name: BasketKind.label(kind, "en") };
    });
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

  /** The total line of a transactions sheet, true for the rows it lists. Never a net figure: the API's `total` adds
   *  income and spending together, so the sums come from the rows, split by sign.
   *  - Only spending: `€412 in 9 payments`.
   *  - Only money in: `€2,400 received in 2 payments`.
   *  - Both: `Spent €21,546 · received €21,400`, with `172 transactions` as the detail.
   *  - Fewer rows than `count` (a cut list): the sums are not known, so only `406 transactions`. */
  export function transactionsTotal(list: TransactionList): { headline: string; detail: string | null } {
    const rows = list.transactions.filter((row) => Number.isFinite(row.amount));
    const count = Math.max(list.count, rows.length);
    const counted = (noun: "payment" | "transaction") => `${count} ${noun}${count === 1 ? "" : "s"}`;
    if (rows.length < count) return { headline: counted("transaction"), detail: null };
    const cents = (amounts: number[]) => roundAway(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
    const spent = cents(rows.filter((row) => row.amount < 0).map((row) => -row.amount));
    const received = cents(rows.filter((row) => row.amount > 0).map((row) => row.amount));
    if (received === 0) return { headline: `${money(spent)} in ${counted("payment")}`, detail: null };
    if (spent === 0) return { headline: `${money(received)} received in ${counted("payment")}`, detail: null };
    return { headline: `Spent ${money(spent)} · received ${money(received)}`, detail: counted("transaction") };
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

/** Today's one primary insight or action: the most material thing, with one tap into Sisu. */
export interface TodayFocusState {
  readonly id: string;
  /** `warning` only for a projected shortfall or a dip into the buffer before payday. */
  readonly tone: "warning" | "info";
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  /** The question asked in Sisu (model.askSisu) and the button's words. */
  readonly question: string;
  readonly askLabel: string;
  /** The transactions behind it, when there are some to show. */
  readonly evidence: { readonly title: string; readonly filter: EvidenceFilter } | null;
}

export namespace TodayFocus {
  const money = TodayPresenter.money;
  export const paydayQuestion = "I keep running short before payday. What can I spend this week without missing my bills?";
  /** At least this many months below zero in the window make "running short" the insight. */
  export const shortMonthsThreshold = 3;

  /** In order: a projected shortfall, a dip into the buffer, months that ran below zero, the biggest bill to check,
   *  then the first thing Sisu noticed. Null when there is nothing to say. */
  export function primary(overview: Overview, budget: WeeklyBudget.Result | null, cashFlow: CashFlow | null,
    confirmedBillName: string | null): TodayFocusState | null {
    const ready = budget?.kind === "ready" ? budget : null;
    const window = { from: overview.windowFrom, to: overview.windowTo };
    if (ready && ready.projectedEur !== null && (ready.status === "shortfall" || ready.status === "belowBuffer")) {
      const payday = Dates.short(ready.nextPayday, "en");
      const short = ready.status === "shortfall";
      return {
        id: short ? "shortfall" : "below-buffer", tone: "warning", eyebrow: "Before payday",
        title: short
          ? `At your usual pace you would be about ${money(-ready.projectedEur)} short before payday`
          : `At your usual pace about ${money(ready.projectedEur)} would be left before payday`,
        detail: short
          ? `${money(ready.billsEur)} of bills are due before ${payday}. Sisu can help you plan this week.`
          : `That is under your ${money(ready.bufferEur)} buffer${ready.bufferIsDefault ? " (assumed)" : ""}. Bills of ${money(ready.billsEur)} are due before ${payday}.`,
        question: paydayQuestion, askLabel: "Plan this week with Sisu", evidence: null,
      };
    }
    const shortMonths = cashFlow?.negativeMonths ?? 0;
    if (shortMonths >= shortMonthsThreshold) {
      return {
        id: "short-months", tone: "info", eyebrow: "Before payday",
        title: `Your balance went below €0 in ${shortMonths} of the last ${overview.windowMonths} months`,
        detail: "Running short before payday is not the same as having no savings: it is about when money leaves. Sisu can show when it happens.",
        question: paydayQuestion, askLabel: "Ask Sisu about payday",
        evidence: { title: "Payments while the balance was below €0", filter: { ...window, negativeBalance: true } },
      };
    }
    const bill = TodayPresenter.flaggedBill(overview);
    if (bill) {
      const name = confirmedBillName ?? bill.guessLabel;
      return {
        id: `bill-${bill.id}`, tone: "info", eyebrow: "Biggest bill to check",
        title: confirmedBillName ? `${name}: about ${money(bill.monthlyAvg)} a month` : `Looks like ${name}: about ${money(bill.monthlyAvg)} a month`,
        detail: confirmedBillName ? "Bills like this are often cheaper for new customers." : "The name is Sisu's guess from the payments. Bills like this are often cheaper for new customers.",
        question: `Find a cheaper ${name.toLowerCase()} plan that meets my needs.`, askLabel: "Compare offers with Sisu",
        evidence: { title: `${bill.category} payments`, filter: { ...window, category: bill.category } },
      };
    }
    // Peer comparisons are not a primary insight: they come from synthetic demo profiles, not real people.
    const insight = overview.insights.find((item) => !item.id.includes("peer"));
    if (!insight) return null;
    return {
      id: `insight-${insight.id}`, tone: "info", eyebrow: "Sisu noticed", title: insight.title, detail: insight.body,
      question: `Tell me more: ${insight.title}`, askLabel: "Ask Sisu about it",
      evidence: { title: insight.title, filter: insight.evidence },
    };
  }
}
