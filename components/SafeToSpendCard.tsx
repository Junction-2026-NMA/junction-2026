"use client";

import { useState } from "react";
import type { Overview } from "@/lib/types";
import { eur } from "@/lib/format";

export function SafeToSpendCard({ overview }: { overview: Overview }) {
  const [open, setOpen] = useState(false);
  const { safeToSpend: s } = overview;
  const over = s.gapPerMonth < 0;

  return (
    <section className="rounded-3xl bg-green p-6 text-white fade-in">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lime">Safe to spend</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="tabular text-6xl font-semibold tracking-tight">{eur(s.perWeek)}</span>
        <span className="text-lg text-white/70">a week</span>
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-white/85">
        {over ? (
          <>You usually spend <b className="text-lime">{eur(-s.gapPerMonth)} a month more</b> than this on everyday choices.</>
        ) : (
          <>You usually stay <b className="text-lime">{eur(s.gapPerMonth)} a month under</b> this. That is money you could put to work.</>
        )}
      </p>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-4 min-h-11 text-sm font-semibold text-lime underline decoration-lime/40 underline-offset-4"
      >
        {open ? "Hide the maths" : "Show the maths"}
      </button>

      {open && (
        <dl className="mt-2 space-y-2 rounded-2xl bg-black/15 p-4 text-sm">
          {s.steps.map((step) => (
            <div key={step.label} className="flex items-baseline justify-between gap-3">
              <dt>
                {step.label}
                <span className="block text-xs text-white/60">{step.basis}</span>
              </dt>
              <dd className="tabular font-semibold">{step.amount < 0 ? "−" : ""}{eur(Math.abs(step.amount))}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-white/20 pt-2 font-semibold">
            <dt>Left for everyday choices</dt>
            <dd className="tabular">{eur(s.perMonth)} / month</dd>
          </div>
          <div className="flex items-baseline justify-between text-white/75">
            <dt>What you actually spend on them</dt>
            <dd className="tabular">{eur(s.actualEverydayPerMonth)} / month</dd>
          </div>
        </dl>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-black/15 p-3">
          <p className="text-white/60">Balance today</p>
          <p className="tabular text-xl font-semibold">{eur(overview.balance)}</p>
        </div>
        <div className="rounded-2xl bg-black/15 p-3">
          <p className="text-white/60">Covers must-pay costs for</p>
          <p className="tabular text-xl font-semibold">{overview.runwayMonths.toFixed(1)} months</p>
        </div>
      </div>
    </section>
  );
}
