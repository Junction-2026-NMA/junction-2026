// The snapshot of AppModel (web/app/AppModel.ts): every value of ios/Sisu/App/AppModel.swift a screen reads,
// immutable, replaced on every change. Derived values (isLive, berries, flaggedBill, todayProgress…) are
// computed into the snapshot, so `useApp()` and `useAppSelector()` see them like stored ones.
import type { DataSourceKind } from "@/web/core/API";
import type { DemoCustomer, Overview, RecurringBill } from "@/web/core/Models";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { CoachRewards } from "@/web/core/AppLogic/CoachAppLogic";
import { DailyProgress, DayStamp, type DailyAction } from "@/web/core/AppLogic/DailyProgress";
import { OnboardingFlow } from "@/web/core/AppLogic/Onboarding";
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
  /** The first-run flow. Complete after the first visit; "Start the demo over" restarts it. */
  readonly onboarding: OnboardingFlow;
  /** The transactions sheet MainScreen shows, or null. */
  readonly evidence: EvidenceRequest | null;
  /** The sheet Today shows, or null. */
  readonly todaySheet: TodaySheet | null;
  // Progress and hooks
  readonly progress: DailyProgress;
  /** Confirmed bill names by "customerId/billId". */
  readonly confirmedBillNames: Readonly<Record<string, string>>;
  /** Euros a month freed by switches the user approved (follows the coach session). */
  readonly approvedMonthlySaving: number;
  /** Bumped by `startInvestigation()`. */
  readonly investigationRequests: number;
  /** Bumped whenever berries are earned, so a Rive trigger can celebrate (`drop#${berryDrops}`). */
  readonly berryDrops: number;
  /** Set when the last of today's actions is done; MainScreen shows the Rive celebration and clears it. */
  readonly celebration: Celebration | null;
  /** Berries earned in the coach (quiz answered, action decided). */
  readonly coachRewards: CoachRewards;
}

/** The snapshot: the stored values plus the derived ones. */
export interface AppState extends AppStored {
  /** `api.kind == .live`. Anything not live must show the "Sample data" tag. */
  readonly isLive: boolean;
  /** Every berry: today's actions plus the coach's. */
  readonly berries: number;
  /** `"\(berries)"`, what the berries pill shows. */
  readonly berriesText: string;
  /** The bill Today flags (TodayPresenter.flaggedBill), null without an overview. */
  readonly flaggedBill: RecurringBill | null;
  /** `onboarding.firstInsightPending`: Today shows FirstInsightCallout until `dismissFirstInsight()`. */
  readonly firstInsightPending: boolean;
  /** `onboarding.isActive`. */
  readonly onboardingActive: boolean;
  /** The share of today's actions done, 0…1 (`todayProgress`). */
  readonly todayProgress: number;
  /** The actions done today (`isDone(_:)` for each). */
  readonly doneToday: readonly DailyAction[];
  /** The day the derived values were computed for. */
  readonly today: DayStamp;
}

export function derive(stored: AppStored, today: DayStamp): AppState {
  const berries = stored.progress.berries + stored.coachRewards.berries;
  return {
    ...stored,
    isLive: stored.apiKind === "live",
    berries,
    berriesText: `${berries}`,
    flaggedBill: stored.overview ? TodayPresenter.flaggedBill(stored.overview) : null,
    firstInsightPending: stored.onboarding.firstInsightPending,
    onboardingActive: OnboardingFlow.isActive(stored.onboarding),
    todayProgress: DailyProgress.progress(stored.progress, today),
    doneToday: DailyProgress.done(stored.progress, today),
    today,
  };
}

/** Swift `AppModel.Keys`: the same UserDefaults keys, in localStorage. */
export const Keys = {
  baseURL: "sisu.baseURL",
  sample: "sisu.sample",
  customer: "sisu.customer",
  progress: "sisu.progress",
  billNames: "sisu.billNames",
  coachRewards: "sisu.coachRewards",
  /** Not "sisu.onboarding": on iOS that name is the launch argument, which would shadow the stored value. */
  onboarding: "sisu.onboardingFlow",
} as const;

export const billKey = (customerId: string, billId: string): string => `${customerId}/${billId}`;

/** `defaults.dictionary(forKey:) as? [String: String]`. */
export function stringDictionary(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([, v]) => typeof v === "string") ? Object.fromEntries(entries) as Record<string, string> : {};
}
