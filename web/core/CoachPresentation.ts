/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/CoachPresentation.swift. Pure helpers that turn coach payloads into the exact strings and
// numbers a screen shows, so views hold no arithmetic and no formatting. Copy rules are those of ios/BRAND.md:
// number first, no blame, "about" for estimates. Every figure comes from the payload; nothing here recomputes a
// saving. Optional Swift outputs are `T | null` here; optional inputs accept `null` or `undefined`.
import type { CalcStep, RecurringBill, ScenarioResponse } from "@/web/core/Models";
import type {
  ActionImpact, ActionKind, ActionStatus, AffordabilityVerdict, AgentAction, AuditEvent, Fact, Grounding, Offer, ResearchResult, Stage,
  TeachingCard, ToolTrace,
} from "@/web/core/CoachModels";
import { CustomerMemory, TurnTimings } from "@/web/core/CoachModels";
import type { CoachDataLabel, CoachMessage, CoachStatus } from "@/web/core/CoachSession";
import { Dates, Money, jsonEqual, rawOf, roundAway } from "@/web/core/Presentation";
import type { SisuLanguage } from "@/web/core/Presentation";
import { RiveBindings } from "@/web/core/RiveContract";
import type { ResearchStage, RiveValueMap } from "@/web/core/RiveContract";

// MARK: - Fixed labels

export namespace CoachText {
  export function pick(language: SisuLanguage, en: string, fi: string): string { return language === "en" ? en : fi; }

  /** The tag every action card carries: `Simulated, no real switch`, or for a transfer `Simulated, no money moves`. */
  export function simulatedTag(language: SisuLanguage = "en", kind: ActionKind | null = null): string {
    return ActionPresenter.isTransfer(kind)
      ? pick(language, "Simulated, no money moves", "Simuloitu, rahaa ei siirry")
      : pick(language, "Simulated, no real switch", "Simuloitu, ei oikeaa vaihtoa");
  }

  /** `Sample data`: for anything served from the bundled recordings. */
  export function sampleDataTag(language: SisuLanguage = "en"): string { return pick(language, "Sample data", "Esimerkkidata"); }

  /** `Mock data`: for anything a server marked `mock: true`. */
  export function mockDataTag(language: SisuLanguage = "en"): string { return pick(language, "Mock data", "Testidata"); }

  /** The tag the screen owes the user for a session's data: null when it is live. */
  export function dataTag(label: CoachDataLabel, language: SisuLanguage = "en"): string | null {
    switch (rawOf(label)) {
      case "mock": return mockDataTag(language);
      case "sample": return sampleDataTag(language);
      default: return null;
    }
  }

  /** What stands in for a field the source did not give: `not stated`. */
  export function notStated(language: SisuLanguage = "en"): string { return pick(language, "not stated", "ei ilmoitettu"); }

  /** `Fetched 14 Nov 2026, 10:42` (fi `Haettu 14.11.2026 klo 10.42`) for an ISO moment, shown in `timeZone`. */
  export function fetched(iso: string, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): string {
    return pick(language, "Fetched ", "Haettu ") + Dates.shortDateTime(iso, language, timeZone);
  }

  /** Where a number came from, for a `Fact.source`, `Stage.source` or `ToolTrace.source`. */
  export function sourceLabel(source: string, language: SisuLanguage = "en"): string {
    switch (source) {
      case "bank-data": case "finance": return pick(language, "Your bank data", "Tilitietosi");
      case "exa": return pick(language, "Web search", "Verkkohaku");
      case "context.dev": return pick(language, "Offer pages", "Tarjoussivut");
      case "exa+context.dev": return pick(language, "Web search and offer pages", "Verkkohaku ja tarjoussivut");
      case "calculation": return pick(language, "Calculation", "Laskelma");
      case "assumption": return pick(language, "Assumption", "Oletus");
      case "customer-stated": return pick(language, "You told Sisu", "Kerroit Sisulle");
      case "nemotron": return pick(language, "Sisu's model", "Sisun malli");
      default: return source;
    }
  }

  /** A number with at most `places` decimals and no trailing zeros: `8.9`, `24`, fi `8,9`. */
  export function number(value: number, places = 2, language: SisuLanguage = "en"): string {
    if (!Number.isFinite(value)) return "—";
    const scale = 10 ** places;
    const rounded = Math.round(Math.abs(value) * scale);
    if (!(rounded < 9.0e15)) return "—";
    const whole = Math.floor(rounded / scale);
    const fraction = String(rounded % scale).padStart(places, "0").replace(/0+$/, "");
    const sign = value < 0 && rounded > 0 ? Money.minus : "";
    const grouped = Money.group(String(whole), language === "en" ? "," : Money.nbsp);
    return sign + grouped + (fraction === "" ? "" : (language === "en" ? "." : ",") + fraction);
  }

  /** A fact's value with its unit: `€39.83 a month`, `4,573 kWh a year`, `8.9 c/kWh`, `65%`, `3`. */
  export function factValue(fact: Fact, language: SisuLanguage = "en"): string {
    return value(fact.value, fact.unit, language);
  }

  /** A value with one of the server's units. An unknown unit is shown after the number as it came. */
  export function value(amount: number, unit: string, language: SisuLanguage = "en"): string {
    const money = Money.format(amount, language, amount !== roundAway(amount));
    const plain = number(amount, 2, language);
    switch (unit) {
      case "EUR": return money;
      case "EUR/month": return money + pick(language, " a month", " kuukaudessa");
      case "EUR/year": return money + pick(language, " a year", " vuodessa");
      case "kWh/year": return plain + pick(language, " kWh a year", " kWh vuodessa");
      case "c/kWh": return plain + " c/kWh";
      case "months": return plain + pick(language, amount === 1 ? " month" : " months", " kk");
      case "years": return plain + pick(language, amount === 1 ? " year" : " years", " v");
      case "days": return plain + pick(language, amount === 1 ? " day" : " days", " pv");
      case "percent": return plain + (language === "en" ? "%" : Money.nbsp + "%");
      case "count": case "": return plain;
      default: return plain + " " + unit;
    }
  }
}

const pick = CoachText.pick;

// MARK: - Offers

/** One row of the offer table. */
export interface OfferRow {
  id: string;
  provider: string;
  /** The plan's name, or `not stated`. */
  plan: string;
  /** `€3.90 a month + 8.9 c/kWh`, one of the two, or `not stated`. */
  price: string;
  /** `8.9 c/kWh` for an electricity offer; null otherwise. */
  energy: string | null;
  /** `24 months`, or `not stated`. */
  contract: string;
  /** `About €38 a month` (the cost the answer and the saving use), or `Cost not estimated`. */
  estimatedMonthlyCost: string;
  /** From the server's `estimatedYearlySavingEur`, never recomputed. */
  saving: string;
  /** False for offers whose price cannot be compared fairly: show them, do not rank them. */
  comparable: boolean;
  /** Never true for an offer that does not meet the user's requirements. */
  isBest: boolean;
  sourceUrl: string;
  /** Whether it meets the user's requirements: null when the backend did not say. */
  meets: boolean | null;
  /** Why it does not meet them, as the backend said. */
  misses: string[];
  /** True when a fee was not stated: the cost leaves it out, so the saving is incomplete. */
  feesUnknown: boolean;
  /** `Base fee €3.90 a month · Setup fee unknown`, or `Fees unknown`. Never a made-up €0. */
  fees: string;
}

export namespace OfferPresenter {
  export function monthly(language: SisuLanguage): string { return pick(language, " a month", " kuukaudessa"); }

  /** The saving line of one offer (see `OfferRow.saving`). */
  export function savingText(offer: Offer, language: SisuLanguage = "en"): string {
    if (!offer.comparable) {
      return offer.contractType?.toLowerCase() === "spot"
        ? pick(language, "Spot price, not comparable", "Pörssisähkö, ei vertailukelpoinen")
        : pick(language, "Not comparable", "Ei vertailukelpoinen");
    }
    const saving = offer.estimatedYearlySavingEur;
    if (saving == null || !Number.isFinite(saving)) return CoachText.notStated(language);
    return feesUnknown(offer) ? yearly(saving, language) + pick(language, " · incomplete", " · vajaa") : yearly(saving, language);
  }

  /** Whether the offer meets the user's requirements: null when the backend did not say. */
  export function qualifies(offer: Offer): boolean | null {
    const flag = offer.meetsRequirements ?? offer.matchesRequirements;
    return typeof flag === "boolean" ? flag : null;
  }

  /** The backend's reasons an offer misses the requirements (strings only). */
  export function misses(offer: Offer): string[] {
    return Array.isArray(offer.misses) ? offer.misses.filter((one): one is string => typeof one === "string" && one.trim() !== "") : [];
  }

  /** True when a fee the cost depends on was not stated (the server then counts it as nothing). Without the
   *  backend's flag, the rule of lib/agent/research/compare.ts: an electricity cost (energy price stated) leaves the
   *  one-off setup fee out, so only a missing monthly base fee makes it incomplete; another bill's cost spreads the
   *  setup fee over 12 months, so a missing setup fee does too. A missing fee is still shown as unknown, never €0. */
  export function feesUnknown(offer: Offer): boolean {
    if (offer.feesUnknown === true || offer.feesKnown === false) return true;
    if (offer.feesUnknown === false || offer.feesKnown === true) return false;
    if (offer.monthlyPriceEur == null) return true;
    return offer.energyPriceCentsPerKwh == null && offer.setupFeeEur == null;
  }

  /** The fees as stated: `Base fee €3.90 a month · Setup fee unknown`, `No setup fee`, or `Fees unknown`. */
  export function fees(offer: Offer, language: SisuLanguage = "en"): string {
    const monthlyFee = offer.monthlyPriceEur;
    const setup = offer.setupFeeEur;
    if (monthlyFee == null && setup == null) return pick(language, "Fees unknown", "Maksut eivät tiedossa");
    const isEnergy = offer.energyPriceCentsPerKwh != null;
    const parts: string[] = [];
    if (monthlyFee != null) {
      const amount = Money.format(monthlyFee, language, monthlyFee !== roundAway(monthlyFee)) + monthly(language);
      parts.push(isEnergy ? pick(language, "Base fee ", "Perusmaksu ") + amount : amount);
    } else {
      parts.push(pick(language, "Monthly fee unknown", "Kuukausimaksu ei tiedossa"));
    }
    if (setup == null) parts.push(pick(language, "Setup fee unknown", "Avausmaksu ei tiedossa"));
    else if (setup === 0) parts.push(pick(language, "No setup fee", "Ei avausmaksua"));
    else parts.push(pick(language, "Setup fee ", "Avausmaksu ") + Money.format(setup, language, setup !== roundAway(setup)));
    return parts.join(" · ");
  }

  /** `About €24 less a year` for a positive yearly saving, `About €24 more a year` for a negative one. */
  export function yearly(saving: number, language: SisuLanguage = "en"): string {
    if (!Number.isFinite(saving)) return CoachText.notStated(language);
    const whole = roundAway(saving);
    const amount = Money.format(Math.abs(saving), language);
    if (whole === 0) return pick(language, "About the same as now", "Suunnilleen sama kuin nyt");
    return whole > 0
      ? pick(language, `About ${amount} less a year`, `Noin ${amount} vähemmän vuodessa`)
      : pick(language, `About ${amount} more a year`, `Noin ${amount} enemmän vuodessa`);
  }

  export function row(offer: Offer, isBest = false, language: SisuLanguage = "en"): OfferRow {
    const priceParts: string[] = [];
    if (offer.monthlyPriceEur != null) priceParts.push(Money.format(offer.monthlyPriceEur, language, true) + monthly(language));
    if (offer.energyPriceCentsPerKwh != null) priceParts.push(CoachText.number(offer.energyPriceCentsPerKwh, 2, language) + " c/kWh");
    const contract = offer.contractMonths != null ? CoachText.value(offer.contractMonths, "months", language) : CoachText.notStated(language);
    const cost = offer.estimatedMonthlyCostEur != null
      ? pick(language, "About ", "Noin ") + Money.format(offer.estimatedMonthlyCostEur, language, offer.estimatedMonthlyCostEur !== roundAway(offer.estimatedMonthlyCostEur)) + monthly(language)
      : pick(language, "Cost not estimated", "Hintaa ei arvioitu");
    const meets = qualifies(offer);
    return {
      id: offer.provider + "|" + (offer.plan ?? ""),
      provider: offer.provider,
      plan: offer.plan ?? CoachText.notStated(language),
      price: priceParts.length === 0 ? CoachText.notStated(language) : priceParts.join(" + "),
      energy: offer.energyPriceCentsPerKwh != null ? CoachText.number(offer.energyPriceCentsPerKwh, 2, language) + " c/kWh" : null,
      contract,
      estimatedMonthlyCost: cost,
      saving: savingText(offer, language),
      comparable: offer.comparable,
      isBest: isBest && meets !== false,
      sourceUrl: offer.sourceUrl,
      meets,
      misses: misses(offer),
      feesUnknown: feesUnknown(offer),
      fees: fees(offer, language),
    };
  }

  /** The offer table, in the server's order, offers that meet the requirements first when the backend says which do.
   *  The best offer is flagged, unless nothing meets the requirements (`noMatch`). */
  export function rows(research: ResearchResult, language: SisuLanguage = "en", noMatch = false): OfferRow[] {
    const all = research.offers.map((offer) => row(offer, !noMatch && research.best != null && jsonEqual(research.best, offer), language));
    return [...all.filter((one) => one.meets !== false), ...all.filter((one) => one.meets === false)];
  }

  /** True when no offer meets the user's requirements: the backend says so (`noMatch`, `matchingCount` 0, or
   *  every offer marked as not meeting them), or, when the requirements were not judged offer by offer, the
   *  answer's own text says none qualifies. Offers judged against stated requirements outweigh the words. */
  export function noMatch(research: ResearchResult, answerText = ""): boolean {
    if (research.noMatch === true) return true;
    const flags = research.offers.map(qualifies);
    const flagged = flags.some((flag) => flag !== null);
    const req = research.requirements;
    const asked = (req != null && typeof req === "object" && Object.keys(req).length > 0)
      || (typeof research.requirementsText === "string" && research.requirementsText.trim() !== "");
    if (research.matchingCount === 0 && (asked || flagged)) return true;
    if (flagged && !flags.some((flag) => flag === true)) return true;
    if (asked && flagged) return false;
    return textSaysNoMatch(answerText);
  }

  /** The answer says that no option meets what the user asked for (the backend's model filters in words only):
   *  "None of the offers I found have a contract of 6 months or less", "There are no electricity contracts of 6
   *  months or less", "The offers I found are all 24-month contracts, not 12 months or less". A sentence that only
   *  says nothing is cheaper is not one. */
  export function textSaysNoMatch(text: string): boolean {
    const t = text.toLowerCase().replace(/[’]/g, "'");
    const things = "(?:offers?|options?|deals?|plans?|contracts?|subscriptions?)";
    const found = "(?: (?:that )?(?:i|sisu|we) (?:found|compared|checked|could find|looked at))?";
    return /\bno (matching|suitable|qualifying) (options?|offers?|deals?|plans?|contracts?)\b/.test(t)
      || /\bnone of (them|these|those|the (offers?|options?|deals?|plans?|contracts?))\b[^.]*\b(meets?|match(es)?|qualif|fits?)/.test(t)
      || /\b(none|no (offer|option|deal|plan|contract)s?) (meets?|match(es)?|qualif|fits?)/.test(t)
      || new RegExp(`\\bnone of (?:the|these|those) (?:[\\w-]+ )?${things}${found} (?:have|has|are|is|offers?|comes?)\\b(?! (?:any )?(?:cheaper|lower|less expensive))`).test(t)
      || new RegExp(`\\bthere (?:are|were|is) no (?![^.]*\\bcheaper\\b)[\\w -]{0,40}?${things} (?:of|under|with|shorter|lasting|that (?:meet|match|fit)|for \\d)`).test(t)
      || /\b(?:are|were) all \d+[- ]months?\b[^.]*?\b(?:not|none|no)\b/.test(t)
      || /\b(?:could not|couldn't|did not|didn't|cannot|can't) find any [^.]*\b(?:\d+ months? or (?:less|shorter)|that (?:meets?|match(?:es)?|fits?))/.test(t)
      || /\bei (yhtään )?sopiv/.test(t);
  }

  /** `You asked for: a contract of 12 months or less, a fixed price.` from the requirements the backend sent; null
   *  when there are none it can name. */
  export function requirementText(research: ResearchResult, language: SisuLanguage = "en"): string | null {
    const req = research.requirements ?? {};
    const stated = typeof research.requirementsText === "string" ? research.requirementsText.trim().replace(/\.$/, "") : "";
    if (typeof req !== "object") return null;
    const parts: string[] = [];
    const num = (key: string) => (typeof req[key] === "number" && Number.isFinite(req[key]) ? (req[key] as number) : null);
    const max = num("maxContractMonths"), min = num("minContractMonths"), fee = num("maxMonthlyFeeEur"), cost = num("maxMonthlyCostEur");
    if (max != null) parts.push(pick(language, `a contract of ${max} months or less`, `enintään ${max} kk sopimus`));
    if (min != null) parts.push(pick(language, `a contract of at least ${min} months`, `vähintään ${min} kk sopimus`));
    if (req.contractType === "fixed") parts.push(pick(language, "a fixed price", "kiinteä hinta"));
    if (req.contractType === "spot") parts.push(pick(language, "a spot price", "pörssihinta"));
    if (fee != null) parts.push(pick(language, `a monthly fee of ${Money.format(fee, language, fee !== roundAway(fee))} or less`, `kuukausimaksu enintään ${Money.format(fee, language, true)}`));
    if (cost != null) parts.push(pick(language, `an estimated cost of ${Money.format(cost, language, cost !== roundAway(cost))} a month or less`, `arvioitu hinta enintään ${Money.format(cost, language, true)} kuukaudessa`));
    if (req.noSetupFee === true) parts.push(pick(language, "no setup fee", "ei avausmaksua"));
    // `greenOnly` is the shipped backend's name (rework/api-answers), `greenEnergy` the first draft's.
    if (req.greenEnergy === true || req.greenOnly === true) parts.push(pick(language, "green energy", "vihreä sähkö"));
    if (parts.length === 0 && stated !== "") return pick(language, "You asked for: ", "Toiveesi: ") + stated + ".";
    return parts.length === 0 ? null : pick(language, "You asked for ", "Toiveesi: ") + parts.join(", ") + ".";
  }

  /** `About €24 less a year with Example Energia`, or `Nothing cheaper today`. */
  export function headline(research: ResearchResult, language: SisuLanguage = "en", noMatching = false): string {
    if (noMatching) return pick(language, "No matching options found", "Ei sopivia vaihtoehtoja");
    const best = research.best;
    const saving = best?.estimatedYearlySavingEur;
    if (best != null && qualifies(best) === false) return pick(language, "Nothing cheaper that meets your requirements", "Ei halvempaa, joka täyttää toiveesi");
    if (best == null || saving == null || !(roundAway(saving) > 0)) return pick(language, "Nothing cheaper today", "Ei halvempaa tänään");
    return yearly(saving, language) + pick(language, ` with ${best.provider}`, ` – ${best.provider}`);
  }

  /** `Your bill now: about €40 a month`, or null when the server has no baseline. */
  export function baseline(research: ResearchResult, language: SisuLanguage = "en"): string | null {
    if (research.baselineMonthlyEur == null) return null;
    const amount = Money.format(research.baselineMonthlyEur, language) + monthly(language);
    return pick(language, `Your bill now: about ${amount}`, `Laskusi nyt: noin ${amount}`);
  }

  /** When the offers were fetched, and that they are example data when they are. */
  export function fetchedNote(research: ResearchResult, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): string {
    const time = CoachText.fetched(research.finishedAt ?? research.startedAt, language, timeZone);
    return research.mock ? time + " · " + CoachText.mockDataTag(language) : time;
  }

  /** The best offer's yearly saving spread over twelve months, for the futures chart. Null when nothing is cheaper. */
  export function monthlyBillSaving(research: ResearchResult): number | null {
    const saving = research.best?.estimatedYearlySavingEur;
    return saving != null && saving > 0 ? saving / 12 : null;
  }
}

// MARK: - Stage cards

/** One line of a card: a label, an optional value on the right and an optional small detail under it. */
export interface CardLine { label: string; value: string | null; detail: string | null }
export namespace CardLine {
  export function make(label: string, value: string | null = null, detail: string | null = null): CardLine {
    return { label, value: value ?? null, detail: detail ?? null };
  }
}

/** What a stage card shows. */
export interface StageCard {
  id: string;
  kind: string;
  title: string;
  summary: string;
  /** Where the card's numbers come from, for example `Your bank data`. */
  source: string;
  lines: CardLine[];
  /** `Fetched 14 Nov 2026, 11:25` for web research; null otherwise. */
  footnote: string | null;
  /** True when the stage holds example data: add the "Mock data" tag. */
  isMock: boolean;
}

export namespace StagePresenter {
  /** The working of a calculation, line by line: the label, the signed amount and how it was worked out. */
  export function lines(steps: CalcStep[], language: SisuLanguage = "en"): CardLine[] {
    return steps.map((step) => CardLine.make(step.label, Money.format(step.amount, language, true), step.basis));
  }

  export function card(stage: Stage, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): StageCard {
    const data = stage.data;
    let cardLines: CardLine[] = [];
    let footnote: string | null = null;
    let isMock = false;
    switch (data.kind) {
      case "lead":
        cardLines = data.patterns.map((pattern) => {
          const impact = pattern.yearlyImpactEur;
          const value = impact != null ? pick(language, "About ", "Noin ") + CoachText.value(roundAway(impact), "EUR/year", language) : null;
          return CardLine.make(pattern.title, value, pattern.detail);
        });
        break;
      case "evidence":
        cardLines = [
          CardLine.make(pick(language, data.count === 1 ? "1 transaction" : `${data.count} transactions`, `${data.count} tapahtumaa`),
            Money.format(data.totalEur, language, true)),
          ...data.largest.map((row) => CardLine.make(Dates.short(row.date, language) + " · " + row.category, Money.format(row.amount, language, true), row.merchantType ?? null)),
        ];
        break;
      case "research":
        cardLines = [CardLine.make(pick(language, "Searched for", "Haettu hakusanoilla"), null, data.query), ...data.pages.map((page) => CardLine.make(page.title, null, page.url))];
        footnote = CoachText.fetched(data.retrievedAt, language, timeZone);
        isMock = data.mock;
        break;
      case "extraction":
        cardLines = [
          CardLine.make(pick(language, "Pages read", "Luetut sivut"), pick(language, `${data.pagesRead} of ${data.pagesTotal}`, `${data.pagesRead}/${data.pagesTotal}`)),
          ...data.offers.map((offer) => CardLine.make([offer.provider, offer.plan].filter((part): part is string => part != null).join(" · "), OfferPresenter.savingText(offer, language))),
          ...data.problems.map((problem) => CardLine.make(pick(language, "Could not be read", "Ei voitu lukea"), null, problem)),
        ];
        break;
      case "calculation":
        cardLines = lines(data.steps, language);
        break;
      case "teaching":
        cardLines = [CardLine.make(data.card.question)];
        break;
      case "action":
        cardLines = [CardLine.make(data.action.title, ActionPresenter.statusSentence(data.action.status, language, data.action.kind))];
        break;
      case "impact":
        cardLines = FuturesPresenter.impactSeries(data.impact, language).map((one) => CardLine.make(one.label, one.endLabel, one.rangeLabel));
        break;
      case "memory":
        cardLines = [CardLine.make(pick(language, "Sisu will remember", "Sisu muistaa"), data.item.value)];
        break;
      case "unknown":
        break;
    }
    return {
      id: stage.id, kind: rawOf(stage.kind), title: stage.title ?? "", summary: stage.summary ?? "",
      source: CoachText.sourceLabel(stage.source ?? "", language), lines: cardLines, footnote, isMock,
    };
  }

  /** The live research stage for the `StageIndicator` component. Null when the reply has nothing to do with research. */
  export function researchStage(message: CoachMessage): ResearchStage | null {
    const kinds = new Set((message.stages ?? []).map((stage) => rawOf(stage.kind)));
    if (kinds.has("calculation")) return "done";
    const status = message.research ? rawOf(message.research.status) : null;
    if (status === "done" || status === "partial" || status === "failed") return "done";
    if (kinds.has("extraction")) return "comparing";
    if (kinds.has("research")) return "reading";
    if (message.startedEarly != null || message.runningTool === "search_offers" || message.research != null) return "searching";
    return null;
  }
}

// MARK: - Action card

/** What the approval card shows. */
export interface ActionCardState {
  id: string;
  title: string;
  summary: string;
  /** The steps a real switch would take. */
  checklist: string[];
  /** Show these near the saving. */
  assumptions: string[];
  /** `€2.01 a month`: what the action frees, from the server; `€50` for a one-off transfer. */
  monthly: string;
  /** Beside the amount: `freed` for a switch, `to your savings` for a transfer. */
  amountNote: string;
  /** `What a real switch takes (3 steps)`, or `What a real transfer takes (3 steps)`. */
  checklistLabel: string;
  /** The celebration's line after approval: `€2.01 a month freed. Simulated, no real switch.`, or for a
   *  transfer `€50 to your savings. Simulated, no money moved.` */
  approvedLine: string;
  statusSentence: string;
  /** `Simulated, no real switch`, or `Simulated, no money moves` for a transfer. */
  simulatedTag: string;
  /** True while Approve and Decline make sense. */
  canDecide: boolean;
  /** After approval: the server's sentence. */
  impactSummary: string | null;
  /** `Valid until 14 Nov 2026, 11:56` while it waits; null afterwards. A plain fact, not a countdown. */
  validUntil: string | null;
  /** The text Sisu drafted for the provider. Never sent. */
  draftMessage: string | null;
  /** Show it prominently whenever it is set; never hide it. */
  warning: string | null;
  /** After approval: `Done (simulation). Reference SIM-1A2B3C4D.` */
  confirmation: string | null;
  /** `To your savings` or `To your investments` for a transfer. */
  destination: string | null;
}

const nonEmpty = (text: string | null | undefined): string | null => (text != null && text !== "" ? text : null);

export namespace ActionPresenter {
  /** A one-off or standing transfer: its words say "transfer" and "no money moved", never "switch" or "freed". */
  export function isTransfer(kind: ActionKind | null | undefined): boolean {
    const raw = kind == null ? "" : rawOf(kind);
    return raw === "one_off_transfer" || raw === "standing_transfer";
  }

  export function statusSentence(status: ActionStatus, language: SisuLanguage = "en", kind: ActionKind | null = null): string {
    switch (rawOf(status)) {
      case "awaiting_approval": return pick(language, "Waiting for your approval. Nothing has been done.", "Odottaa hyväksyntääsi. Mitään ei ole tehty.");
      case "executed_simulated":
        return isTransfer(kind)
          ? pick(language, "Approved. Simulated, no money moved.", "Hyväksytty. Simuloitu, rahaa ei siirretty.")
          : pick(language, "Approved. Simulated, no real switch was made.", "Hyväksytty. Simuloitu, oikeaa vaihtoa ei tehty.");
      case "declined": return pick(language, "Declined. Nothing was done.", "Hylätty. Mitään ei tehty.");
      case "expired":
        return pick(language, "Expired. Prices may have changed. Ask Sisu to prepare it again.",
          "Vanhentunut. Hinnat ovat voineet muuttua. Pyydä Sisua valmistelemaan se uudelleen.");
      default: return rawOf(status);
    }
  }

  /** The amount as it moves: `€50` once for a one-off transfer, `€50 a month` for a standing one or a switch. */
  export function amount(action: AgentAction, language: SisuLanguage = "en"): string {
    return rawOf(action.kind) === "one_off_transfer"
      ? CoachText.value(action.monthlyAmountEur, "EUR", language)
      : CoachText.value(action.monthlyAmountEur, "EUR/month", language);
  }

  export function card(action: AgentAction, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): ActionCardState {
    const waiting = rawOf(action.status) === "awaiting_approval";
    const transfer = isTransfer(action.kind);
    const checklist = action.checklist ?? [];
    const steps = pick(language, checklist.length === 1 ? "1 step" : `${checklist.length} steps`, `${checklist.length} vaihetta`);
    const to = destination(action, language);
    const monthly = amount(action, language);
    const amountNote = transfer ? (to ?? pick(language, "To your savings", "Säästöihisi")).toLowerCase() : pick(language, "freed", "vapautuu");
    return {
      id: action.id,
      title: action.title,
      summary: action.summary,
      checklist,
      assumptions: action.assumptions ?? [],
      monthly,
      amountNote,
      checklistLabel: transfer
        ? pick(language, `What a real transfer takes (${steps})`, `Mitä oikea siirto vaatii (${steps})`)
        : pick(language, `What a real switch takes (${steps})`, `Mitä oikea vaihto vaatii (${steps})`),
      approvedLine: transfer
        ? `${monthly} ${amountNote}. ` + pick(language, "Simulated, no money moved.", "Simuloitu, rahaa ei siirretty.")
        : `${monthly} ${amountNote}. ${CoachText.simulatedTag(language)}.`,
      statusSentence: statusSentence(action.status, language, action.kind),
      simulatedTag: CoachText.simulatedTag(language, action.kind),
      canDecide: waiting,
      impactSummary: action.impact?.summary ?? null,
      validUntil: waiting ? pick(language, "Valid until ", "Voimassa: ") + Dates.shortDateTime(action.expiresAt, language, timeZone) : null,
      draftMessage: action.draftMessage ?? null,
      warning: warning(action),
      confirmation: confirmation(action),
      destination: destination(action, language),
    };
  }

  /** One row of the "history" drawer: `Approved by you · 14 Nov 2026, 11:26`. */
  export function auditLine(event: AuditEvent, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): CardLine {
    const whats: Record<string, [string, string]> = {
      action_prepared: ["Prepared", "Valmisteltu"],
      action_approved: ["Approved", "Hyväksytty"],
      action_executed_simulated: ["Carried out as a simulation", "Toteutettu simulaationa"],
      action_declined: ["Declined", "Hylätty"],
      action_expired: ["Expired", "Vanhentunut"],
      memory_saved: ["Remembered", "Tallennettu muistiin"],
      memory_forgotten: ["Forgotten", "Unohdettu"],
      consent_changed: ["Remembering changed", "Muistamisen asetus muutettu"],
      demo_reset: ["Demo reset", "Demo nollattu"],
    };
    const whos: Record<string, [string, string]> = { user: ["by you", "sinä"], "sisu-agent": ["by Sisu", "Sisu"], system: ["by the system", "järjestelmä"] };
    const what = Object.prototype.hasOwnProperty.call(whats, event.type) ? pick(language, ...whats[event.type]) : event.type;
    const who = Object.prototype.hasOwnProperty.call(whos, event.actor) ? pick(language, ...whos[event.actor]) : event.actor;
    return CardLine.make(what + " " + who, Dates.shortDateTime(event.at, language, timeZone), event.detail);
  }

  /** The warning to show prominently on an action card. Null when the action has none. Never hide it. (ChartPresentation.swift) */
  export function warning(action: AgentAction): string | null { return nonEmpty(action.warning); }

  /** The confirmation to show after approval. (ChartPresentation.swift) */
  export function confirmation(action: AgentAction): string | null { return nonEmpty(action.confirmation); }

  /** `To your savings` or `To your investments` for a transfer; null for anything else. (ChartPresentation.swift) */
  export function destination(action: AgentAction, language: SisuLanguage = "en"): string | null {
    switch (action.destination) {
      case "savings": return pick(language, "To your savings", "Säästöihisi");
      case "investments": return pick(language, "To your investments", "Sijoituksiisi");
      default: return null;
    }
  }
}

// MARK: - Receipts

/** The line under an answer that says whether its numbers have sources. */
export interface GroundingLine { text: string; isWarning: boolean }

export namespace GroundingPresenter {
  /** `All 6 numbers have a source`, or `2 of 6 numbers have no source yet` as a warning. Null with no numbers to check. */
  export function line(grounding: Grounding, language: SisuLanguage = "en"): GroundingLine | null {
    const missing = Math.max((grounding.unverified ?? []).length, (grounding.numbers ?? []).filter((n) => n.status === "unverified").length);
    if (grounding.ok && missing === 0) {
      if (!(grounding.checked > 0)) return null;
      const text = grounding.checked === 1
        ? pick(language, "1 number has a source", "Luvulla on lähde")
        : pick(language, `All ${grounding.checked} numbers have a source`, `Kaikilla ${grounding.checked} luvulla on lähde`);
      return { text, isWarning: false };
    }
    const total = Math.max(grounding.checked, missing);
    const count = Math.max(missing, 1);
    const text = pick(language, `${count} of ${total} numbers ${count === 1 ? "has" : "have"} no source yet`, `${count}/${total} luvulta puuttuu vielä lähde`);
    return { text, isWarning: true };
  }
}

// MARK: - Tool trace

/** One row of the trace drawer. */
export interface ToolRow { id: string; name: string; summary: string; duration: string; source: string; ok: boolean }

export namespace ToolPresenter {
  /** `1.2 s` for 1,234 ms; `under 0.1 s` below 50 ms. Finnish uses a decimal comma. */
  export function duration(ms: number, language: SisuLanguage = "en"): string {
    if (!Number.isFinite(ms) || !(ms >= 50)) return pick(language, "under 0.1 s", "alle 0,1 s");
    const tenths = Math.round(ms / 100);
    if (!(tenths < 9.0e15)) return "—";
    return `${Math.floor(tenths / 10)}${language === "en" ? "." : ","}${tenths % 10} s`;
  }

  /** `Find patterns` for `find_patterns`. */
  export function name(raw: string): string {
    const words = Array.from(raw.replace(/_/g, " ").replace(/-/g, " "));
    if (words.length === 0) return raw;
    return words[0].toUpperCase() + words.slice(1).join("");
  }

  export function row(trace: ToolTrace, language: SisuLanguage = "en"): ToolRow {
    return { id: trace.id, name: name(trace.name), summary: trace.summary, duration: duration(trace.tookMs, language), source: CoachText.sourceLabel(trace.source, language), ok: trace.ok };
  }

  /** `Answered in 4.8 s`, with `backup model` added when the backup answered. */
  export function timingLine(timings: TurnTimings, language: SisuLanguage = "en"): string {
    const base = pick(language, "Answered in ", "Vastattu ajassa ") + duration(timings.totalMs, language);
    return TurnTimings.usedBackup(timings) ? base + " · " + pick(language, "backup model", "varamalli") : base;
  }
}

// MARK: - Teaching quiz

/** The predict-then-reveal state of one teaching card. Immutable: `choose` returns the next state. */
export interface TeachingQuiz {
  readonly card: TeachingCard;
  /** The option the user tapped. Null until then. */
  readonly selectedIndex: number | null;
}

export namespace TeachingQuiz {
  export function make(card: TeachingCard): TeachingQuiz { return { card, selectedIndex: null }; }

  /** Records the user's choice. Only the first valid choice counts. */
  export function choose(quiz: TeachingQuiz, index: number): TeachingQuiz {
    if (quiz.selectedIndex != null || !Number.isInteger(index) || index < 0 || index >= quiz.card.options.length) return quiz;
    return { ...quiz, selectedIndex: index };
  }

  export function isRevealed(quiz: TeachingQuiz): boolean { return quiz.selectedIndex != null; }

  /** Null before the user has chosen. */
  export function isCorrect(quiz: TeachingQuiz): boolean | null {
    return quiz.selectedIndex == null ? null : quiz.selectedIndex === quiz.card.correctIndex;
  }

  /** All `idle` before the choice; afterwards the right one is `correct`, a wrong pick is `wrong`, the rest `idle`. */
  export function state(quiz: TeachingQuiz, index: number): RiveBindings.ChoiceState {
    if (quiz.selectedIndex == null) return "idle";
    if (index === quiz.card.correctIndex) return "correct";
    return index === quiz.selectedIndex ? "wrong" : "idle";
  }

  /** The `ChoiceCard` values of every option, in order. */
  export function choices(quiz: TeachingQuiz): RiveValueMap[] {
    return quiz.card.options.map((option, index) => RiveBindings.choiceCard(option, state(quiz, index)));
  }

  /** The card's reveal text, once the user has chosen. */
  export function reveal(quiz: TeachingQuiz): string | null { return isRevealed(quiz) ? quiz.card.reveal : null; }

  /** A short line above the reveal. It praises the guess and never shames a miss. */
  export function feedback(quiz: TeachingQuiz, language: SisuLanguage = "en"): string | null {
    const correct = isCorrect(quiz);
    if (correct == null) return null;
    return correct ? pick(language, "Spot on.", "Juuri niin.") : pick(language, "Good guess. Here is the real figure.", "Hyvä arvaus. Tässä oikea luku.");
  }
}

// MARK: - Futures chart

export interface FuturesPoint { /** Months from today. */ month: number; total: number; low: number; high: number }

/** One line of the futures chart. */
export interface FuturesSeries {
  /** `nothing`, `save` or `invest`. */
  id: string;
  label: string;
  /** A whole curve from a scenario; only the end point from an action's impact. */
  points: FuturesPoint[];
  /** `€611`: where the line ends. */
  endLabel: string;
  /** `€614 to €639` when the end has a range (invested money); null otherwise. */
  rangeLabel: string | null;
}

export namespace FuturesPresenter {
  export function range(low: number, high: number, language: SisuLanguage): string | null {
    const lowText = Money.format(low, language), highText = Money.format(high, language);
    if (lowText === highText) return null;
    return pick(language, `${lowText} to ${highText}`, `${lowText}–${highText}`);
  }

  /** Swift `series(_: ScenarioResponse)` or `series(_: ActionImpact)`, by the shape of the argument. */
  export function series(input: ScenarioResponse | ActionImpact, language: SisuLanguage = "en"): FuturesSeries[] {
    return "horizonYears" in input ? impactSeries(input as ActionImpact, language) : scenarioSeries(input as ScenarioResponse, language);
  }

  /** The three futures of `POST /api/scenarios`, one series each. */
  export function scenarioSeries(scenario: ScenarioResponse, language: SisuLanguage = "en"): FuturesSeries[] {
    return scenario.branches.map((branch) => ({
      id: rawOf(branch.id),
      label: branch.label,
      points: branch.points.map((point) => ({ month: point.month, total: point.total, low: point.totalLow, high: point.totalHigh })),
      endLabel: Money.format(branch.endTotal, language),
      rangeLabel: range(branch.endLow, branch.endHigh, language),
    }));
  }

  /** Where the three futures end after an approved action. Each series holds its end point only. */
  export function impactSeries(impact: ActionImpact, language: SisuLanguage = "en"): FuturesSeries[] {
    const month = Number.isFinite(impact.horizonYears) ? Math.round(Math.min(Math.max(impact.horizonYears, 0), 100) * 12) : 0;
    return impact.branches.map((branch) => ({
      id: rawOf(branch.id),
      label: branch.label,
      points: [{ month, total: branch.endTotal, low: branch.endLow, high: branch.endHigh }],
      endLabel: Money.format(branch.endTotal, language),
      rangeLabel: range(branch.endLow, branch.endHigh, language),
    }));
  }

  /** `About €121 more after 5 years` from the server's `gainVsNothingEur` and `horizonYears`. */
  export function gain(impact: ActionImpact, language: SisuLanguage = "en"): string {
    const amount = Money.format(impact.gainVsNothingEur, language);
    const years = CoachText.number(impact.horizonYears, 1, language);
    return pick(language, `About ${amount} more after ${years} ${impact.horizonYears === 1 ? "year" : "years"}`, `Noin ${amount} enemmän ${years} vuoden jälkeen`);
  }
}

// MARK: - Coach cards without the agent

export namespace CoachCardPresenter {
  /** `Fits comfortably`, `Possible, but tight` or `Not yet` for an affordability verdict. */
  export function verdict(verdict: AffordabilityVerdict, language: SisuLanguage = "en"): string {
    switch (rawOf(verdict)) {
      case "comfortable": return pick(language, "Fits comfortably", "Mahtuu hyvin");
      case "tight": return pick(language, "Possible, but tight", "Onnistuu, mutta tiukasti");
      case "not-yet": return pick(language, "Not yet", "Ei vielä");
      default: return rawOf(verdict);
    }
  }

  /** The working of an affordability answer or a cash-flow forecast, line by line. */
  export function lines(steps: CalcStep[], language: SisuLanguage = "en"): CardLine[] { return StagePresenter.lines(steps, language); }

  /** A bill's headline: the confirmed name, or `Looks like <guess>` while the name is still Sisu's guess. */
  export function billName(bill: RecurringBill, memory: CustomerMemory | null | undefined, language: SisuLanguage = "en"): string {
    const name = memory ? CustomerMemory.confirmedBillName(memory, bill.id) : null;
    if (name != null) return name;
    return pick(language, `Looks like ${bill.guessLabel}`, `Näyttää tältä: ${bill.guessLabel}`);
  }

  /** The talk button's state for a session status (the names are the same). */
  export function voiceState(status: CoachStatus): RiveBindings.VoiceState {
    const raw = rawOf(status);
    return raw === "recording" || raw === "thinking" || raw === "speaking" ? raw : "idle";
  }
}
