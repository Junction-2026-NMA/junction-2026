/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// The offers of one answer, one group per bill researched in the turn (web addition, QA of 15 Nov). A turn can
// research several bills ("Find a cheaper plan that meets my needs" searched electricity, mobile and internet):
// each search sends a research stage, an extraction stage and a "Saving with …" calculation with the same tool call
// id, while the session keeps only the last research result. Grouping the stages keeps a saving and the offer it is
// about together, so the result never pairs one bill's saving with another bill's offer, and "Offers compared"
// lists every bill. The user's requirements apply to every group (read from the question when the backend sent
// none). Nothing here computes a figure.
import { AskedRequirements } from "./AnswerRequirements";
import type { Offer, ResearchResult, Stage } from "./CoachModels";
import { CoachText, OfferPresenter, type OfferRow } from "./CoachPresentation";
import type { CoachMessage } from "./CoachSession";
import { Dates, Money, jsonEqual, type SisuLanguage } from "./Presentation";

const pick = CoachText.pick;

export interface OfferGroup {
  /** The tool call id of the search, or `group-<n>` without one. */
  id: string;
  billType: string | null;
  /** The research result of this bill, with the requirements applied; only one group has it (the last search). */
  research: ResearchResult | null;
  researchStage: Stage | null;
  extraction: Stage | null;
  /** The "Saving with …" calculation of this bill. */
  calc: Stage | null;
  /** The offers, judged against the requirements. */
  offers: Offer[];
  best: Offer | null;
  /** The offer the calculation is about. */
  calcOffer: Offer | null;
  /** True when none of this bill's offers meets the requirements. */
  noMatch: boolean;
  /** The calculation may be shown: it is about an offer that meets the requirements. */
  calcShown: boolean;
  /** `You asked for a contract of 12 months or less.`, or null. */
  requirement: string | null;
}

/** One bill's part of "Offers compared". */
export interface OfferSection {
  id: string;
  /** `Electricity offers` when the answer compared several bills; null for a single one. */
  title: string | null;
  rows: OfferRow[];
  baseline: string | null;
  fetched: string | null;
  problems: string[];
  pagesNote: string | null;
  noMatch: boolean;
}

interface Draft { id: string; researchStage: Stage | null; extraction: Stage | null; calc: Stage | null }

const isSaving = (stage: Stage) => /^saving with /i.test(stage.title.trim());

export namespace OfferGroups {
  /** The groups of an answer, in the order the bills arrived. */
  export function of(message: CoachMessage, question = ""): OfferGroup[] {
    const drafts = draftsOf(message.stages);
    const research = message.research;
    if (drafts.length === 0 && research == null) return [];
    if (drafts.length === 0) drafts.push({ id: "research", researchStage: null, extraction: null, calc: null });
    const owner = research == null ? null
      : drafts.find((d) => billOf(message, d) === research.billType)
        ?? drafts.find((d) => research.best != null && extracted(d).some((offer) => jsonEqual(offer, research.best)))
        ?? drafts[drafts.length - 1];
    const single = drafts.length === 1;
    return drafts.map((draft) => group(message, draft, draft === owner ? research : null, question, single));
  }

  /** The saving a group leads with, a year: its calculation's, or else its best offer's. */
  export function savingOf(group: OfferGroup): number | null {
    if (group.calcShown && group.calc?.data.kind === "calculation") {
      const data = group.calc.data;
      return data.unit === "EUR/month" ? data.resultValue * 12 : data.resultValue;
    }
    const saving = group.best?.estimatedYearlySavingEur;
    return group.best != null && OfferPresenter.qualifies(group.best) !== false && saving != null && Number.isFinite(saving) ? saving : null;
  }

  /** The group the result card leads with: the only one with a saving to show, or the largest saving (which the
   *  answer leads with when it compared several bills). Null when no group has one. */
  export function lead(groups: readonly OfferGroup[]): OfferGroup | null {
    const open = groups.filter((group) => !group.noMatch && (group.calcShown || (savingOf(group) ?? 0) > 0));
    if (open.length <= 1) return open[0] ?? null;
    return open.reduce((best, next) => ((savingOf(next) ?? -Infinity) > (savingOf(best) ?? -Infinity) ? next : best));
  }

  /** "Offers compared", one section per bill, each with its own bill now, its rows and where they were read. */
  export function sections(message: CoachMessage, groups: readonly OfferGroup[], language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): OfferSection[] {
    const several = groups.filter((group) => group.offers.length > 0).length > 1;
    return groups.filter((group) => group.offers.length > 0).map((group) => {
      const extraction = group.extraction?.data.kind === "extraction" ? group.extraction.data : null;
      const stage = group.researchStage?.data.kind === "research" ? group.researchStage.data : null;
      return {
        id: group.id,
        title: several ? billTitle(group.billType, language) : null,
        rows: rows(group, language),
        baseline: baselineText(baselineOf(message, group), language),
        fetched: group.research ? OfferPresenter.fetchedNote(group.research, language, timeZone)
          : stage ? CoachText.fetched(stage.retrievedAt, language, timeZone) + (stage.mock ? " · " + CoachText.mockDataTag(language) : "") : null,
        problems: [...(group.research?.errors ?? []), ...(extraction?.problems ?? [])],
        pagesNote: extraction ? pick(language, `Pages read: ${extraction.pagesRead} of ${extraction.pagesTotal}`, `Luetut sivut: ${extraction.pagesRead}/${extraction.pagesTotal}`) : null,
        noMatch: group.noMatch,
      };
    });
  }

  /** `With Valoo (Netti L 1000M)`: the offer a group's saving is about. */
  export function withOffer(group: OfferGroup, language: SisuLanguage = "en"): string {
    const offer = group.calcOffer ?? group.best;
    const fromTitle = group.calc ? group.calc.title.trim().replace(/^saving with\s+/i, "") : "";
    const name = offer ? `${offer.provider}${offer.plan ? ` (${offer.plan})` : ""}` : fromTitle;
    const incomplete = offer != null && OfferPresenter.feesUnknown(offer)
      ? pick(language, ". Some fees are unknown, so this saving is incomplete.", ". Osa maksuista ei ole tiedossa, joten säästö on vajaa.") : "";
    return pick(language, `With ${name}`, name) + incomplete;
  }
}

// MARK: - Building the groups

/** Research, extraction and "Saving with …" stages, grouped by tool call id, else in arrival order. */
function draftsOf(stages: readonly Stage[]): Draft[] {
  const drafts: Draft[] = [];
  stages.forEach((stage, index) => {
    const kind = stage.data.kind;
    if (kind !== "research" && kind !== "extraction" && kind !== "calculation") return;
    const key = stage.toolCallId ?? null;
    let draft = key != null ? drafts.find((one) => one.id === key) : undefined;
    if (kind === "calculation") {
      if (!draft && isSaving(stage)) draft = [...drafts].reverse().find((one) => one.calc == null);
      if (draft && draft.calc == null) draft.calc = stage;
      return;
    }
    if (!draft && key == null && kind === "extraction") draft = [...drafts].reverse().find((one) => one.extraction == null && one.calc == null);
    if (!draft) {
      draft = { id: key ?? `group-${index}`, researchStage: null, extraction: null, calc: null };
      drafts.push(draft);
    }
    if (kind === "research" && draft.researchStage == null) draft.researchStage = stage;
    if (kind === "extraction" && draft.extraction == null) draft.extraction = stage;
  });
  return drafts;
}

const extracted = (draft: Draft): Offer[] => (draft.extraction?.data.kind === "extraction" ? draft.extraction.data.offers : []);

/** The bill a search was for: the tool call's arguments, else the research stage's title. */
function billOf(message: CoachMessage, draft: Draft): string | null {
  const args = message.tools.find((trace) => trace.id === draft.id)?.args;
  const fromArgs = args != null && typeof args === "object" && !Array.isArray(args) && typeof args.billType === "string" ? args.billType : null;
  return fromArgs ?? /today's (\w+) offers/i.exec(draft.researchStage?.title ?? "")?.[1]?.toLowerCase() ?? null;
}

function group(message: CoachMessage, draft: Draft, research: ResearchResult | null, question: string, single: boolean): OfferGroup {
  const judged = research ? AskedRequirements.apply(research, question) : null;
  const raw = research?.offers ?? extracted(draft);
  const inferred = judged ? null : AskedRequirements.judgeOffers(raw, question);
  const offers = judged?.offers ?? inferred ?? raw;
  const index = draft.calc ? calcOfferIndex(draft.calc, raw, research?.best ?? null) : -1;
  const calcOffer = index >= 0 ? offers[index] ?? null : null;
  const text = single ? message.text : "";
  const flags = offers.map(OfferPresenter.qualifies);
  const noMatch = offers.length > 0 && (judged
    ? OfferPresenter.noMatch(judged, text)
    : (flags.some((flag) => flag !== null) && !flags.some((flag) => flag === true)) || (inferred == null && OfferPresenter.textSaysNoMatch(text)));
  const best = judged ? judged.best ?? null : inferred ? AskedRequirements.best(offers) : calcOffer;
  const max = inferred ? AskedRequirements.maxContractMonths(question) : null;
  const requirement = judged ? OfferPresenter.requirementText(judged)
    : max != null ? OfferPresenter.requirementText({ requirements: { maxContractMonths: max } } as unknown as ResearchResult) : null;
  return {
    id: draft.id, billType: research?.billType ?? billOf(message, draft), research: judged, researchStage: draft.researchStage,
    extraction: draft.extraction, calc: draft.calc, offers, best, calcOffer, noMatch,
    calcShown: draft.calc != null && !noMatch && !(calcOffer != null && OfferPresenter.qualifies(calcOffer) === false),
    requirement,
  };
}

/** Which offer a "Saving with <provider>" calculation is about: the research's best when it is that provider,
 *  else the provider's offer whose yearly saving is the calculation's result. -1 when none is found. */
function calcOfferIndex(calc: Stage, offers: readonly Offer[], best: Offer | null): number {
  const name = calc.title.trim().replace(/^saving with\s+/i, "").toLowerCase();
  if (best != null && best.provider.toLowerCase() === name) {
    const at = offers.findIndex((offer) => jsonEqual(offer, best));
    if (at >= 0) return at;
  }
  const value = calc.data.kind === "calculation" ? calc.data.resultValue : NaN;
  const same = offers.map((offer, at) => ({ offer, at })).filter(({ offer }) => offer.provider.toLowerCase() === name);
  return (same.find(({ offer }) => offer.estimatedYearlySavingEur != null && Math.abs(offer.estimatedYearlySavingEur - value) < 0.005) ?? same[0])?.at ?? -1;
}

// MARK: - Sections

function rows(group: OfferGroup, language: SisuLanguage): OfferRow[] {
  if (group.research) return OfferPresenter.rows(group.research, language, group.noMatch);
  const all = group.offers.map((offer) => OfferPresenter.row(offer, !group.noMatch && group.best != null && jsonEqual(group.best, offer), language));
  return [...all.filter((row) => row.meets !== false), ...all.filter((row) => row.meets === false)];
}

/** The bill now: the research's baseline, else the calculation's "Your bill" step, else the offer chart's. */
function baselineOf(message: CoachMessage, group: OfferGroup): number | null {
  if (group.research?.baselineMonthlyEur != null) return group.research.baselineMonthlyEur;
  const step = group.calc?.data.kind === "calculation" ? group.calc.data.steps.find((one) => /^your (current )?bill\b/i.test(one.label.trim())) : undefined;
  if (step && Number.isFinite(step.amount)) return step.amount;
  const chart = message.visuals.find((visual) => visual.content.kind === "offerBars" && group.billType != null && visual.id === `offers:${group.billType}`);
  return chart?.content.kind === "offerBars" && Number.isFinite(chart.content.currentMonthlyEur) ? chart.content.currentMonthlyEur : null;
}

function baselineText(amount: number | null, language: SisuLanguage): string | null {
  if (amount == null) return null;
  const text = Money.format(amount, language) + OfferPresenter.monthly(language);
  return pick(language, `Your bill now: about ${text}`, `Laskusi nyt: noin ${text}`);
}

function billTitle(billType: string | null, language: SisuLanguage): string {
  switch (billType) {
    case "electricity": return pick(language, "Electricity offers", "Sähkötarjoukset");
    case "mobile": return pick(language, "Mobile offers", "Liittymätarjoukset");
    case "internet": return pick(language, "Internet offers", "Nettitarjoukset");
    case null: return pick(language, "Other offers", "Muut tarjoukset");
    default: return pick(language, `${billType.charAt(0).toUpperCase()}${billType.slice(1)} offers`, billType);
  }
}
