/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// v2 payday (web addition): what the person can confirm for the budget until payday, a changed payday date and bills
// the history does not show, kept per customer and sent with the cash flow and every question. Newer backends work
// the overrides in (`CashFlow.basis` says so); for an older backend or the bundled sample the same rule is applied
// here to the cash flow that came back: bills on or after the new payday drop out, added bills before it count.
// Pure: no React, no storage.
import type { CashFlow, CashFlowBasis, CashFlowBillDue, ExtraBill, PaydayOverrides } from "@/web/core/CoachModels";

export namespace PaydayBudget {
  export const maxDaysAhead = 62;
  export const maxBills = 10;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const DAY_MS = 86_400_000;
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const time = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
  export const isDate = (value: unknown): value is string => typeof value === "string" && DATE.test(value) && !Number.isNaN(time(value))
    && new Date(time(value)).toISOString().slice(0, 10) === value;
  export const daysBetween = (from: string, to: string): number => Math.round((time(to) - time(from)) / DAY_MS);

  /** "Thu 15 Oct" */
  export function dayText(iso: string): string {
    const date = new Date(time(iso));
    return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  }

  /** "until payday on Thu 15 Oct, 15 days": the same words as the server (lib/finance/payday.ts). */
  export function periodText(nextPayday: string, days: number): string {
    return `until payday on ${dayText(nextPayday)}, ${days} ${days === 1 ? "day" : "days"}`;
  }

  export const isEmpty = (overrides: PaydayOverrides | null | undefined): boolean => !overrides?.paydayDate && !overrides?.extraBills?.length;

  /** Stored or typed overrides, each field checked; null when nothing valid is left. */
  export function decode(json: unknown): PaydayOverrides | null {
    if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
    const o = json as Record<string, unknown>;
    const paydayDate = isDate(o.paydayDate) ? o.paydayDate : undefined;
    const extraBills = Array.isArray(o.extraBills) ? o.extraBills.flatMap((item): ExtraBill[] => {
      const bill = (item ?? {}) as Record<string, unknown>;
      const label = typeof bill.label === "string" ? bill.label.trim().slice(0, 40) : "";
      const amount = typeof bill.amountEur === "number" && Number.isFinite(bill.amountEur) ? Math.round(bill.amountEur * 100) / 100 : 0;
      return label && amount > 0 && amount <= 100_000 && isDate(bill.dueDate) ? [{ label, amountEur: amount, dueDate: bill.dueDate }] : [];
    }).slice(0, maxBills) : [];
    const result: PaydayOverrides = { ...(paydayDate ? { paydayDate } : {}), ...(extraBills.length ? { extraBills } : {}) };
    return isEmpty(result) ? null : result;
  }

  /** Why a typed payday is refused, or null when it is fine (1 to `maxDaysAhead` days after the data date). */
  export function paydayError(date: string, dataDate: string): string | null {
    if (!isDate(date)) return "Pick a date.";
    const days = daysBetween(dataDate, date);
    return days >= 1 && days <= maxDaysAhead ? null : `Pick a date within ${maxDaysAhead} days after ${dataDate}.`;
  }

  /** A typed bill as a bill, or the sentence to show. */
  export function bill(label: string, amountText: string, dueDate: string, dataDate: string): ExtraBill | string {
    const name = label.trim().slice(0, 40);
    const amount = Number(amountText.replace(/[€\s ]/g, "").replace(",", "."));
    if (!name) return "Give the bill a name.";
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) return "Type an amount in euros, for example 80.";
    if (!isDate(dueDate)) return "Pick the day it is due.";
    const days = daysBetween(dataDate, dueDate);
    if (days < 0 || days > maxDaysAhead) return `Pick a due date within ${maxDaysAhead} days after ${dataDate}.`;
    return { label: name, amountEur: Math.round(amount * 100) / 100, dueDate };
  }

  /** The cash flow with the overrides worked in. A newer backend already did (it sends `basis`); otherwise the same
   *  rule is applied here. Without overrides an older answer gets a basis inferred from history. */
  export function apply(cashFlow: CashFlow, overrides: PaydayOverrides | null): CashFlow {
    if (cashFlow.basis) return cashFlow;
    const inferred = cashFlow.nextPayday ?? null;
    const nextPayday = overrides?.paydayDate ?? inferred;
    if (!nextPayday) return cashFlow;
    const days = daysBetween(cashFlow.dataTimestamp, nextPayday);
    const added = (overrides?.extraBills ?? []).map((one) => ({ ...one, counted: one.dueDate >= cashFlow.dataTimestamp && one.dueDate < nextPayday }));
    const bills: CashFlowBillDue[] = [
      ...(cashFlow.billsDueBeforePayday ?? []).filter((one) => one.expectedOn < nextPayday),
      ...added.flatMap((one, index) => (one.counted ? [{ billId: `added-${index + 1}`, label: one.label, amount: one.amountEur, expectedOn: one.dueDate }] : [])),
    ].sort((a, b) => (a.expectedOn < b.expectedOn ? -1 : a.expectedOn > b.expectedOn ? 1 : 0));
    const basis: CashFlowBasis = {
      payday: overrides?.paydayDate ? "confirmed" : "history",
      bills: added.some((one) => one.counted) ? "history+added" : "history",
      label: "Estimated budget",
      periodText: periodText(nextPayday, days),
      addedBills: added,
    };
    return { ...cashFlow, nextPayday, daysToNextPayday: days, billsDueBeforePayday: bills, basis };
  }

  /** What the figure assumes, in short lines for "Show the maths". */
  export function assumptions(basis: CashFlowBasis | null | undefined, bufferIsDefault: boolean): string[] {
    return [
      basis?.payday === "confirmed" ? "Payday: the date you gave." : "Payday: inferred from your salary history.",
      "Bills and everyday spending: 12-month averages.",
      ...(basis?.bills === "history+added" ? ["Bills you added are counted when due before payday."] : []),
      bufferIsDefault ? "Buffer: an assumption until you set your own." : "Buffer: the amount you set.",
    ];
  }
}
