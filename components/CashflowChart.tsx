import type { Overview } from "@/lib/types";
import { eur, shortMonth } from "@/lib/format";
import { BASKET_COLOR, Card, Eyebrow } from "./ui";

const HEIGHT = 120;
const BAR_WIDTH = 16;
const GAP = 10;

export function CashflowChart({ overview }: { overview: Overview }) {
  const months = overview.months;
  const peak = Math.max(...months.map((m) => Math.max(m.income, m.regular + m.irregular + m.everyday)), 1);
  const y = (value: number) => (value / peak) * HEIGHT;
  const width = months.length * (BAR_WIDTH + GAP);
  const overspent = months.filter((m) => m.regular + m.irregular + m.everyday + m.saved > m.income).length;

  return (
    <Card>
      <Eyebrow>Month by month</Eyebrow>
      <p className="mt-1 text-lg font-semibold leading-snug">
        {overspent === 0
          ? "You spent less than you earned every month."
          : `More went out than came in during ${overspent} of ${months.length} months.`}
      </p>
      <svg viewBox={`0 0 ${width} ${HEIGHT + 18}`} className="mt-4 w-full" role="img" aria-label="Monthly spending by basket against income">
        {months.map((m, i) => {
          const x = i * (BAR_WIDTH + GAP) + GAP / 2;
          const parts = [
            { value: m.regular, color: BASKET_COLOR.regular },
            { value: m.irregular, color: BASKET_COLOR.irregular },
            { value: m.everyday, color: BASKET_COLOR.everyday },
          ];
          let stacked = 0;
          return (
            <g key={m.month}>
              {parts.map((p, k) => {
                const h = y(p.value);
                stacked += h;
                return <rect key={k} x={x} y={HEIGHT - stacked} width={BAR_WIDTH} height={Math.max(h - 1, 0)} rx={2} fill={p.color} />;
              })}
              <line x1={x - 3} x2={x + BAR_WIDTH + 3} y1={HEIGHT - y(m.income)} y2={HEIGHT - y(m.income)} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" />
              <text x={x + BAR_WIDTH / 2} y={HEIGHT + 14} textAnchor="middle" fontSize={9} fill="var(--muted)">{shortMonth(m.month)}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span className="inline-block h-0.5 w-4 rounded bg-ink" /> money in · bars are spending by basket · typical income {eur(overview.monthlyIncome)}
      </p>
    </Card>
  );
}
