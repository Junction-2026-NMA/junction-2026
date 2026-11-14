/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/Presentation.swift. Pure presentation helpers: formatting, basket shares and what the
// hero block says. Money and dates are formatted by hand exactly as the Swift file does (no Intl), so the web
// prints the very same strings as iOS.
import type { BasketId, Overview } from "@/web/core/Models";

// MARK: - Internal helpers shared by the part-B ports (not in Swift; Swift gets them from the standard library)

/** Swift `.rounded()` / `.rounded(.toNearestOrAwayFromZero)`: halves away from zero (JS `Math.round` rounds -2.5 to -2). */
export function roundAway(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** The raw string of an open enum (`StageKind`, `ActionStatus`…), whether it is ported as a string or as `{ rawValue }`. */
export function rawOf(value: unknown): string {
  if (value && typeof value === "object" && "rawValue" in value) return String((value as { rawValue: unknown }).rawValue);
  return value == null ? "" : String(value);
}

/** Swift `Equatable` for decoded JSON values: deep equality where a missing key equals `null`. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => jsonEqual(item, b[index]));
  }
  const ra = a as Record<string, unknown>, rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  return [...keys].every((key) => jsonEqual(ra[key], rb[key]));
}

/** Swift `Double.isFinite` for a value that may be missing. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// MARK: - Language

export type SisuLanguage = "en" | "fi";
export namespace SisuLanguage {
  export const allCases: readonly SisuLanguage[] = ["en", "fi"];
}

// MARK: - Money

/**
 * Formats euro amounts the way the brand asks.
 *
 * English: symbol first, comma groups, dot decimals: `€64`, `€1,234`, `€1,234.50`.
 * Finnish: number first, a no-break space (U+00A0) between groups and before the sign, comma decimals:
 * `64 €`, `1 234 €`, `1 234,50 €`. Negative amounts start with a real minus sign (U+2212): `−€12`, `−12 €`.
 * With `decimals: false` the amount is rounded to whole euros, halves away from zero. A value that rounds to
 * zero is never negative. A value that is not a finite number gives a dash (`—`).
 */
export namespace Money {
  export const minus = "−";
  export const nbsp = " ";

  export function format(amount: number, language: SisuLanguage, decimals = false): string {
    if (!Number.isFinite(amount)) return "—";
    const scaled = Math.round(Math.abs(amount) * (decimals ? 100 : 1));
    if (!(scaled < 9.0e18)) return "—";
    const units = scaled;
    const whole = decimals ? Math.floor(units / 100) : units;
    const cents = units % 100;
    const negative = amount < 0 && units > 0;

    const groupSeparator = language === "en" ? "," : nbsp;
    let number = group(String(whole), groupSeparator);
    if (decimals) number += (language === "en" ? "." : ",") + (cents < 10 ? `0${cents}` : `${cents}`);
    const sign = negative ? minus : "";
    return language === "en" ? sign + "€" + number : sign + number + nbsp + "€";
  }

  /** The same as `format`, with a leading `+` for amounts above zero (for deltas such as `+€12`). */
  export function signed(amount: number, language: SisuLanguage, decimals = false): string {
    const text = format(amount, language, decimals);
    return amount > 0 && !text.startsWith(minus) && text !== format(0, language, decimals) ? "+" + text : text;
  }

  export function group(digits: string, separator: string): string {
    const chars = Array.from(digits);
    return chars.map((char, index) => (index > 0 && (chars.length - index) % 3 === 0 ? separator : "") + char).join("");
  }
}

// MARK: - Dates

interface DateParts { year: number; month: number; day: number }

/**
 * Formats an ISO date (`2026-11-13`, or a date-time that starts with one) for display.
 * English: `13 Nov 2026`. Finnish: `13.11.2026`. Anything that does not start with a valid date is returned unchanged.
 * Time zones are IANA identifiers (`Europe/Helsinki`); `currentTimeZone()` is the device's, like Swift `.current`.
 */
export namespace Dates {
  export const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  export function currentTimeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  export function short(iso: string, language: SisuLanguage): string {
    const date = parseDate(Array.from(iso));
    return date ? text(date.year, date.month, date.day, language) : iso;
  }

  /**
   * Formats an ISO 8601 moment (`2026-11-14T09:30:00Z`, with or without a fraction of a second, ending in `Z`
   * or an offset such as `+02:00`) in the given time zone.
   * English: `14 Nov 2026, 09:30`. Finnish: `14.11.2026 klo 9.30`. Any other text is returned unchanged.
   */
  export function shortDateTime(iso: string, language: SisuLanguage, timeZone: string = currentTimeZone()): string {
    const moment = parseMoment(iso);
    if (!moment) return iso;
    const parts = zonedParts(moment, timeZone);
    if (!parts) return iso;
    const date = text(parts.year, parts.month, parts.day, language);
    const mm = parts.minute < 10 ? `0${parts.minute}` : `${parts.minute}`;
    return language === "en"
      ? `${date}, ${parts.hour < 10 ? `0${parts.hour}` : `${parts.hour}`}:${mm}`
      : `${date} klo ${parts.hour}.${mm}`;
  }

  /** The moment an ISO 8601 date-time names, or null when the text is not one. */
  export function parseMoment(iso: string): Date | null {
    const s = Array.from(iso);
    const date = parseDate(s);
    if (!date || s.length < 20 || (s[10] !== "T" && s[10] !== "t")) return null;
    const hour = number(s, 11, 2), minute = number(s, 14, 2), second = number(s, 17, 2);
    if (hour == null || s[13] !== ":" || minute == null || s[16] !== ":" || second == null) return null;
    if (hour > 23 || minute > 59 || second > 60) return null;
    let index = 19;
    if (s[index] === "." || s[index] === ",") {
      index += 1;
      const start = index;
      while (index < s.length && isDigit(s[index])) index += 1;
      if (index <= start) return null;
    }
    if (index >= s.length) return null;
    let offsetSeconds = 0;
    if (s[index] === "Z" || s[index] === "z") {
      if (index !== s.length - 1) return null;
    } else if (s[index] === "+" || s[index] === "-") {
      const sign = s[index] === "+" ? 1 : -1;
      const rest = s.slice(index + 1);
      let oh: number | null = null, om: number | null = null;
      if (rest.length === 5 && rest[2] === ":") { oh = number(rest, 0, 2); om = number(rest, 3, 2); }
      else if (rest.length === 4) { oh = number(rest, 0, 2); om = number(rest, 2, 2); }
      else if (rest.length === 2) { oh = number(rest, 0, 2); om = oh == null ? null : 0; }
      if (oh == null || om == null || oh > 23 || om > 59) return null;
      offsetSeconds = sign * (oh * 3600 + om * 60);
    } else {
      return null;
    }
    const utc = new Date(0);
    utc.setUTCFullYear(date.year, date.month - 1, date.day);
    utc.setUTCHours(hour, minute, second, 0);
    return new Date(utc.getTime() - offsetSeconds * 1000);
  }

  export function text(year: number, month: number, day: number, language: SisuLanguage): string {
    return language === "en" ? `${day} ${months[month - 1]} ${year}` : `${day}.${month}.${year}`;
  }

  function isDigit(char: string | undefined): boolean {
    return char !== undefined && char.length === 1 && char >= "0" && char <= "9";
  }

  function number(s: string[], start: number, length: number): number | null {
    if (start + length > s.length) return null;
    let value = 0;
    for (let i = start; i < start + length; i += 1) {
      if (!isDigit(s[i])) return null;
      value = value * 10 + (s[i].charCodeAt(0) - 48);
    }
    return value;
  }

  export function parseDate(s: string[]): DateParts | null {
    if (s.length < 10 || s[4] !== "-" || s[7] !== "-") return null;
    const year = number(s, 0, 4), month = number(s, 5, 2), day = number(s, 8, 2);
    if (year == null || month == null || day == null || month < 1 || month > 12 || day < 1) return null;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= lengths[month - 1] ? { year, month, day } : null;
  }

  /** Year, month, day, hour and minute of a moment in an IANA time zone (Gregorian, 24-hour). */
  export function zonedParts(moment: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
    try {
      const format = new Intl.DateTimeFormat("en-US", {
        timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23", era: "short",
      });
      const parts = Object.fromEntries(format.formatToParts(moment).map((part) => [part.type, part.value]));
      const year = Number(parts.year) * (parts.era === "BC" ? -1 : 1);
      const values = { year, month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
      return Object.values(values).every(Number.isFinite) ? values : null;
    } catch {
      return null;
    }
  }
}

// MARK: - Baskets

/** The four things the basket bar shows: the three spending baskets and savings ("Jars"). */
export type BasketKind = "fixed" | "curveballs" | "leaks" | "jars";
export namespace BasketKind {
  export const allCases: readonly BasketKind[] = ["fixed", "curveballs", "leaks", "jars"];

  /** English: Fixed, Curveballs, Leaks, Jars. Finnish: Kiinteät, Yllärit, Vuodot, Purkit. */
  export function label(kind: BasketKind, language: SisuLanguage): string {
    const en = { fixed: "Fixed", curveballs: "Curveballs", leaks: "Leaks", jars: "Jars" } as const;
    const fi = { fixed: "Kiinteät", curveballs: "Yllärit", leaks: "Vuodot", jars: "Purkit" } as const;
    return (language === "en" ? en : fi)[kind];
  }

  /** Swift `BasketId.kind`: `regular` is Fixed, `irregular` is Curveballs, `everyday` is Leaks. */
  export function of(id: BasketId): BasketKind {
    switch (rawOf(id)) {
      case "regular": return "fixed";
      case "irregular": return "curveballs";
      default: return "leaks";
    }
  }
}

/** Swift `BasketId.kind`. */
export function basketKind(id: BasketId): BasketKind {
  return BasketKind.of(id);
}

/** Shares of the basket bar, each 0...1. */
export interface BasketShares { fixed: number; curveballs: number; leaks: number; jars: number }
export namespace BasketShares {
  export const zero: BasketShares = { fixed: 0, curveballs: 0, leaks: 0, jars: 0 };
}

export namespace BasketMath {
  /**
   * The bar's shares: the `monthlyAvg` of each basket and `monthlySaved` as Jars, each divided by their sum.
   * Negative or non-finite amounts and a missing basket count as 0. When the sum is 0 the result is `zero`.
   */
  export function shares(overview: Overview): BasketShares {
    const amount = (id: string) => clean(overview.baskets.find((basket) => rawOf(basket.id) === id)?.monthlyAvg ?? 0);
    const fixed = amount("regular"), curveballs = amount("irregular"), leaks = amount("everyday");
    const jars = clean(overview.monthlySaved);
    const sum = fixed + curveballs + leaks + jars;
    if (!(sum > 0) || !Number.isFinite(sum)) return BasketShares.zero;
    return { fixed: fixed / sum, curveballs: curveballs / sum, leaks: leaks / sum, jars: jars / sum };
  }

  export function clean(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
}

// MARK: - Hero

/** What the hero block on the X-ray screen says. */
export interface HeroViewState {
  eyebrow: string;
  amount: string;
  unit: string;
  context: string;
  tone: HeroViewState.Tone;
}
export namespace HeroViewState {
  export type Tone = "room" | "above";
}

export namespace XrayPresenter {
  /** The safe-to-spend hero for a customer. The copy never blames: no "overspent" and no "too much". */
  export function hero(overview: Overview, language: SisuLanguage): HeroViewState {
    const safe = overview.safeToSpend;
    const gap = Money.format(Math.abs(safe.gapPerMonth), language);
    const room = !(safe.gapPerMonth < 0);
    const context = room
      ? language === "en" ? `About ${gap} a month under this. That is room to save.` : `Noin ${gap} kuukaudessa tämän alle. Siinä on tilaa säästää.`
      : language === "en" ? `About ${gap} a month above this on everyday choices.` : `Noin ${gap} kuukaudessa tämän yli arjen valinnoissa.`;
    return {
      eyebrow: language === "en" ? "Safe to spend" : "Käytettävissä",
      amount: Money.format(safe.perWeek, language),
      unit: language === "en" ? "a week" : "viikossa",
      context,
      tone: room ? "room" : "above",
    };
  }
}
