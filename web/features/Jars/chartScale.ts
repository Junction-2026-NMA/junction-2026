// Small pure helpers for the futures chart (the web side of Swift Charts' scales and automatic axis marks).
import type { BranchId } from "@/web/core/Models";

/** The line colour of a future: nothing grey, save deep green, invest bright green (FuturesSection.color). */
export function branchColor(id: BranchId): string {
  switch (id) {
    case "nothing": return "var(--sisu-neutral-400)";
    case "save": return "var(--sisu-green-900)";
    case "invest": return "var(--sisu-green-500)";
  }
}

/** Round axis values between 0 and `top`, about `desiredCount` of them (AxisMarks(values: .automatic(desiredCount:))).
 *  Steps of 1, 2 or 5 times a power of ten. */
export function niceTicks(top: number, desiredCount: number): number[] {
  if (!(top > 0) || !Number.isFinite(top)) return [0];
  const rough = top / Math.max(desiredCount, 1);
  const power = Math.floor(Math.log10(rough));
  const error = rough / Math.pow(10, power);
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  const step = factor * Math.pow(10, power);
  const count = Math.floor(top / step + 1e-9);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

/** An SVG path through points. */
export function linePath(points: readonly { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join("");
}

/** A closed SVG path between a low and a high line over the same x values. */
export function bandPath(low: readonly { x: number; y: number }[], high: readonly { x: number; y: number }[]): string {
  if (low.length === 0 || high.length === 0) return "";
  return `${linePath(high)}${linePath([...low].reverse()).replace(/^M/, "L")}Z`;
}
