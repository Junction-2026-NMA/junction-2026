// Demo-only findings. Real page readings stay untouched; the finding is saved separately and labelled simulated.
import { inCity } from "@/lib/agent/research/listings";
import type { Listing, PropertyWatch } from "@/lib/types";
import { type FitEvent, fits, ruleFor } from "./detect";

export function simulatedFinding(watch: PropertyWatch, now: Date): FitEvent | null {
  const priceEur = Math.max(1, Math.floor((watch.budgetEur * 0.97) / 5) * 5);
  const rule = ruleFor(watch, now);
  const target = watch.pages.flatMap((page) => page.listings)
    .filter((listing) => listing.priceEur > watch.budgetEur
      && (!watch.city || inCity(listing, watch.city))
      && (!watch.city || listing.areaM2 !== null)
      && fits({ ...listing, priceEur }, rule))
    .sort((a, b) => a.priceEur - b.priceEur)[0];
  if (target) return { kind: "price_drop", listing: { ...target, priceEur }, previousPriceEur: target.priceEur };

  // Search pages change between recordings and may contain no homes with enough rooms. A clearly invented
  // home makes the same approved housing project repeatable without misrepresenting a live listing or price.
  const page = watch.pages[0];
  if (!watch.city || watch.topic || !page) return null;
  const rooms = watch.minRooms ?? 2;
  const listing: Listing = {
    title: `Simulated flat in ${watch.city}`,
    priceEur,
    rooms,
    areaM2: rooms * 20 + 5,
    city: watch.city,
    district: watch.requirements?.districts?.[0] ?? null,
    availableFrom: watch.requirements?.moveBy ?? now.toISOString().slice(0, 10),
    ...(typeof watch.requirements?.maxDepositEur === "number" ? { depositEur: Math.min(priceEur, watch.requirements.maxDepositEur) } : {}),
    details: "Simulated listing for the demo. Source link is a reference only; this home is not a published offer.",
    url: page.url,
    pageUrl: page.url,
  };
  return fits(listing, rule) ? { kind: "new_listing", listing, previousPriceEur: null } : null;
}
