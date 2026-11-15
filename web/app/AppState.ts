// The snapshot of AppModel (web/app/AppModel.ts): every value of ios/Sisu/App/AppModel.swift a screen reads,
// immutable, replaced on every change. Derived values (isLive, flaggedBill…) are
// computed into the snapshot, so `useApp()` and `useAppSelector()` see them like stored ones.
import type { DataSourceKind } from "@/web/core/API";
import type { DemoCustomer, Overview, RecurringBill } from "@/web/core/Models";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { DailyProgress, DayStamp } from "@/web/core/AppLogic/DailyProgress";
import { OnboardingFlow } from "@/web/core/AppLogic/Onboarding";
import type { AppPrefs } from "./AppPrefs";
import type { AppTab, Celebration, EvidenceRequest, LoadState, TodaySheet } from "./AppTypes";

/** What AppModel stores. */
export interface AppStored {
  // Settings (stored)
  /** The backend address. "" is this site's own /api routes. Query `baseURL=`. */
  readonly baseURLString: string;
  /** Use the bundled sample data only, no network. Query `sample=1`. */
  readonly sampleOnly: boolean;
  // Data
  /** `api.kind`: which data source answers (`live` or `bundledSample`). */
  readonly apiKind: DataSourceKind;
  /** Whether the backend answered the last time it was asked. Null when it was not asked (sample only). */
  readonly backendAnswered: boolean | null;
  readonly customers: readonly DemoCustomer[];
  readonly customersState: LoadState;
  readonly customer: DemoCustomer | null;
  readonly overview: Overview | null;
  readonly overviewState: LoadState;
  // Navigation
  readonly tab: AppTab;
  /** The written conversation (the Ask screen) as a sheet over Talk: the cards, approvals, quizzes and typing.
   *  While it is up, the hands-free conversation holds its microphone. */
  readonly conversationShown: boolean;
  /** The chat history drawer on the Sisu tab (previous conversations, saved projects, New chat). */
  readonly historyOpen: boolean;
  /** The project (a watch id) shown on the Sisu tab, or null. */
  readonly openProjectId: string | null;
  /** The first-run flow. Complete after the first visit; "Start the demo over" restarts it. */
  readonly onboarding: OnboardingFlow;
  /** The transactions sheet MainScreen shows, or null. */
  readonly evidence: EvidenceRequest | null;
  /** The sheet Today shows, or null. */
  readonly todaySheet: TodaySheet | null;
  // Hooks
  /** @deprecated The old daily-actions progress (streak and berries), read from storage and never advanced since the
   *  rewards were removed (2026-11-15). Only Path's header still reads it until its pills go. */
  readonly progress: DailyProgress;
  /** Confirmed bill names by "customerId/billId". */
  readonly confirmedBillNames: Readonly<Record<string, string>>;
  /** Euros a month freed by switches the user approved (follows the coach session). */
  readonly approvedMonthlySaving: number;
  /** Bumped by `startInvestigation()`. */
  readonly investigationRequests: number;
  /** Set when a simulated action is approved; MainScreen shows the Rive celebration and clears it. */
  readonly celebration: Celebration | null;
  // Preferences (stored)
  /** Language, voice, spoken replies and the protected buffer (`Keys.prefs`). */
  readonly prefs: AppPrefs;
}

/** The snapshot: the stored values plus the derived ones. */
export interface AppState extends AppStored {
  /** `api.kind == .live`. Anything not live must show the "Sample data" tag. */
  readonly isLive: boolean;
  /** The bill Today flags (TodayPresenter.flaggedBill), null without an overview. */
  readonly flaggedBill: RecurringBill | null;
  /** `onboarding.firstInsightPending`: Today shows FirstInsightCallout until `dismissFirstInsight()`. */
  readonly firstInsightPending: boolean;
  /** `onboarding.isActive`. */
  readonly onboardingActive: boolean;
  /** The day the derived values were computed for. */
  readonly today: DayStamp;
}

export function derive(stored: AppStored, today: DayStamp): AppState {
  return {
    ...stored,
    isLive: stored.apiKind === "live",
    flaggedBill: stored.overview ? TodayPresenter.flaggedBill(stored.overview) : null,
    firstInsightPending: stored.onboarding.firstInsightPending,
    onboardingActive: OnboardingFlow.isActive(stored.onboarding),
    today,
  };
}

/** Swift `AppModel.Keys`: the same UserDefaults keys, in localStorage. */
export const Keys = {
  baseURL: "sisu.baseURL",
  sample: "sisu.sample",
  customer: "sisu.customer",
  /** The old daily-actions progress and coach rewards (no longer written; cleared on reset). */
  progress: "sisu.progress",
  billNames: "sisu.billNames",
  coachRewards: "sisu.coachRewards",
  /** Not "sisu.onboarding": on iOS that name is the launch argument, which would shadow the stored value. */
  onboarding: "sisu.onboardingFlow",
  /** AppPrefs as JSON (web only). */
  prefs: "sisu.prefs",
} as const;

export const billKey = (customerId: string, billId: string): string => `${customerId}/${billId}`;

/** `defaults.dictionary(forKey:) as? [String: String]`. */
export function stringDictionary(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([, v]) => typeof v === "string") ? Object.fromEntries(entries) as Record<string, string> : {};
}
