"use client";
// The listings last read, by verdict (GET /api/watch/:id `evaluated`): Matches (every requirement met), Needs
// verification (nothing fails but a required detail is not stated: named here), and the alternatives that do not
// meet the requirements, collapsed and kept apart. "No matches yet" when nothing qualifies. Each listing has its
// link, rent, size, the known extra costs (unknown ones flagged), the deposit apart as an upfront cost, the rent
// limit and the savings goal as two separate lines, and the effect on monthly savings from Sisu's finance engine.
import type { EvaluatedListing } from "@/web/core/WatchExtras";
import { Money } from "@/web/core/Presentation";
import { SisuCard } from "@/web/shared/SisuStyle";
import { Disclosure } from "@/web/features/Ask/Disclosure";
import { BackendHousing } from "./BackendHousing";
import { HousingEffectView } from "./ProjectFindings";
import { ListingGroups, affordabilityLines } from "./ProjectJourney";
import { Chip, ExternalLink, Rows } from "./ProjectParts";
import { type ProjectLine, hostOf, safeLink } from "./ProjectPresenter";

const money = (eur: number) => Money.format(eur, "en");

export function ListingResults({ evaluated, stopped }: { evaluated: readonly EvaluatedListing[]; stopped: boolean }) {
  const groups = ListingGroups.of(evaluated);
  return (
    <SisuCard className="sisu-project-findings" testId="project.results">
      <h2 className="sisu-project-h2">Listings checked against your requirements</h2>
      {groups.matches.length === 0 ? (
        <>
          <p className="sisu-project-body" data-testid="project.noMatches"><strong>{ListingGroups.noMatches}</strong></p>
          <p className="sisu-project-muted">{stopped ? "Nothing met every requirement while this project ran." : "Nothing meets every requirement right now. Sisu keeps checking and notifies you when one does."}</p>
        </>
      ) : (
        <>
          <p className="sisu-project-subhead">{`Matches (${groups.matches.length})`}</p>
          {groups.matches.map((e) => <ListingItem key={keyOf(e)} item={e} />)}
        </>
      )}
      {groups.verify.length > 0 ? (
        <>
          <p className="sisu-project-subhead">{`Needs verification (${groups.verify.length})`}</p>
          <p className="sisu-project-muted">Nothing here fails your requirements, but the listing does not state everything. These are not counted as matches.</p>
          {groups.verify.map((e) => <ListingItem key={keyOf(e)} item={e} />)}
        </>
      ) : null}
      {groups.alternatives.length > 0 ? (
        <div className="sisu-pfound-alternatives">
          <Disclosure label="Alternatives: don't meet your requirements" count={groups.alternatives.length} testId="project.alternatives">
            {groups.alternatives.map((e) => <ListingItem key={keyOf(e)} item={e} />)}
          </Disclosure>
        </div>
      ) : null}
    </SisuCard>
  );
}

const keyOf = (e: EvaluatedListing) => `${e.listing.url ?? ""}|${e.listing.title ?? ""}|${e.listing.priceEur ?? ""}`;

function ListingItem({ item }: { item: EvaluatedListing }) {
  const l = item.listing;
  const link = safeLink(l.url) ?? safeLink(l.pageUrl);
  const missing = ListingGroups.missing(item.checks);
  const lines = affordabilityLines(item.checks);
  const housing = item.housing && BackendHousing.matches(item.housing) ? BackendHousing.view(item.housing, { leftOverAfterEur: null }) : null;
  const tag = item.verdict === "match" ? <Chip tone="active">Match</Chip> : item.verdict === "needs_verification" ? <Chip tone="attention">Needs verification</Chip> : <Chip tone="stopped">Does not meet your requirements</Chip>;
  return (
    <article className="sisu-project-finding" data-verdict={item.verdict}>
      <div className="sisu-project-chips">{tag}</div>
      <h3 className="sisu-project-h3">{l.title || "A listing"}</h3>
      <Rows rows={facts(item)} />
      {missing.length > 0 ? <p className="sisu-project-muted">{`Check before you count on it: ${missing.join(", ").toLowerCase()} not stated.`}</p> : null}
      {lines.length > 0 ? (
        <ul className="sisu-pfound-checks">
          {lines.map((line) => <li key={line.label} data-status={line.status}><strong>{line.label}</strong><span>{line.detail}</span></li>)}
        </ul>
      ) : null}
      <p className="sisu-project-subhead">Why</p>
      <ul className="sisu-pfound-checks">
        {item.checks.map((check) => (
          <li key={check.requirement} data-status={check.status}>
            <strong>{`${check.status === "met" ? "Meets" : check.status === "failed" ? "Fails" : "Not stated"}: ${check.requirement}`}</strong>
            <span>{check.detail}</span>
          </li>
        ))}
      </ul>
      {housing ? <HousingEffectView view={housing} /> : null}
      {link ? (
        <div className="sisu-project-actions">
          <a className="sisu-project-small" data-kind="primary" href={link} target="_blank" rel="noopener noreferrer">Open listing</a>
          {l.pageUrl && safeLink(l.pageUrl) && l.pageUrl !== l.url ? <ExternalLink url={l.pageUrl}>{hostOf(l.pageUrl)}</ExternalLink> : null}
        </div>
      ) : null}
    </article>
  );
}

/** Rent, size, rooms, where, when free; the known extra costs (unknown ones said); the deposit apart, as upfront. */
function facts(item: EvaluatedListing): ProjectLine[] {
  const l = item.listing;
  const rows: ProjectLine[] = [];
  if (l.priceEur != null) rows.push({ label: "Rent", value: `${money(l.priceEur)} a month` });
  rows.push({ label: "Utilities and other monthly costs", value: l.utilitiesPerMonthEur != null ? `${money(l.utilitiesPerMonthEur)} a month` : "Unknown: not on the listing" });
  rows.push({ label: "Size", value: l.areaM2 != null ? `${l.areaM2} m²` : "Not stated" });
  if (l.rooms != null) rows.push({ label: "Rooms", value: String(l.rooms) });
  const where = [l.district, l.city].filter(Boolean).join(", ");
  if (where) rows.push({ label: "Where", value: where });
  if (l.availableFrom) rows.push({ label: "Available from", value: l.availableFrom });
  rows.push({ label: "Deposit (upfront, once)", value: l.depositEur != null ? money(l.depositEur) : "Unknown: ask the landlord" });
  return rows;
}
