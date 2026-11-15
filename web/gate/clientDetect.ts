// Browser-side confirmation of the server's first guess. Call only in effects or event handlers.
import { isMobileLikeUserAgent, platformFromUserAgent, type DeviceKind, type InstallPlatform } from "./detect";

/** Phones are narrower than this on their short side, in CSS pixels (an iPad mini is 744). */
const PHONE_MAX_SHORT_SIDE = 740;

const CONTINUE_KEY = "sisu.gate.continueInBrowser";

function matches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

function isIPadLikeMac(): boolean {
  return /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

/** Phone = touch device with a coarse pointer, a mobile (or iPadOS-style Mac) user agent, and a small screen. */
export function detectClientKind(): DeviceKind {
  const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const coarse = matches("(pointer: coarse)") || matches("(any-pointer: coarse)");
  const mobileUa = isMobileLikeUserAgent(navigator.userAgent, navigator.maxTouchPoints);
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const small = shortSide > 0 && shortSide <= PHONE_MAX_SHORT_SIDE;
  return touch && coarse && mobileUa && small ? "phone" : "desktop";
}

/** True when launched from the home screen. */
export function detectStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || matches("(display-mode: standalone)") || matches("(display-mode: fullscreen)");
}

/** Install steps for this browser, using the real touch support to spot iPadOS. */
export function detectClientPlatform(): InstallPlatform {
  return platformFromUserAgent(navigator.userAgent, isIPadLikeMac());
}

export function readContinuedInBrowser(): boolean {
  try {
    return window.sessionStorage.getItem(CONTINUE_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberContinuedInBrowser(): void {
  try {
    window.sessionStorage.setItem(CONTINUE_KEY, "1");
  } catch {
    // Private mode or blocked storage: the choice simply lasts until the next reload.
  }
}
