/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// What one answer shows, worked out once (web addition of the 15 Nov rework, no Swift counterpart yet): one short
// result with the most useful number, then the details behind it, each said once: how it was worked out, the
// assumptions, and the sources with labels that tell bank data, the user's input, the web, estimates, simulations
// and the synthetic demo comparison apart. Every figure comes from the payload; nothing here computes a new one.
// The offers are grouped per bill (AnswerOffers.ts); the repeats are taken out in AnswerWorking.ts.
import type { EvidenceFilter } from "./Models";
import type { AgentAction, ResearchResult, Stage } from "./CoachModels";
import type { CoachMessage } from "./CoachSession";
import type { Visual } from "./PlanModels";
import { CardLine, CoachText, GroundingPresenter, OfferPresenter, StagePresenter, ToolPresenter } from "./CoachPresentation";
import type { FuturesSeries, GroundingLine, OfferRow } from "./CoachPresentation";
import { StepPresenter, type StepRow } from "./ChartPresentation";
import { Dates, Money, rawOf, roundAway, type SisuLanguage } from "./Presentation";
import { CardText, SourceTags, type SourceTag } from "./AnswerText";
import { OfferGroups, type OfferGroup, type OfferSection } from "./AnswerOffers";
import { Working } from "./AnswerWorking";
import { PaydayAnswers } from "./AnswerPayday";

export { CardText, SourceTags } from "./AnswerText";
export type { SourceKind, SourceTag } from "./AnswerText";
export type { OfferSection } from "./AnswerOffers";

const pick = CoachText.pick;

// MARK: - The answer

export interface ShowEvidence { title: string; filter: EvidenceFilter }

/** The one result an answer leads with. `value` is null for a result that is a sentence (no matching offers). */
export interface AnswerResult {
  label: string;
  value: string | null;
  detail: string | null;
  tags: SourceTag[];
  /** True for "No matching options found": offer to broaden the search or keep looking. */
  noMatch: boolean;
  evidence: ShowEvidence | null;
}

/** One part of "How this was worked out". */
export interface HowBlock { id: string; title: string; lines: CardLine[]; evidence: ShowEvidence | null }

export interface AnswerSource { title: string; url: string; fetched: string | null }

export interface AnswerOffers {
  /** Every offer row of every bill (for the count). */
  rows: OfferRow[];
  /** One section per bill, each with its own bill now. */
  sections: OfferSection[];
  /** `You asked for …`; null when the result card already says it. */
  requirement: string | null;
}

/** The projection over the years. `optional`: the card leads with the monthly figure, so it is its own closed,
 *  optional section of the details; otherwise it is part of "How this was worked out". */
export interface FuturesView { series: FuturesSeries[]; summary: string; label: string; optional: boolean; tags: SourceTag[] }

export interface AnswerView {
  result: AnswerResult | null;
  offers: AnswerOffers | null;
  how: HowBlock[];
  futures: FuturesView | null;
  steps: StepRow[];
  timing: string | null;
  assumptions: string[];
  sources: AnswerSource[];
  tags: SourceTag[];
  grounding: GroundingLine | null;
  noMatch: boolean;
  /** The agent's charts that say more than the answer (the others repeat a card and are left out). */
  visuals: Visual[];
  /** Ids of prepared switches whose offer does not meet the user's requirements: their card says so. */
  mismatchedActionIds: string[];
  /** v3: the Path lesson that explains a payday or spending answer ("Open the lesson: …"); null otherwise. */
  lesson: PaydayAnswers.LessonLink | null;
  /** v3: the answer rests on the synthetic profile's bank data as of the scenario date (payday, a category cut):
   *  the card names that date with Today's own formatter (TodayPresenter.dataDate). */
  scenarioDated: boolean;
  /** v3: actions not shown with this answer: a transfer prepared next to a category cut (a saving question). */
  hiddenActionIds: string[];
}

export function messageActions(message: CoachMessage): AgentAction[] {
  const staged = message.stages.flatMap((stage) => (stage.data.kind === "action" ? [stage.data.action] : []));
  return message.action && !staged.some((one) => one.id === message.action!.id) ? [...staged, message.action] : staged;
}

export namespace AnswerPresenter {
  /** `question`: what the user asked (the message before this one), read for a requirement the backend did not send. */
  export function view(message: CoachMessage, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone(), question = ""): AnswerView {
    const h = (text: string | null | undefined) => CardText.readable(text, language, timeZone);
    const groups = OfferGroups.of(message, question);
    const withOffers = groups.filter((group) => group.offers.length > 0);
    const noMatch = withOffers.length > 0 && withOffers.every((group) => group.noMatch);
    const lead = noMatch ? null : OfferGroups.lead(groups);
    const owner = groups.find((group) => group.research != null) ?? null;
    const research: ResearchResult | null = owner?.research ?? null;
    const grouped = new Set(groups.flatMap((group) => (group.calc ? [group.calc] : [])));
    const shownCalc = new Set(groups.flatMap((group) => (group.calc && group.calcShown ? [group.calc] : [])));
    const calcs = message.stages.filter((stage) => stage.data.kind === "calculation" && (!grouped.has(stage) || shownCalc.has(stage)));
    const generalCalcs = calcs.filter((stage) => !grouped.has(stage));
    const impact = noMatch ? undefined : message.stages.find((stage) => stage.data.kind === "impact");
    const leadStage = message.stages.find((stage) => stage.data.kind === "lead");
    const evidence = message.stages.filter((stage) => stage.data.kind === "evidence");
    const webTag = groups.length > 0 ? webTagOf(groups[0], language, timeZone) : null;
    const isMock = groups.some((group) => group.research?.mock === true || (group.researchStage?.data.kind === "research" && group.researchStage.data.mock));
    const actions = messageActions(message);
    // A monthly saving leads with what it frees each month; the years ahead only when the question asked about them.
    const monthly = impact && impact.data.kind === "impact" && Working.leadsMonthly(impact.data.impact, question) ? impact : null;

    // The result: the first thing that holds the most useful number.
    let result: AnswerResult | null = null;
    let resultCalc: Stage | null = null;
    let resultEvidence: Stage | null = null;
    const leadCalc = lead?.calcShown ? lead.calc : null;
    if (noMatch) {
      const requirement = withOffers.find((group) => group.requirement != null)?.requirement ?? null;
      const count = withOffers.reduce((sum, group) => sum + group.offers.length, 0);
      result = { label: OfferPresenter.headline(research ?? ({} as ResearchResult), language, true), value: null, noMatch: true, evidence: null,
        detail: requirement ?? pick(language, `None of the ${count} ${count === 1 ? "offer" : "offers"} Sisu compared meets what you asked for.`, `Yksikään ${count} vertaillusta tarjouksesta ei täytä toiveitasi.`),
        tags: SourceTags.unique([webTag, isMock ? SourceTags.mock(language) : null]) };
    } else if ((leadCalc ?? generalCalcs[0])?.data.kind === "calculation") {
      resultCalc = (leadCalc ?? generalCalcs[0])!;
      const data = resultCalc.data.kind === "calculation" ? resultCalc.data : null;
      const value = CoachText.value(data!.resultValue, data!.unit, language);
      const detail = leadCalc && lead ? OfferGroups.withOffer(lead, language) : Working.summaryUnlessRepeat(resultCalc.summary, data!.resultValue, h(resultCalc.summary), value, h(data!.resultLabel));
      result = { label: h(data!.resultLabel), value, detail, noMatch: false, evidence: null,
        tags: SourceTags.unique([leadCalc && lead ? webTagOf(lead, language, timeZone) : null, SourceTags.of(resultCalc.source, language),
          ...resultCalc.facts.map((f) => SourceTags.of(f.source, language)), leadCalc && isMock ? SourceTags.mock(language) : null]) };
    } else if (lead != null && lead.best != null) {
      const best = lead.best;
      result = { label: pick(language, `Estimated saving with ${best.provider}`, `Arvioitu säästö: ${best.provider}`),
        value: CoachText.value(roundAway(best.estimatedYearlySavingEur ?? 0), "EUR/year", language),
        detail: OfferPresenter.feesUnknown(best) ? pick(language, "Some fees are unknown, so this saving is incomplete.", "Osa maksuista ei ole tiedossa, joten säästö on vajaa.") : null,
        noMatch: false, evidence: null, tags: SourceTags.unique([webTagOf(lead, language, timeZone), SourceTags.estimate(language), isMock ? SourceTags.mock(language) : null]) };
    } else if (research != null) {
      result = { label: OfferPresenter.headline(research, language), value: null, detail: OfferPresenter.baseline(research, language),
        noMatch: false, evidence: null, tags: SourceTags.unique([webTag, SourceTags.estimate(language), isMock ? SourceTags.mock(language) : null]) };
    } else if (monthly && monthly.data.kind === "impact") {
      const data = monthly.data.impact;
      result = { label: h(Working.freedLabel(monthly, data.monthlyEur, language)), value: CoachText.value(data.monthlyEur, "EUR/month", language),
        detail: Number.isFinite(data.yearlyEur) ? CoachText.value(data.yearlyEur, "EUR/year", language) : null, noMatch: false, evidence: null,
        tags: SourceTags.unique([SourceTags.estimate(language), ...Working.savingFacts(monthly, data.monthlyEur).map((f) => SourceTags.of(f.source, language))]) };
    } else if (impact && impact.data.kind === "impact") {
      const years = impact.data.impact.horizonYears;
      result = { label: pick(language, `More after ${CoachText.number(years, 1, language)} ${years === 1 ? "year" : "years"} if you keep it`, `Enemmän ${CoachText.number(years, 1, language)} vuoden jälkeen`),
        value: Money.format(impact.data.impact.gainVsNothingEur, language), detail: null, noMatch: false, evidence: null, tags: [SourceTags.estimate(language)] };
    } else if (leadStage && leadStage.data.kind === "lead" && leadStage.data.patterns[0]?.yearlyImpactEur != null) {
      const top = leadStage.data.patterns[0];
      result = { label: h(top.title), value: pick(language, "About ", "Noin ") + CoachText.value(roundAway(top.yearlyImpactEur!), "EUR/year", language),
        detail: null, noMatch: false, evidence: { title: h(top.title), filter: top.evidence }, tags: [SourceTags.bank(language)] };
    } else if (evidence[0] && evidence[0].data.kind === "evidence") {
      resultEvidence = evidence[0];
      const data = evidence[0].data;
      result = { label: h(evidence[0].title) || pick(language, "From your transactions", "Tapahtumistasi"), value: Money.format(data.totalEur, language, true),
        detail: pick(language, data.count === 1 ? "1 transaction" : `${data.count} transactions`, `${data.count} tapahtumaa`), noMatch: false,
        evidence: { title: h(evidence[0].title), filter: data.filter }, tags: [SourceTags.bank(language)] };
    }

    // v3: a category cut leads with the monthly saving and its baseline (never money to spend before payday), and
    // gets no projection, no futures chart and no transfer unless the question asked about the years or investing.
    // The cash-flow card says the period its figure covers.
    // A projection of some other monthly amount (the person's own €50) is not this cut.
    const found = noMatch ? null : PaydayAnswers.cut(message);
    const cut = found && !(impact && impact.data.kind === "impact" && Math.abs(impact.data.impact.monthlyEur - found.monthlyEur) >= 0.005) ? found : null;
    const cutOnly = cut !== null && !Working.asksLongTerm(question);
    if (cut && cutOnly && result) result = { ...result, label: PaydayAnswers.cutLabel(cut), value: CoachText.value(cut.monthlyEur, "EUR/month", language), detail: PaydayAnswers.cutDetail(cut), evidence: null };
    const payday = PaydayAnswers.payday(message);
    if (payday && result && resultCalc && resultCalc.data.kind === "calculation" && PaydayAnswers.isCashFlowStage(resultCalc)) {
      result = { ...result, detail: PaydayAnswers.paydayDetail(payday, resultCalc.data.resultValue) ?? result.detail };
    }

    // How this was worked out: what Sisu noticed, the transactions, every calculation's steps; with no calculation,
    // the figures the answer rests on.
    const how: HowBlock[] = [];
    if (leadStage && leadStage.data.kind === "lead" && leadStage.data.patterns.length > 0) {
      how.push({ id: leadStage.id, title: pick(language, "What stands out in your transactions", "Mikä erottuu tapahtumistasi"), evidence: null,
        lines: StagePresenter.card(leadStage, language, timeZone).lines.map((line) => CardLine.make(h(line.label), line.value, line.detail ? h(line.detail) : null)) });
    }
    for (const stage of evidence) {
      if (stage.data.kind !== "evidence") continue;
      // The result card already shows this stage's total and count: its working starts with the largest payments.
      const lines = StagePresenter.card(stage, language, timeZone).lines.slice(stage === resultEvidence ? 1 : 0);
      if (lines.length === 0) continue;
      how.push({ id: stage.id, title: h(stage.title) || pick(language, "From your transactions", "Tapahtumistasi"), lines, evidence: { title: h(stage.title), filter: stage.data.filter } });
    }
    for (const stage of calcs) {
      const block = Working.calcBlock(stage, stage === resultCalc, language, timeZone);
      if (block) how.push(block);
    }
    const saving = monthly && monthly.data.kind === "impact" ? Working.savingBlock(monthly, monthly.data.impact.monthlyEur, language, timeZone) : null;
    if (saving) how.push(saving);
    const factsBlock = message.stages.some((stage) => stage.data.kind === "calculation") ? null
      : Working.factsBlock(message, result, language, timeZone, how.flatMap((block) => block.lines.flatMap((line) => Working.numbers(line.value))));
    if (factsBlock) how.push(factsBlock);
    // A chart kind this app cannot draw is only words (its title and summary): those go with the working.
    for (const visual of message.visuals.filter((one) => one.content.kind === "unknown" && one.summary !== "")) {
      how.push({ id: `visual-${visual.id}`, title: h(visual.title), evidence: null, lines: [CardLine.make(h(visual.summary), null, visual.caption ? h(visual.caption) : null)] });
    }

    const assumptions = Working.uniqueText([
      ...calcs.flatMap((stage) => (stage.data.kind === "calculation" ? stage.data.assumptions : [])),
      ...(research?.assumptions ?? []),
      ...actions.flatMap((action) => action.assumptions ?? []),
    ].map(h)).map((item) => Working.withoutCardText(item, result?.detail)).filter((item) => !Working.sameText(item, result?.detail));

    const sources: AnswerSource[] = [];
    const addSource = (title: string, url: string, at: string | null | undefined) => {
      if (url === "" || sources.some((one) => one.url === url)) return;
      sources.push({ title: title || url, url, fetched: at ? CoachText.fetched(at, language, timeZone) : null });
    };
    for (const group of groups) {
      if (group.researchStage?.data.kind === "research") for (const page of group.researchStage.data.pages) addSource(page.title, page.url, page.retrievedAt || group.researchStage.data.retrievedAt);
    }
    for (const citation of [...(research?.citations ?? []), ...message.citations, ...actions.flatMap((a) => a.sources ?? [])]) addSource(citation.title, citation.url, citation.retrievedAt);

    const hasOffers = groups.length > 0;
    const visuals = message.visuals.filter((visual) => {
      switch (visual.content.kind) {
        case "unknown": return false;
        case "offerBars": return !hasOffers;
        case "futuresLines": return !noMatch && !cutOnly && impact == null && !actions.some((a) => a.impact);
        case "waterfall": return calcs.length === 0;
        default: return true;
      }
    });

    const synthetic = Working.backedFacts(message).some(SourceTags.isPeerFact) || SourceTags.comparesWithPeers(message.text) ? SourceTags.synthetic(language) : null;
    if (result && synthetic) result = { ...result, tags: SourceTags.unique([...result.tags, synthetic]) };
    const tags = SourceTags.unique([
      webTag,
      ...message.facts.map((fact) => SourceTags.of(fact.source, language)),
      ...message.stages.map((stage) => SourceTags.of(stage.source, language)),
      ...visuals.map((visual) => (SourceTags.isSynthetic(visual) ? SourceTags.synthetic(language) : SourceTags.of(visual.source, language))),
      synthetic,
      actions.some((a) => a.simulated !== false) ? SourceTags.simulated(language) : null,
      isMock ? SourceTags.mock(language) : null,
    ]);

    // The bill now is said once: on the result card ("Nothing cheaper today") or in the offers, not in both.
    const sections = OfferGroups.sections(message, groups, language, timeZone)
      .map((section) => (Working.sameText(section.baseline, result?.detail) ? { ...section, baseline: null } : section));
    const requirement = withOffers.find((group) => group.requirement != null)?.requirement ?? null;
    const offers: AnswerOffers | null = sections.length > 0 ? {
      rows: sections.flatMap((section) => section.rows), sections,
      requirement: Working.sameText(requirement, result?.detail) ? null : requirement,
    } : null;

    const mismatchedActionIds = actions.filter((action) => rawOf(action.kind) === "switch_contract"
      && ((action.offer != null && OfferPresenter.qualifies(action.offer) === false) || noMatch)).map((action) => action.id);

    const futures = impact && impact.data.kind === "impact" && !cutOnly
      ? Working.futures(impact.data.impact, monthly != null, Working.asksInvesting(question), result, language, timeZone) : null;
    const shown = Working.shownNumbers(message.text, result, how);
    const said = { shown, noMatch: noMatch ? result?.label ?? null : null, monthly: monthly != null };
    const steps = message.pending ? [] : StepPresenter.rows(message, language, timeZone).map((row) => ({
      ...row, label: h(row.label), result: stepResult(row.result, said, h),
    }));
    const grounding = message.grounding && !(noMatch && !/\d/.test(message.text)) ? GroundingPresenter.line(message.grounding, language) : null;
    return {
      result, offers, how, futures, steps,
      timing: message.timings ? ToolPresenter.timingLine(message.timings, language) : null,
      assumptions, sources, tags, grounding, noMatch, visuals, mismatchedActionIds,
      lesson: message.pending || noMatch ? null : PaydayAnswers.lesson(message),
      scenarioDated: cut !== null || payday !== null || message.stages.some(PaydayAnswers.isCashFlowStage),
      hiddenActionIds: cutOnly ? actions.filter((action) => ["standing_transfer", "one_off_transfer"].includes(rawOf(action.kind))).map((action) => action.id) : [],
    };
  }

  /** A tool's one-line result, unless it only repeats numbers the answer already says. With no matching offer, the
   *  server's "best saves …" (chosen without the requirements) and its "No matching options found (…)" (the card's
   *  own words) are left out; with a monthly saving leading, so is "projected over 5 years". */
  function stepResult(line: string | null, said: { shown: readonly number[]; noMatch: string | null; monthly: boolean }, h: (text: string) => string): string | null {
    const part = (head: string) => new RegExp(`[;,]\\s*${head}[^;·]*?(?=\\s*(?:[;·]|$))`, "i");
    let kept = line;
    if (kept && said.noMatch != null) kept = kept.replace(part("best saves "), "").replace(part(said.noMatch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "");
    if (kept && said.monthly) kept = kept.replace(part("projected over "), "");
    return kept == null || kept.trim() === "" || Working.onlyRepeats(kept, said.shown) ? null : h(kept);
  }

  /** `Web · Context.dev · 15 Nov 2026, 02:43`: what read a group's offers, and when. */
  function webTagOf(group: OfferGroup, language: SisuLanguage, timeZone: string): SourceTag {
    const stage = group.researchStage?.data.kind === "research" ? group.researchStage.data : null;
    const extraction = group.extraction?.data.kind === "extraction" ? group.extraction.data : null;
    const at = group.research?.finishedAt ?? group.research?.startedAt ?? stage?.retrievedAt ?? null;
    const by = group.research?.citations.find((c) => c.readBy)?.readBy ?? extraction?.extractedWith ?? stage?.pages.find((p) => p.readBy)?.readBy ?? null;
    return SourceTags.web(by ?? "context.dev", at, language, timeZone);
  }
}
