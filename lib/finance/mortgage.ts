// The customer's mortgage application, from the S-Pankki mortgage files, set beside their own bank figures.
// Only some customers have one (of the demo three, Sanna). Everything here is copied or subtracted, nothing estimated.
import eventsJson from "@/data/mortgage_events.json";
import finalJson from "@/data/mortgage_final.json";
import type { MortgageApplication, Overview } from "@/lib/types";
import { round2 } from "./math";

type FinalRow = { mortgage_customer_id: string; customer_id: string; final_decision: string; final_property_price_eur: number; final_requested_loan_eur: number; final_equity_amount_eur: number; final_collateral_value_eur: number; required_monthly_income_eur: number; lfinal_loan_to_value: number };
type EventRow = { mortgage_customer_id: string; timestamp: string; event_type: string; property_type?: string | null; expense_type?: string | null; expense_amount?: number | null };

const FINAL = finalJson as unknown as FinalRow[];
const EVENTS = eventsJson as unknown as EventRow[];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// "01JUN26:21:52:39" -> "2026-06-01"
export function parseStamp(stamp: string): string {
  const match = /^(\d{2})([A-Z]{3})(\d{2})/.exec(stamp);
  const month = match ? MONTHS.indexOf(match[2]) + 1 : 0;
  return match && month ? `20${match[3]}-${String(month).padStart(2, "0")}-${match[1]}` : stamp.slice(0, 10);
}

export function mortgageFor(overview: Overview): MortgageApplication | null {
  const row = FINAL.find((r) => r.customer_id === overview.customerId);
  if (!row) return null;
  const events = EVENTS.filter((e) => e.mortgage_customer_id === row.mortgage_customer_id)
    .map((e) => ({ ...e, on: parseStamp(e.timestamp) }))
    .sort((a, b) => a.on.localeCompare(b.on));
  const decision = events.find((e) => e.event_type === "loan_decision");
  const required = round2(row.required_monthly_income_eur);
  const ownMoneyStillNeededEur = round2(Math.max(row.final_equity_amount_eur - overview.balance, 0));

  return {
    customerId: overview.customerId,
    decision: row.final_decision,
    startedOn: events[0]?.on ?? overview.dataTimestamp,
    decidedOn: decision?.on ?? null,
    propertyType: events.find((e) => e.property_type)?.property_type ?? null,
    propertyPriceEur: row.final_property_price_eur,
    loanEur: row.final_requested_loan_eur,
    ownMoneyEur: row.final_equity_amount_eur,
    collateralValueEur: row.final_collateral_value_eur,
    loanToValuePct: round2(row.lfinal_loan_to_value * 100),
    requiredMonthlyIncomeEur: required,
    monthlyIncomeEur: overview.monthlyIncome,
    incomeMarginEur: round2(overview.monthlyIncome - required),
    balanceEur: overview.balance,
    ownMoneyStillNeededEur,
    fees: events.filter((e) => e.event_type === "expense_recorded" && typeof e.expense_amount === "number").map((e) => ({ type: String(e.expense_type ?? "fee").replace(/_/g, " "), amountEur: e.expense_amount as number, on: e.on })),
    timeline: events.map((e) => ({ on: e.on, event: e.event_type.replace(/_/g, " ") })),
    steps: [
      { label: "Property price", amount: row.final_property_price_eur, basis: "final figure in the mortgage application" },
      { label: "Loan", amount: -row.final_requested_loan_eur, basis: "final requested loan" },
      { label: "Your own money in the application", amount: row.final_equity_amount_eur, basis: "property price minus the loan" },
      { label: "Balance in this account", amount: -overview.balance, basis: `account balance on ${overview.dataTimestamp}` },
      { label: "Own money not covered by this account", amount: ownMoneyStillNeededEur, basis: "own money minus the balance, never below zero" },
    ],
    assumptions: [
      "Figures come from the bank's mortgage application record and this account's balance.",
      "Only this account is visible. Savings or investments held elsewhere may cover the own-money part.",
      "This describes the application on record. It is not advice on whether to buy.",
    ],
  };
}
