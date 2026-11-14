"use client";

// Three futures drawn as lines, with the range of the invested one as a soft band. Touch a year for its figures.
import { useState } from "react";
import type { Visual } from "@/lib/types";

type Futures = Extract<Visual, { kind: "futures_lines" }>;
const euro = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const COLOUR: Record<string, string> = { nothing: "var(--viz-quiet)", save: "var(--viz-main)", invest: "var(--viz-1)" };
const W = 320;
const H = 150;
const PAD = 6;

export function FuturesLines({ visual }: { visual: Futures }) {
  const [year, setYear] = useState<number | null>(null);
  const all = visual.series.flatMap((series) => series.points.flatMap((point) => [point.value, point.low, point.high]));
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const x = (y: number) => PAD + (y / visual.years) * (W - PAD * 2);
  const y = (value: number) => H - PAD - ((value - min) / (max - min || 1)) * (H - PAD * 2);
  const path = (points: { year: number; value: number }[]) => points.map((point, index) => `${index ? "L" : "M"}${x(point.year).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const invest = visual.series.find((series) => series.id === "invest");
  const band = invest ? `${invest.points.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p.high).toFixed(1)}`).join(" ")} ${[...invest.points].reverse().map((p) => `L${x(p.year).toFixed(1)},${y(p.low).toFixed(1)}`).join(" ")} Z` : null;
  const at = year ?? visual.years;
  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setYear(Math.min(visual.years, Math.max(0, Math.round(((event.clientX - box.left) / box.width) * visual.years))));
  };
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full touch-none" role="img" aria-label={`${visual.title}: ${visual.series.map((s) => `${s.label} ${euro(s.points.at(-1)?.value ?? 0)}`).join(", ")}`} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setYear(null)}>
        <line x1={PAD} x2={W - PAD} y1={y(min)} y2={y(min)} stroke="var(--viz-grid)" strokeWidth="1" />
        {band && <path className="viz-fade" d={band} fill="var(--viz-1)" fillOpacity="0.12" style={{ animationDelay: "700ms" }} />}
        {year !== null && <line x1={x(year)} x2={x(year)} y1={PAD} y2={H - PAD} stroke="var(--viz-grid)" strokeWidth="1" />}
        {visual.series.map((series, index) => (
          <g key={series.id}>
            <path className="viz-draw" d={path(series.points)} pathLength="1" fill="none" stroke={COLOUR[series.id]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: `${index * 160}ms` }} />
            {series.points.filter((point) => point.year === at).map((point) => <circle key={point.year} cx={x(point.year)} cy={y(point.value)} r="4" fill={COLOUR[series.id]} stroke="var(--viz-surface)" strokeWidth="2" />)}
          </g>
        ))}
        {Array.from({ length: visual.years + 1 }, (_, index) => index).filter((index) => index === 0 || index === visual.years || visual.years <= 6).map((index) => (
          <text key={index} x={x(index)} y={H + 10} textAnchor={index === 0 ? "start" : index === visual.years ? "end" : "middle"} fontSize="9" fill="var(--muted, #5d6b64)">{index === 0 ? "Today" : `Year ${index}`}</text>
        ))}
      </svg>
      <ul className="space-y-1 text-sm">
        {visual.series.map((series) => {
          const point = series.points.find((p) => p.year === at);
          return (
            <li key={series.id} className="flex items-center gap-2">
              <span className="h-0.5 w-3.5 shrink-0" style={{ background: COLOUR[series.id] }} />
              <span className="min-w-0 flex-1 truncate">{series.label}</span>
              {series.id === "invest" && point && <span className="tabular shrink-0 text-xs text-muted">{euro(point.low)} to {euro(point.high)}</span>}
              <span className="tabular w-16 shrink-0 text-right font-medium">{point ? euro(point.value) : "–"}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">{at === 0 ? "Today" : `After ${at} ${at === 1 ? "year" : "years"}`}. Touch the chart to move along it.</p>
    </div>
  );
}
