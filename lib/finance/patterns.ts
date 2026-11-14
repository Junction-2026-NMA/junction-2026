// Finds things worth looking into in a customer's own history. Pure arithmetic on their rows: nothing here is guessed
// by a model. Each pattern carries the receipts (facts) and the filter that opens the transactions behind it.
import type { BillType, CashFlow, Confidence, EvidenceFilter, Overview, Pattern, PatternKind, Transaction } from "@/lib/types";
import { basketOf } from "./baskets";
import { transactionsFor } from "./data";
import { fact } from "./facts";
import { groupBy, round2, sum } from "./math";

const SMALL_PURCHASE_EUR = 10;
const CREEP_MIN_PCT = 5;
const CREEP_MIN_EUR_PER_MONTH = 2;
const DRIFT_MIN_PCT = 15;
const DRIFT_MIN_EUR_PER_MONTH = 20;
const SPIKE_SHARE = 0.33; // 7 of about 30 days is 0.23 if spending were even
const EVEN_FIRST_WEEK_SHARE = 0.23;
const IDLE_BUFFER_MONTHS = 6;
const GUESS_BILL_TYPE: Record<string, BillType> = { Electricity: "electricity", "Home internet": "internet", "Mobile plan": "mobile" };

const spent = (rows: Transaction[]): number => -sum(rows.filter((row) => row.amount < 0).map((row) => row.amount));
const pct = (now: number, before: number): number => (before > 0 ? round2(((now - before) / before) * 100) : 0);

type Windows = { now: Transaction[]; before: Transaction[]; evidence: EvidenceFilter; priorFrom: string };

// The 12 months the overview covers, and the 12 months before them.
function windows(overview: Overview): Windows {
  const rows = transactionsFor(overview.customerId);
  const priorFrom = `${Number(overview.windowFrom.slice(0, 4)) - 1}${overview.windowFrom.slice(4)}`;
  return {
    now: rows.filter((row) => row.date >= overview.windowFrom && row.date <= overview.windowTo),
    before: rows.filter((row) => row.date >= priorFrom && row.date < overview.windowFrom),
    evidence: { from: overview.windowFrom, to: overview.windowTo },
    priorFrom,
  };
}

function billPatterns(overview: Overview, w: Windows, billTypeOf: (billId: string, guess: string) => BillType | null): Pattern[] {
  const beforeBills = w.before.filter((row) => row.amount < 0 && row.type !== "purchase" && row.category === "Utilities");
  const beforeByMonth = groupBy(beforeBills, (row) => row.date.slice(0, 7));
  const priorMonths = Object.keys(beforeByMonth).length;

  return overview.recurringBills
    .filter((bill) => bill.category === "Utilities")
    .flatMap((bill): Pattern[] => {
      const slot = Number(bill.id.split("-")[1]) - 1;
      const billType = billTypeOf(bill.id, bill.guessLabel);
      const evidence: EvidenceFilter = { ...w.evidence, category: "Utilities" };
      const yearly = round2(bill.monthlyAvg * 12);
      const opportunity: Pattern = {
        id: `bill-opportunity:${bill.id}`,
        kind: "bill-opportunity",
        title: `${bill.guessLabel}: €${Math.round(yearly)} a year`,
        detail: `${bill.basis} Contracts like this are often cheaper for new customers than for loyal ones, so it is worth checking today's offers.`,
        yearlyImpactEur: null,
        confidence: bill.confidence,
        billType,
        evidence,
        facts: [
          fact(`${bill.id}:monthly`, `${bill.guessLabel}, average per month`, bill.monthlyAvg, "EUR/month", `average of ${bill.monthsSeen} payments in the last ${bill.windowMonths} months`, { evidence }),
          fact(`${bill.id}:yearly`, `${bill.guessLabel}, per year`, yearly, "EUR/year", "monthly average times 12", { evidence, source: "calculation" }),
        ],
        nextSteps: billType ? ["search_offers", "explain_concept"] : ["explain_concept"],
      };

      // The same slot a year earlier: has this bill crept up?
      const priorAmounts = Object.values(beforeByMonth).flatMap((rows) => {
        const sorted = [...rows].sort((a, b) => a.amount - b.amount);
        return sorted[slot] ? [-sorted[slot].amount] : [];
      });
      if (priorMonths < 6 || priorAmounts.length < 6) return [opportunity];
      const priorAvg = round2(sum(priorAmounts) / priorAmounts.length);
      const rise = round2(bill.monthlyAvg - priorAvg);
      const risePct = pct(bill.monthlyAvg, priorAvg);
      if (risePct < CREEP_MIN_PCT || rise < CREEP_MIN_EUR_PER_MONTH) return [opportunity];
      const creep: Pattern = {
        id: `bill-creep:${bill.id}`,
        kind: "bill-creep",
        title: `${bill.guessLabel} costs ${Math.round(risePct)}% more than a year ago`,
        detail: `It averaged €${priorAvg.toFixed(2)} a month in the year before and €${bill.monthlyAvg.toFixed(2)} a month in the last 12 months. That is €${Math.round(rise * 12)} more a year for the same bill.`,
        yearlyImpactEur: round2(rise * 12),
        confidence: bill.confidence,
        billType,
        evidence: { from: w.priorFrom, to: overview.windowTo, category: "Utilities" },
        facts: [
          fact(`${bill.id}:prior-monthly`, `${bill.guessLabel}, average per month a year earlier`, priorAvg, "EUR/month", `average of ${priorAmounts.length} payments in the 12 months before`, { evidence: { from: w.priorFrom, to: overview.windowFrom, category: "Utilities" } }),
          fact(`${bill.id}:rise-pct`, `${bill.guessLabel}, rise in a year`, risePct, "percent", "last 12 months against the 12 months before", { source: "calculation" }),
          fact(`${bill.id}:rise-yearly`, `${bill.guessLabel}, extra cost per year`, rise * 12, "EUR/year", "monthly rise times 12", { source: "calculation" }),
        ],
        nextSteps: billType ? ["search_offers"] : ["explain_concept"],
      };
      return [creep, opportunity];
    });
}

function everydayPatterns(overview: Overview, w: Windows): Pattern[] {
  const everydayNow = w.now.filter((row) => row.amount < 0 && basketOf(row.category)?.basket === "everyday");
  const everydayBefore = w.before.filter((row) => row.amount < 0 && basketOf(row.category)?.basket === "everyday");
  const nowBy = groupBy(everydayNow, (row) => row.category);
  const beforeBy = groupBy(everydayBefore, (row) => row.category);
  const patterns: Pattern[] = [];

  // Has a category grown much faster than a year ago?
  const drift = Object.entries(nowBy)
    .map(([category, rows]) => ({ category, now: round2(spent(rows) / 12), before: round2(spent(beforeBy[category] ?? []) / 12) }))
    .filter((c) => c.before > 0 && pct(c.now, c.before) >= DRIFT_MIN_PCT && c.now - c.before >= DRIFT_MIN_EUR_PER_MONTH)
    .sort((a, b) => b.now - b.before - (a.now - a.before))[0];
  if (drift) {
    const extra = round2((drift.now - drift.before) * 12);
    patterns.push({
      id: `category-drift:${drift.category}`,
      kind: "category-drift",
      title: `${drift.category} is up ${Math.round(pct(drift.now, drift.before))}% on a year ago`,
      detail: `You averaged €${Math.round(drift.before)} a month on ${drift.category} the year before and €${Math.round(drift.now)} a month in the last 12 months: €${Math.round(extra)} more a year.`,
      yearlyImpactEur: extra,
      confidence: "high",
      billType: null,
      evidence: { ...w.evidence, category: drift.category },
      facts: [
        fact(`drift:${drift.category}:now`, `${drift.category}, per month now`, drift.now, "EUR/month", "last 12 months", { evidence: { ...w.evidence, category: drift.category } }),
        fact(`drift:${drift.category}:before`, `${drift.category}, per month a year earlier`, drift.before, "EUR/month", "the 12 months before", { evidence: { from: w.priorFrom, to: overview.windowFrom, category: drift.category } }),
        fact(`drift:${drift.category}:extra`, `${drift.category}, extra per year`, extra, "EUR/year", "difference times 12", { source: "calculation" }),
      ],
      nextSteps: ["get_spending", "run_scenario"],
    });
  }

  // The category furthest above people the same age.
  const overPeers = overview.baskets
    .flatMap((basket) => (basket.id === "everyday" ? basket.categories : []))
    .filter((c) => c.peerMonthlyAvg !== null && c.monthlyAvg > c.peerMonthlyAvg)
    .sort((a, b) => b.monthlyAvg - (b.peerMonthlyAvg ?? 0) - (a.monthlyAvg - (a.peerMonthlyAvg ?? 0)))[0];
  if (overPeers) {
    const gap = round2(overPeers.monthlyAvg - (overPeers.peerMonthlyAvg ?? 0));
    patterns.push({
      id: `peer-gap:${overPeers.category}`,
      kind: "peer-gap",
      title: `${overPeers.category}: €${Math.round(gap)} a month above people your age`,
      detail: `You average €${Math.round(overPeers.monthlyAvg)} a month; the ${overview.peerCount} customers aged ${overview.ageBand} average €${Math.round(overPeers.peerMonthlyAvg ?? 0)}. That gap is €${Math.round(gap * 12)} a year.`,
      yearlyImpactEur: round2(gap * 12),
      confidence: "medium",
      billType: null,
      evidence: { ...w.evidence, category: overPeers.category },
      facts: [
        fact(`peer:${overPeers.category}:mine`, `${overPeers.category}, your monthly average`, overPeers.monthlyAvg, "EUR/month", `${overPeers.count} purchases in the last 12 months`, { evidence: { ...w.evidence, category: overPeers.category } }),
        fact(`peer:${overPeers.category}:peers`, `${overPeers.category}, age ${overview.ageBand} average`, overPeers.peerMonthlyAvg ?? 0, "EUR/month", `${overview.peerCount} customers in the same age band`),
        fact(`peer:${overPeers.category}:gap-yearly`, `${overPeers.category}, gap per year`, gap * 12, "EUR/year", "monthly gap times 12", { source: "calculation" }),
      ],
      nextSteps: ["get_spending", "run_scenario"],
    });
  }

  // Small purchases that are easy to forget.
  const small = everydayNow.filter((row) => -row.amount < SMALL_PURCHASE_EUR);
  if (small.length >= 12) {
    const total = round2(spent(small));
    patterns.push({
      id: "small-purchases",
      kind: "small-purchases",
      title: `${small.length} purchases under €${SMALL_PURCHASE_EUR} added up to €${Math.round(total)} this year`,
      detail: `Each one is small, about €${(total / small.length).toFixed(2)} on average, which is why they are easy to miss. Together they are ${Math.round((total / Math.max(spent(everydayNow), 1)) * 100)}% of your everyday spending.`,
      yearlyImpactEur: total,
      confidence: "high",
      billType: null,
      evidence: { ...w.evidence, basket: "everyday" },
      facts: [
        fact("small:count", `Purchases under €${SMALL_PURCHASE_EUR}`, small.length, "count", "everyday-basket purchases in the last 12 months", { evidence: { ...w.evidence, basket: "everyday" } }),
        fact("small:total", `Total of purchases under €${SMALL_PURCHASE_EUR}`, total, "EUR/year", "sum of those purchases", { evidence: { ...w.evidence, basket: "everyday" } }),
      ],
      nextSteps: ["get_spending", "run_scenario"],
    });
  }
  return patterns;
}

function cashPatterns(overview: Overview, w: Windows, cashFlow: CashFlow): Pattern[] {
  const patterns: Pattern[] = [];
  const negative = w.now.filter((row) => row.balanceAfter < 0);

  if (negative.length) {
    const lowest = Math.min(...negative.map((row) => row.balanceAfter));
    const typicalDays = cashFlow.cycles.length ? Math.round(sum(cashFlow.cycles.map((c) => c.daysToLowest)) / cashFlow.cycles.length) : null;
    patterns.push({
      id: "overdraft-risk",
      kind: "overdraft-risk",
      title: `Below zero in ${cashFlow.negativeMonths} of the last ${overview.windowMonths} months`,
      detail: `${negative.length} payments left the account in the red; the lowest point was €${lowest.toFixed(2)}.${typicalDays === null ? "" : ` Your balance is usually lowest about ${typicalDays} days after payday.`}`,
      yearlyImpactEur: null, // the data has no overdraft fees or interest, so no honest euro cost exists
      confidence: "high",
      billType: null,
      evidence: { ...w.evidence, negativeBalance: true },
      facts: [
        fact("overdraft:months", "Months with a balance below zero", cashFlow.negativeMonths, "count", `of the last ${overview.windowMonths} months`, { evidence: { ...w.evidence, negativeBalance: true } }),
        fact("overdraft:payments", "Payments that left the balance below zero", negative.length, "count", "last 12 months", { evidence: { ...w.evidence, negativeBalance: true } }),
        fact("overdraft:lowest", "Lowest balance", lowest, "EUR", "lowest balance after any payment in the last 12 months", { evidence: { ...w.evidence, negativeBalance: true } }),
        ...(typicalDays === null ? [] : [fact("overdraft:days-to-low", "Days from payday to the lowest balance", typicalDays, "days", `average over the last ${cashFlow.cycles.length} pay cycles`, { source: "calculation" })]),
      ],
      nextSteps: ["get_cash_flow", "explain_concept"],
    });
  }

  if (cashFlow.firstWeekShare !== null && cashFlow.firstWeekShare >= SPIKE_SHARE) {
    const share = Math.round(cashFlow.firstWeekShare * 100);
    patterns.push({
      id: "payday-spike",
      kind: "payday-spike",
      title: `${share}% of your everyday spending happens in the week after payday`,
      detail: `If spending were spread evenly it would be about ${Math.round(EVEN_FIRST_WEEK_SHARE * 100)}%. Money that goes early is what runs short at the end of the month.`,
      yearlyImpactEur: null,
      confidence: "medium",
      billType: null,
      evidence: { ...w.evidence, basket: "everyday" },
      facts: [fact("payday:first-week-share", "Share of everyday spending in the week after payday", share, "percent", `over the last ${cashFlow.cycles.length} pay cycles`, { source: "calculation", evidence: { ...w.evidence, basket: "everyday" } })],
      nextSteps: ["get_cash_flow", "explain_concept"],
    });
  }

  const irregular = overview.baskets.find((basket) => basket.id === "irregular");
  const irregularRows = w.now.filter((row) => row.amount < 0 && basketOf(row.category)?.basket === "irregular");
  const biggest = irregularRows.reduce<Transaction | null>((top, row) => (!top || row.amount < top.amount ? row : top), null);
  if (irregular && biggest && -biggest.amount >= irregular.monthlyAvg * 2) {
    patterns.push({
      id: "lumpy-costs",
      kind: "lumpy-costs",
      title: `Now-and-then costs average €${Math.round(irregular.monthlyAvg)} a month, but one was €${Math.round(-biggest.amount)}`,
      detail: `Costs in this basket arrive in lumps: the largest was a ${biggest.category} payment on ${biggest.date}. Setting aside the monthly average means a lump does not have to come out of that month's money.`,
      yearlyImpactEur: null,
      confidence: "high",
      billType: null,
      evidence: { ...w.evidence, basket: "irregular" },
      facts: [
        fact("lumpy:monthly", "Now-and-then costs, average per month", irregular.monthlyAvg, "EUR/month", "last 12 months", { evidence: { ...w.evidence, basket: "irregular" } }),
        fact("lumpy:largest", "Largest single now-and-then cost", -biggest.amount, "EUR", `${biggest.category} on ${biggest.date}`, { evidence: { ...w.evidence, basket: "irregular" } }),
      ],
      nextSteps: ["check_affordability", "explain_concept", "prepare_action"],
    });
  }

  const idle = round2(overview.balance - IDLE_BUFFER_MONTHS * overview.monthlyMandatory);
  if (overview.monthlyMandatory > 0 && idle > 1000) {
    patterns.push({
      id: "idle-cash",
      kind: "idle-cash",
      title: `Your balance covers ${overview.runwayMonths} months of must-pay costs`,
      detail: `A common rule of thumb is a buffer of three to six months. About €${Math.round(idle)} sits above a six-month buffer in an account that, in this data, earns no interest. What to do with it is your decision; Sisu can show what different choices would look like.`,
      yearlyImpactEur: null,
      confidence: "medium",
      billType: null,
      evidence: w.evidence,
      facts: [
        fact("idle:runway", "Months of must-pay costs covered by the balance", overview.runwayMonths, "months", "balance divided by average must-pay costs", { source: "calculation" }),
        fact("idle:above-buffer", "Balance above a six-month buffer", idle, "EUR", `balance minus ${IDLE_BUFFER_MONTHS} months of must-pay costs`, { source: "calculation" }),
      ],
      nextSteps: ["run_scenario", "explain_concept"],
    });
  }
  return patterns;
}

const CONFIDENCE_WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.8, low: 0.5 };
// Patterns with no euro figure still need a place in the order. These stand-ins are used for sorting only, never shown.
const SORT_VALUE_WITHOUT_EUR: Partial<Record<PatternKind, number>> = { "overdraft-risk": 400, "payday-spike": 150, "lumpy-costs": 120, "idle-cash": 100 };

export function findPatterns(overview: Overview, cashFlow: CashFlow, billTypeOf?: (billId: string, guess: string) => BillType | null): Pattern[] {
  const w = windows(overview);
  const resolveBillType = billTypeOf ?? ((_: string, guess: string) => GUESS_BILL_TYPE[guess] ?? null);
  const sortValue = (pattern: Pattern): number => {
    const billYearly = pattern.kind === "bill-opportunity" ? (pattern.facts[1]?.value ?? 0) * 0.15 : 0; // a typical switch saves a fraction of the bill
    return (pattern.yearlyImpactEur ?? SORT_VALUE_WITHOUT_EUR[pattern.kind] ?? billYearly) * CONFIDENCE_WEIGHT[pattern.confidence];
  };
  return [...billPatterns(overview, w, resolveBillType), ...everydayPatterns(overview, w), ...cashPatterns(overview, w, cashFlow)].sort((a, b) => sortValue(b) - sortValue(a));
}
