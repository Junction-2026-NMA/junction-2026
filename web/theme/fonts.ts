// The brand fonts (port of the UIAppFonts list in ios/project.yml and SisuTheme.Font's PostScript names).
// Bricolage Grotesque Bold/ExtraBold for headlines and hero numbers, Figtree Regular/SemiBold/Bold for the rest.
// Apply `sisuFontVariables` on the app root (next to the `sisu-root` class): tokens.css reads the variables.
import localFont from "next/font/local";

export const bricolage = localFont({
  src: [
    { path: "./fonts/BricolageGrotesque-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/BricolageGrotesque-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  variable: "--sisu-font-bricolage",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const figtree = localFont({
  src: [
    { path: "./fonts/Figtree-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Figtree-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Figtree-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--sisu-font-figtree",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/** The class names that define `--sisu-font-bricolage` and `--sisu-font-figtree`. Put them on the app root. */
export const sisuFontVariables = `${bricolage.variable} ${figtree.variable}`;
