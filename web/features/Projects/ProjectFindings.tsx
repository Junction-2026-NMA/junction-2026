"use client";
// A project's findings, newest first: what was found, why it matters (the server's figures), the total effect of a
// home when known, where and when it was found, and the next steps (open the listing, draft a viewing enquiry the
// user sends themselves). Simulated findings say so.
import { useState } from "react";
import type { WatchNotification } from "@/web/core/WatchModels";
import { SisuCard } from "@/web/shared/SisuStyle";
import { Chip, ExternalLink, Note, Rows } from "./ProjectParts";
import { FindingText, HousingText, hostOf, safeLink } from "./ProjectPresenter";

export function ProjectFindings({ findings, rent, fresh }: { findings: WatchNotification[]; rent: boolean; fresh: ReadonlySet<string> }) {
  if (findings.length === 0) {
    return (
      <SisuCard>
        <p className="sisu-project-body">No findings yet.</p>
        <p className="sisu-project-muted">
          {rent ? "When a home that fits appears, or a rent drops to your limit, it shows here." : "When an offer drops to your limit, it shows here."}
        </p>
      </SisuCard>
    );
  }
  return (
    <>
      {findings.map((finding) => <Finding key={finding.id} finding={finding} rent={rent} isNew={fresh.has(finding.id)} />)}
    </>
  );
}

function Finding({ finding, rent, isNew }: { finding: WatchNotification; rent: boolean; isNew: boolean }) {
  const [drafting, setDrafting] = useState(false);
  const simulated = FindingText.isSimulated(finding);
  const listingUrl = safeLink(finding.listing?.url) ?? safeLink(finding.listing?.pageUrl);
  const pageUrl = safeLink(finding.listing?.pageUrl);
  const why = FindingText.why(finding, rent);
  const housing = HousingText.view(finding, rent);
  const line = FindingText.listingLine(finding.listing, rent);

  return (
    <SisuCard className="sisu-project-finding sisu-project-enter">
      <div className="sisu-project-chips" data-new={isNew ? "true" : "false"}>
        {isNew ? <Chip tone="new">New</Chip> : null}
        {simulated ? <Chip tone="simulated">Simulated for the demo</Chip> : null}
        <Chip tone="plain">{finding.kind === "price_drop" ? "Price dropped" : "New listing"}</Chip>
      </div>
      <h3 className="sisu-project-h2">{FindingText.title(finding)}</h3>
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
      {drafting ? <Enquiry finding={finding} /> : null}
    </SisuCard>
  );
}

function HousingEffectView({ view }: { view: NonNullable<ReturnType<typeof HousingText.view>> }) {
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
      {view.missing.length > 0 ? (
        <Note title="Not known yet" lines={[...missingLines(view.missing), ...(view.note ? [view.note] : [])]} />
      ) : view.note ? <p className="sisu-project-muted">{view.note}</p> : null}
    </>
  );
}

/** Short names ("Deposit") join into one line; the newer backend's full sentences stay one per line. */
function missingLines(missing: readonly string[]): string[] {
  return missing.some((item) => /[.!?]$/.test(item.trim())) ? [...missing] : [missing.join(", ") + "."];
}

function Enquiry({ finding }: { finding: WatchNotification }) {
  const [text, setText] = useState(() => FindingText.enquiry(finding));
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
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
      <label className="sisu-project-label" htmlFor={`enquiry-${finding.id}`}>Your enquiry (edit it as you like)</label>
      <textarea id={`enquiry-${finding.id}`} className="sisu-project-enquiry" value={text}
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
