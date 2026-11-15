// What changed on a watched page, listing by listing: the previous versus the current reading (v3, for "How Sisu
// found this"). Code compares the two readings; the change record Context.dev sends only says that a page changed.
import { listingKey } from "@/lib/agent/research/listings";
import type { Listing, MonitorChange, PropertyWatch, WatchNotification, WatchedPage } from "@/lib/types";
import { buildOverview } from "@/lib/finance/overview";
import { requirementChecks, verdictOf } from "./evaluate";
import { watchEvaluationRule } from "./rule";

export const MAX_CHANGES = 30;
const MAX_PER_PAGE = 5;

const reading = (listing: Listing) => ({ priceEur: listing.priceEur, areaM2: listing.areaM2, availableFrom: listing.availableFrom });

// Listings that are new on the page, or whose rent, size or move-in date differ from the last reading.
export function pageChanges(page: WatchedPage, previous: Listing[], current: Listing[], detectedAt: string, detectedBy: WatchNotification["detectedBy"]): MonitorChange[] {
  const before = new Map(previous.map((listing) => [listingKey(listing), listing]));
  return current
    .flatMap((listing): MonitorChange[] => {
      const earlier = before.get(listingKey(listing)) ?? null;
      const same = earlier && earlier.priceEur === listing.priceEur && earlier.areaM2 === listing.areaM2 && earlier.availableFrom === listing.availableFrom;
      if (same) return [];
      return [{ id: crypto.randomUUID(), pageUrl: page.url, pageTitle: page.title ?? null, detectedAt, detectedBy, simulated: detectedBy === "simulation", listingTitle: listing.title, before: earlier ? reading(earlier) : null, after: reading(listing), findingId: null }];
    })
    .slice(0, MAX_PER_PAGE);
}

// Links each change to the finding it produced (same listing), so the app can show the change next to it.
export const linkFindings = (changes: MonitorChange[], notes: WatchNotification[]): MonitorChange[] =>
  changes.map((change) => {
    const note = notes.find((item) => item.listing.pageUrl === change.pageUrl && item.listing.title === change.listingTitle && item.listing.priceEur === change.after.priceEur);
    return note ? { ...change, findingId: note.id } : change;
  });

export const withChanges = (watch: PropertyWatch, changes: MonitorChange[]): PropertyWatch => (changes.length ? { ...watch, changes: [...changes, ...(watch.changes ?? [])].slice(0, MAX_CHANGES) } : watch);

// The verdict of one listing for this watch, with the ONE rule the Project's results and counts use (lib/watch/rule.ts).
// A price watch has no requirements beyond the price, which detectFits has already checked.
export function judge(watch: PropertyWatch, listing: Listing, now: Date): Pick<WatchNotification, "verdict" | "checks"> {
  if (watch.priceUnit !== "EUR/month") return { verdict: "match", checks: [] };
  const checks = requirementChecks(listing, watchEvaluationRule(watch, buildOverview(watch.customerId), now));
  return { verdict: verdictOf(checks), checks };
}
