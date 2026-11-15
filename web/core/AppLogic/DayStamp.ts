/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// A calendar day (Swift DayStamp, from SisuCore/AppLogic/DailyProgress.swift). AppModel keeps the day its snapshot
// was computed for and recomputes it when the app comes back to the foreground on a new day. Pure.
import { Dates } from "@/web/core/Presentation";

/** A calendar day. Encoded as `{ year, month, day }` like the Swift struct. */
export interface DayStamp { readonly year: number; readonly month: number; readonly day: number }

export namespace DayStamp {
  export function make(year: number, month: number, day: number): DayStamp { return { year, month, day }; }

  /** The day `date` falls on in `timeZone` (an IANA id; the device's by default). Swift `DayStamp(date, calendar:)`. */
  export function from(date: Date, timeZone: string = Dates.currentTimeZone()): DayStamp {
    const parts = Dates.zonedParts(date, timeZone);
    return parts ? { year: parts.year, month: parts.month, day: parts.day } : { year: 0, month: 0, day: 0 };
  }

  function utcMidnight(stamp: DayStamp): number {
    const date = new Date(0);
    date.setUTCFullYear(stamp.year, stamp.month - 1, stamp.day);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  }

  /** The days from `from` to `other` (positive when `other` is later), in the Gregorian calendar. */
  export function daysUntil(from: DayStamp, other: DayStamp): number {
    const a = utcMidnight(from), b = utcMidnight(other);
    return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
  }

  export function equals(a: DayStamp | null | undefined, b: DayStamp | null | undefined): boolean {
    if (a == null || b == null) return a == null && b == null;
    return a.year === b.year && a.month === b.month && a.day === b.day;
  }

  /** Swift `<`. */
  export function less(a: DayStamp, b: DayStamp): boolean {
    if (a.year !== b.year) return a.year < b.year;
    if (a.month !== b.month) return a.month < b.month;
    return a.day < b.day;
  }

  /** `yyyy-MM-dd`. */
  export function text(stamp: DayStamp): string {
    const pad = (n: number, width: number) => String(n).padStart(width, "0");
    return `${pad(stamp.year, 4)}-${pad(stamp.month, 2)}-${pad(stamp.day, 2)}`;
  }
}
