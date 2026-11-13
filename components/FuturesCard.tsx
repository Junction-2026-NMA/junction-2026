"use client";

import { useMemo, useState } from "react";
import type { BranchId, Overview } from "@/lib/types";
import { LIMITS, runScenario } from "@/lib/finance/scenario";
import { eur } from "@/lib/format";
import { Card, Eyebrow } from "./ui";

const COLOR: Record<BranchId, string> = { nothing: "var(--muted)", save: "var(--amber)", invest: "var(--green)" };
const W = 320;
const H = 170;

type Guess = BranchId | null;

export function FuturesCard({ overview }: { overview: Overview }) {
  const [billSaving, setBillSaving] = useState(15);
  const [cutPct, setCutPct] = useState(10);
  const [years, setYears] = useState(5);
  const [guess, setGuess] = useState<Guess>(null);

  const result = useMemo(
    () => runScenario(overview, { billSavingPerMonth: billSaving, everydayCutPct: cutPct, years }),
    [overview, billSaving, cutPct, years],
  );

  const all = result.branches.flatMap((b) => b.points.flatMap((p) => [p.total, p.totalLow, p.totalHigh]));
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all, 1);
  const months = years * 12;
  const x = (month: number) => (month / months) * W;
  const y = (value: number) => H - ((value - lo) / (hi - lo)) * H;
  const line = (values: { month: number; v: number }[]) => values.map((p, i) => `${i ? "L" : "M"}${x(p.month).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

  const invest = result.branches.find((b) => b.id === "invest")!;
  const nothing = result.branches.find((b) => b.id === "nothing")!;
  const band = `${line(invest.points.map((p) => ({ month: p.month, v: p.totalHigh })))} ${[...invest.points].reverse().map((p) => `L${x(p.month).toFixed(1)},${y(p.totalLow).toFixed(1)}`).join(" ")} Z`;
  const safest = [...result.branches].sort((a, b) => b.runwayMonthsAtYear1 - a.runwayMonthsAtYear1)[0];

  return (
    <Card>
      <Eyebrow>Your futures</Eyebrow>
      <p className="mt-1 text-lg font-semibold leading-snug">
        Freeing up <span className="tabular text-green">{eur(result.freedPerMonth)} a month</span> could leave you{" "}
        <span className="tabular text-green">{eur(invest.endTotal - nothing.endTotal)}</span> better off in {years} {years === 1 ? "year" : "years"}.
      </p>

      <svg viewBox={`-4 -6 ${W + 8} ${H + 12}`} className="mt-4 w-full" role="img" aria-label="Projected money under three futures">
        {lo < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="4 4" />}
        <path d={band} fill="var(--green)" opacity={0.12} />
        {result.branches.map((b) => (
          <path key={b.id} d={line(b.points.map((p) => ({ month: p.month, v: p.total })))} fill="none" stroke={COLOR[b.id]} strokeWidth={b.id === "nothing" ? 2 : 3} strokeLinecap="round" strokeDasharray={b.id === "nothing" ? "5 5" : undefined} />
        ))}
      </svg>

      <ul className="mt-3 space-y-2 text-sm">
        {result.branches.map((b) => (
          <li key={b.id} className="flex items-baseline gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR[b.id] }} />
            <span className="flex-1">{b.label}</span>
            <span className="tabular font-semibold">{eur(b.endTotal)}</span>
          </li>
        ))}
        <li className="pl-[18px] text-xs text-muted">
          Invested future could land between {eur(invest.endLow)} and {eur(invest.endHigh)}. The shaded band shows that range.
        </li>
      </ul>

      <div className="mt-5 space-y-4">
        <Slider label="Saving from switching a bill" value={billSaving} unit="€/mo" range={LIMITS.billSavingPerMonth} max={100} onChange={setBillSaving} />
        <Slider label="Trim everyday spending by" value={cutPct} unit="%" range={LIMITS.everydayCutPct} onChange={setCutPct} />
        <Slider label="Look ahead" value={years} unit={years === 1 ? "year" : "years"} range={LIMITS.years} onChange={setYears} />
      </div>

      <div className="mt-5 rounded-2xl bg-green-soft p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green">Predict before you reveal</p>
        <p className="mt-1 font-semibold">If your income stopped a year from now, which future keeps you afloat longest?</p>
        <div className="mt-3 grid gap-2">
          {result.branches.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={guess !== null}
              onClick={() => setGuess(b.id)}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                guess === null ? "border-green/30 bg-card hover:border-green" : b.id === safest.id ? "border-green bg-green text-white" : guess === b.id ? "border-coral bg-coral/10" : "border-line bg-card opacity-60"
              }`}
            >
              <span>{b.label}</span>
              {guess !== null && <span className="tabular shrink-0">{b.runwayMonthsAtYear1.toFixed(1)} months</span>}
            </button>
          ))}
        </div>
        {guess !== null && (
          <p className="mt-3 text-sm leading-relaxed">
            <b>{guess === safest.id ? "Right." : "Not quite."}</b> Cash in your account pays the rent straight away, so “{safest.label.toLowerCase()}” covers must-pay costs for{" "}
            {safest.runwayMonthsAtYear1.toFixed(1)} months. Invested money usually grows more, but it can be worth less on the day you need it. That is why an emergency buffer comes before investing.
            <button type="button" onClick={() => setGuess(null)} className="ml-2 font-semibold text-green underline">Try again</button>
          </p>
        )}
      </div>

      <details className="mt-4 text-xs leading-relaxed text-muted">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">Assumptions behind this chart</summary>
        <ul className="list-disc space-y-1 pl-4">
          {result.assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </details>
    </Card>
  );
}

type SliderProps = { label: string; value: number; unit: string; range: readonly [number, number]; max?: number; onChange: (value: number) => void };

function Slider({ label, value, unit, range, max, onChange }: SliderProps) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular font-semibold">{value} {unit}</span>
      </span>
      <input type="range" min={range[0]} max={max ?? range[1]} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-11 w-full accent-[var(--green)]" />
    </label>
  );
}
