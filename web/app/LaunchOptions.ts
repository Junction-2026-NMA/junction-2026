// Launch options the app understands: port of ios/Sisu/App/LaunchOptions.swift. iOS reads launch arguments
// (`-sisu.tab ask`); the web reads the same names, minus the `-sisu.` prefix, from the URL query
// (`/app?tab=sisu`), so tests can deep-link like the iOS screenshot harness.
//
//   sample=1                  bundled sample data only, no network
//   baseURL=<url>             the backend address (default "": this site's own /api routes)
//   customer=<id>             skip the picker and open this customer (CUST04974, CUST04414, CUST02003)
//   tab=today|sisu|path       (talk: the old name of sisu; ask: Sisu with the conversation sheet up,
//                             web/features/Talk/TalkLaunch.ts)
//   onboarding=reset|done     reset: the first-run flow from its first screen, as on a clean install
//                             (progress, names and the chosen customer are cleared); done: skip it. Without it,
//                             customer=… or screenshots=1 count as done, so those launches land on their
//                             screens; otherwise the stored completion decides.
//   motionScale=<n>           slows the first-run transitions n times
//   motionDelay=<s>           applies each first-run tap s seconds later
//
// For screenshots only:
//   screenshots=1             a fresh, throwaway settings store (in memory), so every run starts at day 1 with 0 berries
//   scroll=baskets|bill|insights|end|futures   scroll Today or Jars to that section
//   sheet=maths|transactions|settings          open that sheet on Today
//   answer=nothing|save|invest                 answer the Jars question
import { BranchId } from "@/web/core/Models";
import { OnboardingLaunch } from "@/web/core/AppLogic/Onboarding";
import { AppTab } from "./AppTypes";
import { localDefaults, memoryDefaults, type SisuDefaults } from "./Defaults";

export interface LaunchOptions {
  readonly sampleOnly: boolean | null;
  readonly baseURL: string | null;
  readonly customerId: string | null;
  readonly tab: AppTab | null;
  readonly screenshots: boolean;
  readonly scroll: string | null;
  readonly sheet: string | null;
  readonly answer: BranchId | null;
  readonly onboarding: OnboardingLaunch | null;
  /** How many times slower the first-run transitions play. 1 normally. */
  readonly motionScale: number;
  /** Seconds between a first-run tap and its transition. 0 normally. */
  readonly motionDelay: number;
  /** Where settings and progress are kept (localStorage, or memory with screenshots=1). */
  readonly defaults: SisuDefaults;
}

/** The query of the page, or an empty one outside a browser. */
export function launchQuery(): URLSearchParams {
  try {
    return new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

/** A query parameter's value: null when absent or empty (an empty `-sisu.x` argument has no value either). */
export function launchValue(query: URLSearchParams, name: string): string | null {
  const value = query.get(name);
  return value === null || value === "" ? null : value;
}

/** `UserDefaults.bool`: 1, true, yes count as on. */
function flag(value: string): boolean {
  const lower = value.toLowerCase();
  return lower === "1" || lower === "true" || lower === "yes";
}

let cached: LaunchOptions | null = null;

export const LaunchOptions = {
  parse(query: URLSearchParams, defaults?: SisuDefaults): LaunchOptions {
    const value = (name: string) => launchValue(query, name);
    const sample = value("sample");
    const screenshots = value("screenshots") === "1";
    const delay = Number(value("motionDelay"));
    const scale = Number(value("motionScale"));
    return {
      sampleOnly: sample === null ? null : flag(sample),
      baseURL: query.has("baseURL") ? query.get("baseURL") ?? "" : null,
      customerId: value("customer"),
      tab: AppTab.fromArgument(value("tab")),
      screenshots,
      scroll: value("scroll"),
      sheet: value("sheet"),
      answer: BranchId.fromRaw(value("answer")),
      onboarding: OnboardingLaunch.fromArgument(value("onboarding")),
      motionDelay: Number.isFinite(delay) && delay > 0 ? Math.min(delay, 5) : 0,
      motionScale: Number.isFinite(scale) && scale > 0 ? Math.min(scale, 10) : 1,
      defaults: defaults ?? (screenshots ? memoryDefaults() : localDefaults()),
    };
  },

  /** Swift `LaunchOptions.current`: read once from the page's URL. */
  current(): LaunchOptions {
    cached ??= LaunchOptions.parse(launchQuery());
    return cached;
  },

  /** Launches that open a screen directly (a customer, or screenshot mode) skip the first run by default. */
  skipsOnboardingByDefault(options: LaunchOptions): boolean {
    return options.customerId !== null || options.screenshots;
  },
} as const;
