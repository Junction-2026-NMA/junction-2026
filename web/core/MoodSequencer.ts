// Makes each of Liito's moods readable without inventing any. The backend often finishes a step in a few
// milliseconds and sends the next events in the same network chunk (a tool's end, its stage records, a chart):
// switching Liito the moment each arrives would flash three poses inside one ~300 ms Rive blend, and Rive would
// settle on whichever was current when the blend ended (measured by the animation QA pass, 14 Nov 2026).
//
// The sequencer shows every mood the real events produced, in the order they came, each task mood for at least
// `dwellMs` (searching, calculating, comparing, writing, presenting, and the "found" bounce), then moves on to the
// next. It never makes up a mood or a step: it only delays the switch to the next one. It keeps only the newest
// `maxPending` held moods waiting (plus the final resting mood, if any), so Liito is never more than a couple of
// seconds behind what Sisu is doing. Some moods
// are shown at once, dropping what waits: the microphone opening (listening), a new question (the caller says so),
// and the calm moods once a turn is over (waiting for approval = found, cheering, cosy, proud).
//
// Pure: time is passed in (milliseconds), no timers, no React. web/shared/useLiitoMood.ts drives it on screen.
//
//   const sequencer = new MoodSequencer("idle", now);
//   sequencer.push(target, now, urgent);   // whenever the events give a new target mood
//   sequencer.advance(now);                // when nextChangeAt() is due
//   sequencer.shown                        // the mood to draw
import type { LiitoMood } from "./Activity";

/** Moods that are held for `dwellMs` before the next one shows. Plain thinking, idle and listening are not. */
const dwelling: ReadonlySet<LiitoMood> = new Set<LiitoMood>(["searching", "calculating", "comparing", "writing", "presenting", "found"]);

/** Shown at once, whatever waits: the microphone just opened. */
const alwaysUrgent: ReadonlySet<LiitoMood> = new Set<LiitoMood>(["listening"]);

/** Shown at once when no turn is running: the calm moods after a turn (an action waiting, approved, declined, an
 *  ended conversation). */
const urgentWhenIdle: ReadonlySet<LiitoMood> = new Set<LiitoMood>(["found", "cheering", "cosy", "proud"]);

export class MoodSequencer {
  static readonly defaultDwellMs = 1000;
  static readonly defaultMaxPending = 2;

  private shownMood: LiitoMood;
  private shownAt: number;
  private pending: LiitoMood[] = [];

  constructor(
    initial: LiitoMood,
    now = 0,
    private readonly dwellMs = MoodSequencer.defaultDwellMs,
    private readonly maxPending = MoodSequencer.defaultMaxPending,
  ) {
    this.shownMood = initial;
    this.shownAt = now;
  }

  /** The mood to draw now. */
  get shown(): LiitoMood { return this.shownMood; }

  /** The moods waiting their turn, oldest first. */
  get queue(): readonly LiitoMood[] { return this.pending; }

  /** Whether `target` is shown at once rather than after the moods that wait. `busy`: a turn is running. */
  static isUrgent(target: LiitoMood, busy: boolean): boolean {
    return alwaysUrgent.has(target) || (!busy && urgentWhenIdle.has(target));
  }

  /** True for the moods that are held for the dwell time. */
  static dwells(mood: LiitoMood): boolean { return dwelling.has(mood); }

  /**
   * A new target from the events.
   * @param urgent show it now and drop what waits (see `isUrgent`, or a new question).
   */
  push(target: LiitoMood, now: number, urgent = false): void {
    this.advance(now);
    if (urgent) {
      this.pending = [];
      this.show(target, now);
      return;
    }
    const last = this.pending.length > 0 ? this.pending[this.pending.length - 1] : this.shownMood;
    // The same mood again (consecutive duplicates collapse).
    if (target === last) return;
    if (this.pending.length === 0 && !this.isDwelling(now)) {
      this.show(target, now);
      return;
    }
    this.pending = MoodSequencer.compact([...this.pending, target], this.maxPending);
  }

  /** The waiting moods in order, keeping only what matters: moods that are not held (thinking, idle) only as the
   *  last word, and at most `maxPending` held moods, the newest, so the queue never runs far behind. */
  private static compact(moods: readonly LiitoMood[], maxPending: number): LiitoMood[] {
    const kept = moods.filter((mood, index) => dwelling.has(mood) || index === moods.length - 1);
    let extra = kept.filter((mood) => dwelling.has(mood)).length - maxPending;
    return kept.filter((mood) => {
      if (extra > 0 && dwelling.has(mood)) {
        extra -= 1;
        return false;
      }
      return true;
    });
  }

  /** Moves on to the moods that waited, as far as `now` allows. */
  advance(now: number): void {
    while (this.pending.length > 0 && !this.isDwelling(now)) {
      const [next, ...rest] = this.pending;
      this.pending = rest;
      // A late call still gives the next mood its full time from when it was due, not from the late call.
      const due = dwelling.has(this.shownMood) ? Math.min(now, this.shownAt + this.dwellMs) : now;
      this.show(next, due);
    }
  }

  /** When `advance` next changes the shown mood, or null when nothing waits. */
  nextChangeAt(): number | null {
    if (this.pending.length === 0) return null;
    return dwelling.has(this.shownMood) ? this.shownAt + this.dwellMs : this.shownAt;
  }

  private isDwelling(now: number): boolean {
    return dwelling.has(this.shownMood) && now - this.shownAt < this.dwellMs;
  }

  private show(mood: LiitoMood, at: number): void {
    if (mood === this.shownMood) return;
    this.shownMood = mood;
    this.shownAt = at;
  }
}
