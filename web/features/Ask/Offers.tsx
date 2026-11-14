"use client";
// The offer table, the research card of a typed question and the footer under any offer table (assumptions,
// partial failure and the fetched time). Port of OfferTable, ResearchCard and ResearchFooter in AskCards.swift.
import type { ResearchResult } from "@/web/core/CoachModels";
import { OfferPresenter, type OfferRow } from "@/web/core/CoachPresentation";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { Eyebrow, SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import { Assumptions, Divider, Footnote, Note } from "./CardParts";

const language = "en";

export function OfferTable({ rows }: { rows: OfferRow[] }) {
  return (
    <div className="sisu-ask-offers">
      {rows.map((row, index) => (
        <div key={index} className="sisu-ask-offer-wrap">
          {index > 0 ? <Divider /> : null}
          <div className="sisu-ask-offer" aria-label={offerLabel(row)} role="group">
            <div className="sisu-ask-offer-top" aria-hidden="true">
              <span className="sisu-ask-button-text">{row.provider}</span>
              <span className={`${row.isBest ? "sisu-ask-button-text" : "sisu-ask-label"} sisu-ask-offer-saving${row.comparable ? "" : " sisu-ask-muted"}`}>
                {row.saving}
              </span>
            </div>
            <span className="sisu-ask-caption sisu-ask-muted" aria-hidden="true">{row.plan + " · " + row.price}</span>
            {row.isBest ? (
              <RiveComponent component="Tag" values={RiveBindings.tag("Best offer", "neutral")} {...riveAccessible("Best offer")} />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function offerLabel(row: OfferRow): string {
  return [row.provider, row.saving, row.plan + " · " + row.price, row.isBest ? "Best offer" : null].filter(Boolean).join(", ");
}

/** Offer research from a typed question (no extraction stage): the headline, the table and its notes. */
export function ResearchCard({ research }: { research: ResearchResult }) {
  const baseline = OfferPresenter.baseline(research, language);
  return (
    <SisuCard>
      <Eyebrow text="Offers Sisu found" />
      <h3 className="sisu-ask-h3">{OfferPresenter.headline(research, language)}</h3>
      {baseline ? <p className="sisu-ask-body sisu-ask-muted">{baseline}</p> : null}
      <OfferTable rows={OfferPresenter.rows(research, language)} />
      {/* The footer's fetched line already ends in "Mock data" when the server says the offers are examples. */}
      <ResearchFooter research={research} />
    </SisuCard>
  );
}

/** Assumptions, partial failure and the fetched time, under any offer table. */
export function ResearchFooter({ research }: { research: ResearchResult }) {
  const partial = research.status === "partial" || research.status === "failed" || research.errors.length > 0;
  return (
    <>
      {research.best == null ? (
        <p className="sisu-ask-body">{OfferPresenter.headline(research, language) + ". Your current deal holds up."}</p>
      ) : null}
      {partial ? <Note text="Some offer pages could not be read. These are the offers Sisu could check." lines={research.errors} /> : null}
      <Assumptions items={research.assumptions} />
      <Footnote text={OfferPresenter.fetchedNote(research, language)} />
    </>
  );
}
