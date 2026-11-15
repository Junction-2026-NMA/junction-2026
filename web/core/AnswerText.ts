/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// Text from the server made readable, and the labels that say where a figure comes from (web addition of the 15 Nov
// rework; split out of AnswerPresentation.ts, which re-exports both). Display text only: nothing here changes a
// figure, it only writes it the way the brand does (`€1,220.35`, `−€22.88`, `1 Jun 2026`) and uses the app's names
// for the baskets and the weekly budget.
import { LessonWording } from "./AppLogic/LessonPath";
import { CoachText } from "./CoachPresentation";
import type { Visual } from "./PlanModels";
import { Dates, Money, type SisuLanguage } from "./Presentation";

const pick = CoachText.pick;

/** The averages figure (income minus the baskets, spread over the weeks of a month) by the lessons' name. It runs
 *  before LessonWording, so it never becomes "Estimated weekly budget", which is the cash-flow figure until payday. */
const AVERAGES: readonly (readonly [RegExp, string])[] = [
  [/\bSafe to spend per week\b/g, "Weekly room in an average month"],
  [/\bSafe to spend per month\b/g, "Room in an average month"],
  [/\bsafe to spend per week\b/g, "the weekly room in an average month"],
  [/\bsafe to spend per month\b/g, "the room in an average month"],
  [/\b[Ss]afe[- ]to[- ]spend\b/g, "room in an average month"],
];

export namespace CardText {
  /** ISO dates become `25 Oct 2026` (with a time, `15 Nov 2026, 01:44` in the viewer's zone; a month `2026-09`
   *  becomes `Sep 2026`); `1220.35 euros`
   *  becomes `€1,220.35` and `-22.88 euros` `−€22.88`; `€2010.63` gets its thousands separator; and a hyphen used
   *  as a minus beside a euro amount becomes a real minus: `€-325.50` and `-€325.50` both read `−€325.50`. */
  export function humanize(text: string, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): string {
    if (text === "") return text;
    const separator = language === "en" ? "," : Money.nbsp;
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
      .replace(/\b(\d{4})-(0[1-9]|1[0-2])\b(?!-\d)/g, (_whole, year: string, month: string) =>
        language === "en" ? `${Dates.months[Number(month) - 1]} ${year}` : `${Number(month)}/${year}`)
      .replace(/(^|[\s(])([-−]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)? euros?\b/g, (whole, before: string, sign: string, digits: string, cents: string | undefined) =>
        language !== "en" ? whole : `${before}${sign ? Money.minus : ""}€${Money.group(digits.replace(/,/g, ""), separator)}${cents ?? ""}`)
      .replace(/€(\d{4,})(?!\d)/g, (_whole, digits: string) => "€" + Money.group(digits, separator))
      .replace(/€-(?=\d)/g, Money.minus + "€")
      .replace(/(^|[\s(])-€(?=\d)/g, `$1${Money.minus}€`);
  }

  /** The app's names for the server's older words (`Must-pay costs` → `Essential costs`, `now-and-then baskets` →
   *  `occasional essentials`, and the averages figure once called "Safe to spend per week" by the lessons' name,
   *  `Weekly room in an average month`, so it is never taken for the estimated weekly budget). Figures untouched. */
  export function words(text: string): string {
    const averages = AVERAGES.reduce((current, [pattern, name]) => current.replace(pattern, name), text);
    return LessonWording.text(averages)
      .replace(/\bnow-and-then baskets?\b/g, "occasional essentials")
      .replace(/\bnow-and-then\b/g, "occasional");
  }

  /** `words` then `humanize`, trimmed: what every label, step and assumption of an answer goes through. */
  export function readable(text: string | null | undefined, language: SisuLanguage = "en", timeZone: string = Dates.currentTimeZone()): string {
    return humanize(words(text ?? ""), language, timeZone).trim();
  }
}

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

  /** A figure about other customers ("Customers in the same age band", a gap to peers): a comparison with the
   *  synthetic demo dataset, even when the server labels it bank data. */
  export function isPeerFact(fact: { id: string; label: string }): boolean {
    return PEER.test(fact.id) || PEER.test(fact.label);
  }

  /** An answer that compares the person with other customers in words ("people your age", "your peer group"). */
  export function comparesWithPeers(text: string): boolean { return PEER_TEXT.test(text); }

  /** One of each kind, in a fixed order (bank data first, mock data last); the first label of a kind wins. */
  export function unique(tags: readonly (SourceTag | null)[]): SourceTag[] {
    const kept = new Map<SourceKind, SourceTag>();
    for (const tag of tags) if (tag && !kept.has(tag.kind)) kept.set(tag.kind, tag);
    return ORDER.flatMap((kind) => (kept.has(kind) ? [kept.get(kind)!] : []));
  }
}

const PEER = /peer|age band|same age|others your age/i;
const PEER_TEXT = /\b(people|others|customers) (of )?your age\b|\byour peer group\b|\bthan your peers\b|\bsame age band\b/i;
