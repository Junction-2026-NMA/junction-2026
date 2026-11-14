"use client";
// Where the three futures end: one bar each, labelled by the presenter. Port of ImpactChart in AskCards.swift
// (a Swift Charts BarMark per series with its end label on top, axes hidden, 140 pt tall, then a legend).
import type { FuturesSeries } from "@/web/core/CoachPresentation";

const CHART_HEIGHT = 140;
/** Room above the tallest bar for its end label (the `.annotation(position: .top)`). */
const LABEL_ROOM = 22;

function color(id: string): string {
  switch (id) {
    case "nothing": return "var(--sisu-green-300)";
    case "save": return "var(--sisu-green-500)";
    default: return "var(--sisu-green-700)";
  }
}

export function ImpactChart({ series }: { series: FuturesSeries[] }) {
  if (series.length === 0) return null;
  const ends = series.map((line) => line.points[line.points.length - 1] ?? null);
  const maximum = Math.max(0, ...ends.map((end) => (end && Number.isFinite(end.total) ? end.total : 0)));
  const barRoom = CHART_HEIGHT - LABEL_ROOM;
  return (
    <>
      <div className="sisu-ask-impact" style={{ height: CHART_HEIGHT }} role="img"
        aria-label={series.map((line) => `${line.label}: ${line.endLabel}`).join(", ")}>
        {series.map((line, index) => {
          const end = ends[index];
          if (!end) return <div key={line.id} className="sisu-ask-impact-slot" />;
          const total = Number.isFinite(end.total) ? Math.max(end.total, 0) : 0;
          const height = maximum > 0 ? Math.max((total / maximum) * barRoom, total > 0 ? 2 : 0) : 0;
          return (
            <div key={line.id} className="sisu-ask-impact-slot" aria-hidden="true">
              <span className="sisu-ask-caption">{line.endLabel}</span>
              <div className="sisu-ask-impact-bar" style={{ height, background: color(line.id) }} />
            </div>
          );
        })}
      </div>
      <div className="sisu-ask-impact-legend" aria-hidden="true">
        {series.map((line) => (
          <div key={line.id} className="sisu-ask-impact-row">
            <span className="sisu-ask-impact-dot" style={{ background: color(line.id) }} />
            <span className="sisu-ask-body sisu-ask-grow">{line.label}</span>
            <span className="sisu-ask-label">{line.rangeLabel ?? line.endLabel}</span>
          </div>
        ))}
      </div>
    </>
  );
}
