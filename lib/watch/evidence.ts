// "How Sisu found this": what each tool really did for one Project, built only from stored tool results.
// Exa: the search that found the pages (its exact query and the pages it returned). Context.dev: each page it read,
// when, and how many listings it extracted (the listings themselves are the Project's `evaluated`). Monitoring:
// what changed on a watched page, previous versus current. Research: extra Exa reading after a finding, and what it
// is used for. Nothing here is computed from the web text, and no figure is invented.
import { getConfig } from "@/lib/agent/config";
import { listingQuery } from "@/lib/agent/research/listings";
import type { AgentAction, MonitorChange, ProjectEvidence, PropertyWatch, WatchNotification } from "@/lib/types";
import { researchQuery } from "./research";

const RESEARCH_AFFECTS = "Background reading about getting around from this district. Sisu takes no figure from it, so it does not verify the commute time: check the journey yourself.";

// A watch started from a conversation keeps the search in its plan. Older plans have only the pages that were read;
// their query is rebuilt with the same function the search used (listingQuery), and the sources are those pages.
function discoveryOf(watch: PropertyWatch, action: AgentAction | null): ProjectEvidence["exa"] {
  if (watch.discovery) return watch.discovery;
  if (action?.watch?.discovery) return action.watch.discovery;
  if (!action || !watch.city || watch.topic) return null;
  const searchedAt = action.sources[0]?.retrievedAt ?? action.createdAt;
  return { query: listingQuery(watch.city), searchedAt, sources: action.sources, mock: getConfig().isMock };
}

// A finding made from a change that has no stored change record (findings saved before v3): the change is read
// back from the finding itself, which stores the price before and after.
function changeOfFinding(watch: PropertyWatch, note: WatchNotification): MonitorChange {
  const page = watch.pages.find((candidate) => candidate.url === note.listing.pageUrl);
  return {
    id: `finding:${note.id}`,
    pageUrl: note.listing.pageUrl,
    pageTitle: page?.title ?? null,
    detectedAt: note.detectedAt,
    detectedBy: note.detectedBy,
    simulated: note.simulated,
    listingTitle: note.listing.title,
    before: note.previousPriceEur === null ? null : { priceEur: note.previousPriceEur, areaM2: note.listing.areaM2, availableFrom: note.listing.availableFrom },
    after: { priceEur: note.listing.priceEur, areaM2: note.listing.areaM2, availableFrom: note.listing.availableFrom },
    findingId: note.id,
  };
}

export function projectEvidence(watch: PropertyWatch, notifications: WatchNotification[], action: AgentAction | null): ProjectEvidence {
  const stored = watch.changes ?? [];
  const covered = new Set(stored.flatMap((change) => (change.findingId ? [change.findingId] : [])));
  const derived = notifications.filter((note) => note.kind !== "initial_match" && !covered.has(note.id)).map((note) => changeOfFinding(watch, note));
  return {
    exa: discoveryOf(watch, action),
    extraction: watch.pages.map((page) => ({ url: page.url, title: page.title ?? null, readAt: page.lastReadAt, listingsRead: page.listings.length, problem: page.lastError })),
    monitoring: [...stored, ...derived].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)),
    research: notifications.filter((note) => note.research?.length).map((note) => ({ query: researchQuery(note.listing, watch), sources: note.research ?? [], affects: RESEARCH_AFFECTS })),
  };
}
