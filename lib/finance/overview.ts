import type { BasketId, BasketSummary, CategoryTotal, Insight, MonthPoint, Overview, SafeToSpend, Transaction } from "@/lib/types";
import { BASKETS, BASKET_ORDER, INCOME_CATEGORIES, SAVING_CATEGORIES, basketOf } from "./baskets";
import { DATA_AS_OF, ageBandOf, findCustomer, lastDayOf, lastMonths, peerAverage, peerCount, transactionsFor } from "./data";
import { eur } from "@/lib/format";
import { groupBy, round2, sum } from "./math";
import { detectRecurringBills } from "./recurring";

const WINDOW_MONTHS = 12;
const WEEKS_PER_MONTH = 52 / 12;

const spent = (rows: Transaction[]): number => -sum(rows.filter((t) => t.amount < 0).map((t) => t.amount));

function buildBaskets(windowTx: Transaction[], ageBand: string): BasketSummary[] {
  const spending = windowTx.filter((t) => t.amount < 0 && basketOf(t.category));
  const total = spent(spending);
  const byCategory = groupBy(spending, (t) => t.category);

  const categories: CategoryTotal[] = Object.entries(byCategory).map(([category, rows]) => {
    const { basket, reason } = basketOf(category)!;
    return {
      category,
      basket,
      reason,
      monthlyAvg: round2(spent(rows) / WINDOW_MONTHS),
      count: rows.length,
      peerMonthlyAvg: peerAverage(ageBand, category)?.avgMonthly ?? null,
    };
  });

  return BASKET_ORDER.map((id) => {
    const own = categories.filter((c) => c.basket === id).sort((a, b) => b.monthlyAvg - a.monthlyAvg);
    const monthlyAvg = round2(sum(own.map((c) => c.monthlyAvg)));
    return { id, ...BASKETS[id], monthlyAvg, share: total ? round2((monthlyAvg * WINDOW_MONTHS) / total) : 0, categories: own };
  });
}

function buildMonths(allTx: Transaction[], months: string[]): MonthPoint[] {
  const byMonth = groupBy(allTx, (t) => t.date.slice(0, 7));
  let carriedBalance = 0;
  return months.map((month) => {
    const rows = byMonth[month] ?? [];
    const inBasket = (id: BasketId) => round2(spent(rows.filter((t) => basketOf(t.category)?.basket === id)));
    if (rows.length) carriedBalance = rows[rows.length - 1].balanceAfter;
    return {
      month,
      income: round2(sum(rows.filter((t) => INCOME_CATEGORIES.includes(t.category)).map((t) => t.amount))),
      regular: inBasket("regular"),
      irregular: inBasket("irregular"),
      everyday: inBasket("everyday"),
      saved: round2(spent(rows.filter((t) => SAVING_CATEGORIES.includes(t.category)))),
      endBalance: carriedBalance,
    };
  });
}

function buildSafeToSpend(months: MonthPoint[]): SafeToSpend {
  const avg = (pick: (m: MonthPoint) => number) => round2(sum(months.map(pick)) / months.length);
  const income = avg((m) => m.income);
  const regular = avg((m) => m.regular);
  const irregular = avg((m) => m.irregular);
  const saved = avg((m) => m.saved);
  const everyday = avg((m) => m.everyday);
  const perMonth = round2(income - regular - irregular - saved);
  const basis = `average of the last ${months.length} months`;
  return {
    perMonth,
    perWeek: round2(perMonth / WEEKS_PER_MONTH),
    steps: [
      { label: "Money in per month", amount: income, basis },
      { label: "Must pay, every month", amount: -regular, basis },
      { label: "Set aside for now-and-then costs", amount: -irregular, basis },
      { label: "Savings you already make", amount: -saved, basis: `investment deposits, ${basis}` },
    ],
    actualEverydayPerMonth: everyday,
    gapPerMonth: round2(perMonth - everyday),
  };
}

function buildInsights(windowTx: Transaction[], baskets: BasketSummary[], months: string[], ageBand: string): Insight[] {
  const from = `${months[0]}-01`;
  const to = lastDayOf(months[months.length - 1]);
  const everyday = baskets.find((b) => b.id === "everyday")?.categories ?? [];
  const overPeers = everyday
    .filter((c) => c.peerMonthlyAvg !== null && c.monthlyAvg > c.peerMonthlyAvg)
    .sort((a, b) => b.monthlyAvg - (b.peerMonthlyAvg ?? 0) - (a.monthlyAvg - (a.peerMonthlyAvg ?? 0)))[0];
  const negative = windowTx.filter((t) => t.balanceAfter < 0);
  const negativeMonths = new Set(negative.map((t) => t.date.slice(0, 7))).size;
  const utilities = baskets.flatMap((b) => b.categories).find((c) => c.category === "Utilities");

  const insights: (Insight | null)[] = [
    overPeers
      ? {
          id: "over-peers",
          title: `${overPeers.category}: €${Math.round(overPeers.monthlyAvg - (overPeers.peerMonthlyAvg ?? 0))} a month above people your age`,
          body: `You average €${Math.round(overPeers.monthlyAvg)} a month across ${overPeers.count} purchases. The ${peerCount(ageBand)} customers aged ${ageBand} in the dataset average €${Math.round(overPeers.peerMonthlyAvg ?? 0)}.`,
          evidence: { from, to, category: overPeers.category },
        }
      : null,
    negativeMonths > 0
      ? {
          id: "below-zero",
          title: `Your balance went below zero in ${negativeMonths} of the last ${months.length} months`,
          body: `${negative.length} payments left the account in the red. The lowest point was ${eur(Math.min(...negative.map((t) => t.balanceAfter)))}.`,
          evidence: { from, to, negativeBalance: true },
        }
      : null,
    utilities
      ? {
          id: "bills-year",
          title: `Your monthly bills add up to ${eur(utilities.monthlyAvg * 12)} a year`,
          body: `${utilities.count} bill payments in ${months.length} months, about €${Math.round(utilities.monthlyAvg)} a month. Contracts like these are often cheaper for new customers than for loyal ones.`,
          evidence: { from, to, category: "Utilities" },
        }
      : null,
  ];
  return insights.filter((i): i is Insight => i !== null);
}

export function buildOverview(customerId: string): Overview | null {
  const customer = findCustomer(customerId);
  if (!customer) return null;

  const allTx = transactionsFor(customerId);
  const months = lastMonths(WINDOW_MONTHS);
  const windowTx = allTx.filter((t) => months.includes(t.date.slice(0, 7)));
  const ageBand = ageBandOf(customer.age);
  const baskets = buildBaskets(windowTx, ageBand);
  const monthPoints = buildMonths(allTx, months);
  const safeToSpend = buildSafeToSpend(monthPoints);
  const balance = allTx.length ? allTx[allTx.length - 1].balanceAfter : 0;
  const mandatory = sum(baskets.filter((b) => b.id !== "everyday").map((b) => b.monthlyAvg));

  return {
    customerId,
    displayName: customer.displayName,
    age: customer.age,
    postalCode: customer.postalCode,
    ageBand,
    peerCount: peerCount(ageBand),
    dataTimestamp: DATA_AS_OF,
    currency: "EUR",
    windowMonths: WINDOW_MONTHS,
    windowFrom: `${months[0]}-01`,
    windowTo: lastDayOf(months[months.length - 1]),
    balance,
    monthlyIncome: safeToSpend.steps[0].amount,
    monthlySpending: round2(sum(baskets.map((b) => b.monthlyAvg))),
    monthlySaved: -safeToSpend.steps[3].amount,
    monthlyMandatory: round2(mandatory),
    monthlyEveryday: safeToSpend.actualEverydayPerMonth,
    runwayMonths: mandatory > 0 ? round2(Math.max(balance, 0) / mandatory) : 0,
    baskets,
    months: monthPoints,
    recurringBills: detectRecurringBills(windowTx, months),
    safeToSpend,
    insights: buildInsights(windowTx, baskets, months, ageBand),
    assumptions: [
      "Synthetic S-Pankki data. Names are invented; the dataset has customer IDs only.",
      `All averages cover ${months[0]} to ${months[months.length - 1]}, the last ${WINDOW_MONTHS} months in the dataset.`,
      "Bills have no payee in the data, so bill names are Sisu's guesses until you confirm them.",
      "Runway counts only this account's balance against must-pay costs. Other savings are not visible here.",
      "Peer figures are averages over every customer in the same age band, including those who spent nothing.",
    ],
  };
}
