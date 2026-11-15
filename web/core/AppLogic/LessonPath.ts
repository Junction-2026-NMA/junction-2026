/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// The teaching path: which lessons are done, which one is open to start, and what the path screen shows. Lessons
// unlock one after another; a lesson counts as done only after a right answer (see LessonFollowUps.ts). No points,
// berries or streaks. Pure and immutable. Stored as `{ done: [...] }` (an old stored `berries` is ignored).
import type { ConceptId, TeachingCard } from "@/web/core/CoachModels";
import { rawOf } from "@/web/core/Presentation";

/** The lessons a customer has finished. A lesson counts once. */
export interface LessonProgress {
  /** Concept ids (`three-baskets`…) in the order they were finished. */
  readonly done: readonly string[];
}

export namespace LessonProgress {
  export function make(): LessonProgress { return { done: [] }; }

  export function isDone(progress: LessonProgress, concept: ConceptId): boolean { return progress.done.includes(rawOf(concept)); }

  /** Marks a lesson finished. `added` is false when it was already done. */
  export function complete(progress: LessonProgress, concept: ConceptId): { progress: LessonProgress; added: boolean } {
    if (isDone(progress, concept)) return { progress, added: false };
    return { progress: { done: [...progress.done, rawOf(concept)] }, added: true };
  }

  /** How many of these lessons are done. */
  export function doneCount(progress: LessonProgress, concepts: readonly ConceptId[]): number {
    return concepts.filter((concept) => isDone(progress, concept)).length;
  }

  /** The lesson to do now: the first one not done. Null when all are done. */
  export function next(progress: LessonProgress, concepts: readonly ConceptId[]): ConceptId | null {
    return concepts.find((concept) => !isDone(progress, concept)) ?? null;
  }

  /** True when every one of these lessons is done. */
  export function allDone(progress: LessonProgress, concepts: readonly ConceptId[]): boolean {
    return concepts.length > 0 && concepts.every((concept) => isDone(progress, concept));
  }

  /** A lesson can be opened when it is done (to look again) or it is the next one. Later ones wait. */
  export function isOpen(progress: LessonProgress, concepts: readonly ConceptId[], concept: ConceptId): boolean {
    if (isDone(progress, concept)) return true;
    const upNext = next(progress, concepts);
    return upNext !== null && rawOf(upNext) === rawOf(concept);
  }

  /** Decodes a stored value; null when it is not a `LessonProgress`. Older values with `berries` still decode. */
  export function decode(value: unknown): LessonProgress | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.done) || !v.done.every((id) => typeof id === "string")) return null;
    return { done: [...new Set(v.done as string[])] };
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
  /** Why a locked lesson cannot be opened yet (`Finish "Three baskets" first.`); null when it can. */
  readonly lockedReason: string | null;
}

export namespace LessonNode {
  export type State = "done" | "current" | "locked";

  /** The node's accessibility label, for example `Lesson 2 of 7, Safe to spend, done`. */
  export function accessibilityLabel(node: LessonNode, total: number): string {
    const status = node.state === "done" ? "done" : node.state === "current" ? "next up" : `locked. ${node.lockedReason ?? ""}`.trim();
    return `Lesson ${node.index + 1} of ${total}, ${node.title}, ${status}`;
  }
}

/** What the path screen shows. */
export namespace LessonPathPresenter {
  /** The winding shape: centre, right, further right, right, centre, left, further left… repeating. */
  export const swayPattern: readonly number[] = [0, 0.5, 0.85, 0.5, 0, -0.5, -0.85, -0.5];

  const conceptsOf = (cards: readonly TeachingCard[]) => cards.map((card) => card.concept);

  /** `Finish "Three baskets" first.` */
  export function lockedReason(waitingFor: string): string { return `Finish “${waitingFor}” first.`; }

  /** The nodes, in the order of the cards. */
  export function nodes(cards: readonly TeachingCard[], progress: LessonProgress): LessonNode[] {
    const upNext = LessonProgress.next(progress, conceptsOf(cards));
    const upNextTitle = cards.find((card) => upNext !== null && rawOf(card.concept) === rawOf(upNext))?.title ?? null;
    return cards.map((card, index) => {
      const state: LessonNode.State = LessonProgress.isDone(progress, card.concept) ? "done"
        : upNext != null && rawOf(card.concept) === rawOf(upNext) ? "current" : "locked";
      return {
        id: rawOf(card.concept), concept: card.concept, title: card.title, state, index,
        sway: swayPattern[index % swayPattern.length],
        badge: state === "done" ? "Done" : `Lesson ${index + 1}`,
        lockedReason: state === "locked" && upNextTitle ? lockedReason(upNextTitle) : null,
      };
    });
  }

  /** `3 of 7 lessons`. */
  export function progressText(cards: readonly TeachingCard[], progress: LessonProgress): string {
    return `${LessonProgress.doneCount(progress, conceptsOf(cards))} of ${cards.length} lessons`;
  }

  /** The share done, 0...1, for the Rive `ProgressBar`. */
  export function fraction(cards: readonly TeachingCard[], progress: LessonProgress): number {
    if (cards.length === 0) return 0;
    return LessonProgress.doneCount(progress, conceptsOf(cards)) / cards.length;
  }

  /** The line under the path's title. */
  export function subtitle(cards: readonly TeachingCard[], progress: LessonProgress): string {
    if (LessonProgress.allDone(progress, conceptsOf(cards))) return "Every lesson done. Open any one to look again.";
    return "Short lessons built from your own numbers, one after another.";
  }

  /** The line on the last lesson's finish. */
  export function pathFinished(cards: readonly TeachingCard[]): string {
    return `That was the last of the ${cards.length} lessons. The whole path is done.`;
  }

  /** The empty state, when the backend has no cards for this customer. */
  export const emptyText = "No lessons for this profile yet. Try again in a moment.";
}

/** The lessons' words, brought in line with the app's names for the baskets and the weekly budget. Only phrases
 *  change; every figure stays exactly as the backend computed it. */
export namespace LessonWording {
  const replacements: readonly (readonly [RegExp, string])[] = [
    [/what you must pay every month, what you must pay now and then, and everyday choices/g,
      "regular essentials you pay every month, occasional essentials you pay now and then, and everyday spending"],
    [/Must pay, every month/g, "Regular essentials"],
    [/Must pay, now and then/g, "Occasional essentials"],
    [/monthly must-pays/g, "regular essentials"],
    [/now-and-then costs/g, "occasional essentials"],
    [/must-pay costs/g, "essential costs"],
    [/Must-pay costs/g, "Essential costs"],
    [/must-pays?/gi, "essentials"],
    [/Everyday choices/g, "Everyday spending"],
    [/everyday choices/g, "everyday spending"],
    [/^Safe to spend$/g, "Estimated weekly budget"],
    [/Safe to spend is what is left/g, "Your estimated weekly budget is what is left"],
    [/Safe to spend per (week|month)/g, "Estimated budget per $1"],
    [/€-(\d[\d,]*) a month over/g, "€$1 a month over"],
  ];

  export function text(value: string): string {
    return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
  }

  /** The card with its words renamed (figures untouched). */
  export function card(card: TeachingCard): TeachingCard {
    return {
      ...card,
      title: text(card.title),
      explanation: text(card.explanation),
      question: text(card.question),
      options: card.options.map(text),
      reveal: text(card.reveal),
      facts: card.facts.map((fact) => ({ ...fact, label: text(fact.label) })),
    };
  }
}
