import type { Branch, BranchId, BranchPoint, ScenarioBase, ScenarioInput, ScenarioResult } from "@/lib/types";
import { round2 } from "./math";

// Return scenarios are illustrations, not predictions. Yearly, before inflation, after the fund fee.
export const RETURN_SCENARIOS = { low: 0.01, mid: 0.05, high: 0.08 };
export const FUND_FEE = 0.002;
export const LIMITS = { billSavingPerMonth: [0, 500], everydayCutPct: [0, 50], years: [1, 10], oneOffEur: [0, 100_000] } as const;

const clamp = (x: number, [lo, hi]: readonly [number, number]) => Math.min(Math.max(x, lo), hi);

export function cleanInput(raw: Partial<ScenarioInput>): ScenarioInput | string {
  const values = [raw.billSavingPerMonth, raw.everydayCutPct, raw.years];
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) return "Scenario values must be numbers.";
  return {
    billSavingPerMonth: clamp(raw.billSavingPerMonth!, LIMITS.billSavingPerMonth),
    everydayCutPct: clamp(raw.everydayCutPct!, LIMITS.everydayCutPct),
    years: Math.round(clamp(raw.years!, LIMITS.years)),
    oneOffEur: typeof raw.oneOffEur === "number" && Number.isFinite(raw.oneOffEur) ? round2(clamp(raw.oneOffEur, LIMITS.oneOffEur)) : 0,
  };
}

const LABELS: Record<BranchId, string> = {
  nothing: "Change nothing",
  save: "Make the change, keep the cash",
  invest: "Make the change, invest it",
};

type Flows = { toCash: number; toInvested: number };

function grow(invested: number, deposit: number, yearlyReturn: number): number {
  return (invested + deposit) * (1 + (yearlyReturn - FUND_FEE) / 12);
}

// `invested` is money already in investments on day one (a lump sum the customer moves there).
function project(id: BranchId, base: ScenarioBase, flows: Flows, months: number, invested = 0): Branch {
  const start = { cash: base.balance - invested, low: invested, mid: invested, high: invested };
  const points = Array.from({ length: months }).reduce<{ state: typeof start; points: BranchPoint[] }>(
    (acc, _, i) => {
      const state = {
        cash: acc.state.cash + flows.toCash,
        low: grow(acc.state.low, flows.toInvested, RETURN_SCENARIOS.low),
        mid: grow(acc.state.mid, flows.toInvested, RETURN_SCENARIOS.mid),
        high: grow(acc.state.high, flows.toInvested, RETURN_SCENARIOS.high),
      };
      const point: BranchPoint = {
        month: i + 1,
        cash: round2(state.cash),
        invested: round2(state.mid),
        total: round2(state.cash + state.mid),
        totalLow: round2(state.cash + state.low),
        totalHigh: round2(state.cash + state.high),
      };
      return { state, points: [...acc.points, point] };
    },
    { state: start, points: [{ month: 0, cash: start.cash, invested, total: base.balance, totalLow: base.balance, totalHigh: base.balance }] },
  ).points;

  const end = points[points.length - 1];
  const atYear1 = points[Math.min(12, points.length - 1)];
  return {
    id,
    label: LABELS[id],
    points,
    endTotal: end.total,
    endLow: end.totalLow,
    endHigh: end.totalHigh,
    runwayMonthsAtYear1: base.monthlyMandatory > 0 ? round2(Math.max(atYear1.cash, 0) / base.monthlyMandatory) : 0,
  };
}

// Three futures from the same starting point. Only the destination of the freed-up money differs.
export function runScenario(base: ScenarioBase, input: ScenarioInput): ScenarioResult {
  const freed = round2(input.billSavingPerMonth + (base.monthlyEveryday * input.everydayCutPct) / 100);
  const netToCash = base.monthlyIncome - base.monthlySpending - base.monthlySaved;
  const months = input.years * 12;

  return {
    freedPerMonth: freed,
    branches: [
      project("nothing", base, { toCash: netToCash, toInvested: base.monthlySaved }, months),
      project("save", base, { toCash: netToCash + freed, toInvested: base.monthlySaved }, months),
      project("invest", base, { toCash: netToCash, toInvested: base.monthlySaved + freed }, months, input.oneOffEur ?? 0),
    ],
    assumptions: [
      "Income and spending stay at their last-12-month averages. Real life will differ.",
      `Invested money is shown at ${RETURN_SCENARIOS.mid * 100}% a year, with a range from ${RETURN_SCENARIOS.low * 100}% to ${RETURN_SCENARIOS.high * 100}%. These are scenarios, not predictions; investments can lose value.`,
      `A fund fee of ${FUND_FEE * 100}% a year is taken off. Taxes and inflation are not included.`,
      "Investments already held elsewhere are not visible in the bank data, so the invested pot starts at €0.",
      "Cash in the account earns no interest here.",
      ...(input.oneOffEur ? [`In the "invest it" future, €${input.oneOffEur.toFixed(0)} is moved from the account into investments on day one. In the other two it stays in the account.`] : []),
    ],
  };
}
