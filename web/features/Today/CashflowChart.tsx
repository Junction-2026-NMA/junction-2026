"use client";
// The cash-flow chart of Today: per month, stacked bars for the three baskets (Fixed at the bottom, then
// Curveballs, then Leaks) and a dashed monotone line for money in; euro axis on the leading edge with about three
// round values and grid lines, every other month written under the bars, the legend at the bottom leading.
// The SVG port of the Swift Charts `Chart` in CashflowSection (TodaySections.swift), 220 px tall in all.
import { useLayoutEffect, useRef, useState } from "react";
import { JarsPresenter, NumberText, TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { Overview } from "@/web/core/Models";
import { monotonePath, niceTicks } from "./chartMath";
import "./cashflow.css";

const HEIGHT = 220;
const LEGEND = 26; // the legend row and the gap above it
const X_LABELS = 22; // the month labels and the gap above them
const TOP = 8; // room for the top axis value
const BAR_RATIO = 0.6;

const SERIES = [
  { name: "Fixed", color: "var(--sisu-color-basket-fixed)" },
  { name: "Curveballs", color: "var(--sisu-color-basket-curveballs)" },
  { name: "Leaks", color: "var(--sisu-color-basket-leaks)" },
] as const;

export function CashflowChart({ overview }: { overview: Overview }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const top = TodayPresenter.chartTop(overview);
  const ticks = niceTicks(top, 3);
  const tickLabels = ticks.map((value) => JarsPresenter.axisMoney(value));
  // The euro labels sit outside the plot on the leading side: about 7 px per character of caption text.
  const axisWidth = Math.max(...tickLabels.map((label) => Array.from(label).length)) * 7 + 6;
  const plotLeft = axisWidth;
  const plotWidth = Math.max(width - plotLeft, 1);
  const plotHeight = HEIGHT - LEGEND - X_LABELS - TOP;
  const y = (value: number) => TOP + plotHeight - (Math.max(Number.isFinite(value) ? value : 0, 0) / top) * plotHeight;

  const months = overview.months;
  const band = months.length > 0 ? plotWidth / months.length : plotWidth;
  const barWidth = band * BAR_RATIO;
  const centre = (index: number) => plotLeft + band * index + band / 2;
  const shownTicks = new Set(TodayPresenter.chartMonthTicks(overview));
  const line = monotonePath(months.map((point, index) => ({ x: centre(index), y: y(point.income) })));

  return (
    <div ref={box} className="sisu-cashflow-chart" role="img"
      aria-label={`Monthly money in and spending by basket over the last ${overview.windowMonths} months`}>
      {width > 0 ? (
        <svg width={width} height={HEIGHT - LEGEND} aria-hidden="true">
          {ticks.map((value, index) => (
            <g key={value}>
              <line x1={plotLeft} x2={plotLeft + plotWidth} y1={y(value)} y2={y(value)}
                stroke="var(--sisu-neutral-200)" strokeWidth="1" />
              <text x={plotLeft - 6} y={y(value)} dy="0.35em" textAnchor="end" className="sisu-cashflow-axis">
                {tickLabels[index]}
              </text>
            </g>
          ))}
          {months.map((point, index) => {
            const values = [point.regular, point.irregular, point.everyday].map((v) => Math.max(Number.isFinite(v) ? v : 0, 0));
            const stacked = values.reduce<{ from: number; to: number }[]>(
              (all, value) => [...all, { from: all.length ? all[all.length - 1].to : 0, to: (all.length ? all[all.length - 1].to : 0) + value }], []);
            const label = NumberText.monthShort(point.month);
            return (
              <g key={point.month}>
                {stacked.map((segment, series) => (
                  <rect key={SERIES[series].name} x={centre(index) - barWidth / 2} width={barWidth}
                    y={y(segment.to)} height={Math.max(y(segment.from) - y(segment.to), 0)} fill={SERIES[series].color} />
                ))}
                {shownTicks.has(label) ? (
                  <text x={centre(index)} y={TOP + plotHeight + X_LABELS - 4} textAnchor="middle" className="sisu-cashflow-axis">
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}
          <path d={line} fill="none" stroke="var(--sisu-neutral-600)" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      ) : null}
      <div className="sisu-cashflow-legend" aria-hidden="true">
        {SERIES.map((series) => (
          <span key={series.name} className="sisu-cashflow-legend-item">
            <span className="sisu-cashflow-legend-dot" style={{ background: series.color }} />
            {series.name}
          </span>
        ))}
      </div>
    </div>
  );
}
