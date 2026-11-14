// The small types of ios/Sisu/App/AppModel.swift: the tabs, an evidence request, Today's sheets, load states.
import type { EvidenceFilter } from "@/web/core/Models";
import { makeUUID } from "@/web/core/CoachSession";

/** Swift `enum AppTab: Int`. The web uses the case names; `AppTab.index(tab)` is the Swift rawValue. */
export type AppTab = "today" | "ask" | "jars" | "path";

const tabs: readonly AppTab[] = ["today", "ask", "jars", "path"];

export const AppTab = {
  allCases: tabs,

  /** Swift `AppTab(argument:)`: case-insensitive; null for anything else. */
  fromArgument(argument: string | null | undefined): AppTab | null {
    const value = argument?.toLowerCase();
    return (tabs as readonly string[]).includes(value ?? "") ? (value as AppTab) : null;
  },

  /** The Swift rawValue (0 for Today ... 3 for Path), e.g. for `RiveBindings.tabBar(index)`. */
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
