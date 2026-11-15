// The first run's timings (OnboardingMotion in ios/Sisu/Features/Onboarding/OnboardingView.swift), as CSS
// transition timings. `scale` is the `motionScale` launch option (1 normally). Null means instant (Reduce Motion,
// where SwiftUI's animation is nil).
import { springEasing, type SisuSpring } from "@/web/theme/theme";

const cache = new Map<string, SisuSpring>();

/** springEasing, remembered per (response, damping). */
function spring(response: number, damping: number): SisuSpring {
  const key = `${response}/${damping}`;
  const known = cache.get(key);
  if (known) return known;
  const made = springEasing(response, damping);
  cache.set(key, made);
  return made;
}

export interface MotionTiming extends SisuSpring {
  readonly delayMs: number;
}

export const OnboardingMotion = {
  /** Screens sliding in and out: spring(response: 0.5 × scale, dampingFraction: 0.86). */
  page(reduceMotion: boolean, scale: number): MotionTiming | null {
    return reduceMotion ? null : { ...spring(0.5 * scale, 0.86), delayMs: 0 };
  },

  /** How an element that arrives after its screen comes in: `index` staggers rows by 0.12 s × scale. */
  arrival(reduceMotion: boolean, scale: number, index: number): MotionTiming | null {
    return reduceMotion ? null : { ...spring(0.45 * scale, 0.8), delayMs: index * 120 * scale };
  },

  /** Any spring with this response and damping (the first insight's arrival). */
  spring(reduceMotion: boolean, response: number, damping: number): MotionTiming | null {
    return reduceMotion ? null : { ...spring(response, damping), delayMs: 0 };
  },

  /** A CSS `transition` value for these properties, or "none" when instant. */
  transition(timing: MotionTiming | null, properties: readonly string[]): string {
    if (!timing) return "none";
    return properties.map((p) => `${p} ${timing.durationMs}ms ${timing.easing} ${timing.delayMs}ms`).join(", ");
  },
} as const;

/** A light haptic where the browser can vibrate (.sensoryFeedback). iOS Safari has none. */
export function haptic(ms = 8): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    // Before the first tap Chromium refuses (and logs an error); later it is allowed.
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return;
    navigator.vibrate(ms);
  } catch {
    // No haptics here.
  }
}
