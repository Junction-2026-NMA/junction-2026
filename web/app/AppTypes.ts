// The small types of ios/Sisu/App/AppModel.swift: the tabs, an evidence request, Today's sheets, load states.
import type { EvidenceFilter } from "@/web/core/Models";
import { makeUUID } from "@/web/core/CoachSession";

/** Swift `enum AppTab: Int`: the three pages in the floating tab bar, in order. Talk (Liito and the hands-free
 *  conversation) is the main page and sits in the middle. The Ask conversation is a sheet on Talk; the Jars screen
 *  is not in the bar. The web uses the case names; `AppTab.index(tab)` is the Swift rawValue. */
export type AppTab = "today" | "talk" | "path";

const tabs: readonly AppTab[] = ["today", "talk", "path"];

export const AppTab = {
  allCases: tabs,

  /** Swift `AppTab(argument:)`, `tab=`: `today`, `talk` (or `ask`, which also opens the conversation sheet,
   *  web/features/Talk/TalkLaunch.ts) or `path`; case-insensitive; null for anything else (`jars` too). */
  fromArgument(argument: string | null | undefined): AppTab | null {
    switch (argument?.toLowerCase()) {
      case "today": return "today";
      case "talk": case "ask": return "talk";
      case "path": return "path";
      default: return null;
    }
  },

  /** The Swift rawValue (0 for Today ... 2 for Path). */
  index(tab: AppTab): number { return tabs.indexOf(tab); },

  fromIndex(index: number): AppTab | null { return tabs[index] ?? null; },
} as const;

/** Which transactions a sheet shows, and under what title. Swift `EvidenceRequest` (Identifiable by a UUID). */
export interface EvidenceRequest {
  readonly id: string;
  readonly title: string;
  readonly filter: EvidenceFilter | null;
}

export const EvidenceRequest = {
  make(title: string, filter: EvidenceFilter | null): EvidenceRequest {
    return { id: makeUUID(), title, filter };
  },
} as const;

/** The sheets Today can show. */
export type TodaySheet = "maths" | "settings";

/** Swift `enum LoadState { case idle, loading, loaded; case failed(String) }`. */
export type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded" }
  | { kind: "failed"; message: string };

export const LoadState = {
  idle: { kind: "idle" } as LoadState,
  loading: { kind: "loading" } as LoadState,
  loaded: { kind: "loaded" } as LoadState,
  failed(message: string): LoadState { return { kind: "failed", message }; },
  equals(a: LoadState, b: LoadState): boolean {
    return a.kind === b.kind && (a.kind !== "failed" || a.message === (b as { message: string }).message);
  },
} as const;

/** The celebration MainScreen shows when the last of today's actions is done. */
export interface Celebration {
  readonly headline: string;
  readonly detail: string;
}
