// Geometry for the cash-flow chart (the web side of what Swift Charts does for TodaySections.swift):
// "nice" axis values like `.automatic(desiredCount: 3)`, and the monotone line of `.interpolationMethod(.monotone)`.

/** Round axis values from 0 up to `top`, about `desiredCount` steps (steps of 1, 2 or 5 × 10^n, picked like
 *  d3's ticks: the nearest round step to top / desiredCount). */
export function niceTicks(top: number, desiredCount = 3): number[] {
  if (!Number.isFinite(top) || top <= 0) return [0];
  const raw = top / Math.max(desiredCount, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const error = raw / magnitude;
  const factor = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.SQRT2 ? 2 : 1;
  const step = factor * magnitude;
  const count = Math.floor(top / step + 1e-9);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

export interface Point { x: number; y: number }

/** An SVG path through the points with monotone cubic interpolation in x (Fritsch–Carlson, as d3's
 *  curveMonotoneX and Swift Charts' `.monotone`): it never overshoots between two months. */
export function monotonePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  const n = points.length;
  const slopes = points.slice(0, -1).map((p, i) => {
    const dx = points[i + 1].x - p.x;
    return dx === 0 ? 0 : (points[i + 1].y - p.y) / dx;
  });
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    const a = slopes[i - 1];
    const b = slopes[i];
    if (a * b <= 0) return 0;
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    // Weighted harmonic mean (d3's slope3).
    const p = (a * h1 + b * h0) / (h0 + h1);
    return (Math.sign(a) + Math.sign(b)) * Math.min(Math.abs(a), Math.abs(b), 0.5 * Math.abs(p));
  });
  const segments = points.slice(1).map((p, index) => {
    const q = points[index];
    const dx = (p.x - q.x) / 3;
    const c1 = { x: q.x + dx, y: q.y + dx * tangents[index] };
    const c2 = { x: p.x - dx, y: p.y - dx * tangents[index + 1] };
    return `C${fix(c1.x)},${fix(c1.y)} ${fix(c2.x)},${fix(c2.y)} ${fix(p.x)},${fix(p.y)}`;
  });
  return `M${fix(points[0].x)},${fix(points[0].y)} ${segments.join(" ")}`;
}

function fix(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0";
}
