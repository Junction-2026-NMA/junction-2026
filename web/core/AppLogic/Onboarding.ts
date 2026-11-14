/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/Onboarding.swift. The first-run flow: a welcome, what Sisu does, choosing a demo
// profile, and a short "reading your transactions" moment that waits for the real overview, then Today with the
// first insight highlighted. Pure and immutable: every step returns the next flow. The app stores `OnboardingFlow`
// (Swift's Codable JSON shape) and decides the first screen with `OnboardingFlow.atLaunch`.

/** The screens of the first run, in order. Today follows the last one. */
export type OnboardingStep =
  /** Liito and one line on what Sisu does. */
  | "welcome"
  /** The three things Sisu helps with. */
  | "promise"
  /** Choosing one of the three demo profiles, with the demo disclosure. */
  | "profile"
  /** "Sisu is reading 12 months of transactions": waits for the overview to load. */
  | "reading";

export namespace OnboardingStep {
  export const allCases: readonly OnboardingStep[] = ["welcome", "promise", "profile", "reading"];
  /** 1-based position, for "Step 2 of 4" and the progress bar. */
  export function number(step: OnboardingStep): number { return Math.max(allCases.indexOf(step), 0) + 1; }
}

/** What the `-sisu.onboarding` launch argument (on the web: the `onboarding` query parameter) asks for. */
export type OnboardingLaunch =
  /** Start at the first screen, as on a clean install. */
  | "reset"
  /** Skip the first run. */
  | "done";

export namespace OnboardingLaunch {
  /** Swift `OnboardingLaunch(argument:)`: case-insensitive; null for anything else. */
  export function fromArgument(argument: string | null | undefined): OnboardingLaunch | null {
    const value = argument?.toLowerCase();
    return value === "reset" || value === "done" ? value : null;
  }
}

/** Where the user is in the first run, whether it is finished, and whether Today still owes the first insight. */
export interface OnboardingFlow {
  /** The screen shown while the flow is not complete. */
  readonly step: OnboardingStep;
  /** True once the user reached Today through the flow (or the flow was skipped by a launch argument). */
  readonly isComplete: boolean;
  /** True from finishing the flow until the user dismisses the first-insight callout on Today. */
  readonly firstInsightPending: boolean;
}

export namespace OnboardingFlow {
  export function make(step: OnboardingStep = "welcome", isComplete = false, firstInsightPending = false): OnboardingFlow {
    return { step, isComplete, firstInsightPending };
  }

  /** A clean install: the welcome screen. */
  export const fresh: OnboardingFlow = make();
  /** Already done, with no callout owed (tests and screenshots that open a screen directly). */
  export const skipped: OnboardingFlow = make("reading", true, false);

  export const stepCount = OnboardingStep.allCases.length;

  export function equals(a: OnboardingFlow, b: OnboardingFlow): boolean {
    return a.step === b.step && a.isComplete === b.isComplete && a.firstInsightPending === b.firstInsightPending;
  }

  /** Whether the flow is on screen instead of the app. */
  export function isActive(flow: OnboardingFlow): boolean { return !flow.isComplete; }

  /** Share of the flow reached, for the progress bar: 0.25 on the welcome screen, 1 while reading. */
  export function progress(flow: OnboardingFlow): number { return OnboardingStep.number(flow.step) / stepCount; }

  /** The intro screens can be skipped straight to the profile choice; the profile and reading cannot. */
  export function canSkip(flow: OnboardingFlow): boolean { return isActive(flow) && (flow.step === "welcome" || flow.step === "promise"); }

  /** The intro screens and the profile choice can go back one screen. */
  export function canGoBack(flow: OnboardingFlow): boolean { return isActive(flow) && (flow.step === "promise" || flow.step === "profile"); }

  /** Continue: welcome to promise to profile. The profile moves on only by choosing; reading only by `finish`. */
  export function advance(flow: OnboardingFlow): OnboardingFlow {
    if (!isActive(flow)) return flow;
    if (flow.step === "welcome") return { ...flow, step: "promise" };
    if (flow.step === "promise") return { ...flow, step: "profile" };
    return flow;
  }

  /** Back one screen, from the promise or the profile screen. */
  export function back(flow: OnboardingFlow): OnboardingFlow {
    if (!canGoBack(flow)) return flow;
    if (flow.step === "promise") return { ...flow, step: "welcome" };
    if (flow.step === "profile") return { ...flow, step: "promise" };
    return flow;
  }

  /** Skip the intro: straight to choosing a profile. */
  export function skipIntro(flow: OnboardingFlow): OnboardingFlow {
    return canSkip(flow) ? { ...flow, step: "profile" } : flow;
  }

  /** A profile was chosen: show the reading moment while its overview loads. */
  export function profileChosen(flow: OnboardingFlow): OnboardingFlow {
    return isActive(flow) && flow.step === "profile" ? { ...flow, step: "reading" } : flow;
  }

  /** The overview could not be loaded: back to the profile choice to try again. */
  export function readingFailed(flow: OnboardingFlow): OnboardingFlow {
    return isActive(flow) && flow.step === "reading" ? { ...flow, step: "profile" } : flow;
  }

  /** The overview is loaded and the user goes on: the flow is complete and Today owes the first insight. */
  export function finish(flow: OnboardingFlow): OnboardingFlow {
    return isActive(flow) && flow.step === "reading" ? { ...flow, isComplete: true, firstInsightPending: true } : flow;
  }

  /** The user tapped the first-insight callout away. */
  export function dismissFirstInsight(flow: OnboardingFlow): OnboardingFlow { return { ...flow, firstInsightPending: false }; }

  /** "Start the demo over": back to the welcome screen. */
  export function restart(_flow: OnboardingFlow): OnboardingFlow { return fresh; }

  /**
   * The flow to show at launch.
   * - `reset` starts at the welcome screen, as on a clean install.
   * - `done` skips the flow (keeping a stored callout if one is still owed).
   * - Otherwise, when `skipsByDefault` (opened straight at a customer or in screenshot mode), the flow counts as done.
   * - Otherwise the stored flow: complete stays complete; an unfinished flow starts again at the welcome screen.
   */
  export function atLaunch(stored: OnboardingFlow | null | undefined, launch: OnboardingLaunch | null | undefined, skipsByDefault: boolean): OnboardingFlow {
    if (launch === "reset") return fresh;
    if (stored && stored.isComplete) return stored;
    if (launch === "done") return skipped;
    return skipsByDefault ? skipped : fresh;
  }

  /** Decodes a stored value (Swift `JSONDecoder`); null when it is not an `OnboardingFlow`. */
  export function decode(value: unknown): OnboardingFlow | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (!(OnboardingStep.allCases as readonly unknown[]).includes(v.step) || typeof v.isComplete !== "boolean" || typeof v.firstInsightPending !== "boolean") return null;
    return make(v.step as OnboardingStep, v.isComplete, v.firstInsightPending);
  }
}
