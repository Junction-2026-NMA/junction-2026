// "What would spending 20% less at restaurants save?": answered per month and per year, from the category's own
// average. The years-ahead projection (three futures, one of them invested) is only for a question about the years,
// the future or investing: a monthly-savings question gets no projection and no investment talk.
import { fact } from "@/lib/finance/facts";
import { round2 } from "@/lib/finance/math";
import type { Fact, Overview } from "@/lib/types";
import { type ToolOutcome, outcome } from "./types";

export const DEFAULT_CUT_YEARS = 5; // the horizon the tool schema tells the model to use when none was named

// Words that ask about more than a month or a year: several years, the future, investing, growth. A single "year"
// ("how much a year?") is the yearly figure, which the per-month answer already gives.
const LONG_RUN: RegExp[] = [
  /\byears\b|\bdecades?\b|\blong[- ](run|term)\b|\bfuture\b|\binvest|\bgrow|\bcompound|\bretire|\bpension|\bover time\b|\badds? up\b|\bby 20\d\d\b/i,
  /vuosi(en|a|ssa|na|in)\b|vuodet\b|\b([2-9]|10)\s*vuo|(kahde|kolme|nelj|viid|kuud|seitsem|kahdeks|yhdeks|kymmen)\p{L}*\s+vuo|tulevaisuu|sijoit|pitkällä aikavälillä|korkoa korolle|eläk|kasva/iu,
  /\b([2-9]|10)\s*år\b|framtid|investera|långsiktig|växa/i,
];

export const asksAboutTheLongRun = (question: string): boolean => LONG_RUN.some((pattern) => pattern.test(question));

// Does this run_scenario call need the projection? A lump sum, a target, a cut of all everyday spending, a horizon
// other than the default, or a question about the years ahead all do. A plain category cut does not.
export function wantsProjection(args: Record<string, unknown>, question: string): boolean {
  const years = Number(args.years);
  const named = Number.isFinite(years) && years > 0 && years !== DEFAULT_CUT_YEARS;
  const extra = (typeof args.oneOffEur === "number" && args.oneOffEur > 0) || (typeof args.targetEur === "number" && args.targetEur > 0) || Number(args.everydayCutPct ?? 0) > 0;
  return named || extra || asksAboutTheLongRun(question);
}

export type CategoryCut = { category: string; monthly: number };

// The receipts for a category cut, shared with the projection so both answers source the same figures.
export function categoryCutFacts(overview: Overview, cut: CategoryCut, cutPct: number, freesPerMonthEur: number): Fact[] {
  return [
    fact("scenario:category-avg", `${cut.category}, average per month`, cut.monthly, "EUR/month", `average of the last ${overview.windowMonths} months`, { evidence: { from: overview.windowFrom, to: overview.windowTo, category: cut.category } }),
    fact("scenario:category-cut-pct", "Cut asked for", cutPct, "percent", "the percentage the customer named", { source: "customer-stated" }),
    fact("scenario:category-freed", `Cutting ${cut.category} by ${cutPct}% frees, per month`, freesPerMonthEur, "EUR/month", `${cutPct}% of the monthly average`, { source: "calculation" }),
    fact("scenario:category-freed-yearly", `Cutting ${cut.category} by ${cutPct}% frees, per year`, round2(freesPerMonthEur * 12), "EUR/year", "the monthly figure times 12", { source: "calculation" }),
  ];
}

// The per-month answer: one calculation card (average, the cut, per month, per year), no projection, no chart.
export function categoryCutOutcome(overview: Overview, cut: CategoryCut, cutPct: number, freesPerMonthEur: number): ToolOutcome {
  const yearly = round2(freesPerMonthEur * 12);
  const window = overview.windowMonths;
  return outcome({
    content: JSON.stringify({
      categoryCut: { category: cut.category, averagePerMonthEur: cut.monthly, cutPct, freesPerMonthEur, freesPerYearEur: yearly, basis: `the ${window}-month average, not any single month` },
      say: "Answer with what the cut frees per month, and per year if useful, from their average. They asked about saving, not the years ahead: give no projection and do not suggest investing it. The card shows the working.",
    }),
    summary: `Cutting ${cut.category} by ${cutPct}% frees €${freesPerMonthEur.toFixed(2)} a month`,
    facts: categoryCutFacts(overview, cut, cutPct, freesPerMonthEur),
    stages: [
      {
        kind: "calculation",
        title: `Spending ${cutPct}% less on ${cut.category}`,
        summary: `${cutPct}% of your usual ${cut.category.toLowerCase()} spending`,
        source: "calculation",
        data: {
          kind: "calculation",
          steps: [
            { label: `${cut.category}, average per month`, amount: cut.monthly, basis: `average of the last ${window} months, from your bank data` },
            { label: "Freed per month", amount: freesPerMonthEur, basis: `${cutPct}% of the monthly average` },
            { label: "Freed per year", amount: yearly, basis: "the monthly figure times 12" },
          ],
          resultLabel: "Freed per month",
          resultValue: freesPerMonthEur,
          unit: "EUR/month",
          assumptions: [`From your ${window}-month average for ${cut.category}, not any single month.`, "An estimate: the money is freed only if the spending really goes down. Nothing is moved for you."],
        },
      },
    ],
  });
}
