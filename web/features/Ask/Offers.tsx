"use client";
// The offers Sisu compared, inside an answer's details: each offer's estimated monthly cost (the figure the answer
// uses), its contract, energy price and fees as stated (unknown fees say so, never €0), its saving (marked
// incomplete when a fee is unknown), and whether it meets the user's requirements. "Best match" only ever marks an
// offer that meets them. Offers that miss a requirement are listed apart, after the ones that meet them, with what
// they miss and their page but no cost or saving, so nothing that fails the request reads as an option.
// Port of OfferTable in AskCards.swift, reworked on 15 Nov.
import type { AnswerOffers } from "@/web/core/AnswerPresentation";
import type { OfferRow } from "@/web/core/CoachPresentation";
import { Footnote, Note, validURL } from "./CardParts";
import "./answer.css";

export function OfferTable({ rows }: { rows: OfferRow[] }) {
  return (
    <ul className="sisu-answer-offers">
      {rows.map((row, index) => {
        const href = validURL(row.sourceUrl);
        const misses = row.meets === false;
        // A miss the contract line already says ("contract length not stated") is not said twice.
        const missLines = row.misses.filter((miss) => miss.trim() !== contractText(row));
        return (
          <li key={`${row.id}-${index}`} className="sisu-answer-offer" data-meets={row.meets === false ? "false" : "true"} aria-label={offerLabel(row)}>
            <div className="sisu-answer-offer-top" aria-hidden="true">
              {href ? (
                <a className="sisu-ask-label sisu-answer-offer-name" href={href} target="_blank" rel="noopener noreferrer" tabIndex={-1}>{row.provider}</a>
              ) : <span className="sisu-ask-label sisu-answer-offer-name">{row.provider}</span>}
              {misses ? null : <span className="sisu-ask-label sisu-answer-offer-cost">{row.estimatedMonthlyCost}</span>}
            </div>
            <span className="sisu-ask-caption sisu-ask-muted" aria-hidden="true">{`${row.plan} · ${contractText(row)}`}</span>
            {misses ? null : (
              <>
                <span className="sisu-ask-caption sisu-ask-muted" aria-hidden="true">{[row.energy, row.fees].filter(Boolean).join(" · ")}</span>
                <div className="sisu-answer-offer-bottom" aria-hidden="true">
                  <span className={`sisu-ask-caption${row.comparable ? "" : " sisu-ask-muted"}`}>{row.saving}</span>
                  {row.isBest ? <span className="sisu-answer-pill" data-tone="good">Best match</span> : null}
                </div>
              </>
            )}
            {missLines.length > 0 ? (
              <ul className="sisu-answer-misses" aria-hidden="true">
                {missLines.map((miss, i) => <li key={i} className="sisu-ask-caption">{miss}</li>)}
              </ul>
            ) : null}
            {href ? <a className="sisu-answer-offer-open" href={href} target="_blank" rel="noopener noreferrer">{`Open ${row.provider}'s page`}</a> : null}
          </li>
        );
      })}
    </ul>
  );
}

function contractText(row: OfferRow): string {
  return row.contract === "not stated" ? "contract length not stated" : `${row.contract.replace(/^(\d+) months?$/, "$1-month")} contract`;
}

function offerLabel(row: OfferRow): string {
  if (row.meets === false) return [row.provider, row.plan, contractText(row), "Does not meet your requirements", ...row.misses].filter(Boolean).join(", ");
  return [row.provider, row.plan, row.estimatedMonthlyCost, contractText(row), row.energy, row.fees, row.saving, row.isBest ? "Best match" : null]
    .filter(Boolean).join(", ");
}

/** Everything about the offers: what was asked for, the bill now, the table and where it was read. */
export function OffersDetail({ offers }: { offers: AnswerOffers }) {
  const meeting = offers.rows.filter((row) => row.meets !== false);
  const missing = offers.rows.filter((row) => row.meets === false);
  return (
    <div className="sisu-answer-section">
      {offers.requirement ? <p className="sisu-ask-body">{offers.requirement}</p> : null}
      {offers.baseline ? <p className="sisu-ask-body sisu-ask-muted">{offers.baseline}</p> : null}
      {meeting.length > 0 ? <OfferTable rows={meeting} /> : null}
      {missing.length > 0 ? (
        <>
          <p className="sisu-ask-caption sisu-ask-muted sisu-answer-offers-apart">
            {meeting.length > 0 ? "Did not meet your requirements" : "None of these meet your requirements"}
          </p>
          <OfferTable rows={missing} />
        </>
      ) : null}
      {offers.problems.length > 0 ? <Note text="Some pages could not be read, so a few offers may be missing." lines={offers.problems} /> : null}
      {offers.pagesNote ? <Footnote text={offers.pagesNote} /> : null}
      {offers.fetched ? <Footnote text={offers.fetched} /> : null}
    </div>
  );
}
