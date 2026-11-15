"use client";
// The four chart bodies of ChartState: a ring, rows of bars, monthly columns with an income mark, and lines over
// the years with a band for invested money. Every length is a 0...1 fraction from ChartPresenter.
import type { ChartColorRole, ChartState } from "@/web/core/ChartPresentation";
import { validURL } from "./CardParts";

type Body<K extends ChartState.Body["kind"]> = Extract<ChartState.Body, { kind: K }>;

/** The brand palette for each role: the green ramp dark to light, the customer's own series in deep green, the
 *  comparison in soft green, and amber (never red) for a mark to point out. */
export function roleColor(role: ChartColorRole): string {
  switch (role) {
    case "category1": return "var(--sisu-green-900)";
    case "category2": return "var(--sisu-green-700)";
    case "category3": return "var(--sisu-green-500)";
    case "category4": return "var(--sisu-green-300)";
    case "category5": return "var(--sisu-green-200)";
    case "category6": return "var(--sisu-green-100)";
    case "main": return "var(--sisu-green-700)";
    case "quiet": return "var(--sisu-green-300)";
    case "flagged": return "var(--sisu-amber-mark)";
  }
}

const RING_RADIUS = 60;
const RING_WIDTH = 22;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function DonutBody({ body }: { body: Body<"donut"> }) {
  return (
    <div className="sisu-chart-donut">
      <div className="sisu-chart-ring" aria-hidden="true">
        <svg viewBox="0 0 160 160" width="160" height="160">
          <circle cx="80" cy="80" r={RING_RADIUS} fill="none" stroke="var(--sisu-neutral-200)" strokeWidth={RING_WIDTH} />
          {body.slices.map((slice) => {
            const length = Math.max(slice.end - slice.start, 0) * CIRCUMFERENCE;
            return (
              <circle key={slice.id} cx="80" cy="80" r={RING_RADIUS} fill="none" stroke={roleColor(slice.color)} strokeWidth={RING_WIDTH}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`} strokeDashoffset={-slice.start * CIRCUMFERENCE}
                transform="rotate(-90 80 80)" />
            );
          })}
        </svg>
        <div className="sisu-chart-ring-center">
          <span className="sisu-ask-caption sisu-ask-muted">{body.centerLabel}</span>
          <span className="sisu-ask-h3">{body.centerValue}</span>
        </div>
      </div>
      <div className="sisu-chart-rows" aria-hidden="true">
        {body.slices.map((slice) => (
          <div key={slice.id} className="sisu-chart-row">
            <span className="sisu-chart-swatch" style={{ background: roleColor(slice.color) }} />
            <span className="sisu-ask-body sisu-ask-grow">{slice.label}</span>
            <span className="sisu-ask-label">{slice.valueText}</span>
            <span className="sisu-ask-caption sisu-ask-muted sisu-chart-share">{slice.shareText}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarsBody({ body }: { body: Body<"bars"> }) {
  return (
    <div className="sisu-chart-groups">
      {body.groups.map((group) => (
        <div key={group.id} className="sisu-chart-group">
          <div className="sisu-chart-group-top">
            {group.url && validURL(group.url) ? (
              <a className="sisu-ask-label sisu-ask-primary" href={validURL(group.url) ?? undefined} target="_blank" rel="noopener noreferrer">{group.title}</a>
            ) : (
              <span className="sisu-ask-label">{group.title}</span>
            )}
            {group.note ? <span className="sisu-ask-caption sisu-ask-muted">{group.note}</span> : null}
          </div>
          {group.bars.map((bar) => (
            <div key={bar.id} className="sisu-chart-bar-row" aria-label={`${bar.label}: ${bar.valueText}`} role="group">
              {group.bars.length > 1 ? <span className="sisu-ask-caption sisu-ask-muted sisu-chart-bar-label" aria-hidden="true">{bar.label}</span> : null}
              <div className="sisu-chart-bar-track" aria-hidden="true">
                <div className="sisu-chart-bar-area">
                  <div className="sisu-chart-bar" style={{ width: `${bar.fraction * 100}%`, background: roleColor(bar.color) }} />
                </div>
                <span className="sisu-ask-caption sisu-chart-bar-value">{bar.valueText}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ColumnsBody({ body }: { body: Body<"columns"> }) {
  return (
    <div className="sisu-chart-columns-wrap" aria-hidden="true">
      <div className="sisu-chart-columns">
        {body.columns.map((column) => (
          <div key={column.id} className="sisu-chart-column" title={column.detail}>
            <div className="sisu-chart-column-fill" style={{ height: `${column.fraction * 100}%`, background: roleColor(column.color) }} />
            <div className="sisu-chart-column-mark" style={{ bottom: `${column.markFraction * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="sisu-chart-columns sisu-chart-axis">
        {body.columns.map((column) => (
          <span key={column.id} className="sisu-ask-caption sisu-ask-muted sisu-chart-axis-label">{column.showsLabel ? column.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

const W = 300;
const H = 140;
const PAD = 6;
const px = (x: number) => PAD + x * (W - 2 * PAD);
const py = (y: number) => H - PAD - y * (H - 2 * PAD);

export function LinesBody({ body }: { body: Body<"lines"> }) {
  return (
    <div className="sisu-chart-lines" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="sisu-chart-lines-svg" preserveAspectRatio="none">
        <line x1={PAD} x2={W - PAD} y1={py(0)} y2={py(0)} stroke="var(--sisu-neutral-200)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {body.lines.filter((line) => line.hasBand && line.points.length > 1).map((line) => (
          <polygon key={`${line.id}-band`} fill={roleColor(line.color)} opacity="0.18"
            points={[...line.points.map((p) => `${px(p.x)},${py(p.high)}`), ...[...line.points].reverse().map((p) => `${px(p.x)},${py(p.low)}`)].join(" ")} />
        ))}
        {body.lines.map((line) => (
          <polyline key={line.id} fill="none" stroke={roleColor(line.color)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" points={line.points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} />
        ))}
      </svg>
      <div className="sisu-chart-axis-years">
        {body.axisLabels.map((label) => <span key={label} className="sisu-ask-caption sisu-ask-muted">{label}</span>)}
      </div>
      <div className="sisu-chart-rows">
        {body.lines.map((line) => (
          <div key={line.id} className="sisu-chart-row">
            <span className="sisu-chart-swatch-line" style={{ background: roleColor(line.color) }} />
            <span className="sisu-ask-body sisu-ask-grow">{line.label}</span>
            <span className="sisu-chart-end">
              <span className="sisu-ask-label">{line.endText}</span>
              {line.rangeText ? <span className="sisu-ask-caption sisu-ask-muted">{line.rangeText}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
