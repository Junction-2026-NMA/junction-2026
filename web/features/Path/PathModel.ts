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
import { LessonPathPresenter, LessonProgress, type LessonNode } from "@/web/core/AppLogic/LessonPath";
import type { SisuDefaults } from "@/web/app/Defaults";

/** The lesson the sheet shows. `token` counts presentations, so a lesson opened again starts fresh. */
export interface OpenLesson {
  readonly card: TeachingCard;
  readonly id: string;
  readonly token: number;
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
  /** Set when the last lesson is finished; the screen shows the Rive celebration and clears it. */
  readonly celebration: { readonly headline: string; readonly detail: string } | null;
}

const initial: PathSnapshot = {
  state: { kind: "idle" },
  cards: [],
  progress: LessonProgress.make(),
  dataTag: null,
  openLesson: null,
  celebration: null,
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
        const cards = await client.teachingCards(customerId);
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

  /** Counts a lesson as done (once). Returns the berries earned now. */
  complete(card: TeachingCard): number {
    const { progress, earned } = LessonProgress.complete(this.snapshot.progress, card.concept);
    if (earned > 0) {
      this.set({ progress });
      this.save();
    }
    return earned;
  }

  /** Called when the user closes a lesson with Done. Celebrates when that finished the whole path. */
  finished(_card: TeachingCard, justCompletedPath: boolean) {
    this.set({
      openLesson: null,
      ...(justCompletedPath ? { celebration: LessonPathPresenter.celebration(this.snapshot.cards) } : {}),
    });
  }

  /** Opens a lesson in the sheet (Swift `path.openLesson = OpenLesson(card:)`). */
  open(card: TeachingCard) {
    this.presentations += 1;
    this.set({ openLesson: { card, id: card.id, token: this.presentations } });
  }

  /** The sheet went away (dragged down, backdrop, Escape). */
  closeLesson() {
    if (this.snapshot.openLesson) this.set({ openLesson: null });
  }

  clearCelebration() {
    if (this.snapshot.celebration) this.set({ celebration: null });
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

  private static key(customerId: string): string { return `sisu.lessons.${customerId}`; }
}
