// How a component's contract sizing becomes CSS box size and a Rive Layout.
// Port of RiveSizingModifier (RiveComponentView.swift) and RiveComponentModel.fit(for:).
import type { CSSProperties } from "react";
import { Alignment, Fit, Layout } from "@rive-app/react-canvas";
import type { RiveSizing } from "./contract";

/**
 * The box a component takes, before the parent's own className/style:
 * - fixed: exactly the design size.
 * - flexibleWidth: the full width at the design height, never squashed below it.
 * - contain: the design size, never wider than its parent, keeping its proportions. Give it a width and a height
 *   (style or a class) and it scales to fit inside them.
 * - fill: fills its parent (give the parent a height).
 * A design size of 0 fills the parent.
 */
export function riveBoxStyle(designSize: { width: number; height: number }, sizing: RiveSizing): CSSProperties {
  const { width, height } = designSize;
  if (width <= 0 || height <= 0) return { width: "100%", height: "100%" };
  switch (sizing) {
    case "fixed":
      return { width, height, flex: "none" };
    case "flexibleWidth":
      // minHeight: a column flex layout must never squash the design height (a button cut in half).
      return { width: "100%", height, minHeight: height, minWidth: 0 };
    case "contain":
      return { width, maxWidth: "100%", aspectRatio: `${width} / ${height}` };
    case "fill":
      return { width: "100%", height: "100%" };
  }
}

/** The artboard resizes to the box for flexibleWidth and fill (1 artboard unit = 1 CSS px), and is scaled to
 *  fit, centred, otherwise. */
export function riveLayout(sizing: RiveSizing): Layout {
  switch (sizing) {
    case "flexibleWidth":
    case "fill":
      return new Layout({ fit: Fit.Layout, layoutScaleFactor: 1 });
    case "fixed":
    case "contain":
      return new Layout({ fit: Fit.Contain, alignment: Alignment.Center });
  }
}

/** The device pixel ratio the canvas renders at (the React runtime caps it the same way). */
export function riveDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(Math.max(1, window.devicePixelRatio || 1), 3);
}
