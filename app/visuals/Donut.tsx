"use client";

// The budget ring: where the money goes, one arc per category, drawn in one after another.
// Touch or hover a part and the middle shows it. The list beside it carries every figure, so nothing depends on colour alone.
import { useState } from "react";
import type { Visual } from "@/lib/types";

type Budget = Extract<Visual, { kind: "budget_donut" }>;
const euro = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const R = 40;
const C = 2 * Math.PI * R;
const GAP = 1.6; // surface-coloured space between arcs, in the ring's own units
const colourOf = (label: string, index: number): string => (label === "Other" ? "var(--viz-other)" : `var(--viz-${index + 1})`);

export function Donut({ visual }: { visual: Budget }) {
  const [active, setActive] = useState<number | null>(null);
  const shown = active === null ? null : visual.slices[active];
  // Each arc starts where the ones before it end.
  const lengths = visual.slices.map((slice) => Math.max(0.5, (slice.value / (visual.total || 1)) * C - GAP));
  const arcs = visual.slices.map((slice, index) => ({ slice, index, length: lengths[index], offset: lengths.slice(0, index).reduce((sum, length) => sum + length + GAP, 0) }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${visual.title}: ${visual.slices.map((s) => `${s.label} ${euro(s.value)}`).join(", ")}`}>
          {arcs.map(({ slice, index, length, offset: start }) => (
            <circle
              key={slice.label}
              className="viz-arc cursor-pointer"
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={colourOf(slice.label, index)}
              strokeWidth={active === index ? 15 : 12}
              strokeDashoffset={-start}
              opacity={active === null || active === index ? 1 : 0.3}
              style={{ "--len": `${length}`, "--c": `${C}`, strokeDasharray: `${length} ${C}`, animationDelay: `${index * 110}ms` } as React.CSSProperties}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onClick={() => setActive(active === index ? null : index)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tabular text-2xl font-semibold tracking-tight">{euro(shown ? shown.value : visual.total)}</span>
          <span className="max-w-[6.5rem] truncate text-xs text-muted">{shown ? `${shown.label} · ${Math.round(shown.share)}%` : visual.centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1 text-sm">
        {visual.slices.map((slice, index) => (
          <li key={slice.label} className={`viz-fade flex cursor-default items-center gap-2 rounded-lg px-2 py-1 transition-colors ${active === index ? "bg-paper" : ""}`} style={{ animationDelay: `${index * 110 + 150}ms` }} onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colourOf(slice.label, index) }} />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="tabular shrink-0 text-muted">{Math.round(slice.share)}%</span>
            <span className="tabular w-14 shrink-0 text-right font-medium">{euro(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
