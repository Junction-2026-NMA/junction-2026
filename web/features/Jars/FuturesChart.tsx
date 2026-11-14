"use client";
// The three futures as lines over time, with the invest future's low-high band behind them. Port of FuturesChart
// in ios/Sisu/Features/Jars/JarsScreen.swift (Swift Charts): x from 0 to the last month with 16 px of room at the
// start and 24 px at the end, y from 0 to JarsPresenter.futuresTop, year labels under the plot, about three euro
// labels on the leading side, neutral-200 grid lines, 3 px round-capped lines.
import { useLayoutEffect, useRef, useState } from "react";
import type { Branch } from "@/web/core/Models";
import { JarsPresenter } from "@/web/core/AppLogic/AppPresenters";
import { bandPath, branchColor, linePath, niceTicks } from "./chartScale";

const HEIGHT = 220;
const TOP_ROOM = 8;          // half a label above the top grid line
const X_LABEL_ROOM = 20;     // 4 px gap + a 12/1.3 caption line under the plot
const Y_LABEL_GAP = 6;       // between a euro label and the plot
const START_PADDING = 16;
const END_PADDING = 24;

/** The widest of these labels in the caption font, measured on a canvas. */
function measureWidest(labels: string[], element: HTMLElement | null): number {
  const fallback = Math.max(...labels.map((label) => label.length * 7), 0);
  if (!element || typeof document === "undefined") return fallback;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return fallback;
  const style = getComputedStyle(element);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return Math.ceil(Math.max(...labels.map((label) => context.measureText(label).width), 0));
}

export function FuturesChart({ branches }: { branches: Branch[] }) {
  const box = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [gutter, setGutter] = useState(48);

  const lastMonth = JarsPresenter.futuresLastMonth(branches);
  const top = JarsPresenter.futuresTop(branches);
  const xTicks = JarsPresenter.futuresTicks(branches);
  const yTicks = niceTicks(top, 3);
  const yLabels = yTicks.map((value) => JarsPresenter.axisMoney(value));
  const yKey = yLabels.join("|");

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    setGutter(measureWidest(yKey.split("|"), probe.current) + Y_LABEL_GAP);
  }, [yKey]);

  const plotLeft = gutter;
  const plotRight = Math.max(width, plotLeft + START_PADDING + END_PADDING + 1);
  const plotTop = TOP_ROOM;
  const plotBottom = HEIGHT - X_LABEL_ROOM;
  const xStart = plotLeft + START_PADDING;
  const xEnd = plotRight - END_PADDING;
  const x = (month: number) => xStart + (lastMonth > 0 ? month / lastMonth : 0) * (xEnd - xStart);
  const y = (euros: number) => plotBottom - (Math.min(Math.max(euros, 0), top) / top) * (plotBottom - plotTop);

  const invest = branches.find((branch) => branch.id === "invest");
  const band = invest
    ? bandPath(invest.points.map((p) => ({ x: x(p.month), y: y(p.totalLow) })),
      invest.points.map((p) => ({ x: x(p.month), y: y(p.totalHigh) })))
    : "";

  return (
    <div ref={box} className="sisu-jars-chart" role="img" aria-label="Money over time in three futures">
      <span ref={probe} className="sisu-jars-chart-label" style={{ position: "absolute", visibility: "hidden" }} aria-hidden="true" />
      {width > 0 ? (
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          {xTicks.map((month) => (
            <line key={`x${month}`} x1={x(month)} x2={x(month)} y1={plotTop} y2={plotBottom}
              stroke="var(--sisu-neutral-200)" strokeWidth={1} />
          ))}
          {yTicks.map((value) => (
            <line key={`y${value}`} x1={plotLeft} x2={plotRight} y1={y(value)} y2={y(value)}
              stroke="var(--sisu-neutral-200)" strokeWidth={1} />
          ))}
          {band ? <path d={band} fill="var(--sisu-green-100)" /> : null}
          {branches.map((branch) => (
            <path key={branch.id} d={linePath(branch.points.map((p) => ({ x: x(p.month), y: y(p.total) })))}
              fill="none" stroke={branchColor(branch.id)} strokeWidth={3} strokeLinecap="round" />
          ))}
          {xTicks.map((month) => (
            <text key={`xl${month}`} className="sisu-jars-chart-label" x={x(month)} y={plotBottom + 4}
              textAnchor="middle" dominantBaseline="hanging">
              {JarsPresenter.axisLabel(month)}
            </text>
          ))}
          {yTicks.map((value, index) => (
            <text key={`yl${value}`} className="sisu-jars-chart-label" x={plotLeft - Y_LABEL_GAP} y={y(value)}
              textAnchor="end" dominantBaseline="central">
              {yLabels[index]}
            </text>
          ))}
        </svg>
      ) : null}
    </div>
  );
}
