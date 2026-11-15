"use client";
// What a project has found, in two cards with their headings inside, like the other sections:
// - "Fits now": the listings last read that meet the requirements (`GET /api/watch/:id` currentMatches), each with
//   the housing effect, Open listing and a viewing enquiry. One that is already a finding is shown only there.
// - "Findings", newest first: what was found, why it matters (the server's figures), the total effect of a home when
//   known, where and when it was found, and the same next steps. Simulated findings say so.
// The enquiry is for the user to send themselves; nothing contacts a landlord. A stopped project promises nothing new.
import { useState } from "react";
import type { Listing, PropertyWatch, WatchNotification } from "@/web/core/WatchModels";
import { type CurrentMatch, sameListing } from "@/web/core/WatchProject";
import { SisuCard } from "@/web/shared/SisuStyle";
import { BackendHousing } from "./BackendHousing";
import { Chip, ExternalLink, Note, Rows } from "./ProjectParts";
import { FindingText, HousingText, type HousingView, ProjectText, hostOf, safeLink } from "./ProjectPresenter";

export interface ProjectFindingsProps {
  findings: WatchNotification[];
  /** The listings that fit now (empty where the server does not send them, and on a stopped project). */
  matches: readonly CurrentMatch[];
  watch: PropertyWatch;
  rent: boolean;
  fresh: ReadonlySet<string>;
  stopped: boolean;
}

export function ProjectFindings({ findings, matches, watch, rent, fresh, stopped }: ProjectFindingsProps) {
  const fitting = matches.filter((match) => !findings.some((finding) => sameListing(finding.listing, match.listing)));
  return (
    <>
      {fitting.length > 0 ? (
        <SisuCard className="sisu-project-findings" testId="project.fitsNow">
          <h2 className="sisu-project-h2">Fits now</h2>
          <p className="sisu-project-muted">{rent ? "Homes on the watched pages that meet your requirements, as last read." : "Offers on the watched pages that meet your limit, as last read."}</p>
          {fitting.map((match) => <MatchItem key={`${match.listing.url ?? ""}|${match.listing.title ?? ""}`} match={match} watch={watch} rent={rent} />)}
        </SisuCard>
      ) : null}
      {findings.length > 0 ? (
        <SisuCard className="sisu-project-findings" testId="project.findings">
          <h2 className="sisu-project-h2">Findings</h2>
          {findings.map((finding) => <Finding key={finding.id} finding={finding} rent={rent} isNew={fresh.has(finding.id)} />)}
        </SisuCard>
      ) : fitting.length === 0 ? (
        <SisuCard testId="project.findings">
          <h2 className="sisu-project-h2">Findings</h2>
          {stopped ? <p className="sisu-project-body">No findings while this project ran.</p> : (
            <>
              <p className="sisu-project-body">No findings yet.</p>
              <p className="sisu-project-muted">
                {rent ? "When a home that fits appears, or a rent drops to your limit, it shows here." : "When an offer drops to your limit, it shows here."}
              </p>
            </>
          )}
        </SisuCard>
      ) : null}
    </>
  );
}

function MatchItem({ match, watch, rent }: { match: CurrentMatch; watch: PropertyWatch; rent: boolean }) {
  const listing = match.listing;
  const housing = rent && match.housing && BackendHousing.matches(match.housing) ? BackendHousing.view(match.housing, { leftOverAfterEur: null }) : null;
  const pageUrl = safeLink(listing.pageUrl);
  const readAt = watch.pages.find((page) => page.url === listing.pageUrl)?.lastReadAt ?? null;
  const line = FindingText.listingLine(listing, rent);
  return (
    <article className="sisu-project-finding sisu-project-enter">
      <h3 className="sisu-project-h3">{listing.title || (rent ? "A home that fits" : "An offer that fits")}</h3>
      {line ? <p className="sisu-project-body">{line}</p> : null}
      {housing ? <HousingEffectView view={housing} /> : null}
      <p className="sisu-project-muted">
        {readAt ? `Read from the page ${ProjectText.when(readAt)}` : "Read from the page"}
        {pageUrl ? <> · <ExternalLink url={pageUrl}>{hostOf(pageUrl)}</ExternalLink></> : null}
      </p>
      <NextSteps listing={listing} rent={rent} id={`match-${listing.url ?? listing.title ?? "home"}`} />
    </article>
  );
}

function Finding({ finding, rent, isNew }: { finding: WatchNotification; rent: boolean; isNew: boolean }) {
  const simulated = FindingText.isSimulated(finding);
  const pageUrl = safeLink(finding.listing?.pageUrl);
  const why = FindingText.why(finding, rent);
  const housing = HousingText.view(finding, rent);
  const line = FindingText.listingLine(finding.listing, rent);

  return (
    <article className="sisu-project-finding sisu-project-enter" data-new={isNew ? "true" : "false"}>
      <div className="sisu-project-chips">
        {isNew ? <Chip tone="new">New</Chip> : null}
        {simulated ? <Chip tone="simulated">Simulated for the demo</Chip> : null}
        <Chip tone="plain">{finding.kind === "price_drop" ? "Price dropped" : "New listing"}</Chip>
      </div>
      <h3 className="sisu-project-h3">{FindingText.title(finding)}</h3>
      {line ? <p className="sisu-project-body">{line}</p> : null}
      {simulated ? <p className="sisu-project-muted">The page did not really change.</p> : null}
      {why.length > 0 ? (
        <>
          <p className="sisu-project-subhead">Why it matters</p>
          <Rows rows={why} />
        </>
      ) : finding.summary ? <p className="sisu-project-body">{finding.summary}</p> : null}
      {housing ? <HousingEffectView view={housing} /> : null}
      <p className="sisu-project-muted">
        {FindingText.provenance(finding)}
        {pageUrl ? <> · <ExternalLink url={pageUrl}>{hostOf(pageUrl)}</ExternalLink></> : null}
      </p>
      {finding.listing ? <NextSteps listing={finding.listing} rent={rent} id={`finding-${finding.id}`} /> : null}
    </article>
  );
}

/** Open the listing, and for a home a viewing enquiry to copy. */
function NextSteps({ listing, rent, id }: { listing: Listing; rent: boolean; id: string }) {
  const [drafting, setDrafting] = useState(false);
  const listingUrl = safeLink(listing.url) ?? safeLink(listing.pageUrl);
  return (
    <>
      <div className="sisu-project-actions">
        {listingUrl ? (
          <a className="sisu-project-small" data-kind="primary" href={listingUrl} target="_blank" rel="noopener noreferrer">
            {rent ? "Open listing" : "Open offer"}
          </a>
        ) : null}
        {rent ? (
          <button type="button" className="sisu-project-small" aria-expanded={drafting} onClick={() => setDrafting((d) => !d)}>
            {drafting ? "Hide the enquiry" : "Prepare a viewing enquiry"}
          </button>
        ) : null}
      </div>
      {drafting ? <Enquiry listing={listing} id={id} /> : null}
    </>
  );
}

function HousingEffectView({ view }: { view: HousingView }) {
  return (
    <>
      <p className="sisu-project-subhead">Total cost of moving</p>
      <Rows rows={view.monthly} />
      {view.upfront.length > 0 ? (
        <>
          <p className="sisu-project-label">Once, before moving in</p>
          <Rows rows={view.upfront} />
        </>
      ) : null}
      <Rows rows={view.totals} />
      {view.missing.length > 0 ? <Note title="Not known yet" lines={missingLines(view.missing)} /> : null}
      {view.note ? <p className="sisu-project-muted">{view.note}</p> : null}
    </>
  );
}

/** Short names ("Deposit") join into one line; the newer backend's full sentences stay one per line. */
function missingLines(missing: readonly string[]): string[] {
  return missing.some((item) => /[.!?]$/.test(item.trim())) ? [...missing] : [missing.join(", ") + "."];
}

function Enquiry({ listing, id }: { listing: Listing; id: string }) {
  const [text, setText] = useState(() => FindingText.enquiry({ listing }));
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const fieldId = `enquiry-${id}`.replace(/[^\w-]/g, "-");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <div className="sisu-project-field">
      <label className="sisu-project-label" htmlFor={fieldId}>Your enquiry (edit it as you like)</label>
      <textarea id={fieldId} className="sisu-project-enquiry" value={text}
        onChange={(event) => { setText(event.target.value); setCopied("idle"); }} data-selectable />
      <div className="sisu-project-actions">
        <button type="button" className="sisu-project-small" onClick={() => void copy()}>Copy the message</button>
      </div>
      <p className="sisu-project-muted" role="status">
        {copied === "done" ? "Copied. " : copied === "failed" ? "Copying did not work here: select the text and copy it. " : ""}
        Sisu never sends it or contacts the landlord. Send it yourself from the listing page.
      </p>
    </div>
  );
}
