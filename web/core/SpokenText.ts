/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// Sisu's sentences worded for the ear, just before text to speech (CoachSession.say). The screen shows "15 Oct 2026"
// (CardText.humanize), but a voice reads an ISO date ("2026-10-15") digit by digit and "€-12" as "euro dash twelve".
// Here an ISO date, with or without a time, becomes "15 October" (the year only when it is not this year) in the
// answer's language, and a negative euro amount becomes "minus 12 euros". Pure: nothing else in the sentence changes.
import { Dates } from "./Presentation";

export namespace SpokenText {
  const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
    "November", "December"];
  /** "minus" and the word for euros (one, many) per language; anything else is said in English. */
  const money: Readonly<Record<string, { minus: string; one: string; many: string }>> = {
    en: { minus: "minus", one: "euro", many: "euros" },
    fi: { minus: "miinus", one: "euro", many: "euroa" },
    sv: { minus: "minus", one: "euro", many: "euro" },
    de: { minus: "minus", one: "Euro", many: "Euro" },
  };
  /** An ISO date (`2026-10-15`), optionally with a time and a zone (`T09:30:00Z`, ` 09:30`, `+02:00`). */
  const isoDate = /(?<![\d-])(\d{4}-\d{2}-\d{2})((?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?)(?:[Zz]|[+-]\d{2}(?::?\d{2})?)?)?(?![\d])/g;
  /** `€-12`, `€ −12.50`, `-€12`, `−€1,234`. */
  const minusEuroBefore = /(?<![\p{L}\p{N}])(?:€\s?[-−]\s?|[-−]\s?€\s?)(\d[\d,]*(?:\.\d+)?)/gu;
  /** `-12 €`, `−12,50 €` (the Finnish order). */
  const minusEuroAfter = /(?<![\p{L}\p{N}])[-−](\d[\d  ]*(?:,\d+)?)\s?€/gu;

  /** One sentence, ready to be spoken.
   * @param language the answer language (ISO 639-1, such as `fi`); null, `auto` or unknown is English.
   * @param now gives this year (a date in it is said without the year) and the time zone of a date with a time. */
  export function format(text: string, language: string | null = null, now: Date = new Date(), timeZone: string = Dates.currentTimeZone()): string {
    const code = languageCode(language);
    const year = now.getFullYear();
    return text
      .replace(isoDate, (match: string, date: string, time: string | undefined) => spokenDate(date, time ? match : null, code, year, timeZone) ?? match)
      .replace(minusEuroBefore, (_match: string, amount: string) => minusEuros(amount, code))
      .replace(minusEuroAfter, (_match: string, amount: string) => minusEuros(amount.replace(/[  ]/g, ""), code));
  }

  /** "15 October", "15 October 2027", "15. lokakuuta". Null when the text is not a real date. */
  export function spokenDate(date: string, moment: string | null, language: string, thisYear: number, timeZone: string): string | null {
    const parts = momentParts(moment, timeZone) ?? Dates.parseDate(Array.from(date));
    if (!parts) return null;
    const withYear = parts.year !== thisYear;
    if (language === "en") return `${parts.day} ${englishMonths[parts.month - 1]}${withYear ? ` ${parts.year}` : ""}`;
    try {
      const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", timeZone: "UTC", ...(withYear ? { year: "numeric" } : {}) };
      return new Intl.DateTimeFormat(language, options).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
    } catch {
      return `${parts.day} ${englishMonths[parts.month - 1]}${withYear ? ` ${parts.year}` : ""}`;
    }
  }

  /** The day a date-time with a zone falls on where the person is; null for a date alone or a time without a zone. */
  function momentParts(moment: string | null, timeZone: string): { year: number; month: number; day: number } | null {
    if (moment === null) return null;
    const instant = Dates.parseMoment(moment.replace(" ", "T"));
    return instant ? Dates.zonedParts(instant, timeZone) : null;
  }

  function minusEuros(amount: string, language: string): string {
    const words = money[language] ?? money.en;
    const unit = amount === "1" ? words.one : words.many;
    return `${words.minus} ${amount} ${unit}`;
  }

  /** `fi-FI` → `fi`; null, `auto` and blanks → `en`. */
  function languageCode(language: string | null): string {
    const code = (language ?? "").trim().toLowerCase().split(/[-_]/)[0];
    return code === "" || code === "auto" || !/^[a-z]{2,3}$/.test(code) ? "en" : code;
  }
}
