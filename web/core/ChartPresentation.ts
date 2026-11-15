/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/ChartPresentation.swift. Charts and the card content of 14 Nov, as exactly what a view needs:
// fractions already scaled, texts already formatted, colours named by role. Nothing here recomputes a figure the
// server sent. (The Swift file's `ActionPresenter` extension — warning, confirmation, destination — lives in
// ActionPresenter in web/core/CoachPresentation.ts, because a TS namespace cannot be extended across modules.)
import type { AgentAction } from "@/web/core/CoachModels";
import type { CoachMessage } from "@/web/core/CoachSession";
import { PlanItem, PlanTotals } from "@/web/core/PlanModels";
import type { MoneyPlan, Visual } from "@/web/core/PlanModels";
import type { PlanCheckLane, PlanView } from "@/web/core/PlanSession";
import { CardLine, CoachText, FuturesPresenter, ToolPresenter } from "@/web/core/CoachPresentation";
import { Dates, Money, rawOf, roundAway } from "@/web/core/Presentation";
import type { SisuLanguage } from "@/web/core/Presentation";

export { ActionPresenter } from "@/web/core/CoachPresentation";

const pick = CoachText.pick;

/** A colour by role. The app maps roles to its palette; keep the six category colours in their order. */
export type ChartColorRole = "category1" | "category2" | "category3" | "category4" | "category5" | "category6" | "main" | "quiet" | "flagged";
export namespace ChartColorRole {
  export const allCases: readonly ChartColorRole[] = ["category1", "category2", "category3", "category4", "category5", "category6", "main", "quiet", "flagged"];
  const categories: readonly ChartColorRole[] = allCases.slice(0, 6);
  /** The role of the nth category (0-based), cycling after six. */
  export function category(index: number): ChartColorRole { return categories[((index % 6) + 6) % 6]; }
}

export interface ChartLegendEntry { label: string; color: ChartColorRole; /** True for a line (the income mark), false for a swatch. */ isLine: boolean }

/** One horizontal bar: its label, the value text at its tip and its length as a fraction of the longest bar. */
export interface ChartBar {
  id: string;
  label: string;
  valueText: string;
  /** 0...1 of the chart's width. */
  fraction: number;
  color: ChartColorRole;
  /** A short note beside the label: `€64 above`, `saves about €24 a year`. */
  note: string | null;
  url: string | null;
}

export interface ChartSlice {
  id: string;
  label: string;
  valueText: string;
  /** `38%`. */
  shareText: string;
  /** Where the slice starts and ends around the ring, 0...1. */
  start: number;
  end: number;
  color: ChartColorRole;
}

export interface ChartColumn {
  id: string;
  label: string;
  /** True for the months whose label is printed on the axis (every third, and the last). */
  showsLabel: boolean;
  /** The column's height, 0...1. */
  fraction: number;
  /** Where the income mark sits, 0...1. */
  markFraction: number;
  /** True when the month cost more than it brought in. */
  flagged: boolean;
  color: ChartColorRole;
  /** `Oct: €1,783 in, €1,901 out, €118 more out than in`. */
  detail: string;
}

export interface ChartLinePoint { /** 0...1 along the years. */ x: number; /** 0...1 of the height. */ y: number; low: number; high: number }

export interface ChartLine {
  id: string;
  label: string;
  color: ChartColorRole;
  points: ChartLinePoint[];
  /** True when the line has a range to draw as a band (invested money). */
  hasBand: boolean;
  /** `€10,516` at the end of the line. */
  endText: string;
  /** `€9,528 to €11,348`, when there is a range. */
  rangeText: string | null;
}

/** What a chart view draws. */
export interface ChartState {
  id: string;
  kind: string;
  title: string;
  caption: string;
  /** The code-written sentence that says what the picture shows: use it as the accessibility label. */
  summary: string;
  legend: ChartLegendEntry[];
  body: ChartState.Body;
  /** A result line under the chart (`Safe to spend a week` and `€164`), when the chart has one. */
  resultLabel: string | null;
  resultValue: string | null;
  /** What the flagged marks mean, or that offers are example data. */
  footnote: string | null;
  /** Where the numbers come from: `Your bank data`. */
  source: string;
  /** What the lengths measure: `Average a month`, `Estimated cost a month`. Null when the chart says it itself. */
  unit: string | null;
  /** The value at the top of a columns chart: `Scale up to €2,100`. */
  scale: string | null;
}

export namespace ChartState {
  export interface BarGroup { id: string; title: string; note: string | null; bars: ChartBar[]; url: string | null }
  export type Body =
    /** A ring: slices in order, the text in its centre (label and total). */
    | { kind: "donut"; slices: ChartSlice[]; centerLabel: string; centerValue: string }
    /** Rows of bars. Each group has a title and one or two bars. */
    | { kind: "bars"; groups: BarGroup[] }
    /** Columns per month with an income mark across each. */
    | { kind: "columns"; columns: ChartColumn[] }
    /** Lines over the years. `axisLabels` are the years to print. */
    | { kind: "lines"; lines: ChartLine[]; axisLabels: string[] }
    /** A kind this version does not know: show title, caption and summary only. */
    | { kind: "none" };
}

// MARK: - Charts

const finiteMax = (values: number[]): number | null => { const f = values.filter(Number.isFinite); return f.length ? Math.max(...f) : null; };
const finiteMin = (values: number[]): number | null => { const f = values.filter(Number.isFinite); return f.length ? Math.min(...f) : null; };
const bar = (fields: Omit<ChartBar, "note" | "url"> & Partial<Pick<ChartBar, "note" | "url">>): ChartBar => ({ note: null, url: null, ...fields });

export namespace ChartPresenter {
  export function euro(value: number, language: SisuLanguage): string { return Money.format(value, language); }

  export function fraction(value: number, maximum: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(maximum) || !(maximum > 0)) return 0;
    return Math.min(Math.max(value / maximum, 0), 1);
  }

  /** Everything a chart view needs for one `Visual`. */
  export function chart(visual: Visual, language: SisuLanguage = "en"): ChartState {
    const base: ChartState = {
      id: visual.id, kind: visual.kind, title: visual.title ?? "", caption: visual.caption ?? "", summary: visual.summary ?? "", legend: [],
      body: { kind: "none" }, resultLabel: null, resultValue: null, footnote: null, source: CoachText.sourceLabel(visual.source ?? "", language),
      unit: null, scale: null,
    };
    const content = visual.content;
    switch (content.kind) {
      case "budgetDonut": {
        const sum = content.slices.reduce((total, slice) => total + (Number.isFinite(slice.share) ? Math.max(slice.share, 0) : 0), 0);
        const slices = content.slices.reduce<{ out: ChartSlice[]; cursor: number }>((acc, slice, index) => {
          const share = sum > 0 && Number.isFinite(slice.share) ? Math.max(slice.share, 0) / sum : 0;
          const end = Math.min(acc.cursor + share, 1);
          const one: ChartSlice = {
            id: `${index}-${slice.label}`, label: slice.label, valueText: euro(slice.value, language),
            shareText: CoachText.value(roundAway(slice.share), "percent", language), start: acc.cursor, end, color: ChartColorRole.category(index),
          };
          return { out: [...acc.out, one], cursor: end };
        }, { out: [], cursor: 0 }).out;
        return { ...base, body: { kind: "donut", slices, centerLabel: content.centerLabel, centerValue: euro(content.total, language) },
          legend: slices.map((slice) => ({ label: slice.label, color: slice.color, isLine: false })) };
      }
      case "peerBars": {
        const maximum = finiteMax(content.rows.flatMap((row) => [row.you, row.peers])) ?? 0;
        const legend: ChartLegendEntry[] = [
          { label: pick(language, "You", "Sinä"), color: "main", isLine: false },
          { label: pick(language, `People ${content.peerGroup}`, `Muut ${content.peerGroup}`), color: "quiet", isLine: false },
        ];
        const groups = content.rows.map((row, index): ChartState.BarGroup => {
          const gap = roundAway(row.you - row.peers);
          const note = gap > 0 ? pick(language, `${euro(row.you - row.peers, language)} above`, `${euro(row.you - row.peers, language)} yli`)
            : gap < 0 ? pick(language, `${euro(row.peers - row.you, language)} below`, `${euro(row.peers - row.you, language)} alle`)
            : pick(language, "about the same", "suunnilleen sama");
          return { id: `${index}-${row.label}`, title: row.label, note, url: null, bars: [
            bar({ id: "you", label: legend[0].label, valueText: euro(row.you, language), fraction: fraction(row.you, maximum), color: "main" }),
            bar({ id: "peers", label: legend[1].label, valueText: euro(row.peers, language), fraction: fraction(row.peers, maximum), color: "quiet" }),
          ] };
        });
        return { ...base, legend, body: { kind: "bars", groups }, unit: pick(language, "Average a month", "Keskimäärin kuukaudessa") };
      }
      case "monthBars": {
        const months = content.months;
        const maximum = Math.max(finiteMax(months.flatMap((m) => [m.income, m.spending])) ?? 0, 1);
        const legend: ChartLegendEntry[] = [
          { label: pick(language, "Spending", "Menot"), color: "main", isLine: false },
          { label: pick(language, "Income", "Tulot"), color: "quiet", isLine: true },
        ];
        const columns = months.map((month, index): ChartColumn => {
          const over = month.spending > month.income;
          const inOut = pick(language, `${month.label}: ${euro(month.income, language)} in, ${euro(month.spending, language)} out`,
            `${month.label}: ${euro(month.income, language)} sisään, ${euro(month.spending, language)} ulos`);
          const extra = over ? pick(language, `, ${euro(month.spending - month.income, language)} more out than in`,
            `, ${euro(month.spending - month.income, language)} enemmän ulos kuin sisään`) : "";
          return { id: month.month, label: month.label, showsLabel: index % 3 === 0 || index === months.length - 1,
            fraction: fraction(month.spending, maximum), markFraction: fraction(month.income, maximum), flagged: over, color: over ? "flagged" : "main", detail: inOut + extra };
        });
        const footnote = columns.some((column) => column.flagged)
          ? pick(language, "Marked months cost more than they brought in.", "Merkityt kuukaudet maksoivat enemmän kuin toivat.") : null;
        return { ...base, legend, body: { kind: "columns", columns }, footnote, unit: pick(language, "Per month", "Kuukaudessa"),
          scale: maximum > 1 ? pick(language, `Scale up to ${euro(maximum, language)}`, `Asteikko ${euro(maximum, language)} asti`) : null };
      }
      case "waterfall": {
        const shown = content.steps.filter((step) => Number.isFinite(step.amount) && roundAway(step.amount) !== 0);
        const maximum = shown.length ? Math.max(...shown.map((step) => Math.abs(step.amount))) : 0;
        const groups = shown.map((step, index): ChartState.BarGroup => ({ id: `${index}-${step.label}`, title: step.label, note: step.basis, url: null, bars: [
          bar({ id: "amount", label: step.label, valueText: euro(step.amount, language), fraction: fraction(Math.abs(step.amount), maximum), color: step.amount < 0 ? "quiet" : "main" }),
        ] }));
        return { ...base, body: { kind: "bars", groups }, resultLabel: content.resultLabel, resultValue: euro(content.resultValue, language) };
      }
      case "futuresLines": {
        const all = content.series.flatMap((one) => one.points);
        const lowest = finiteMin(all.flatMap((p) => [p.value, p.low])) ?? 0;
        const highest = finiteMax(all.flatMap((p) => [p.value, p.high])) ?? 0;
        const span = highest - lowest;
        const lastYear = Math.max(finiteMax(all.map((p) => p.year)) ?? content.years, 0);
        const y = (value: number) => (span > 0 && Number.isFinite(value) ? Math.min(Math.max((value - lowest) / span, 0), 1) : 0);
        const lines = content.series.map((one, index): ChartLine => {
          const color: ChartColorRole = one.id === "nothing" ? "quiet" : one.id === "invest" ? "main" : ChartColorRole.category(index);
          const end = one.points.length ? one.points[one.points.length - 1] : null;
          return {
            id: one.id, label: one.label, color,
            points: one.points.map((p) => ({ x: lastYear > 0 ? fraction(p.year, lastYear) : 0, y: y(p.value), low: y(p.low), high: y(p.high) })),
            hasBand: one.points.some((p) => Money.format(p.low, language) !== Money.format(p.high, language)),
            endText: end ? euro(end.value, language) : "",
            rangeText: end ? FuturesPresenter.range(end.low, end.high, language) : null,
          };
        });
        const whole = Number.isFinite(lastYear) ? roundAway(Math.min(lastYear, 100)) : 0;
        const axisLabels = Array.from({ length: Math.max(whole, 0) + 1 }, (_, year) => String(year));
        return { ...base, body: { kind: "lines", lines, axisLabels }, legend: lines.map((line) => ({ label: line.label, color: line.color, isLine: true })),
          unit: pick(language, "Total in euros, by year", "Yhteensä euroina, vuosittain") };
      }
      case "offerBars": {
        const current = content.currentMonthlyEur;
        const maximum = finiteMax([current, ...content.offers.map((offer) => offer.monthlyEur)]) ?? 0;
        const nowLabel = pick(language, "Your bill now", "Laskusi nyt");
        const groups: ChartState.BarGroup[] = [
          { id: "current", title: nowLabel, note: null, url: null, bars: [bar({ id: "current", label: nowLabel, valueText: euro(current, language), fraction: fraction(current, maximum), color: "quiet" })] },
          ...content.offers.map((offer, index): ChartState.BarGroup => ({
            id: `${index}-${offer.provider}`,
            title: [offer.provider, offer.plan].filter((part): part is string => part != null).join(" · "),
            note: offer.yearlySavingEur > 0
              ? pick(language, `saves about ${euro(offer.yearlySavingEur, language)} a year`, `säästää noin ${euro(offer.yearlySavingEur, language)} vuodessa`)
              : pick(language, "not cheaper", "ei halvempi"),
            bars: [bar({ id: "offer", label: offer.provider, valueText: euro(offer.monthlyEur, language), fraction: fraction(offer.monthlyEur, maximum), color: "main", url: offer.url })],
            url: offer.url,
          })),
        ];
        const footnote = content.mock ? pick(language, "Example data, not a live search.", "Esimerkkidataa, ei oikea haku.") : null;
        return { ...base, body: { kind: "bars", groups }, footnote, unit: pick(language, "Estimated cost a month", "Arvioitu hinta kuukaudessa") };
      }
      case "unknown":
        return base;
    }
  }
}

// MARK: - The steps list

/** One row of "What Sisu is doing" (while the reply is pending) and "What Sisu did" (afterwards). */
export interface StepRow {
  id: string;
  label: string;
  state: StepRow.State;
  /** `1.2 s`, once it has finished. */
  duration: string | null;
  /** One line on what came back. */
  result: string | null;
}
export namespace StepRow { export type State = "running" | "done" | "failed"; }

export namespace StepPresenter {
  /** `What Sisu is doing` while the reply is pending, `What Sisu did` afterwards. */
  export function heading(pending: boolean, language: SisuLanguage = "en"): string {
    return pending ? pick(language, "What Sisu is doing", "Mitä Sisu tekee") : pick(language, "What Sisu did", "Mitä Sisu teki");
  }

  /** The rows of a reply's steps. A step still running when the reply has ended (a cancelled turn) is not shown as
   *  running, and a finished one says what it did (`Searched …`, not `Searching …`). A web search that reused
   *  results fetched earlier (it took under 0.1 s, or the research says it was cached) shows when those results
   *  were fetched instead of two durations that contradict each other. */
  export function rows(message: CoachMessage, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): StepRow[] {
    return (message.steps ?? []).map((step) => {
      const state: StepRow.State = !step.ok ? "failed" : step.done || !message.pending ? "done" : "running";
      const reused = state === "done" ? reusedAt(message, step.id, step.tookMs) : null;
      const duration = reused == null && step.tookMs != null ? ToolPresenter.duration(step.tookMs, language) : null;
      return {
        id: step.id,
        label: state === "done" ? pastTense(step.label) : step.label,
        state,
        duration,
        // One time per row: the row's own duration, or when reused results were fetched; never the server's too.
        result: reused != null ? withReuse(step.result, reused, language, timeZone) : duration != null && step.result ? withoutDuration(step.result) : step.result ?? null,
      };
    });
  }

  const PAST: readonly (readonly [RegExp, string])[] = [
    [/^Searching\b/, "Searched"], [/^Checking\b/, "Checked"], [/^Adding up\b/, "Added up"], [/^Working out\b/, "Worked out"],
    [/^Reading\b/, "Read"], [/^Looking\b/, "Looked"], [/^Finding\b/, "Found"], [/^Comparing\b/, "Compared"],
    [/^Preparing\b/, "Prepared"], [/^Projecting\b/, "Projected"], [/^Building\b/, "Built"], [/^Setting up\b/, "Set up"],
    [/^Calculating\b/, "Calculated"], [/^Getting\b/, "Got"], [/^Drawing\b/, "Drew"], [/^Scanning\b/, "Scanned"], [/^Going through\b/, "Went through"],
    [/^Opening\b/, "Opened"], [/^Saving that\b/, "Saved that"], [/^Researching\b/, "Researched"], [/^Running\b/, "Ran"], [/\band reading\b/, "and read"],
  ];

  /** `Searched today's offers … and read the pages` for `Searching today's offers … and reading the pages`. */
  export function pastTense(label: string): string {
    return PAST.reduce((text, [pattern, past]) => text.replace(pattern, past), label);
  }

  /** When the results a web step reused were fetched ("" when not known); null for a step that fetched afresh. */
  function reusedAt(message: CoachMessage, id: string, tookMs: number | null): string | null {
    const trace = (message.tools ?? []).find((one) => one.id === id);
    const web = trace != null && (trace.name === "search_offers" || /exa|context\.dev/i.test(trace.source));
    if (!web) return null;
    const research = message.research as (typeof message.research & { cached?: unknown }) | null;
    const quick = tookMs != null && Number.isFinite(tookMs) && tookMs < 50;
    if (!quick && research?.cached !== true) return null;
    const stage = (message.stages ?? []).find((one) => one.toolCallId === id && one.data.kind === "research");
    if (stage?.data.kind === "research" && stage.data.retrievedAt) return stage.data.retrievedAt;
    return research?.finishedAt ?? research?.startedAt ?? "";
  }

  /** `15 offers from 3 pages` for `15 offers from 3 pages in 3.6 s`. */
  function withoutDuration(result: string): string {
    return result.replace(/ in \d+(?:[.,]\d+)? s\b/g, "").trim();
  }

  function withReuse(result: string | null, iso: string, language: SisuLanguage, timeZone: string): string {
    const moment = Dates.parseMoment(iso);
    const parts = moment ? Dates.zonedParts(moment, timeZone) : null;
    const time = parts ? `${String(parts.hour).padStart(2, "0")}${language === "en" ? ":" : "."}${String(parts.minute).padStart(2, "0")}` : null;
    const note = time
      ? pick(language, `reused results from ${time}`, `käytetty klo ${time} haettuja tuloksia`)
      : pick(language, "reused earlier results", "käytetty aiemmin haettuja tuloksia");
    const base = withoutDuration(result ?? "");
    return base === "" ? note.charAt(0).toUpperCase() + note.slice(1) : `${base} · ${note}`;
  }
}

// MARK: - The money plan

/** One of the two parts of the plan's total. */
export interface PlanSplitFigure { /** `€257 a year`. */ amount: string; /** `needs nothing from you` or `needs spending to come down`. */ label: string }

/** The card that sums the plan up. The total is only here together with its two parts. */
export interface PlanCardState {
  /** `About €1,771 a year`. */
  title: string;
  needsNothing: PlanSplitFigure;
  needsSpendingChange: PlanSplitFigure;
  /** The server's own summary sentence, when it has arrived. */
  summary: string | null;
  /** `Approve all 4`, or null when nothing waits. */
  approveLabel: string | null;
  /** What approving does, in plain words, with the simulation said out loud. */
  approveNote: string;
  /** Always `Simulated, no real switch`. */
  simulatedTag: string;
  /** The warnings of the actions that have one. Show every one of them. */
  warnings: string[];
  /** After approval: one confirmation per approved action. */
  confirmations: string[];
}

/** One row of the plan's list. */
export interface PlanItemRow { id: string; title: string; detail: string; /** `About €768 a year`. */ amount: string; needsNote: string; needsSpendingChange: boolean }

/** What sources say today about something worth checking, beside the customer's own figure. Never a decision. */
export interface PlanCheckCard {
  id: string;
  title: string;
  /** `What the sources say today`. */
  heading: string;
  /** The finding, or a line saying the research found nothing to report or is still running. */
  finding: string;
  /** The customer's own figure. */
  yoursLabel: string | null;
  yoursValue: string | null;
  /** Whether the figures were found in the pages' own text. */
  confirmedNote: string | null;
  sources: CardLine[];
  /** `This is general information, not a decision about your case.` */
  disclaimer: string;
  isRunning: boolean;
  isMock: boolean;
}

const nonEmpty = (text: string | null | undefined): text is string => text != null && text !== "";
const isWaiting = (action: AgentAction) => rawOf(action.status) === "awaiting_approval";

export namespace PlanPresenter {
  export function yearly(value: number, language: SisuLanguage): string {
    return Money.format(value, language) + pick(language, " a year", " vuodessa");
  }

  /** The summary card, from the totals (always with their split) and the actions set up so far. Null until the sums have arrived. */
  export function card(view: PlanView, language: SisuLanguage = "en"): PlanCardState | null {
    const totals = view.calc?.totals ?? view.plan?.totals;
    if (totals == null) return null;
    const actions = view.actions ?? [];
    const waiting = actions.filter(isWaiting).length;
    const spendingChange = PlanTotals.spendingChangeYearlyEur(totals);
    return {
      title: pick(language, "About ", "Noin ") + yearly(totals.totalYearlyEur, language),
      needsNothing: { amount: yearly(totals.effortlessYearlyEur, language), label: pick(language, "needs nothing from you", "ei vaadi sinulta mitään") },
      needsSpendingChange: { amount: yearly(spendingChange, language), label: pick(language, "needs spending to come down", "vaatii menojen pienenemistä") },
      summary: view.summary?.text ?? view.plan?.summary ?? null,
      approveLabel: waiting > 0 ? pick(language, `Approve all ${waiting}`, `Hyväksy kaikki ${waiting}`) : null,
      approveNote: pick(language, "Approving sets these up as a simulation. No contract is switched and no money moves.",
        "Hyväksyntä tekee nämä simulaationa. Sopimuksia ei vaihdeta eikä rahaa siirry."),
      simulatedTag: CoachText.simulatedTag(language),
      warnings: actions.map((action) => action.warning).filter(nonEmpty),
      confirmations: actions.map((action) => action.confirmation).filter(nonEmpty),
    };
  }

  /** The plan's items as rows, once the plan is done. */
  export function items(plan: MoneyPlan, language: SisuLanguage = "en"): PlanItemRow[] {
    return plan.items.map((item) => {
      const needsSpendingChange = PlanItem.needsSpendingChange(item);
      return {
        id: item.id, title: item.title, detail: item.detail,
        amount: pick(language, "About ", "Noin ") + yearly(item.yearlyEur, language),
        needsNote: needsSpendingChange
          ? pick(language, "Only if this spending really comes down", "Vain jos nämä menot todella pienenevät")
          : pick(language, "Needs nothing from you", "Ei vaadi sinulta mitään"),
        needsSpendingChange,
      };
    });
  }

  /** A check as a card: what the sources say today, the customer's own figure beside it, and the sources. */
  export function check(lane: PlanCheckLane, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): PlanCheckCard {
    const found = lane.check ?? null;
    const finding = found
      ? nonEmpty(found.finding) ? found.finding : pick(language, "The sources had nothing clear to report today.", "Lähteistä ei löytynyt tänään selvää tietoa.")
      : pick(language, "Looking this up now.", "Tarkistetaan parhaillaan.");
    const confirmedNote = found
      ? found.figuresConfirmed
        ? pick(language, "The figures were found in the pages' own text.", "Luvut löytyivät sivujen omasta tekstistä.")
        : pick(language, "The figures could not be found in the pages' own text. Check the sources.", "Lukuja ei löytynyt sivujen omasta tekstistä. Tarkista lähteet.")
      : null;
    const yours = found?.yours ?? null;
    return {
      id: lane.id, title: lane.title,
      heading: pick(language, "What the sources say today", "Mitä lähteet sanovat tänään"),
      finding,
      yoursLabel: yours?.label ?? null,
      yoursValue: yours ? CoachText.value(yours.value, yours.unit, language) : null,
      confirmedNote,
      sources: (found?.sources ?? []).map((source) => CardLine.make(source.title, CoachText.fetched(source.retrievedAt, language, timeZone), source.url)),
      disclaimer: pick(language, "This is general information, not a decision about your case.", "Tämä on yleistä tietoa, ei päätös sinun asiastasi."),
      isRunning: found == null,
      isMock: found?.mock ?? false,
    };
  }
}
