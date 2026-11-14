"use client";
// A chart the agent sent (`visual` events, CoachMessage.visuals), drawn from SisuCore's ChartPresenter: every
// fraction and text is the presenter's, nothing is recomputed here. The iOS screen does not draw these yet; the
// web port shows them in the answer, on a solid white card (brand rule: charts never on glass).
import { ChartPresenter, type ChartLegendEntry } from "@/web/core/ChartPresentation";
import type { Visual } from "@/web/core/PlanModels";
import { Eyebrow, SisuCard } from "@/web/shared/SisuStyle";
import { BarsBody, ColumnsBody, DonutBody, LinesBody, roleColor } from "./ChartBodies";
import { Footnote } from "./CardParts";
import "./charts.css";

const language = "en";

export function ChartCard({ visual }: { visual: Visual }) {
  const chart = ChartPresenter.chart(visual, language);
  const body = chart.body;
  return (
    <SisuCard>
      <div className="sisu-ask-stage-header">
        {chart.source !== "" ? <Eyebrow text={chart.source} /> : null}
        {chart.title !== "" ? <h3 className="sisu-ask-h3">{chart.title}</h3> : null}
        {chart.caption !== "" ? <p className="sisu-ask-body sisu-ask-muted">{chart.caption}</p> : null}
      </div>
      {/* Bars may carry links to the offer pages, so they stay a group whose rows are read out. */}
      <figure className="sisu-chart" role={body.kind === "bars" ? "group" : "img"} aria-label={chart.summary !== "" ? chart.summary : chart.title}>
        {body.kind === "donut" ? <DonutBody body={body} /> : null}
        {body.kind === "bars" ? <BarsBody body={body} /> : null}
        {body.kind === "columns" ? <ColumnsBody body={body} /> : null}
        {body.kind === "lines" ? <LinesBody body={body} /> : null}
        {body.kind === "none" && chart.summary !== "" ? <p className="sisu-ask-body">{chart.summary}</p> : null}
      </figure>
      {body.kind !== "donut" && body.kind !== "lines" && chart.legend.length > 0 ? <Legend entries={chart.legend} /> : null}
      {chart.resultLabel != null && chart.resultValue != null ? (
        <div className="sisu-ask-result">
          <span className="sisu-ask-h3">{chart.resultLabel}</span>
          <span className="sisu-ask-h3 sisu-ask-result-value">{chart.resultValue}</span>
        </div>
      ) : null}
      {chart.footnote ? <Footnote text={chart.footnote} /> : null}
    </SisuCard>
  );
}

function Legend({ entries }: { entries: ChartLegendEntry[] }) {
  return (
    <div className="sisu-chart-legend" aria-hidden="true">
      {entries.map((entry) => (
        <span key={entry.label} className="sisu-chart-legend-entry">
          <span className={entry.isLine ? "sisu-chart-swatch-line" : "sisu-chart-swatch"} style={{ background: roleColor(entry.color) }} />
          <span className="sisu-ask-caption">{entry.label}</span>
        </span>
      ))}
    </div>
  );
}
