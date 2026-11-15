"use client";
// The mood a Liito badge draws, from the target mood the real events give (LiitoTask), through a MoodSequencer
// (web/core/MoodSequencer.ts): each task Liito really does stays on screen long enough to read (about a second),
// in the order the events came, never invented, never more than a couple of moods behind. Used by every Liito that
// follows the conversation: the Talk badges (hero and chat header) and the Ask header.
//
//   const shown = useLiitoMood(target, { busy, turn });
//
// - busy: a turn is running (Sisu thinking, speaking or the microphone open). When it is not, the calm moods after
//   a turn (an action waiting, cheering, cosy, proud) show at once.
// - turn: anything that changes with each new question (the newest question's id): a new question shows its first
//   mood at once and drops what still waited from the last one.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LiitoMood } from "@/web/core/Activity";
import { MoodSequencer } from "@/web/core/MoodSequencer";

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** The sequencer as a store for React, with the one timer that moves on to the next waiting mood. */
class SequencedMood {
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly sequencer: MoodSequencer) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  readonly getSnapshot = (): LiitoMood => this.sequencer.shown;

  push(target: LiitoMood, urgent: boolean): void {
    const before = this.sequencer.shown;
    this.sequencer.push(target, clock(), urgent);
    if (this.sequencer.shown !== before) this.emit();
    this.schedule();
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.dispose();
    const due = this.sequencer.nextChangeAt();
    if (due === null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const before = this.sequencer.shown;
      this.sequencer.advance(clock());
      if (this.sequencer.shown !== before) this.emit();
      this.schedule();
    }, Math.max(0, due - clock()) + 4);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export function useLiitoMood(target: LiitoMood, options: { busy: boolean; turn?: string | number | null }): LiitoMood {
  const { busy, turn = null } = options;
  const [store] = useState(() => new SequencedMood(new MoodSequencer(target, clock())));
  const shown = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const lastTurn = useRef(turn);
  const urgent = MoodSequencer.isUrgent(target, busy);

  // Before paint: a new target is on screen in the same frame as the screen that caused it.
  useLayoutEffect(() => {
    const newTurn = lastTurn.current !== turn;
    lastTurn.current = turn;
    store.push(target, urgent || newTurn);
  }, [store, target, urgent, turn]);

  useEffect(() => () => store.dispose(), [store]);

  return shown;
}
