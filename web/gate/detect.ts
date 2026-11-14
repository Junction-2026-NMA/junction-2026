// Pure device and browser detection from a user-agent string and the URL query.
// Safe on the server and in the browser (no window access here; see clientDetect.ts).

export type DeviceKind = "phone" | "desktop";

/** Which install instructions fit this browser. */
export type InstallPlatform =
  | { kind: "iosSafari" }
  /** Chrome, Firefox, Edge... on iOS. `canAddToHomeScreen` is true from iOS 16.4. */
  | { kind: "iosOtherBrowser"; browser: string; canAddToHomeScreen: boolean }
  /** An app's built-in browser (Instagram, Facebook, LinkedIn...): it cannot install. */
  | { kind: "inAppBrowser"; app: string; ios: boolean }
  | { kind: "android"; browser: "chrome" | "edge" | "samsung" | "firefox" | "other" }
  | { kind: "other" };

/** Query overrides for screenshots and tests. Nothing is stored. */
export interface GateOverrides {
  device: DeviceKind | null;
  standalone: boolean;
}

/** What the gate shows. */
export type GateView = "qr" | "install" | "app";

const MOBILE_UA = /iPhone|iPod|Android.+Mobile|Mobile Safari|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i;
const IPAD_LIKE_MAC = /Macintosh/i;

/** First pass on the server: a mobile user agent counts as a phone. Tablets and computers get the QR page. */
export function kindFromUserAgent(ua: string, deviceType?: string): DeviceKind {
  if (deviceType === "mobile") return "phone";
  if (deviceType === "tablet") return "desktop";
  return MOBILE_UA.test(ua) ? "phone" : "desktop";
}

/** True for a mobile user agent, or a Mac user agent on a touch device (iPadOS asks for desktop sites). */
export function isMobileLikeUserAgent(ua: string, maxTouchPoints: number): boolean {
  if (MOBILE_UA.test(ua)) return true;
  return IPAD_LIKE_MAC.test(ua) && maxTouchPoints > 1;
}

const IN_APP_BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB/i, "Facebook"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Snapchat/i, "Snapchat"],
  [/TikTok|musical_ly|BytedanceWebview/i, "TikTok"],
  [/Twitter/i, "X"],
  [/Line\//i, "LINE"],
  [/WhatsApp/i, "WhatsApp"],
  [/Telegram/i, "Telegram"],
  [/Slack/i, "Slack"],
  [/Discord/i, "Discord"],
  [/GSA\//i, "Google app"],
];

const IOS_BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/CriOS/i, "Chrome"],
  [/FxiOS/i, "Firefox"],
  [/EdgiOS/i, "Edge"],
  [/OPiOS|OPT\//i, "Opera"],
  [/DuckDuckGo/i, "DuckDuckGo"],
  [/Brave/i, "Brave"],
];

function isIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

/** iOS major and minor version from "OS 17_4 like Mac OS X", or null. */
export function iosVersion(ua: string): [number, number] | null {
  const match = /OS (\d+)[_.](\d+)/.exec(ua);
  if (!match || !isIOS(ua)) return null;
  return [Number(match[1]), Number(match[2])];
}

function androidBrowser(ua: string): "chrome" | "edge" | "samsung" | "firefox" | "other" {
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/EdgA/i.test(ua)) return "edge";
  if (/Firefox/i.test(ua)) return "firefox";
  if (/OPR|Opera|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser|; wv\)/i.test(ua)) return "other";
  if (/Chrome\//i.test(ua)) return "chrome";
  return "other";
}

/** Which install steps to show. `isIPadLikeMac` covers iPadOS sending a Mac user agent. */
export function platformFromUserAgent(ua: string, isIPadLikeMac = false): InstallPlatform {
  const inApp = IN_APP_BROWSERS.find(([pattern]) => pattern.test(ua));
  if (inApp) return { kind: "inAppBrowser", app: inApp[1], ios: isIOS(ua) || isIPadLikeMac };

  if (isIOS(ua) || isIPadLikeMac) {
    const other = IOS_BROWSERS.find(([pattern]) => pattern.test(ua));
    if (!other) return { kind: "iosSafari" };
    const version = iosVersion(ua);
    const canAddToHomeScreen = version !== null && (version[0] > 16 || (version[0] === 16 && version[1] >= 4));
    return { kind: "iosOtherBrowser", browser: other[1], canAddToHomeScreen };
  }

  if (/Android/i.test(ua)) return { kind: "android", browser: androidBrowser(ua) };
  return { kind: "other" };
}

type QueryValue = string | string[] | undefined;

function firstValue(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads ?device=phone|desktop and ?standalone=1. Works with Next searchParams or URLSearchParams. */
export function parseOverrides(query: Record<string, QueryValue> | URLSearchParams): GateOverrides {
  const get = (key: string): string | undefined =>
    query instanceof URLSearchParams ? (query.get(key) ?? undefined) : firstValue(query[key]);
  const device = get("device");
  const standalone = get("standalone");
  return {
    device: device === "phone" || device === "desktop" ? device : null,
    standalone: standalone === "1" || standalone === "true",
  };
}

export interface GateInput {
  overrides: GateOverrides;
  /** Detected device kind (server first pass or client confirmation). */
  kind: DeviceKind;
  /** Running from the home screen (display-mode standalone/fullscreen or navigator.standalone). */
  standalone: boolean;
  /** The person tapped "Continue in the browser" earlier in this tab. */
  continuedInBrowser: boolean;
}

/**
 * The decision, in order: ?standalone=1 -> app; a computer (or ?device=desktop) -> QR, even when the site was
 * installed as a desktop app (Chrome and Brave offer that) or opened in a standalone window; running from the
 * home screen -> app; a phone that chose the browser -> app; any other phone -> install steps.
 */
export function decideView(input: GateInput): GateView {
  const { overrides } = input;
  if (overrides.standalone) return "app";
  const kind = overrides.device ?? input.kind;
  if (kind === "desktop") return "qr";
  if (input.standalone) return "app";
  return input.continuedInBrowser ? "app" : "install";
}
