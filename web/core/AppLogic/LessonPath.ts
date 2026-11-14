/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/LessonPath.swift. The teaching path: which lessons are done, the berries they earned,
// and what the path screen shows. Pure and immutable; the JSON shape of `LessonProgress` is Swift's Codable one.
import type { ConceptId, TeachingCard } from "@/web/core/CoachModels";
import { TeachingQuiz } from "@/web/core/CoachPresentation";
import { rawOf } from "@/web/core/Presentation";
import type { DailyProgress } from "@/web/core/AppLogic/DailyProgress";

/** The lessons a customer has finished. A lesson counts once; berries only ever go up. */
export interface LessonProgress {
  /** Concept ids (`three-baskets`…) in the order they were finished. */
  readonly done: readonly string[];
  readonly berries: number;
}

export namespace LessonProgress {
  /** Berries for one finished lesson. */
  export const reward = 15;

  export function make(): LessonProgress { return { done: [], berries: 0 }; }

  export function isDone(progress: LessonProgress, concept: ConceptId): boolean { return progress.done.includes(rawOf(concept)); }

  /** Marks a lesson finished. Returns the next state and the berries earned now: `reward` the first time, 0 after that. */
  export function complete(progress: LessonProgress, concept: ConceptId): { progress: LessonProgress; earned: number } {
    if (isDone(progress, concept)) return { progress, earned: 0 };
    return { progress: { done: [...progress.done, rawOf(concept)], berries: progress.berries + reward }, earned: reward };
  }

  /** How many of these lessons are done. */
  export function doneCount(progress: LessonProgress, concepts: readonly ConceptId[]): number {
    return concepts.filter((concept) => isDone(progress, concept)).length;
  }

  /** The lesson the path suggests: the first one not done. Null when all are done. */
  export function next(progress: LessonProgress, concepts: readonly ConceptId[]): ConceptId | null {
    return concepts.find((concept) => !isDone(progress, concept)) ?? null;
  }

  /** True when every one of these lessons is done. */
  export function allDone(progress: LessonProgress, concepts: readonly ConceptId[]): boolean {
    return concepts.length > 0 && concepts.every((concept) => isDone(progress, concept));
  }

  /** Decodes a stored value (Swift `JSONDecoder`); null when it is not a `LessonProgress`. */
  export function decode(value: unknown): LessonProgress | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.done) || !v.done.every((id) => typeof id === "string") || typeof v.berries !== "number") return null;
    return { done: v.done as string[], berries: v.berries };
  }
}

/** One round node on the path. */
export interface LessonNode {
  readonly id: string;
  readonly concept: ConceptId;
  readonly title: string;
  readonly state: LessonNode.State;
  /** Its place along the path, 0 based. */
  readonly index: number;
  /** Sideways offset of the winding path, from -1 (left) to 1 (right). */
  readonly sway: number;
  /** The short text inside the node's sticker: `Done`, or `Lesson 4`. */
  readonly badge: string;
}

export namespace LessonNode {
  export type State = "done" | "current" | "upcoming";

  /** The node's accessibility label, for example `Lesson 2 of 7, Safe to spend, done`. */
  export function accessibilityLabel(node: LessonNode, total: number): string {
    const status = node.state === "done" ? "done" : node.state === "current" ? "next up" : "not started";
    return `Lesson ${node.index + 1} of ${total}, ${node.title}, ${status}`;
  }
}

/** What the path screen shows. */
export namespace LessonPathPresenter {
  /** The winding shape: centre, right, further right, right, centre, left, further left… repeating. */
  export const swayPattern: readonly number[] = [0, 0.5, 0.85, 0.5, 0, -0.5, -0.85, -0.5];

  const conceptsOf = (cards: readonly TeachingCard[]) => cards.map((card) => card.concept);

  /** The nodes, in the order of the cards. */
  export function nodes(cards: readonly TeachingCard[], progress: LessonProgress): LessonNode[] {
    const next = LessonProgress.next(progress, conceptsOf(cards));
    return cards.map((card, index) => {
      const state: LessonNode.State = LessonProgress.isDone(progress, card.concept) ? "done"
        : next != null && rawOf(card.concept) === rawOf(next) ? "current" : "upcoming";
      return {
        id: rawOf(card.concept), concept: card.concept, title: card.title, state, index,
        sway: swayPattern[index % swayPattern.length],
        badge: state === "done" ? "Done" : `Lesson ${index + 1}`,
      };
    });
  }

  /** `3 of 7 done`. */
  export function progressText(cards: readonly TeachingCard[], progress: LessonProgress): string {
    return `${LessonProgress.doneCount(progress, conceptsOf(cards))} of ${cards.length} done`;
  }

  /** The share done, 0...1, for the Rive `ProgressBar`. */
  export function fraction(cards: readonly TeachingCard[], progress: LessonProgress): number {
    if (cards.length === 0) return 0;
    return LessonProgress.doneCount(progress, conceptsOf(cards)) / cards.length;
  }

  /** The berries pill: the day's berries plus those the lessons earned. */
  export function berriesText(daily: DailyProgress, lessons: LessonProgress): string {
    return `${daily.berries + lessons.berries}`;
  }

  /** The line under the path's title. */
  export function subtitle(cards: readonly TeachingCard[], progress: LessonProgress): string {
    if (LessonProgress.allDone(progress, conceptsOf(cards))) return "Every lesson done. Open any one again.";
    return "Short lessons built from your own numbers. Any order is fine.";
  }

  /** `+15 berries` on the Done step, or null when this lesson was already counted. */
  export function rewardText(earned: number): string | null { return earned > 0 ? `+${earned} berries` : null; }

  /** The celebration after the last lesson. */
  export function celebration(cards: readonly TeachingCard[]): { headline: string; detail: string } {
    return { headline: "Path complete.", detail: `All ${cards.length} lessons done. Liito is proud of you.` };
  }

  /** The quiz feedback line. It praises the guess and never blames a miss. */
  export function feedback(quiz: TeachingQuiz): string | null {
    const correct = TeachingQuiz.isCorrect(quiz);
    if (correct == null) return null;
    return correct ? "Spot on." : "Close. Here is how it works out for you.";
  }

  /** The empty state, when the backend has no cards for this customer. */
  export const emptyText = "No lessons for this profile yet. Try again in a moment.";
}
