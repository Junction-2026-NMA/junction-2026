// How much could this customer move to savings without running short? Two figures, both from their own numbers:
// a one-off amount they could move today, and an amount they could move every month.
import type { CashFlow, Overview, SavingRoom } from "@/lib/types";
import { round2 } from "./math";

const CUSHION_DAYS = 7; // keep a week of everyday spending in hand before payday
const roundDownToTen = (amount: number): number => Math.max(Math.floor(amount / 10) * 10, 0);

export function savingRoom(overview: Overview, cashFlow: CashFlow): SavingRoom {
  const cushionEur = round2(cashFlow.averageDailyEverydayEur * CUSHION_DAYS);
  const beforePayday = cashFlow.projectedLowPointEur ?? overview.balance;
  const nowEur = roundDownToTen(beforePayday - cushionEur);
  const perMonthEur = roundDownToTen(overview.safeToSpend.gapPerMonth);
  return {
    nowEur,
    perMonthEur,
    cushionEur,
    steps: [
      { label: "Expected balance just before payday", amount: beforePayday, basis: cashFlow.nextPayday ? `after bills due and usual spending until ${cashFlow.nextPayday}` : "account balance" },
      { label: "Kept in hand", amount: -cushionEur, basis: `${CUSHION_DAYS} days of everyday spending` },
      { label: "Could be moved today", amount: nowEur, basis: "rounded down to the nearest ten, never below zero" },
      { label: "Left over in an average month", amount: overview.safeToSpend.gapPerMonth, basis: "safe to spend minus actual everyday spending, 12-month average" },
      { label: "Could be moved every month", amount: perMonthEur, basis: "rounded down to the nearest ten, never below zero" },
    ],
    basis: "One-off: the balance expected just before payday, less a week of everyday spending. Monthly: what an average month leaves over.",
  };
}
