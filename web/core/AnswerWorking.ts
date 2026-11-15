/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// "How this was worked out" with each figure said once (web addition, QA of 15 Nov): a calculation's steps without
// the one the result card already shows, a summary or tool line left out when it only repeats a number the answer
// already says, and, for an answer the model gave without a calculation, the figures it rests on with their basis.
// A figure is only listed when the text says it as the same kind of figure (euros for euros, a percentage for a
// percentage): an age range or a year in the text never "backs" a fact. A monthly saving leads with what it frees
// each month; its projection over the years is optional. Numbers are only compared here, never computed.
import { CardText, SourceTags } from "./AnswerText";
import type { AnswerResult, FuturesView, HowBlock } from "./AnswerPresentation";
import type { ActionImpact, Fact, Stage } from "./CoachModels";
import { CardLine, CoachText, FuturesPresenter, StagePresenter } from "./CoachPresentation";
import type { CoachMessage } from "./CoachSession";
import { Dates, type SisuLanguage } from "./Presentation";

const pick = CoachText.pick;
const close = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** What kind of figure a number is: in a text, read from the words beside it; for a fact, from its unit. */
export type FigureKind = "euro" | "percent" | "count" | "time" | "energy" | "price";
export interface Claim { value: number; kind: FigureKind | null }

const PERCENT_AFTER = /^\s?(?:%|percent\b|per cent\b|prosent)/i;
const PRICE_AFTER = /^\s?(?:c\/kwh|cents?\b|snt\b)/i;
const ENERGY_AFTER = /^\s?kwh\b/i;
const EURO_AFTER = /^\s?(?:€|euros?\b|eur\b|euroa\b)/i;
const EURO_BEFORE = /(?:€|\beur)\s?[-−–]?\s?$/i;
const COUNT_AFTER = /^[\s-]*(?:customers?|people|persons?|profiles?|transactions?|purchases?|payments?|bills?|offers?|pages?|sources?|times|homes?|listings?|flats?|apartments?|rooms?|items?|lessons?|plans?|contracts?|categories|tapahtum\w*|maksu\w*|ostok\w*|asiakka\w*|tarjou\w*|kertaa)\b/i;
/** Years are left out on purpose: "18-year-olds", "in 2026" and "5 years" are never matched to a fact. */
const TIME_AFTER = /^[\s-]*(?:months?\b|weeks?\b|days?\b|hours?\b|kuukau|kk\b|viiko|päiv|tunti)/i;
const RATE_AFTER = /^\s(?:a|per|each|every)\s(?:month|year|week|day)\b/i;
const AGE_BEFORE = /\b(?:ages?|aged|ikä\w*)\s+(?:\d+\s*(?:-|–|to|and)\s*)?$/i;
const INVESTING = /invest|sijoit|\bfunds?\b|rahast|\bstocks?\b|osake|\betfs?\b|compound|korkoa korolle/i;
const HORIZON = /\byears\b|\bdecades?\b|\b\d+[\s-]*years?\b|long[\s-]?(?:term|run)|\bfuture\b|retire|pension|vuotta\b|vuode(?:n|ssa) (?:päästä|kuluttua)|tulevaisuu|eläk/i;

function withoutDates(text: string | null | undefined): string {
  return (text ?? "").replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");
}

function kindOf(before: string, after: string): FigureKind | null {
  if (AGE_BEFORE.test(before)) return null;
  if (PERCENT_AFTER.test(after)) return "percent";
  if (PRICE_AFTER.test(after)) return "price";
  if (ENERGY_AFTER.test(after)) return "energy";
  if (EURO_AFTER.test(after) || EURO_BEFORE.test(before)) return "euro";
  if (COUNT_AFTER.test(after)) return "count";
  if (TIME_AFTER.test(after)) return "time";
  return RATE_AFTER.test(after) ? "euro" : null;
}

export namespace Working {
  /** The numbers a text says, as written (ISO dates and clock times left out, signs dropped): `€1,220.35` → 1220.35. */
  export function numbers(text: string | null | undefined): number[] {
    return claims(text).map((claim) => claim.value);
  }

  /** Each number of a text with the kind of figure it is: `55.3 euros` is euros, `20%` a percentage, `419 customers`
   *  a count, `6 months` a time; a bare number (`ages 18 to 24`, a year, a day) has no kind. */
  export function claims(text: string | null | undefined): Claim[] {
    const plain = withoutDates(text);
    return [...plain.matchAll(/\d[\d,]*(?:\.\d+)?/g)].flatMap((match) => {
      const value = Number(match[0].replace(/,+$/, "").replace(/,(?=\d{3}\b)/g, ""));
      if (!Number.isFinite(value)) return [];
      const start = match.index ?? 0, end = start + match[0].length;
      return [{ value, kind: kindOf(plain.slice(Math.max(0, start - 24), start), plain.slice(end, end + 24)) }];
    });
  }

  /** The kind of figure a fact's unit holds; null for one never matched (years, an unknown unit). */
  export function factKind(unit: string): FigureKind | null {
    const u = unit.trim().toLowerCase();
    if (u.startsWith("eur")) return "euro";
    if (u === "percent" || u === "%") return "percent";
    if (u === "count") return "count";
    if (/^(?:months|weeks|days|hours)$/.test(u)) return "time";
    if (u === "c/kwh") return "price";
    return u.startsWith("kwh") ? "energy" : null;
  }

  /** True when `said` is `value`, to the cent or rounded to whole euros (`About €134` says `133.82`). */
  export function says(said: number, value: number): boolean {
    const target = Math.abs(value);
    return close(said, target) || (Number.isInteger(said) && !Number.isInteger(target) && Math.round(target) === said);
  }

  /** A calculation's summary, unless it only repeats the label or a number equal to the result (to the cent or
   *  rounded to whole euros): `About €134 a week until 15 Oct 2026` repeats `€133.82`. */
  export function summaryUnlessRepeat(rawSummary: string, resultValue: number, summary: string, value: string, label: string): string | null {
    if (summary === "" || summary === label || /=/.test(summary)) return null;
    if (numbers(rawSummary).some((said) => says(said, resultValue))) return null;
    const bare = value.replace(/ a (month|year)$/, "");
    return summary.includes(bare) ? null : summary;
  }

  /** One calculation's working. The result's own calculation leaves out every step that is the result (same label
   *  and value), wherever it stands; another calculation ends with its result unless a step already says it. */
  export function calcBlock(stage: Stage, isResult: boolean, language: SisuLanguage, timeZone: string): HowBlock | null {
    if (stage.data.kind !== "calculation") return null;
    const data = stage.data;
    const h = (text: string | null | undefined) => CardText.readable(text, language, timeZone);
    const isTotal = (step: { label: string; amount: number }) => sameText(h(step.label), h(data.resultLabel)) && close(step.amount, data.resultValue);
    const steps = data.steps.filter((step) => !(isResult && isTotal(step)));
    const lines = StagePresenter.lines(steps, language).map((line) => CardLine.make(h(line.label), line.value, line.detail ? h(line.detail) : null));
    const total = isResult || data.steps.some(isTotal) ? [] : [CardLine.make(h(data.resultLabel), CoachText.value(data.resultValue, data.unit, language))];
    const all = [...lines, ...total];
    return all.length === 0 ? null : { id: stage.id, title: h(stage.title).replace(/^Worked out:\s*/i, ""), lines: all, evidence: null };
  }

  /** The facts the answer's text says: a number in the text of the same kind (euros for a euro fact, a percentage
   *  for a percentage, a count for a count) that says the fact's value to the cent, or rounded when the grounding
   *  check matched the two. A bare number, such as an age or a year, backs nothing: when in doubt, left out. */
  export function backedFacts(message: CoachMessage): Fact[] {
    const receipts = new Set((message.grounding?.numbers ?? []).flatMap((n) => (n.factId ? [n.factId] : [])));
    const said = claims(message.text);
    return message.facts.filter((fact) => {
      const kind = Number.isFinite(fact.value) ? factKind(fact.unit) : null;
      return kind != null && said.some((claim) => claim.kind === kind
        && (close(claim.value, Math.abs(fact.value)) || (receipts.has(fact.id) && says(claim.value, fact.value))));
    });
  }

  /** The backed facts, one per figure: two labels for the same amount (`Freed per month`, `Cutting Restaurants by
   *  20% frees, per month`) are the same figure, said once. */
  export function usedFacts(message: CoachMessage): Fact[] {
    const seen = new Set<string>();
    return backedFacts(message).filter((fact) => {
      const key = `${factKind(fact.unit)}|${Math.abs(fact.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** "Figures behind this answer": for an answer with no calculation (the model answered from the grounding facts),
   *  each figure the text uses with its basis. Leaves out a figure the result card or the working (`shown`) already
   *  says. Null with none. */
  export function factsBlock(message: CoachMessage, result: AnswerResult | null, language: SisuLanguage, timeZone: string = Dates.currentTimeZone(),
    shown: readonly number[] = []): HowBlock | null {
    const h = (text: string | null | undefined) => CardText.readable(text, language, timeZone);
    const onCard = [...numbers(result?.value), ...numbers(result?.detail), ...shown];
    const lines = usedFacts(message)
      .filter((fact) => !onCard.some((one) => close(one, Math.abs(fact.value))))
      .map((fact) => CardLine.make(h(fact.label), CoachText.value(fact.value, fact.unit, language), fact.basis ? h(fact.basis) : null));
    return lines.length === 0 ? null : { id: `facts-${message.id}`, title: pick(language, "Figures behind this answer", "Luvut vastauksen takana"), lines, evidence: null };
  }

  // MARK: A monthly saving and its optional projection

  /** True when the question asks about investing. */
  export function asksInvesting(question: string): boolean { return INVESTING.test(question); }

  /** True when the question asks about the years ahead or investing (then the projection may lead). */
  export function asksLongTerm(question: string): boolean { return HORIZON.test(question) || asksInvesting(question); }

  /** True when a projection's monthly figure should lead: the question did not ask about the years ahead or
   *  investing, and the monthly figure is not the person's own amount (`What if I save €50 a month?`). */
  export function leadsMonthly(impact: ActionImpact, question: string): boolean {
    return !asksLongTerm(question) && Number.isFinite(impact.monthlyEur) && impact.monthlyEur > 0
      && !numbers(question).some((said) => says(said, impact.monthlyEur));
  }

  /** The result card's label for what a change frees each month: the stage's own words when they say what changes
   *  (`Cutting Restaurants by 20% frees`), else `Freed by the change`. */
  export function freedLabel(stage: Stage, monthly: number, language: SisuLanguage): string {
    const named = stage.facts.find((fact) => fact.unit === "EUR/month" && close(Math.abs(fact.value), Math.abs(monthly)) && /\d/.test(fact.label));
    return named ? named.label.replace(/,?\s*(?:per|a|each)\s+month$/i, "") : pick(language, "Freed by the change", "Muutos vapauttaa");
  }

  /** What a monthly saving is worked out from, from the stage's own facts: the monthly averages and the percentage
   *  asked for, with the transactions behind them. The projection's figures stay out. */
  export function savingFacts(stage: Stage, monthly: number): Fact[] {
    return stage.facts.filter((fact) => Number.isFinite(fact.value) && (fact.unit === "EUR/month" || fact.unit === "percent")
      && !close(Math.abs(fact.value), Math.abs(monthly)));
  }

  export function savingBlock(stage: Stage, monthly: number, language: SisuLanguage, timeZone: string): HowBlock | null {
    const h = (text: string | null | undefined) => CardText.readable(text, language, timeZone);
    const basis = savingFacts(stage, monthly);
    const withEvidence = basis.find((fact) => fact.evidence != null) ?? null;
    const lines = basis.map((fact) => CardLine.make(h(fact.label), CoachText.value(fact.value, fact.unit, language), fact.basis ? h(fact.basis) : null));
    return lines.length === 0 ? null : {
      id: `saving-${stage.id}`, title: pick(language, "What the saving is worked out from", "Mistä säästö on laskettu"), lines,
      evidence: withEvidence?.evidence ? { title: h(withEvidence.label), filter: withEvidence.evidence } : null,
    };
  }

  /** The projection over the years. `optional`: the card leads with the monthly figure, so the projection is an
   *  optional extra of its own, without the "invest it" line unless investing was asked about. Otherwise it is part
   *  of the working, and its sentence goes when it only repeats the card. */
  export function futures(impact: ActionImpact, optional: boolean, invest: boolean, result: AnswerResult | null, language: SisuLanguage,
    timeZone: string): FuturesView {
    const summary = CardText.readable(impact.summary, language, timeZone);
    const years = impact.horizonYears;
    const span = `${CoachText.number(years, 1, language)} ${pick(language, years === 1 ? "year" : "years", "vuotta")}`;
    return {
      series: FuturesPresenter.series(impact, language).filter((line) => invest || line.id !== "invest"),
      label: optional ? pick(language, `Optional: if you keep the saving for ${span}`, `Valinnainen: jos säästät ${span}`) : pick(language, "If you keep the money", "Jos säästät rahat"),
      optional, tags: [SourceTags.estimate(language)],
      summary: onlyRepeats(summary, [...numbers(result?.label), ...numbers(result?.value)]) ? "" : summary,
    };
  }

  // MARK: Said once

  /** Every number the answer already says: in its text, on the result card and in the working. */
  export function shownNumbers(text: string, result: AnswerResult | null, how: readonly HowBlock[]): number[] {
    return [...numbers(text), ...numbers(result?.label), ...numbers(result?.value), ...numbers(result?.detail),
      ...how.flatMap((block) => block.lines.flatMap((line) => numbers(line.value)))];
  }

  /** True when every number of a tool's one-line result is already said elsewhere (it adds nothing). */
  export function onlyRepeats(line: string, shown: readonly number[]): boolean {
    const said = numbers(line);
    return said.length > 0 && said.every((one) => shown.some((value) => says(one, value)));
  }

  /** An assumption without a bracketed part the result card already says: `Only offers that meet what you asked
   *  for (contract of 6 months or less) can be…` when the card says `You asked for a contract of 6 months or less.` */
  export function withoutCardText(item: string, card: string | null | undefined): string {
    if (!card) return item;
    const said = key(card);
    return item.replace(/\s*\(([^()]+)\)/g, (all, inner: string) => (said.includes(key(inner)) ? "" : all));
  }

  const key = (text: string) => text.toLowerCase().replace(/[.\s]+$/g, "").replace(/\s+/g, " ").trim();

  /** True for the same sentence, ignoring case, spacing and a closing full stop. */
  export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
    return a != null && b != null && a.trim() !== "" && key(a) === key(b);
  }

  export function uniqueText(items: string[]): string[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const k = key(item);
      if (item === "" || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
}
