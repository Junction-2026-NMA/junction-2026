/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/DailyProgress.swift. The Duolingo loop: three small actions a day, a streak of days
// the app was opened, and berries for effort. Pure: the day is injected. Immutable: `complete` returns the next
// state with the berries earned. The JSON shape is Swift's Codable one, so the app stores it the same way.
import { Dates } from "@/web/core/Presentation";

/** The three small actions on the Today screen. */
export type DailyAction =
  /** Done by opening the app. */
  | "checkIn"
  /** Confirm or correct the name of the flagged bill. */
  | "confirmBill"
  /** Let Sisu look into your finances (the Ask tab). */
  | "investigate";

export namespace DailyAction {
  export const allCases: readonly DailyAction[] = ["checkIn", "confirmBill", "investigate"];

  /** Berries earned the first time the action is done on a day. */
  export function reward(action: DailyAction): number {
    return action === "checkIn" ? 5 : action === "confirmBill" ? 10 : 15;
  }

  /** The title shown on the action's row. */
  export function title(action: DailyAction): string {
    return action === "checkIn" ? "Check in" : action === "confirmBill" ? "Confirm your bill's name" : "Let Sisu look into it";
  }

  /** The reward as the row shows it: `+5`. */
  export function rewardText(action: DailyAction): string { return `+${reward(action)}`; }
}

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

/**
 * Streak, berries and today's actions.
 * - A day counts once for the streak, however often the app is opened.
 * - The streak grows by one when the last active day was yesterday, and starts again at 1 after a gap.
 * - Each action earns its berries once per day. Berries are never taken away.
 * - A new state starts honestly: streak 0, 0 berries, nothing done. The first check-in makes it day 1.
 */
export interface DailyProgress {
  readonly streakDays: number;
  readonly berries: number;
  /** The last day an action was done. Null before the first one (Swift omits the key). */
  readonly lastActiveDay?: DayStamp | null;
  /** The actions done on `lastActiveDay` (Swift's `Set` encodes as an array). */
  readonly doneOnLastDay: readonly DailyAction[];
}

export namespace DailyProgress {
  export function make(): DailyProgress { return { streakDays: 0, berries: 0, lastActiveDay: null, doneOnLastDay: [] }; }

  /** The actions already done on `day`. */
  export function done(progress: DailyProgress, day: DayStamp): readonly DailyAction[] {
    return DayStamp.equals(progress.lastActiveDay, day) ? progress.doneOnLastDay : [];
  }

  /** The share of today's actions done, 0...1, for the progress bar. */
  export function progress(progress: DailyProgress, day: DayStamp): number {
    return done(progress, day).length / DailyAction.allCases.length;
  }

  /**
   * Records `action` on `day` and returns the next state and the berries earned (0 when it was already done that
   * day). Completing any action also counts the day for the streak. A day earlier than the last active day (a clock
   * set back) changes nothing.
   */
  export function complete(progress: DailyProgress, action: DailyAction, day: DayStamp): { progress: DailyProgress; earned: number } {
    const last = progress.lastActiveDay ?? null;
    if (last && DayStamp.less(day, last)) return { progress, earned: 0 };
    const sameDay = last != null && DayStamp.equals(day, last);
    const base: DailyProgress = sameDay
      ? progress
      : { ...progress, streakDays: last && DayStamp.daysUntil(last, day) === 1 ? progress.streakDays + 1 : 1, lastActiveDay: day, doneOnLastDay: [] };
    if (base.doneOnLastDay.includes(action)) return { progress: base, earned: 0 };
    const earned = DailyAction.reward(action);
    return { progress: { ...base, doneOnLastDay: [...base.doneOnLastDay, action], berries: base.berries + earned }, earned };
  }

  /** The berries earned on `day` (the rewards of the actions done that day). */
  export function berriesEarned(progress: DailyProgress, day: DayStamp): number {
    return done(progress, day).reduce((sum, action) => sum + DailyAction.reward(action), 0);
  }

  /** True when every daily action is done on `day`. */
  export function allDone(progress: DailyProgress, day: DayStamp): boolean {
    return done(progress, day).length === DailyAction.allCases.length;
  }

  /** The celebration when the last of today's actions is done. */
  export function celebration(progress: DailyProgress, day: DayStamp): { headline: string; detail: string } | null {
    if (!allDone(progress, day)) return null;
    const days = progress.streakDays === 1 ? "Day 1 of your streak." : `${progress.streakDays} days in a row.`;
    return { headline: "Three for three.", detail: `${berriesEarned(progress, day)} berries today. ${days}` };
  }

  /** The streak as the pill shows it: `1`. */
  export function streakText(progress: DailyProgress): string { return `${progress.streakDays}`; }
  /** The berries as the pill shows them: `15`. */
  export function berriesText(progress: DailyProgress): string { return `${progress.berries}`; }

  /** Decodes a stored value (Swift `JSONDecoder`); null when it is not a `DailyProgress`. */
  export function decode(value: unknown): DailyProgress | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.streakDays !== "number" || typeof v.berries !== "number" || !Array.isArray(v.doneOnLastDay)) return null;
    const actions = v.doneOnLastDay.filter((a): a is DailyAction => (DailyAction.allCases as readonly unknown[]).includes(a));
    if (actions.length !== v.doneOnLastDay.length) return null;
    const day = v.lastActiveDay as Record<string, unknown> | null | undefined;
    if (day != null && (typeof day.year !== "number" || typeof day.month !== "number" || typeof day.day !== "number")) return null;
    return {
      streakDays: v.streakDays, berries: v.berries,
      lastActiveDay: day == null ? null : { year: day.year as number, month: day.month as number, day: day.day as number },
      doneOnLastDay: [...new Set(actions)],
    };
  }
}
