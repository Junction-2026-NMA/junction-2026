"use client";
// The details of one answer, closed at first: the offers compared, "Show the maths" (what stood out, the
// transactions, each calculation's steps, the futures), the assumptions (each once per
// answer) and the sources (labelled, with when they were read and a link). Replaces the stage cards and the
// "How Sisu worked this out" drawer of the iOS port, which repeated the same figures several times. When the answer
// leads with a monthly saving, its projection over the years is a separate optional section, labelled an estimate.
// The tool calls and the timing are not here: they are the answer's activity trace above the card (AnswerActivity).
import { useAppModel } from "@/web/app/AppProvider";
import type { AnswerView, FuturesView, HowBlock } from "@/web/core/AnswerPresentation";
import { Footnote, LinesView, SourceLink } from "./CardParts";
import { Disclosure } from "./Disclosure";
import { ImpactChart } from "./ImpactChart";
import { OffersDetail } from "./Offers";
import { SourceChips } from "./ResultLine";
import "./answer.css";

export function AnswerDetails({ view }: { view: AnswerView }) {
  const optional = view.futures?.optional ? view.futures : null;
  const inHow = view.futures?.optional ? null : view.futures;
  const hasHow = view.how.length > 0 || inHow != null;
  if (!hasHow && optional == null && view.offers == null && view.assumptions.length === 0 && view.sources.length === 0 && view.tags.length === 0) return null;
  return (
    <section className="sisu-answer-details" aria-label="Details" data-testid="answer.details">
      <div className="sisu-answer-details-head">
        <span className="sisu-ask-label sisu-ask-muted">Details</span>
        {view.grounding ? (
          <span className="sisu-answer-grounding" data-warning={view.grounding.isWarning ? "true" : "false"}>{view.grounding.text}</span>
        ) : null}
      </div>
      {view.offers ? (
        <Disclosure label={view.noMatch ? "Offers Sisu compared" : "Offers compared"} count={view.offers.rows.length} testId="offers">
          <OffersDetail offers={view.offers} />
        </Disclosure>
      ) : null}
      {hasHow ? (
        <Disclosure label="Show the maths" testId="how">
          {view.how.map((block) => <HowSection key={block.id} block={block} />)}
          {inHow ? (
            <div className="sisu-answer-section">
              <span className="sisu-ask-label">{inHow.label}</span>
              <Futures futures={inHow} />
            </div>
          ) : null}
        </Disclosure>
      ) : null}
      {optional ? (
        <Disclosure label={optional.label} testId="futures">
          <div className="sisu-answer-section">
            <SourceChips tags={optional.tags} />
            <Futures futures={optional} />
          </div>
        </Disclosure>
      ) : null}
      {view.assumptions.length > 0 ? (
        <Disclosure label="Assumptions" count={view.assumptions.length} testId="assumptions">
          <ul className="sisu-answer-list">
            {view.assumptions.map((item, index) => <li key={index} className="sisu-ask-body">{item}</li>)}
          </ul>
        </Disclosure>
      ) : null}
      {view.sources.length > 0 || view.tags.length > 0 ? (
        <Disclosure label="Sources" count={view.sources.length} testId="sources">
          {view.tags.length > 0 ? (
            <div className="sisu-answer-section">
              <span className="sisu-ask-caption sisu-ask-muted">Where the figures come from</span>
              <SourceChips tags={view.tags} />
            </div>
          ) : null}
          {view.sources.map((source) => (
            <div key={source.url} className="sisu-answer-source">
              <SourceLink title={source.title} url={source.url} />
              {source.fetched ? <Footnote text={source.fetched} /> : null}
            </div>
          ))}
        </Disclosure>
      ) : null}
    </section>
  );
}

function Futures({ futures }: { futures: FuturesView }) {
  return (
    <>
      <ImpactChart series={futures.series} />
      {futures.summary !== "" ? <p className="sisu-ask-caption sisu-ask-muted">{futures.summary}</p> : null}
    </>
  );
}

function HowSection({ block }: { block: HowBlock }) {
  const model = useAppModel();
  return (
    <div className="sisu-answer-section">
      <span className="sisu-ask-label">{block.title}</span>
      <LinesView lines={block.lines} />
      {block.evidence ? (
        <button type="button" className="sisu-answer-link" onClick={() => model.showEvidence(block.evidence!.title, block.evidence!.filter)}>
          See the transactions
        </button>
      ) : null}
    </div>
  );
}
