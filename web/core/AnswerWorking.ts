/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// "How this was worked out" with each figure said once (web addition, QA of 15 Nov): a calculation's steps without
// the one the result card already shows, a summary or tool line left out when it only repeats a number the answer
// already says, and, for an answer the model gave without a calculation, the figures it rests on with their basis.
// Numbers are only compared here, never computed.
import { CardText } from "./AnswerText";
import type { AnswerResult, HowBlock } from "./AnswerPresentation";
import type { Fact, Stage } from "./CoachModels";
import { CardLine, CoachText, StagePresenter } from "./CoachPresentation";
import type { CoachMessage } from "./CoachSession";
import { Dates, type SisuLanguage } from "./Presentation";

const pick = CoachText.pick;
const close = (a: number, b: number) => Math.abs(a - b) < 0.005;

export namespace Working {
  /** The numbers a text says, as written (ISO dates and clock times left out, signs dropped): `€1,220.35` → 1220.35. */
  export function numbers(text: string | null | undefined): number[] {
    const plain = (text ?? "").replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, " ")
      .replace(/\b\d{1,2}:\d{2}\b/g, " ");
    return (plain.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((one) => Number(one.replace(/,+$/, "").replace(/,(?=\d{3}\b)/g, ""))).filter(Number.isFinite);
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

  /** The facts the answer's text rests on: those the grounding check matched to a number in the text, and those
   *  whose value the text says to the cent. One per label and value. */
  export function usedFacts(message: CoachMessage): Fact[] {
    const receipts = new Set((message.grounding?.numbers ?? []).flatMap((n) => (n.factId ? [n.factId] : [])));
    const said = numbers(message.text);
    const seen = new Set<string>();
    return message.facts.filter((fact) => {
      if (!Number.isFinite(fact.value)) return false;
      const key = `${fact.label.trim().toLowerCase()}|${fact.value}`;
      if (seen.has(key) || !(receipts.has(fact.id) || said.some((one) => close(one, Math.abs(fact.value))))) return false;
      seen.add(key);
      return true;
    });
  }

  /** "Figures behind this answer": for an answer with no calculation (the model answered from the grounding facts),
   *  each figure the text uses with its basis. Leaves out a figure the result card already shows. Null with none. */
  export function factsBlock(message: CoachMessage, result: AnswerResult | null, language: SisuLanguage, timeZone: string = Dates.currentTimeZone()): HowBlock | null {
    const h = (text: string | null | undefined) => CardText.readable(text, language, timeZone);
    const onCard = [...numbers(result?.value), ...numbers(result?.detail)];
    const lines = usedFacts(message)
      .filter((fact) => !onCard.some((one) => close(one, Math.abs(fact.value))))
      .map((fact) => CardLine.make(h(fact.label), CoachText.value(fact.value, fact.unit, language), fact.basis ? h(fact.basis) : null));
    return lines.length === 0 ? null : { id: `facts-${message.id}`, title: pick(language, "Figures behind this answer", "Luvut vastauksen takana"), lines, evidence: null };
  }

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
