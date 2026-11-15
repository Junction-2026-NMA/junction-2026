"use client";
// A chart the agent sent (`visual` events, CoachMessage.visuals), drawn from SisuCore's ChartPresenter: every
// fraction and text is the presenter's, nothing is recomputed here. On a solid white card (brand rule: charts never
// on glass), with where the figures come from, what the lengths measure, a legend and the result. A comparison with
// other customers is labelled as the synthetic demo dataset, never as statistics about real people.
import { CardText, SourceTags } from "@/web/core/AnswerPresentation";
import { ChartPresenter, type ChartLegendEntry } from "@/web/core/ChartPresentation";
import type { Visual } from "@/web/core/PlanModels";
import { SisuCard } from "@/web/shared/SisuStyle";
import { BarsBody, ColumnsBody, DonutBody, LinesBody, roleColor } from "./ChartBodies";
import { Footnote } from "./CardParts";
import { SourceChips } from "./ResultLine";
import "./charts.css";

const language = "en";

export function ChartCard({ visual }: { visual: Visual }) {
  const chart = ChartPresenter.chart(visual, language);
  const body = chart.body;
  const synthetic = SourceTags.isSynthetic(visual);
  const tags = SourceTags.unique([synthetic ? SourceTags.synthetic(language) : SourceTags.of(visual.source, language)]);
  const caption = CardText.humanize(chart.caption, language);
  return (
    <SisuCard>
      <div className="sisu-ask-stage-header">
        {chart.title !== "" ? <h3 className="sisu-ask-h3">{chart.title}</h3> : null}
        {caption !== "" ? <p className="sisu-ask-caption sisu-ask-muted">{caption}</p> : null}
        {tags.length > 0 ? <SourceChips tags={tags} /> : null}
      </div>
      {chart.unit || chart.scale ? (
        <div className="sisu-chart-unit-row">
          {chart.unit ? <span className="sisu-ask-caption sisu-ask-muted">{chart.unit}</span> : null}
          {chart.scale ? <span className="sisu-ask-caption sisu-ask-muted">{chart.scale}</span> : null}
        </div>
      ) : null}
      {/* Bars may carry links to the offer pages, so they stay a group whose rows are read out. */}
      <figure className="sisu-chart" role={body.kind === "bars" ? "group" : "img"} aria-label={chart.summary !== "" ? chart.summary : chart.title}>
        {body.kind === "donut" ? <DonutBody body={body} /> : null}
        {body.kind === "bars" ? <BarsBody body={body} /> : null}
        {body.kind === "columns" ? <ColumnsBody body={body} /> : null}
        {body.kind === "lines" ? <LinesBody body={body} /> : null}
        {body.kind === "none" && chart.summary !== "" ? <p className="sisu-ask-body">{CardText.humanize(chart.summary, language)}</p> : null}
      </figure>
      {body.kind !== "donut" && body.kind !== "lines" && chart.legend.length > 0 ? <Legend entries={chart.legend} /> : null}
      {chart.resultLabel != null && chart.resultValue != null ? (
        <div className="sisu-ask-result">
          <span className="sisu-ask-h3">{chart.resultLabel}</span>
          <span className="sisu-ask-h3 sisu-ask-result-value">{chart.resultValue}</span>
        </div>
      ) : null}
      {synthetic ? (
        <Footnote text="Compared with other customers in this demo's synthetic dataset. These are not statistics about real people in Finland." />
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
