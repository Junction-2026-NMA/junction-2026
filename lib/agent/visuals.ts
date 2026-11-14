// Pictures the agent can put on screen. Each one is built in code from the same figures the answer uses, and
// carries a receipt for every number in it, so a chart can never show something the customer's data does not.
// The screen draws them (see app/visuals/); the model only chooses which one to show.
import { peerAverage, transactionsFor } from "@/lib/finance/data";
import { fact } from "@/lib/finance/facts";
import { groupBy, round2, sum } from "@/lib/finance/math";
import type { Fact, Overview, ResearchResult, ScenarioResult, Visual } from "@/lib/types";

export const CHART_KINDS = ["budget", "vs_peers", "months", "safe_to_spend"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

const MAX_SLICES = 5; // more than this and the smallest fold into "Other"
const MAX_PEER_ROWS = 5;
const MAX_OFFERS = 4;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (month: string): string => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;
const eur = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const period = (o: Overview): string => `Average of the last ${o.windowMonths} months, ${monthLabel(o.windowFrom.slice(0, 7))} to ${monthLabel(o.windowTo.slice(0, 7))}`;

// Average monthly spending per category over the overview's window, largest first.
function categoryAverages(overview: Overview): { category: string; monthly: number }[] {
  const rows = transactionsFor(overview.customerId).filter((row) => row.amount < 0 && row.date >= overview.windowFrom && row.date <= overview.windowTo);
  return Object.entries(groupBy(rows, (row) => row.category))
    .map(([category, list]) => ({ category, monthly: round2(-sum(list.map((row) => row.amount)) / overview.windowMonths) }))
    .filter((entry) => entry.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);
}

export function budgetVisual(overview: Overview): Visual {
  const all = categoryAverages(overview);
  const top = all.slice(0, MAX_SLICES);
  const rest = round2(sum(all.slice(MAX_SLICES).map((entry) => entry.monthly)));
  const parts = rest > 0 ? [...top, { category: "Other", monthly: rest }] : top;
  const total = round2(sum(parts.map((part) => part.monthly)));
  const facts: Fact[] = [
    ...parts.map((part) => fact(`chart:budget:${part.category}`, `${part.category}, average per month`, part.monthly, "EUR/month", period(overview), { evidence: part.category === "Other" ? undefined : { from: overview.windowFrom, to: overview.windowTo, category: part.category } })),
    fact("chart:budget:total", "All spending, average per month", total, "EUR/month", "the sum of the categories", { source: "calculation" }),
  ];
  return {
    id: "budget",
    kind: "budget_donut",
    title: "Where your money goes in an average month",
    caption: period(overview),
    summary: `All spending averages ${eur(total)} a month. The largest part is ${parts[0]?.category ?? "nothing"} at ${eur(parts[0]?.monthly ?? 0)}${parts[1] ? `, then ${parts[1].category} at ${eur(parts[1].monthly)}` : ""}${parts[2] ? ` and ${parts[2].category} at ${eur(parts[2].monthly)}` : ""}.`,
    source: "bank-data",
    facts,
    slices: parts.map((part) => ({ label: part.category, value: part.monthly, share: total ? round2((part.monthly / total) * 100) : 0 })),
    total,
    centerLabel: "a month",
  };
}

export function peersVisual(overview: Overview): Visual | null {
  const rows = categoryAverages(overview)
    .map((entry) => ({ entry, peers: peerAverage(overview.ageBand, entry.category) }))
    .filter((row): row is { entry: { category: string; monthly: number }; peers: { avgMonthly: number; customers: number } } => row.peers !== null)
    .slice(0, MAX_PEER_ROWS);
  if (!rows.length) return null;
  const gaps = rows.map((row) => ({ category: row.entry.category, gap: round2(row.entry.monthly - row.peers.avgMonthly) }));
  const above = gaps.filter((g) => Math.round(g.gap) > 0).sort((a, b) => b.gap - a.gap);
  const below = gaps.filter((g) => Math.round(g.gap) < 0).sort((a, b) => a.gap - b.gap);
  const list = (items: { category: string; gap: number }[]) => items.map((g) => `${g.category} (${eur(Math.abs(g.gap))} a month)`).join(", ");
  return {
    id: "vs_peers",
    kind: "peer_bars",
    title: `You and others aged ${overview.ageBand}`,
    caption: `${period(overview)}, beside the average of ${overview.peerCount} customers aged ${overview.ageBand}`,
    summary: `${above.length ? `You spend more than people your age on ${list(above)}.` : "You spend no more than people your age in your main categories."}${below.length ? ` You spend less on ${list(below)}.` : ""}`,
    source: "bank-data",
    facts: rows.flatMap((row) => [
      fact(`chart:peers:${row.entry.category}:gap`, `${row.entry.category}, you against people your age, per month`, Math.abs(round2(row.entry.monthly - row.peers.avgMonthly)), "EUR/month", "your average minus theirs", { source: "calculation" }),
      fact(`chart:peers:${row.entry.category}:you`, `${row.entry.category}, you per month`, row.entry.monthly, "EUR/month", period(overview)),
      fact(`chart:peers:${row.entry.category}:peers`, `${row.entry.category}, people your age per month`, round2(row.peers.avgMonthly), "EUR/month", `average of ${row.peers.customers} customers aged ${overview.ageBand}`),
    ]),
    peerGroup: `aged ${overview.ageBand}`,
    rows: rows.map((row) => ({ label: row.entry.category, you: row.entry.monthly, peers: round2(row.peers.avgMonthly) })),
  };
}

export function monthsVisual(overview: Overview): Visual {
  const months = overview.months.map((m) => ({ month: m.month, label: monthLabel(m.month), income: round2(m.income), spending: round2(m.regular + m.irregular + m.everyday) }));
  const over = months.filter((m) => m.spending > m.income);
  const highest = [...months].sort((a, b) => b.spending - a.spending)[0];
  return {
    id: "months",
    kind: "month_bars",
    title: "Money in and money out, month by month",
    caption: `${monthLabel(overview.windowFrom.slice(0, 7))} to ${monthLabel(overview.windowTo.slice(0, 7))}. Spending is bills, now-and-then costs and everyday spending together.`,
    summary: `${over.length ? `In ${over.length} of the ${months.length} months more went out than came in: ${over.map((m) => m.label).join(", ")}.` : `In none of the ${months.length} months did more go out than came in.`} The most went out in ${highest.label}: ${eur(highest.spending)}.`,
    source: "bank-data",
    facts: [fact("chart:months:over", "Months where more went out than came in", over.length, "count", "counted month by month", { source: "calculation" }), fact("chart:months:count", "Months shown", months.length, "count", "the window"), ...months.flatMap((m) => [fact(`chart:months:${m.month}:in`, `Income in ${m.label}`, m.income, "EUR", "money that came in that month"), fact(`chart:months:${m.month}:out`, `Spending in ${m.label}`, m.spending, "EUR", "money that went out that month")])],
    months,
  };
}

export function safeToSpendVisual(overview: Overview): Visual {
  const safe = overview.safeToSpend;
  return {
    id: "safe_to_spend",
    kind: "waterfall",
    title: "How your safe-to-spend is worked out",
    caption: "Income, less must-pay bills, less what is set aside for now-and-then costs",
    summary: `Safe to spend is ${eur(safe.perWeek)} a week, ${eur(safe.perMonth)} a month: what is left of your income after must-pay bills and what is set aside for now-and-then costs.`,
    source: "calculation",
    facts: [...safe.steps.map((step, index) => fact(`chart:safe:${index}`, step.label, step.amount, "EUR/month", step.basis, { source: "calculation" })), fact("chart:safe:week", "Safe to spend per week", safe.perWeek, "EUR", "the monthly figure divided by the weeks in a month", { source: "calculation" }), fact("chart:safe:month", "Safe to spend per month", safe.perMonth, "EUR/month", "income less must-pay and set-aside costs", { source: "calculation" })],
    steps: safe.steps,
    resultLabel: "Safe to spend a week",
    resultValue: safe.perWeek,
  };
}

export function chartFor(kind: ChartKind, overview: Overview): Visual | null {
  if (kind === "budget") return budgetVisual(overview);
  if (kind === "vs_peers") return peersVisual(overview);
  if (kind === "months") return monthsVisual(overview);
  return safeToSpendVisual(overview);
}

// The three futures from the scenario engine, one point a year.
export function futuresVisual(result: ScenarioResult, years: number): Visual {
  const yearly = (points: ScenarioResult["branches"][number]["points"]) => points.filter((point) => point.month % 12 === 0);
  const series = result.branches.map((branch) => ({ id: branch.id, label: branch.label, points: yearly(branch.points).map((point) => ({ year: point.month / 12, value: round2(point.total), low: round2(point.totalLow), high: round2(point.totalHigh) })) }));
  return {
    id: "futures",
    kind: "futures_lines",
    title: `Three futures over ${years} years`,
    caption: `With €${result.freedPerMonth} a month freed. A scenario, not a forecast; investments can lose value.`,
    summary: `After ${years} years: ${result.branches.map((branch) => `${branch.label.toLowerCase()} ${eur(branch.endTotal)}`).join(", ")}.`,
    source: "calculation",
    facts: result.branches.map((branch) => fact(`chart:futures:${branch.id}`, `${branch.label}, after ${years} years`, branch.endTotal, "EUR", "the scenario engine's projection", { source: "calculation" })),
    years,
    series,
  };
}

// The customer's bill beside the cheapest comparable offers found today.
export function offersVisual(research: ResearchResult): Visual | null {
  const offers = research.offers.filter((offer) => offer.comparable && offer.estimatedMonthlyCostEur !== null).slice(0, MAX_OFFERS);
  if (!offers.length || research.baselineMonthlyEur === null) return null;
  return {
    id: `offers:${research.billType}`,
    kind: "offer_bars",
    title: `Your ${research.billType} bill beside today's offers`,
    caption: `Estimated cost a month. ${research.citations.length} pages read${research.finishedAt ? `, ${research.finishedAt.slice(0, 16).replace("T", " ")} UTC` : ""}.`,
    summary: `The cheapest comparable offer is ${offers[0].provider} at about ${eur(offers[0].estimatedMonthlyCostEur ?? 0)} a month, against your ${eur(research.baselineMonthlyEur)} now.`,
    source: "context.dev",
    facts: [fact("chart:offers:current", "Your bill per month", research.baselineMonthlyEur, "EUR/month", "average of the last 12 months"), ...offers.map((offer, index) => fact(`chart:offers:${index}`, `${offer.provider}, estimated per month`, offer.estimatedMonthlyCostEur ?? 0, "EUR/month", "price from the provider's page, applied to your use", { source: "calculation", url: offer.sourceUrl }))],
    currentMonthlyEur: research.baselineMonthlyEur,
    offers: offers.map((offer) => ({ provider: offer.provider, plan: offer.plan, monthlyEur: offer.estimatedMonthlyCostEur ?? 0, yearlySavingEur: offer.estimatedYearlySavingEur ?? 0, url: offer.sourceUrl })),
    mock: research.mock,
  };
}
