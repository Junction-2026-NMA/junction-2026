// The snapshot of AppModel (web/app/AppModel.ts): every value of ios/Sisu/App/AppModel.swift a screen reads,
// immutable, replaced on every change. Derived values (isLive, flaggedBill…) are
// computed into the snapshot, so `useApp()` and `useAppSelector()` see them like stored ones.
import type { DataSourceKind } from "@/web/core/API";
import type { DemoCustomer, Overview, RecurringBill } from "@/web/core/Models";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { DayStamp } from "@/web/core/AppLogic/DayStamp";
import { OnboardingFlow } from "@/web/core/AppLogic/Onboarding";
import type { AppPrefs } from "./AppPrefs";
import type { SisuDefaults } from "./Defaults";
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
  /** True from launch until the stored (or `customer=`) profile is chosen again with its overview and coach session,
   *  or found missing: the root shows only the background then, never the profile chooser or a half-loaded Sisu tab
   *  (RootView's "restoring" route). */
  readonly restoringCustomer: boolean;
  readonly overview: Overview | null;
  readonly overviewState: LoadState;
  // Navigation
  readonly tab: AppTab;
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
  /** The old daily-actions progress (streak, berries) and coach rewards: no longer written, only cleared on reset. */
  progress: "sisu.progress",
  billNames: "sisu.billNames",
  coachRewards: "sisu.coachRewards",
  /** Not "sisu.onboarding": on iOS that name is the launch argument, which would shadow the stored value. */
  onboarding: "sisu.onboardingFlow",
  /** AppPrefs as JSON (web only). */
  prefs: "sisu.prefs",
  /** The saved conversations of every customer (web only; web/core/ConversationHistory.ts). */
  conversations: "sisu.conversations",
  /** "I speak" and "Sisu answers in" (web only; web/voice/VoicePrefs.ts). */
  voiceLanguages: "sisu.voiceLanguages",
  /** The project findings seen on this device, by customer (web only; web/app/ProjectStore.ts). */
  projectsSeen: "sisu.projectsSeen",
  /** Prefixes of per-customer values: lesson progress and a lesson left for "Ask Sisu" (web/features/Path/PathModel.ts). */
  lessonsPrefix: "sisu.lessons.",
  lessonAttemptPrefix: "sisu.lessonAttempt.",
  /** v2 payday: the payday and bills the person confirmed, per customer (web/app/PaydayStore.ts). */
  paydayPrefix: "sisu.payday.",
} as const;

/** What starting over removes ("Start the demo over" and `onboarding=reset`): names, old progress, preferences,
 *  voice languages, conversations, lesson progress and seen findings. The address and sample switch stay. */
export function clearPersonalData(defaults: SisuDefaults): void {
  [Keys.progress, Keys.billNames, Keys.coachRewards, Keys.prefs, Keys.voiceLanguages, Keys.conversations, Keys.projectsSeen]
    .forEach((key) => defaults.remove(key));
  [Keys.lessonsPrefix, Keys.lessonAttemptPrefix, Keys.paydayPrefix].forEach((prefix) => defaults.removePrefix(prefix));
}

export const billKey = (customerId: string, billId: string): string => `${customerId}/${billId}`;

/** `defaults.dictionary(forKey:) as? [String: String]`. */
export function stringDictionary(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([, v]) => typeof v === "string") ? Object.fromEntries(entries) as Record<string, string> : {};
}
