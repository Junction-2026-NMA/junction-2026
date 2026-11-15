/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// The S-Pankki payday story in the answer cards (v3, 15 Nov): "Why do I keep running out before payday?" (the
// cash flow: money available until the next payday) and "What if I spend 20 percent less eating out?" (a category
// cut: a monthly saving from the category's own average). Pure: read from the facts the backend computed in code
// (lib/agent/tools/finance.ts getCashFlow, lib/agent/tools/category-cut.ts), never typed here.
// - A category cut is a monthly saving, worded apart from money available before payday, with its baseline.
// - Either answer links to the existing Path lesson that explains it (LessonLink).
import type { Fact, Stage } from "./CoachModels";
import type { CoachMessage } from "./CoachSession";
import { CoachText } from "./CoachPresentation";
import { LessonWording } from "./AppLogic/LessonPath";
import { Dates } from "./Presentation";

export namespace PaydayAnswers {
  /** A category cut as the backend worked it out: the category's monthly average, the cut and what it frees. */
  export interface Cut { category: string; baselineEur: number; months: number | null; pct: number; monthlyEur: number; yearlyEur: number }
  /** The cash-flow answer: what is left for spending until the next payday, and when that is. */
  export interface Payday { leftEur: number; perWeekEur: number | null; nextPayday: string | null; days: number | null }
  /** "Open the lesson: <title>" under an answer. `concept` is the Path lesson's concept id. */
  export interface LessonLink { concept: string; title: string; label: string }

  const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

  /** Every fact of the answer: the turn's own and its stages'. */
  export function factsOf(message: Pick<CoachMessage, "facts" | "stages">): Fact[] {
    return [...message.facts, ...message.stages.flatMap((stage) => stage.facts)];
  }

  const find = (facts: readonly Fact[], id: string): Fact | undefined => facts.find((one) => one.id === id && finite(one.value));

  /** The cut, when the answer carries the backend's category-cut receipts (scenario:category-*), else null. */
  export function cut(message: Pick<CoachMessage, "facts" | "stages">): Cut | null {
    const facts = factsOf(message);
    const avg = find(facts, "scenario:category-avg");
    const pct = find(facts, "scenario:category-cut-pct");
    const freed = find(facts, "scenario:category-freed");
    if (!avg || !pct || !freed) return null;
    const yearly = find(facts, "scenario:category-freed-yearly");
    const category = avg.evidence?.category ?? avg.label.split(",")[0].trim();
    const months = Number((avg.basis ?? "").match(/last (\d+) months/)?.[1] ?? NaN);
    return { category, baselineEur: avg.value, months: Number.isFinite(months) ? months : null, pct: pct.value, monthlyEur: freed.value, yearlyEur: yearly ? yearly.value : freed.value * 12 };
  }

  /** "Monthly saving if you spend 20% less on Restaurants": a saving each month, never money to spend before payday. */
  export function cutLabel(cut: Cut): string {
    return `Monthly saving if you spend ${CoachText.number(cut.pct, 0, "en")}% less on ${cut.category}`;
  }

  /** "€663.60 a year · from your Restaurants average of €276.52 a month over 12 months". */
  export function cutDetail(cut: Cut): string {
    const over = cut.months === null ? "" : ` over ${cut.months} months`;
    return `${CoachText.value(cut.yearlyEur, "EUR/year", "en")} · from your ${cut.category} average of ${CoachText.value(cut.baselineEur, "EUR/month", "en")}${over}`;
  }

  /** The cash-flow answer's receipts (cash:budget:left, cash:days-to-payday), or null for any other answer. */
  export function payday(message: Pick<CoachMessage, "facts" | "stages">): Payday | null {
    const facts = factsOf(message);
    const left = find(facts, "cash:budget:left");
    if (!left) return null;
    const days = find(facts, "cash:days-to-payday");
    const date = [days?.basis, find(facts, "cash:budget:weeks")?.basis].map((text) => (text ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0]).find(Boolean) ?? null;
    return { leftEur: left.value, perWeekEur: find(facts, "cash:budget:per-week")?.value ?? null, nextPayday: date, days: days ? days.value : null };
  }

  /** The period the figure covers, and the total when the result shows the weekly figure:
   *  "€184 in total until payday on 1 Oct 2025 (15 days)" or "Until payday on 1 Oct 2025 (15 days)". */
  export function paydayDetail(payday: Payday, resultValue: number | null): string | null {
    if (payday.nextPayday === null) return null;
    const days = payday.days === null ? "" : ` (${CoachText.number(payday.days, 0, "en")} ${payday.days === 1 ? "day" : "days"})`;
    const when = `payday on ${Dates.short(payday.nextPayday, "en")}${days}`;
    return resultValue !== null && Math.abs(resultValue - payday.leftEur) < 0.005
      ? `Until ${when}` : `${CoachText.value(payday.leftEur, "EUR", "en")} in total until ${when}`;
  }

  /** Is this the cash-flow card (by its stage), for answers that carry no budget receipts (no payday found)? */
  export const isCashFlowStage = (stage: Stage): boolean =>
    stage.data.kind === "calculation" && /weekly budget until payday|bills before payday are covered|balance before the next payday/i.test(stage.title);

  /** The Path lesson that explains the answer: the three baskets for a category cut (restaurants are everyday
   *  spending, the basket that can change), the weekly room for the money left until payday. */
  export function lesson(message: Pick<CoachMessage, "facts" | "stages">): LessonLink | null {
    if (cut(message)) return link("three-baskets", "Three baskets");
    if (payday(message) || message.stages.some(isCashFlowStage)) return link("safe-to-spend", LessonWording.averagesTitle);
    return null;
  }

  const link = (concept: string, title: string): LessonLink => ({ concept, title, label: `Open the lesson: ${title}` });
}
