// Port of ios/Sisu/Theme/SisuTheme.swift for TypeScript use (canvas drawing, inline styles, charts).
// The same values live as CSS custom properties in tokens.css; prefer those in CSS. Light values only.

export const SisuTheme = {
  Color: {
    green900: "#004628",
    green700: "#007841",
    green500: "#00AA46",
    green300: "#99D59F",
    green200: "#91FA9B",
    green100: "#D2FCD5",
    green50: "#EBF7EC",
    green25: "#F7FCF7",
    white: "#FFFFFF",

    neutral900: "#1F1F1F",
    neutral600: "#666666",
    neutral400: "#949494",
    neutral200: "#E6E6E6",

    /** Heads-up notes only. */
    amberBackground: "#FFF1D8",
    amberMark: "#CF8300",
    amberText: "#885600",
    /** Tips. */
    infoBackground: "#E0F4FF",
    infoText: "#006E87",
    /** Failed actions only. Spending is never red. */
    errorBackground: "#FFEDED",
    errorText: "#B70000",

    /** Dark mode only. */
    darkBackground: "#00301B",
    darkOutline: "#1B6B43",

    background: "#F6F8F7",
    card: "#FFFFFF",
    hairline: "#E3E8E5",
    pressEdge: "#DCE3DF",
    inputFill: "#F6F8F7",
    outline: "#99D59F",
    text: "#18211C",
    textMuted: "#5E6662",
    primary: "#007841",
    onPrimary: "#FFFFFF",

    tabSelected: "#004628",
    tabIdle: "#3B4440",
    selectionTint: "#00AA46",
    selectionFill: "#DDF3E2",
    barSolid: "#FCFDFC",

    basketFixed: "#004628",
    basketCurveballs: "#007841",
    basketLeaks: "#00AA46",
    basketJars: "#91FA9B",
  },

  /** CSS `font` shorthands (weight size/line-height family). Same as the --sisu-type-* tokens. */
  Font: {
    hero: "var(--sisu-type-hero)",
    display: "var(--sisu-type-display)",
    h1: "var(--sisu-type-h1)",
    h2: "var(--sisu-type-h2)",
    h3: "var(--sisu-type-h3)",
    bodyLarge: "var(--sisu-type-body-large)",
    body: "var(--sisu-type-body)",
    label: "var(--sisu-type-label)",
    caption: "var(--sisu-type-caption)",
    button: "var(--sisu-type-button)",
    /** Point sizes, for code that needs the number. */
    size: { hero: 64, display: 40, h1: 32, h2: 24, h3: 20, bodyLarge: 18, body: 16, label: 14, caption: 12, button: 17 },
    /** Families for canvas text. */
    displayFamily: "var(--sisu-font-display)",
    textFamily: "var(--sisu-font-text)",
  },

  /** Layout distances in px (1 pt = 1 CSS px). Everything sits on the 4 px grid. */
  Spacing: {
    grid: 4,
    margin: 20,
    card: 16,
    section: 32,
    tabBarClearance: 16,
    touchTarget: 48,
    pressEdge: 4,
  },

  Radius: {
    button: 18,
    card: 24,
    sheet: 32,
    hero: 32,
  },

  TabBar: {
    height: 64,
    inset: 5,
    sideMargin: 20,
    lift: -10,
    icon: 20,
  },
} as const;

/** One spring, as SwiftUI's spring(response:dampingFraction:) sampled into a CSS linear() easing. */
export interface SisuSpring {
  durationMs: number;
  easing: string;
}

/** Samples an underdamped spring (mass 1) until it settles within 0.2 %. */
export function springEasing(response: number, dampingFraction: number, samples = 30): SisuSpring {
  const omega = (2 * Math.PI) / response;
  const zeta = Math.min(Math.max(dampingFraction, 0.01), 0.99);
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  const duration = Math.log(1 / 0.002) / (zeta * omega);
  const at = (t: number) =>
    1 - Math.exp(-zeta * omega * t) * (Math.cos(damped * t) + ((zeta * omega) / damped) * Math.sin(damped * t));
  const points = Array.from({ length: samples + 1 }, (_, index) =>
    index === samples ? 1 : Math.round(at((duration * index) / samples) * 10000) / 10000,
  );
  return { durationMs: Math.round(duration * 1000), easing: `linear(${points.join(", ")})` };
}

export const SisuSprings = {
  /** SisuMotion.state: spring(response: 0.35, dampingFraction: 0.72). */
  state: springEasing(0.35, 0.72),
  /** GlassTabBar pill: spring(response: 0.4, dampingFraction: 0.74). */
  tab: springEasing(0.4, 0.74),
} as const;
