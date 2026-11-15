"use client";
// "How Sisu found this": what each tool really did for this project, from the stored tool results (`evidence`).
// Exa found the pages; Context.dev read the listing facts and watches the pages for changes; Sisu's finance engine
// worked out the effect on the budget. A link is a source, never proof of a requirement (a commute is not measured).
import { Money } from "@/web/core/Presentation";
import type { EvaluatedListing, ListingFacts, ProjectEvidence } from "@/web/core/WatchExtras";
import { Disclosure } from "@/web/features/Ask/Disclosure";
import { BackendHousing } from "./BackendHousing";
import { AlertRules } from "./ProjectJourney";
import { Chip, ExternalLink, Rows } from "./ProjectParts";
import { ProjectText, hostOf, safeLink } from "./ProjectPresenter";

const money = (eur: number) => Money.format(eur, "en");
const when = (iso: string | null) => (iso ? ProjectText.when(iso) : "time not recorded");

function factsLine(f: ListingFacts | null): string {
  if (!f) return "Not on the page before";
  return [f.priceEur != null ? `${money(f.priceEur)} a month` : null, f.areaM2 != null ? `${f.areaM2} m²` : null, f.availableFrom ? `free ${f.availableFrom}` : null]
    .filter(Boolean).join(" · ") || "No figures";
}

export function HowSisuFound({ evidence, listings }: { evidence: ProjectEvidence | null; listings: readonly EvaluatedListing[] }) {
  if (!evidence) return null;
  const finance = listings.find((e) => e.verdict !== "fails" && e.housing && BackendHousing.matches(e.housing)) ?? null;
  const view = finance?.housing ? BackendHousing.view(finance.housing, { leftOverAfterEur: null }) : null;
  return (
    <div className="sisu-pfound" data-testid="project.howFound">
      <Disclosure label="How Sisu found this" testId="project.howFound">
        <section className="sisu-pfound-part">
          <p className="sisu-project-subhead">Exa: sources discovered</p>
          {evidence.exa ? (
            <>
              <p className="sisu-project-muted">{`Searched for "${evidence.exa.query}" ${when(evidence.exa.searchedAt)}. Only the place and the topic were sent, never your bank data.`}</p>
              {evidence.exa.mock ? <Chip tone="attention">Example data</Chip> : null}
              <ul className="sisu-project-links">
                {evidence.exa.sources.map((s) => (safeLink(s.url) ? <li key={s.url}><ExternalLink url={s.url}>{s.title || hostOf(s.url)}</ExternalLink></li> : null))}
              </ul>
            </>
          ) : <p className="sisu-project-muted">No search was recorded for this project.</p>}
        </section>

        <section className="sisu-pfound-part">
          <p className="sisu-project-subhead">Context.dev: listing facts extracted</p>
          {evidence.extraction.length === 0 ? <p className="sisu-project-muted">No page read was recorded for this project.</p> : null}
          {evidence.extraction.map((page) => {
            const read = listings.filter((e) => e.listing.pageUrl === page.url).slice(0, 6);
            return (
              <div key={page.url} className="sisu-pfound-change">
                <p className="sisu-project-muted">
                  {safeLink(page.url) ? <ExternalLink url={page.url}>{page.title || hostOf(page.url)}</ExternalLink> : page.title}
                  {` · read ${when(page.readAt)}${page.listingsRead != null ? ` · ${page.listingsRead} listing${page.listingsRead === 1 ? "" : "s"}` : ""}${page.problem ? ` · ${page.problem}` : ""}`}
                </p>
                {read.length > 0 ? (
                  <ul className="sisu-pfound-checks">
                    {read.map((e) => (
                      <li key={`${e.listing.url ?? ""}|${e.listing.title ?? ""}`} data-status="met">
                        <strong>{e.listing.title || "Listing"}</strong>
                        <span>{[
                          e.listing.priceEur != null ? `rent ${money(e.listing.priceEur)}/month` : "rent not stated",
                          e.listing.areaM2 != null ? `${e.listing.areaM2} m²` : "size not stated",
                          e.listing.depositEur != null ? `deposit ${money(e.listing.depositEur)}` : "deposit not stated",
                          e.listing.utilitiesPerMonthEur != null ? `utilities ${money(e.listing.utilitiesPerMonthEur)}/month` : "fees not stated",
                        ].join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="sisu-pfound-part">
          <p className="sisu-project-subhead">Context.dev monitoring: changes detected</p>
          {evidence.monitoring.length === 0 ? <p className="sisu-project-muted">No change detected on the watched pages yet.</p> : evidence.monitoring.map((c) => (
            <div key={c.id} className="sisu-pfound-change">
              {c.simulated ? <Chip tone="simulated">{AlertRules.simulatedLabel}</Chip> : null}
              <Rows rows={[
                { label: "Source", value: c.pageTitle || (c.pageUrl ? hostOf(c.pageUrl) : "A watched page") },
                { label: "Listing", value: c.listingTitle || "A listing" },
                { label: "Detected", value: `${when(c.detectedAt)}${c.detectedBy ? ` (${c.detectedBy})` : ""}` },
                { label: "Before", value: factsLine(c.before) },
                { label: "Now", value: factsLine(c.after) },
              ]} />
              {c.simulated ? <p className="sisu-project-muted">Simulated for demo: the page did not really change. It went through the same requirement check as a real change.</p> : null}
            </div>
          ))}
        </section>

        {evidence.research.length > 0 ? (
          <section className="sisu-pfound-part">
            <p className="sisu-project-subhead">Exa: extra research after a change</p>
            {evidence.research.map((r) => (
              <div key={r.query}>
                <p className="sisu-project-muted">{`Searched "${r.query}"${r.affects ? `: ${r.affects}` : ""}. A link is background reading; it does not confirm a requirement such as a commute time.`}</p>
                <ul className="sisu-project-links">
                  {r.sources.map((s) => (safeLink(s.url) ? <li key={s.url}><ExternalLink url={s.url}>{s.title || hostOf(s.url)}</ExternalLink></li> : null))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        <section className="sisu-pfound-part">
          <p className="sisu-project-subhead">Sisu&apos;s finance engine: effect on your budget</p>
          {view && finance ? (
            <>
              <p className="sisu-project-muted">{`For ${finance.listing.title || "the cheapest qualifying listing"}, from your own bank figures:`}</p>
              <Rows rows={[...view.monthly, ...view.upfront, ...view.totals]} />
              {view.note ? <p className="sisu-project-muted">{view.note}</p> : null}
            </>
          ) : <p className="sisu-project-muted">Worked out in code for each listing that could qualify, from your own monthly figures.</p>}
        </section>
      </Disclosure>
    </div>
  );
}
