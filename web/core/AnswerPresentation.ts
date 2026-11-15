/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// What one answer shows, worked out once (web addition of the 15 Nov rework, no Swift counterpart yet): one short
// result with the most useful number, then the details behind it, each said once: how it was worked out, the
// assumptions, and the sources with labels that tell bank data, the user's input, the web, estimates, simulations
// and the synthetic demo comparison apart. Every figure comes from the payload; nothing here computes a new one.
import type { EvidenceFilter } from "./Models";
import type { AgentAction, Offer, ResearchResult, Stage } from "./CoachModels";
import type { CoachMessage } from "./CoachSession";
import type { Visual } from "./PlanModels";
import { CardLine, CoachText, FuturesPresenter, GroundingPresenter, OfferPresenter, StagePresenter, ToolPresenter } from "./CoachPresentation";
import type { FuturesSeries, GroundingLine, OfferRow } from "./CoachPresentation";
import { StepPresenter, type StepRow } from "./ChartPresentation";
import { Dates, Money, rawOf, roundAway, type SisuLanguage } from "./Presentation";

const pick = CoachText.pick;

// MARK: - Text from the server, made readable

export namespace CardText {
  /** ISO dates become `25 Oct 2026` (with a time, `15 Nov 2026, 01:44` in the viewer's zone), and a hyphen used as
   *  a minus beside a euro amount becomes a real minus: `€-325.50` and `-€325.50` both read `−€325.50`. */
  export function humanize(text: string, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): string {
    if (text === "") return text;
    return text
      .replace(/\b(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z| ?UTC|[+-]\d{2}:?\d{2})?/g,
        (whole, date: string, hh: string, mm: string, zone: string | undefined) => {
          if (zone == null) return `${Dates.short(date, language)}, ${hh}:${mm}`;
          const offset = zone.trim() === "UTC" || zone === "Z" ? "Z" : zone.length === 5 ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone;
          const moment = `${date}T${hh}:${mm}:00${offset}`;
          const shown = Dates.shortDateTime(moment, language, timeZone);
          return shown === moment ? whole : shown;
        })
      .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (date: string) => Dates.short(date, language))
      .replace(/€-(?=\d)/g, Money.minus + "€")
      .replace(/(^|[\s(])-€(?=\d)/g, `$1${Money.minus}€`);
  }
}

const human = (text: string | null | undefined, language: SisuLanguage, timeZone: string): string => CardText.humanize(text ?? "", language, timeZone).trim();

// MARK: - Source labels

export type SourceKind = "bank" | "input" | "web" | "estimate" | "synthetic" | "simulated" | "mock";
export interface SourceTag { kind: SourceKind; label: string }

const ORDER: readonly SourceKind[] = ["bank", "input", "web", "estimate", "synthetic", "simulated", "mock"];

export namespace SourceTags {
  export function bank(language: SisuLanguage = "en"): SourceTag { return { kind: "bank", label: pick(language, "Bank data", "Pankkitiedot") }; }
  export function input(language: SisuLanguage = "en"): SourceTag { return { kind: "input", label: pick(language, "Your input", "Kertomasi") }; }
  export function estimate(language: SisuLanguage = "en"): SourceTag { return { kind: "estimate", label: pick(language, "Estimate", "Arvio") }; }
  export function simulated(language: SisuLanguage = "en"): SourceTag { return { kind: "simulated", label: pick(language, "Simulated", "Simuloitu") }; }
  export function mock(language: SisuLanguage = "en"): SourceTag { return { kind: "mock", label: CoachText.mockDataTag(language) }; }
  export function synthetic(language: SisuLanguage = "en"): SourceTag {
    return { kind: "synthetic", label: pick(language, "Synthetic demo data comparison", "Vertailu synteettiseen demodataan") };
  }
  /** `Web · Exa · 15 Nov 2026, 01:44`: what was read, by what, and when. */
  export function web(by: string | null, retrievedAt: string | null, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): SourceTag {
    const parts = [pick(language, "Web", "Verkko"), by ? provider(by) : null, retrievedAt ? Dates.shortDateTime(retrievedAt, language, timeZone) : null];
    return { kind: "web", label: parts.filter((part): part is string => part != null && part !== "").join(" · ") };
  }

  export function provider(raw: string): string {
    switch (raw.toLowerCase()) {
      case "exa": return "Exa";
      case "context.dev": return "Context.dev";
      case "exa+context.dev": return "Exa and Context.dev";
      default: return raw;
    }
  }

  /** The label for a `Fact.source`, `Stage.source` or `Visual.source`; null for one that says nothing to a person. */
  export function of(source: string, language: SisuLanguage = "en"): SourceTag | null {
    const raw = source.toLowerCase();
    if (raw === "") return null;
    if (raw.includes("synthetic") || raw.includes("peer")) return synthetic(language);
    switch (raw) {
      case "bank-data": case "finance": return bank(language);
      case "customer-stated": return input(language);
      case "exa": case "context.dev": case "exa+context.dev": return web(raw, null, language);
      case "calculation": case "assumption": case "nemotron": return estimate(language);
      default: return null;
    }
  }

  /** A peer chart compares with other customers of the synthetic demo dataset, never real statistics. */
  export function isSynthetic(visual: Visual): boolean {
    return visual.synthetic === true || visual.kind === "peer_bars" || visual.content.kind === "peerBars" || /synthetic|peer/i.test(visual.source);
  }

  /** One of each kind, in a fixed order (bank data first, mock data last); the first label of a kind wins. */
  export function unique(tags: readonly (SourceTag | null)[]): SourceTag[] {
    const kept = new Map<SourceKind, SourceTag>();
    for (const tag of tags) if (tag && !kept.has(tag.kind)) kept.set(tag.kind, tag);
    return ORDER.flatMap((kind) => (kept.has(kind) ? [kept.get(kind)!] : []));
  }
}

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

export interface AnswerOffers { rows: OfferRow[]; baseline: string | null; requirement: string | null; fetched: string | null; problems: string[]; pagesNote: string | null }

export interface AnswerView {
  result: AnswerResult | null;
  offers: AnswerOffers | null;
  how: HowBlock[];
  futures: { series: FuturesSeries[]; summary: string } | null;
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
}

const isOfferCalc = (stage: Stage, extraction: Stage | undefined): boolean =>
  stage.kind === "calculation" && ((extraction?.toolCallId != null && stage.toolCallId === extraction.toolCallId) || /^saving with /i.test(stage.title));

export function messageActions(message: CoachMessage): AgentAction[] {
  const staged = message.stages.flatMap((stage) => (stage.data.kind === "action" ? [stage.data.action] : []));
  return message.action && !staged.some((one) => one.id === message.action!.id) ? [...staged, message.action] : staged;
}

function uniqueText(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().replace(/[.\s]+$/g, "").replace(/\s+/g, " ");
    if (item === "" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export namespace AnswerPresenter {
  export function view(message: CoachMessage, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): AnswerView {
    const h = (text: string | null | undefined) => human(text, language, timeZone);
    const research: ResearchResult | null = message.research;
    const extraction = message.stages.find((stage) => stage.data.kind === "extraction");
    const offerList: Offer[] = research?.offers ?? (extraction?.data.kind === "extraction" ? extraction.data.offers : []);
    const hasOffers = offerList.length > 0 || research != null;
    const noMatch = hasOffers && offerList.length > 0 && (research
      ? OfferPresenter.noMatch(research, message.text)
      : (offerList.some((o) => OfferPresenter.qualifies(o) != null) && !offerList.some((o) => OfferPresenter.qualifies(o) === true)) || OfferPresenter.textSaysNoMatch(message.text));
    const hidden = (stage: Stage) => noMatch && (isOfferCalc(stage, extraction) || stage.kind === "impact");
    const calcs = message.stages.filter((stage) => stage.data.kind === "calculation" && !hidden(stage));
    const impact = message.stages.find((stage) => stage.data.kind === "impact" && !hidden(stage));
    const lead = message.stages.find((stage) => stage.data.kind === "lead");
    const evidence = message.stages.filter((stage) => stage.data.kind === "evidence");
    const researchStage = message.stages.find((stage) => stage.data.kind === "research");
    const fetchedAt = research?.finishedAt ?? research?.startedAt ?? (researchStage?.data.kind === "research" ? researchStage.data.retrievedAt : null);
    const webBy = research?.citations.find((c) => c.readBy)?.readBy ?? (extraction?.data.kind === "extraction" ? extraction.data.extractedWith ?? null : null);
    const webTag = hasOffers ? SourceTags.web(webBy ?? "context.dev", fetchedAt, language, timeZone) : null;
    const isMock = research?.mock === true || (researchStage?.data.kind === "research" && researchStage.data.mock);
    const best = research?.best ?? null;
    const actions = messageActions(message);

    // The result: the first thing that holds the most useful number.
    let result: AnswerResult | null = null;
    const firstCalc = calcs[0];
    if (noMatch) {
      const requirement = research ? OfferPresenter.requirementText(research, language) : null;
      const count = offerList.length;
      result = { label: OfferPresenter.headline(research ?? ({} as ResearchResult), language, true), value: null, noMatch: true, evidence: null,
        detail: requirement ?? pick(language, `None of the ${count} ${count === 1 ? "offer" : "offers"} Sisu compared meets what you asked for.`, `Yksikään ${count} vertaillusta tarjouksesta ei täytä toiveitasi.`),
        tags: SourceTags.unique([webTag, isMock ? SourceTags.mock(language) : null]) };
    } else if (firstCalc && firstCalc.data.kind === "calculation") {
      const data = firstCalc.data;
      const value = CoachText.value(data.resultValue, data.unit, language);
      const offerCalc = isOfferCalc(firstCalc, extraction) && best != null;
      const detail = offerCalc
        ? pick(language, `With ${best.provider}${best.plan ? ` (${best.plan})` : ""}`, `${best.provider}${best.plan ? ` (${best.plan})` : ""}`)
          + (OfferPresenter.feesUnknown(best) ? pick(language, ". Some fees are unknown, so this saving is incomplete.", ". Osa maksuista ei ole tiedossa, joten säästö on vajaa.") : "")
        : summaryUnlessRepeat(h(firstCalc.summary), value, h(data.resultLabel));
      result = { label: h(data.resultLabel), value, detail, noMatch: false, evidence: null,
        tags: SourceTags.unique([SourceTags.of(firstCalc.source, language), ...firstCalc.facts.map((f) => SourceTags.of(f.source, language)), offerCalc ? webTag : null, offerCalc && isMock ? SourceTags.mock(language) : null]) };
    } else if (research != null) {
      const saving = best?.estimatedYearlySavingEur;
      const fits = best != null && OfferPresenter.qualifies(best) !== false && saving != null && roundAway(saving) > 0;
      result = { label: fits ? pick(language, `Estimated saving with ${best!.provider}`, `Arvioitu säästö: ${best!.provider}`) : OfferPresenter.headline(research, language),
        value: fits ? CoachText.value(roundAway(saving!), "EUR/year", language) : null,
        detail: fits && OfferPresenter.feesUnknown(best!) ? pick(language, "Some fees are unknown, so this saving is incomplete.", "Osa maksuista ei ole tiedossa, joten säästö on vajaa.") : OfferPresenter.baseline(research, language),
        noMatch: false, evidence: null, tags: SourceTags.unique([webTag, SourceTags.estimate(language), isMock ? SourceTags.mock(language) : null]) };
    } else if (impact && impact.data.kind === "impact") {
      const years = impact.data.impact.horizonYears;
      result = { label: pick(language, `More after ${CoachText.number(years, 1, language)} ${years === 1 ? "year" : "years"} if you keep it`, `Enemmän ${CoachText.number(years, 1, language)} vuoden jälkeen`),
        value: Money.format(impact.data.impact.gainVsNothingEur, language), detail: null, noMatch: false, evidence: null, tags: [SourceTags.estimate(language)] };
    } else if (lead && lead.data.kind === "lead" && lead.data.patterns[0]?.yearlyImpactEur != null) {
      const top = lead.data.patterns[0];
      result = { label: h(top.title), value: pick(language, "About ", "Noin ") + CoachText.value(roundAway(top.yearlyImpactEur!), "EUR/year", language),
        detail: null, noMatch: false, evidence: { title: h(top.title), filter: top.evidence }, tags: [SourceTags.bank(language)] };
    } else if (evidence[0] && evidence[0].data.kind === "evidence") {
      const data = evidence[0].data;
      result = { label: h(evidence[0].title) || pick(language, "From your transactions", "Tapahtumistasi"), value: Money.format(data.totalEur, language, true),
        detail: pick(language, data.count === 1 ? "1 transaction" : `${data.count} transactions`, `${data.count} tapahtumaa`), noMatch: false,
        evidence: { title: h(evidence[0].title), filter: data.filter }, tags: [SourceTags.bank(language)] };
    }

    // How this was worked out: what Sisu noticed, the transactions, every calculation's steps.
    const how: HowBlock[] = [];
    if (lead && lead.data.kind === "lead" && lead.data.patterns.length > 0) {
      how.push({ id: lead.id, title: pick(language, "What stands out in your transactions", "Mikä erottuu tapahtumistasi"), evidence: null,
        lines: StagePresenter.card(lead, language, timeZone).lines.map((line) => CardLine.make(h(line.label), line.value, line.detail ? h(line.detail) : null)) });
    }
    for (const stage of evidence) {
      if (stage.data.kind !== "evidence") continue;
      const lines = StagePresenter.card(stage, language, timeZone).lines;
      how.push({ id: stage.id, title: h(stage.title) || pick(language, "From your transactions", "Tapahtumistasi"), lines, evidence: { title: h(stage.title), filter: stage.data.filter } });
    }
    for (const stage of calcs) {
      if (stage.data.kind !== "calculation") continue;
      const isResult = stage === firstCalc && !noMatch;
      const resultLabel = stage.data.resultLabel.trim().toLowerCase();
      const resultValue = stage.data.resultValue;
      // The result card already shows the result: a last step that only restates it is left out of the working.
      const shown = stage.data.steps.filter((step, index, all) => !(isResult && index === all.length - 1
        && step.label.trim().toLowerCase() === resultLabel && Math.abs(step.amount - resultValue) < 0.005));
      const steps = StagePresenter.lines(shown, language).map((line) => CardLine.make(h(line.label), line.value, line.detail ? h(line.detail) : null));
      const total = isResult ? [] : [CardLine.make(h(stage.data.resultLabel), CoachText.value(stage.data.resultValue, stage.data.unit, language))];
      how.push({ id: stage.id, title: h(stage.title).replace(/^Worked out:\s*/i, ""), lines: [...steps, ...total], evidence: null });
    }

    const assumptions = uniqueText([
      ...calcs.flatMap((stage) => (stage.data.kind === "calculation" ? stage.data.assumptions : [])),
      ...(research?.assumptions ?? []),
      ...actions.flatMap((action) => action.assumptions ?? []),
    ].map(h));

    const sources: AnswerSource[] = [];
    const addSource = (title: string, url: string, at: string | null | undefined) => {
      if (url === "" || sources.some((one) => one.url === url)) return;
      sources.push({ title: title || url, url, fetched: at ? CoachText.fetched(at, language, timeZone) : null });
    };
    if (researchStage?.data.kind === "research") for (const page of researchStage.data.pages) addSource(page.title, page.url, page.retrievedAt || researchStage.data.retrievedAt);
    for (const citation of [...(research?.citations ?? []), ...message.citations, ...actions.flatMap((a) => a.sources ?? [])]) addSource(citation.title, citation.url, citation.retrievedAt);

    // A chart kind this app cannot draw is only words (its title and summary): those go with the working.
    for (const visual of message.visuals.filter((one) => one.content.kind === "unknown" && one.summary !== "")) {
      how.push({ id: `visual-${visual.id}`, title: h(visual.title), evidence: null, lines: [CardLine.make(h(visual.summary), null, visual.caption ? h(visual.caption) : null)] });
    }
    const visuals = message.visuals.filter((visual) => {
      switch (visual.content.kind) {
        case "unknown": return false;
        case "offerBars": return !hasOffers;
        case "futuresLines": return !noMatch && impact == null && !actions.some((a) => a.impact);
        case "waterfall": return calcs.length === 0;
        default: return true;
      }
    });

    const tags = SourceTags.unique([
      ...message.facts.map((fact) => SourceTags.of(fact.source, language)),
      ...message.stages.map((stage) => SourceTags.of(stage.source, language)),
      ...visuals.map((visual) => (SourceTags.isSynthetic(visual) ? SourceTags.synthetic(language) : SourceTags.of(visual.source, language))),
      webTag,
      actions.some((a) => a.simulated !== false) ? SourceTags.simulated(language) : null,
      isMock ? SourceTags.mock(language) : null,
    ]);

    const offers: AnswerOffers | null = offerList.length > 0 ? {
      rows: research ? OfferPresenter.rows(research, language, noMatch) : offerList.map((offer) => OfferPresenter.row(offer, false, language)),
      baseline: research ? OfferPresenter.baseline(research, language) : null,
      requirement: research ? OfferPresenter.requirementText(research, language) : null,
      fetched: research ? OfferPresenter.fetchedNote(research, language, timeZone) : null,
      problems: [...(research?.errors ?? []), ...(extraction?.data.kind === "extraction" ? extraction.data.problems : [])],
      pagesNote: extraction?.data.kind === "extraction" ? pick(language, `Pages read: ${extraction.data.pagesRead} of ${extraction.data.pagesTotal}`, `Luetut sivut: ${extraction.data.pagesRead}/${extraction.data.pagesTotal}`) : null,
    } : null;

    const mismatchedActionIds = actions.filter((action) => rawOf(action.kind) === "switch_contract"
      && ((action.offer != null && OfferPresenter.qualifies(action.offer) === false) || noMatch)).map((action) => action.id);

    return {
      result, offers, how,
      futures: impact && impact.data.kind === "impact" ? { series: FuturesPresenter.series(impact.data.impact, language), summary: h(impact.data.impact.summary) } : null,
      steps: message.pending ? [] : StepPresenter.rows(message, language).map((row) => ({ ...row, result: row.result ? h(row.result) : null })),
      timing: message.timings ? ToolPresenter.timingLine(message.timings, language) : null,
      assumptions, sources, tags,
      grounding: message.grounding ? GroundingPresenter.line(message.grounding, language) : null,
      noMatch, visuals, mismatchedActionIds,
    };
  }

  /** A calculation's summary, unless it only repeats the value or the label. */
  function summaryUnlessRepeat(summary: string, value: string, label: string): string | null {
    if (summary === "" || summary === label) return null;
    const bare = value.replace(/ a (month|year)$/, "");
    const whole = bare.replace(/[.,]\d{2}$/, "");
    return summary.includes(bare) || summary.includes(whole) || /=/.test(summary) ? null : summary;
  }
}
