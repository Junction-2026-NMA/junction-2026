// Background reading for a finding, with Exa: only when the Project asks for something a listing page cannot say
// (a commute limit), and only for a listing that already meets every other requirement. Exa gets the district,
// the city and the place they commute to: public names only, never a price, a budget or anything about the customer.
// The links are shown as reading for the customer; no figure is taken from them.
import { getConfig } from "@/lib/agent/config";
import { exaSearch } from "@/lib/agent/research/exa";
import type { Citation, Listing, PropertyWatch } from "@/lib/types";

export const needsResearch = (watch: PropertyWatch, listing: Listing): boolean => typeof watch.requirements?.maxCommuteMinutes === "number" && !!listing.district && !getConfig().isMock && !!getConfig().exa.apiKey;

export function researchQuery(listing: Listing, watch: Pick<PropertyWatch, "city" | "requirements">): string {
  const to = watch.requirements?.commuteTo ? ` ${watch.requirements.commuteTo}` : "";
  return `${listing.district} ${listing.city ?? watch.city ?? ""} julkinen liikenne matka-aika${to}`.replace(/\s+/g, " ").trim();
}

export async function researchListing(watch: PropertyWatch, listing: Listing, now: Date): Promise<Citation[]> {
  if (!needsResearch(watch, listing)) return [];
  try {
    const results = await exaSearch(researchQuery(listing, watch), { numResults: 3, highlights: false });
    return results.map((result) => ({ title: result.title.slice(0, 120), url: result.url, retrievedAt: now.toISOString(), cacheAgeMs: null, readBy: "exa" as const }));
  } catch {
    return []; // background reading is optional: a finding is still reported without it
  }
}
