/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/CoachAppLogic.swift. Small pure rules the coach screen (Ask) needs: which kind of bill a
// detected bill is, and Liito's mood while Sisu works.
import type { RecurringBill } from "@/web/core/Models";
import type { BillType } from "@/web/core/CoachModels";
import type { RiveBindings } from "@/web/core/RiveContract";

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
