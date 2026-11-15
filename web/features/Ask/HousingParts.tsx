"use client";
// v2 housing pieces shared by the results card in the chat and the project view: one listing's card (source, size,
// location, rent, recurring costs with unknowns named, upfront costs apart, the effect on the month and the
// savings goal), the excluded list, the maths, the Exa and Context.dev evidence, and the requirement table.
// Every figure comes from the server's evaluation (lib/housing/evaluate.ts); nothing is worked out here.
import type { CalcStep } from "@/web/core/Models";
import { type HousingEvaluation, type HousingResearchRecord, HousingText, type ListingEvaluation, allEvaluated } from "@/web/core/HousingModels";
import { Chip, ExternalLink } from "@/web/features/Projects/ProjectParts";
import "@/web/features/Projects/projects.css";
import "./housing.css";

const VERDICT_LABEL = { fits: "Meets every requirement", needs_checking: "Needs checking", excluded: "Excluded" } as const;

export function ListingCard({ one, heading, savingsGoal }: { one: ListingEvaluation; heading: string; savingsGoal: number | null }) {
  const left = one.leftOverAfterEur;
  return (
    <article className="sisu-housing-listing" data-verdict={one.verdict} data-testid="housing.listing">
      <div className="sisu-project-chips">
        <Chip tone={one.verdict === "fits" ? "plain" : "attention"}>{heading}</Chip>
        <span className="sisu-project-muted">{one.host}</span>
      </div>
      <div className="sisu-housing-listing-head">
        <h3 className="sisu-project-h3">{one.listing.title}</h3>
        <p className="sisu-housing-price">{HousingText.cost(one.listing.priceEur, "month")}</p>
      </div>
      <p className="sisu-project-muted">{HousingText.facts(one)}{one.listing.availableFrom ? ` · free ${one.listing.availableFrom}` : ""}</p>
      <p className="sisu-project-subhead">Every month</p>
      <ul className="sisu-housing-costs">
        {one.recurring.map((cost) => (
          <li key={cost.label} data-unknown={cost.eur === null ? "true" : "false"}>
            <span>{cost.label}</span><span>{cost.eur === null ? (cost.note ?? "unknown") : HousingText.cost(cost.eur, "month")}</span>
          </li>
        ))}
      </ul>
      <p className="sisu-project-subhead">Upfront, once</p>
      <ul className="sisu-housing-costs">
        {one.upfront.map((cost) => (
          <li key={cost.label} data-unknown={cost.eur === null ? "true" : "false"}>
            <span>{cost.label}</span><span>{cost.eur === null ? (cost.note ?? "unknown") : HousingText.cost(cost.eur, "once")}</span>
          </li>
        ))}
      </ul>
      <p className="sisu-project-body">{`Your month: ${HousingText.effect(one)}`}</p>
      {savingsGoal !== null ? (
        <p className="sisu-project-muted">{left >= savingsGoal ? `Your savings goal of ${HousingText.eur(savingsGoal)} a month still fits.` : `Your savings goal of ${HousingText.eur(savingsGoal)} a month would not fit.`}</p>
      ) : null}
      {one.unknowns.length ? <p className="sisu-project-muted">{`Check yourself: ${one.unknowns.join("; ")}.`}</p> : null}
      {one.reasons.length ? <p className="sisu-project-muted">{`Excluded: ${one.reasons.join("; ")}.`}</p> : null}
      <ExternalLink url={one.listing.url}>Open the listing</ExternalLink>
    </article>
  );
}

export function ExcludedList({ excluded }: { excluded: ListingEvaluation[] }) {
  if (!excluded.length) return <p className="sisu-project-muted">Nothing was excluded.</p>;
  return (
    <ul className="sisu-project-list-plain">
      {excluded.map((one) => <li key={one.key}>{`${one.listing.title} (${HousingText.cost(one.listing.priceEur, "month")}, ${one.host}): ${one.reasons.join("; ")}`}</li>)}
    </ul>
  );
}

export function MathsList({ steps, assumptions, reasoning }: { steps: CalcStep[]; assumptions: string[]; reasoning?: string | null }) {
  return (
    <>
      {reasoning ? <p className="sisu-project-body">{reasoning}</p> : null}
      <ul className="sisu-housing-costs">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`}><span>{step.label}</span><span>{HousingText.eur(step.amount)}</span></li>
        ))}
      </ul>
      <p className="sisu-project-subhead">Assumptions</p>
      <ul className="sisu-project-list-plain">{assumptions.map((line) => <li key={line}>{line}</li>)}</ul>
    </>
  );
}

/** Exa found the pages (the query is shown exactly as sent); Context.dev read each one into listings. */
export function ResearchSources({ research }: { research: HousingResearchRecord }) {
  return (
    <>
      {research.mock ? <Chip tone="attention">Example data: no live search was made</Chip> : null}
      <p className="sisu-project-subhead">Exa search (finds the listing pages)</p>
      <p className="sisu-housing-query" data-testid="housing.exaQuery">{research.exaQuery}</p>
      <p className="sisu-project-muted">{`Only the city went to Exa. ${HousingText.retrieved(research.retrievedAt, false)}.`}</p>
      <ul className="sisu-project-links">
        {research.sources.map((source) => <li key={source.url}><ExternalLink url={source.url}>{`${source.host}: ${source.title}`}</ExternalLink></li>)}
      </ul>
      <p className="sisu-project-subhead">Context.dev (reads each page into rent, size, rooms and district)</p>
      <ul className="sisu-project-list-plain">
        {research.read.map((page) => <li key={page.url}>{`${page.host}: ${HousingText.retrieved(page.retrievedAt, page.cached)}`}</li>)}
        {research.problems.map((problem) => <li key={problem}>{`Not read: ${problem}`}</li>)}
      </ul>
    </>
  );
}

const MARK = { pass: "✓", fail: "✗", unknown: "?" } as const;

/** Listing × requirement: the facts read from each page, compared in code with each requirement. */
export function RequirementTable({ evaluation }: { evaluation: HousingEvaluation }) {
  const all = allEvaluated(evaluation);
  if (!all.length) return <p className="sisu-project-muted">No listing was read.</p>;
  const labels = all[0].checks.map((check) => check.label);
  return (
    <div className="sisu-housing-scroll">
      <table className="sisu-housing-table" data-testid="housing.requirementTable">
        <thead>
          <tr><th scope="col">Listing</th>{labels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {all.map((one) => (
            <tr key={one.key}>
              <th scope="row">{`${one.listing.title} · ${HousingText.cost(one.listing.priceEur, "month")} · ${one.listing.areaM2 === null ? "? m²" : `${one.listing.areaM2} m²`}`}<br /><span className="sisu-project-muted">{VERDICT_LABEL[one.verdict]}</span></th>
              {one.checks.map((check) => (
                <td key={check.id}><span className="sisu-housing-mark" data-status={check.status} aria-label={check.status}>{MARK[check.status]}</span> {check.detail}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const verdictLabel = (one: ListingEvaluation): string => VERDICT_LABEL[one.verdict];
