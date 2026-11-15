// The teaching path's data: the seven teaching cards (live from the backend, or the bundled sample), the
// lessons done per customer (kept in the app's defaults), and the lesson that is open. Port of
// ios/Sisu/Features/Path/PathModel.swift. Logic is in web/core's LessonProgress and LessonPathPresenter; this
// only loads, stores and remembers what is on screen.
//
// A small observable (subscribe / getSnapshot, an immutable snapshot replaced on every change) for
// useSyncExternalStore, like the stores in web/app. Reads (`allDone`, `snapshot`) are synchronous, so a
// caller sees a change right after making it, as with the Swift @Observable class.
import { CoachClient } from "@/web/core/CoachClient";
import type { TeachingCard } from "@/web/core/CoachModels";
import { CoachText } from "@/web/core/CoachPresentation";
import { CoachErrors, type CoachDataLabel } from "@/web/core/CoachSession";
import { LessonPathPresenter, LessonProgress, LessonWording, type LessonNode } from "@/web/core/AppLogic/LessonPath";
import { LessonAttempt } from "@/web/core/AppLogic/LessonFollowUps";
import { rawOf } from "@/web/core/Presentation";
import { Keys } from "@/web/app/AppState";
import type { SisuDefaults } from "@/web/app/Defaults";

/** The lesson the sheet shows. `token` counts presentations, so a lesson opened again starts fresh. */
export interface OpenLesson {
  readonly card: TeachingCard;
  readonly id: string;
  readonly token: number;
  /** Where the person was in this lesson (restored after "Ask Sisu"). */
  readonly attempt: LessonAttempt;
}

export type PathState =
  | { readonly kind: "idle" | "loading" | "loaded" | "empty" }
  | { readonly kind: "failed"; readonly message: string };

export interface PathSnapshot {
  readonly state: PathState;
  readonly cards: readonly TeachingCard[];
  readonly progress: LessonProgress;
  /** `Sample data` or `Mock data`; null when the cards are live. */
  readonly dataTag: string | null;
  /** The lesson sheet. */
  readonly openLesson: OpenLesson | null;
  /** The line shown for a moment after tapping a locked lesson (`Finish "Three baskets" first.`). */
  readonly lockedNotice: { readonly text: string; readonly token: number } | null;
}

const initial: PathSnapshot = {
  state: { kind: "idle" },
  cards: [],
  progress: LessonProgress.make(),
  dataTag: null,
  openLesson: null,
  lockedNotice: null,
};

export class PathModel {
  private snapshot: PathSnapshot = initial;
  private listeners = new Set<() => void>();
  private customerId = "";
  private defaults: SisuDefaults | null = null;
  private loadedKey: string | null = null;
  /** The load in flight for `loadedKey`, so a second caller (a re-run effect) waits for the same one. */
  private pending: Promise<void> | null = null;
  private generation = 0;
  private presentations = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): PathSnapshot => this.snapshot;

  private set(change: Partial<PathSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }

  get state(): PathState { return this.snapshot.state; }
  get cards(): readonly TeachingCard[] { return this.snapshot.cards; }
  get nodes(): LessonNode[] { return LessonPathPresenter.nodes(this.snapshot.cards, this.snapshot.progress); }
  get allDone(): boolean {
    return LessonProgress.allDone(this.snapshot.progress, this.snapshot.cards.map((card) => card.concept));
  }

  /** Loads the cards for this customer and data source, once per combination. */
  load(customerId: string, live: boolean, baseURL: string, defaults: SisuDefaults, force = false): Promise<void> {
    const key = `${customerId}|${live}|${baseURL}`;
    if (!force && key === this.loadedKey) return this.pending ?? Promise.resolve();
    this.loadedKey = key;
    this.customerId = customerId;
    this.defaults = defaults;
    const generation = ++this.generation;
    this.set({ progress: PathModel.read(customerId, defaults), state: { kind: "loading" } });
    const client = live ? CoachClient.live(baseURL) : CoachClient.sample();
    const run = async () => {
      try {
        const cards = (await client.teachingCards(customerId)).map(LessonWording.card);
        let label: CoachDataLabel = client.kind === "bundledSample" ? "sample" : "live";
        if (label === "live") {
          const warm = await client.warm().catch(() => null);
          if (warm?.mock) label = "mock";
        }
        if (generation !== this.generation) return;
        this.set({ cards, dataTag: CoachText.dataTag(label), state: { kind: cards.length === 0 ? "empty" : "loaded" } });
      } catch (error) {
        if (generation !== this.generation) return;
        this.set({ state: { kind: "failed", message: CoachErrors.sentence(error) } });
        this.loadedKey = null;
      }
    };
    const pending = run().finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }

  retry(customerId: string, live: boolean, baseURL: string, defaults: SisuDefaults): Promise<void> {
    return this.load(customerId, live, baseURL, defaults, true);
  }

  /** Counts a lesson as done (once), after a right answer. Returns true when that finished the whole path. */
  complete(card: TeachingCard): boolean {
    const wasAllDone = this.allDone;
    const { progress, added } = LessonProgress.complete(this.snapshot.progress, card.concept);
    if (added) {
      this.set({ progress });
      this.save();
    }
    return added && !wasAllDone && this.allDone;
  }

  /** Opens a lesson in the sheet, where the person left it if they stepped out to ask Sisu. A locked lesson does
   *  not open: it says which lesson comes first. */
  open(card: TeachingCard) {
    const concepts = this.snapshot.cards.map((c) => c.concept);
    if (!LessonProgress.isOpen(this.snapshot.progress, concepts, card.concept)) {
      const reason = this.nodes.find((node) => node.concept === card.concept)?.lockedReason ?? "Finish the lessons before this one first.";
      this.presentations += 1;
      this.set({ lockedNotice: { text: reason, token: this.presentations } });
      return;
    }
    const saved = this.readAttempt();
    const attempt = saved && saved.concept === card.id ? saved : LessonAttempt.make(card.concept);
    this.presentations += 1;
    this.set({ openLesson: { card, id: card.id, token: this.presentations, attempt }, lockedNotice: null });
  }

  /** A lesson asked for from outside the path (an answer's "Open the lesson", or the place kept by "Ask Sisu").
   *  When the unlock order still keeps it closed, the lesson that is up next opens instead and the notice says
   *  why, so the order stays honest and the person still lands in a lesson they can do now. */
  openOrNext(card: TeachingCard) {
    const concepts = this.snapshot.cards.map((c) => c.concept);
    if (LessonProgress.isOpen(this.snapshot.progress, concepts, card.concept)) return this.open(card);
    const upNext = LessonProgress.next(this.snapshot.progress, concepts);
    const next = this.snapshot.cards.find((c) => upNext !== null && rawOf(c.concept) === rawOf(upNext));
    if (!next) return this.open(card);
    this.open(next);
    this.presentations += 1;
    this.set({ lockedNotice: { text: `"${card.title}" opens after "${next.title}", so that lesson comes first.`, token: this.presentations } });
  }

  /** Keeps the place in the open lesson (each answer, and before "Ask Sisu" leaves the tab). */
  keep(attempt: LessonAttempt, resume = false) {
    this.defaults?.setJSON(PathModel.attemptKey(this.customerId), { ...attempt, resume });
  }

  /** The lesson to reopen when the path comes back (after "Ask Sisu"), once. */
  takeResume(): TeachingCard | null {
    const stored = this.defaults?.json(PathModel.attemptKey(this.customerId)) as Record<string, unknown> | null | undefined;
    const attempt = LessonAttempt.decode(stored);
    if (!attempt || stored?.resume !== true) return null;
    this.keep(attempt, false);
    return this.snapshot.cards.find((card) => card.id === attempt.concept) ?? null;
  }

  /** The lesson is finished or closed for good: forget the place. */
  forgetAttempt() {
    this.defaults?.remove(PathModel.attemptKey(this.customerId));
  }

  /** The sheet went away (dragged down, backdrop, Escape, Done). The place stays, so it opens where it was. */
  closeLesson() {
    if (this.snapshot.openLesson) this.set({ openLesson: null });
  }

  clearLockedNotice() {
    if (this.snapshot.lockedNotice) this.set({ lockedNotice: null });
  }

  /** Screenshots only: start with the first `count` lessons done. */
  pretendDone(count: number) {
    const progress = this.snapshot.cards
      .slice(0, Math.max(count, 0))
      .reduce((done, card) => LessonProgress.complete(done, card.concept).progress, this.snapshot.progress);
    this.set({ progress });
    this.save();
  }

  private save() {
    this.defaults?.setJSON(PathModel.key(this.customerId), this.snapshot.progress);
  }

  private static read(customerId: string, defaults: SisuDefaults): LessonProgress {
    return LessonProgress.decode(defaults.json(PathModel.key(customerId))) ?? LessonProgress.make();
  }

  private readAttempt(): LessonAttempt | null {
    return LessonAttempt.decode(this.defaults?.json(PathModel.attemptKey(this.customerId)));
  }

  private static key(customerId: string): string { return `${Keys.lessonsPrefix}${customerId}`; }
  private static attemptKey(customerId: string): string { return `${Keys.lessonAttemptPrefix}${customerId}`; }
}
