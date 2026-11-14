"use client";

// Bar charts: you beside people your age, money in and out by month, your bill beside today's offers, and the
// build-up of safe-to-spend. Thin bars, values at the tips, one baseline each.
import { useState } from "react";
import type { Visual } from "@/lib/types";

const euro = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const Swatch = ({ colour, line = false }: { colour: string; line?: boolean }) => <span className={`inline-block shrink-0 ${line ? "h-0.5 w-3.5" : "h-2.5 w-2.5 rounded-sm"}`} style={{ background: colour }} />;

function Bar({ value, max, colour, delay, label }: { value: number; max: number; colour: string; delay: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 min-w-0 flex-1">
        <div className="viz-grow-x h-full rounded-r" style={{ width: `${Math.max(1.5, (value / (max || 1)) * 100)}%`, background: colour, animationDelay: `${delay}ms` }} />
      </div>
      <span className="tabular w-14 shrink-0 text-right text-[13px]">{label}</span>
    </div>
  );
}

export function PeerBars({ visual }: { visual: Extract<Visual, { kind: "peer_bars" }> }) {
  const max = Math.max(...visual.rows.flatMap((row) => [row.you, row.peers]));
  return (
    <div className="space-y-3">
      <p className="flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><Swatch colour="var(--viz-main)" /> You</span>
        <span className="flex items-center gap-1.5"><Swatch colour="var(--viz-quiet)" /> People {visual.peerGroup}</span>
      </p>
      {visual.rows.map((row, index) => (
        <div key={row.label} className="viz-fade space-y-1" style={{ animationDelay: `${index * 90}ms` }}>
          <p className="flex justify-between text-sm">
            <span>{row.label}</span>
            <span className="text-xs text-muted">{Math.round(row.you - row.peers) > 0 ? `${euro(row.you - row.peers)} above` : Math.round(row.you - row.peers) < 0 ? `${euro(row.peers - row.you)} below` : "about the same"}</span>
          </p>
          <Bar value={row.you} max={max} colour="var(--viz-main)" delay={index * 90} label={euro(row.you)} />
          <Bar value={row.peers} max={max} colour="var(--viz-quiet)" delay={index * 90 + 60} label={euro(row.peers)} />
        </div>
      ))}
    </div>
  );
}

export function OfferBars({ visual }: { visual: Extract<Visual, { kind: "offer_bars" }> }) {
  const max = Math.max(visual.currentMonthlyEur, ...visual.offers.map((offer) => offer.monthlyEur));
  return (
    <div className="space-y-2.5">
      <div className="space-y-1">
        <p className="text-sm font-medium">Your bill now</p>
        <Bar value={visual.currentMonthlyEur} max={max} colour="var(--viz-quiet)" delay={0} label={euro(visual.currentMonthlyEur)} />
      </div>
      {visual.offers.map((offer, index) => (
        <div key={`${offer.provider}:${offer.plan}`} className="viz-fade space-y-1" style={{ animationDelay: `${(index + 1) * 90}ms` }}>
          <p className="flex justify-between gap-3 text-sm">
            <a href={offer.url} target="_blank" rel="noreferrer" className="min-w-0 truncate underline decoration-line underline-offset-2">{offer.provider}</a>
            <span className="shrink-0 text-xs text-muted">{offer.yearlySavingEur > 0 ? `saves about ${euro(offer.yearlySavingEur)} a year` : "not cheaper"}</span>
          </p>
          <Bar value={offer.monthlyEur} max={max} colour="var(--viz-main)" delay={(index + 1) * 90} label={euro(offer.monthlyEur)} />
        </div>
      ))}
      {visual.mock && <p className="text-xs text-amber">Example data, not a live search.</p>}
    </div>
  );
}

export function Waterfall({ visual }: { visual: Extract<Visual, { kind: "waterfall" }> }) {
  const max = Math.max(...visual.steps.map((step) => Math.abs(step.amount)));
  return (
    <div className="space-y-2">
      {visual.steps.filter((step) => Math.round(step.amount) !== 0).map((step, index) => (
        <div key={step.label} className="viz-fade space-y-1" style={{ animationDelay: `${index * 110}ms` }}>
          <p className="text-sm">{step.label}</p>
          <Bar value={Math.abs(step.amount)} max={max} colour={step.amount < 0 ? "var(--viz-quiet)" : "var(--viz-main)"} delay={index * 110} label={`${step.amount < 0 ? "−" : ""}${euro(Math.abs(step.amount))}`} />
        </div>
      ))}
      <p className="viz-fade flex items-baseline justify-between border-t border-line pt-2" style={{ animationDelay: `${visual.steps.length * 110}ms` }}>
        <span className="text-sm font-medium">{visual.resultLabel}</span>
        <span className="tabular text-2xl font-semibold tracking-tight">{euro(visual.resultValue)}</span>
      </p>
    </div>
  );
}

// Spending as a column for each month, with a mark across it at that month's income: a column that pokes above
// its mark is a month that cost more than it brought in.
export function MonthBars({ visual }: { visual: Extract<Visual, { kind: "month_bars" }> }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 320;
  const H = 130;
  const max = Math.max(...visual.months.flatMap((m) => [m.income, m.spending]), 1);
  const slot = W / visual.months.length;
  const y = (value: number) => H - (value / max) * (H - 8);
  const shown = active === null ? null : visual.months[active];
  return (
    <div className="space-y-2">
      <p className="flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><Swatch colour="var(--viz-main)" /> Spending</span>
        <span className="flex items-center gap-1.5"><Swatch colour="var(--ink, #14201b)" line /> Income</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label={`${visual.title}: ${visual.months.map((m) => `${m.label} in ${euro(m.income)} out ${euro(m.spending)}`).join(", ")}`} onPointerLeave={() => setActive(null)}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--viz-grid)" strokeWidth="1" />
        {visual.months.map((m, index) => {
          const x = index * slot + slot / 2;
          const over = m.spending > m.income;
          return (
            <g key={m.month} onPointerEnter={() => setActive(index)} onClick={() => setActive(index)} opacity={active === null || active === index ? 1 : 0.4} style={{ transition: "opacity 160ms ease" }}>
              <rect x={index * slot} y="0" width={slot} height={H + 16} fill="transparent" />
              <rect className="viz-grow-y" x={x - 6} y={y(m.spending)} width="12" height={H - y(m.spending)} rx="3" fill={over ? "var(--coral, #e2573a)" : "var(--viz-main)"} style={{ animationDelay: `${index * 45}ms` }} />
              <line className="viz-fade" x1={x - 9} x2={x + 9} y1={y(m.income)} y2={y(m.income)} stroke="var(--ink, #14201b)" strokeWidth="2" strokeLinecap="round" style={{ animationDelay: `${index * 45 + 300}ms` }} />
              {(index % 3 === 0 || index === visual.months.length - 1) && <text x={index === 0 ? index * slot + 2 : index === visual.months.length - 1 ? W - 2 : x} y={H + 12} textAnchor={index === 0 ? "start" : index === visual.months.length - 1 ? "end" : "middle"} fontSize="9" fill="var(--muted, #5d6b64)">{m.label}</text>}
            </g>
          );
        })}
      </svg>
      <p className="tabular min-h-5 text-[13px] text-muted">
        {shown ? `${shown.label}: ${euro(shown.income)} in, ${euro(shown.spending)} out${shown.spending > shown.income ? `, ${euro(shown.spending - shown.income)} more out than in` : ""}` : "Red columns are months that cost more than they brought in. Touch a month for its figures."}
      </p>
    </div>
  );
}
