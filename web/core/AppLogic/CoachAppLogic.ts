/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/CoachAppLogic.swift. Small pure rules the coach screen (Ask) needs: berries for coach
// moments, which kind of bill a detected bill is, and Liito's mood while Sisu works.
import type { RecurringBill } from "@/web/core/Models";
import type { BillType } from "@/web/core/CoachModels";
import type { RiveBindings } from "@/web/core/RiveContract";

/**
 * Berries earned in the coach: answering a teaching question and deciding on an action. Each moment earns its
 * berries once (keyed by the card or action id), whatever the answer or decision. Berries are never taken away.
 * The JSON shape is Swift's Codable one (`awarded` is the encoded `Set<String>`), so it stores the same way.
 */
export interface CoachRewards {
  readonly berries: number;
  readonly awarded: readonly string[];
}

export namespace CoachRewards {
  export type Moment =
    /** The user answered a predict-before-reveal question. */
    | "quizAnswered"
    /** The user approved or declined an action. */
    | "actionDecided";

  export function reward(moment: Moment): number { return moment === "quizAnswered" ? 5 : 10; }

  export function make(): CoachRewards { return { berries: 0, awarded: [] }; }

  /** Records the moment and returns the berries earned: the moment's reward the first time, 0 after that. */
  export function award(rewards: CoachRewards, moment: Moment, id: string): { rewards: CoachRewards; earned: number } {
    const key = moment + "/" + id;
    if (rewards.awarded.includes(key)) return { rewards, earned: 0 };
    const earned = reward(moment);
    return { rewards: { berries: rewards.berries + earned, awarded: [...rewards.awarded, key] }, earned };
  }

  /** `+5` for the label next to a quiz or action. */
  export function rewardText(moment: Moment): string { return `+${reward(moment)}`; }

  /** Decodes a stored value (Swift `JSONDecoder`); null when it is not a `CoachRewards`. */
  export function decode(value: unknown): CoachRewards | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.berries !== "number" || !Array.isArray(v.awarded) || !v.awarded.every((key) => typeof key === "string")) return null;
    return { berries: v.berries, awarded: [...new Set(v.awarded as string[])] };
  }
}

export namespace CoachBillMatch {
  /**
   * The kind of bill Sisu can research offers for, from a detected bill's category and guessed name, or from free
   * text (Swift `billType(for:)` and `billType(text:)`). Null when it is none of electricity, mobile or internet.
   */
  export function billType(bill: RecurringBill | string): BillType | null {
    return billTypeOfText(typeof bill === "string" ? bill : bill.category + " " + bill.guessLabel);
  }

  /** The same rule on free text (a confirmed name such as `Helen sähkö`). Swift `billType(text:)`. */
  export function billTypeOfText(text: string): BillType | null {
    const words = text.toLowerCase();
    const any = (list: string[]) => list.some((word) => words.includes(word));
    if (any(["electric", "sähkö", "sahko", "energia", "energy", "power"])) return "electricity" as BillType;
    if (any(["internet", "broadband", "laajakaista", "fiber", "fibre", "valokuitu"])) return "internet" as BillType;
    if (any(["mobile", "phone", "puhelin", "liittymä", "liittyma", "telecom", "telia", "elisa", "dna"])) return "mobile" as BillType;
    return null;
  }
}

/** Liito's mood on the Ask screen. Never sad: it follows what Sisu is doing, not the user's money. */
export namespace CoachMood {
  /**
   * @param isThinking a turn is running.
   * @param stageJustLanded a stage card arrived in the last moment.
   * @param celebrating the user just approved an action.
   */
  export function liito(isThinking: boolean, stageJustLanded: boolean, celebrating: boolean): RiveBindings.LiitoMood {
    if (celebrating) return "cheering";
    if (stageJustLanded) return "found";
    if (isThinking) return "thinking";
    return "idle";
  }
}

/** The names of the research services as the brand writes them (the server sends `exa`, `context.dev`). */
export namespace CoachProviderName {
  export function display(raw: string): string {
    switch (raw.toLowerCase()) {
      case "exa": return "Exa";
      case "context.dev": case "contextdev": return "Context.dev";
      case "exa+context.dev": return "Exa and Context.dev";
      default: return raw;
    }
  }
}
