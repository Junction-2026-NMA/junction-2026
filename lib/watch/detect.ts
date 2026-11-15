// The part of a watch that decides. No network and no state: given a page as it was and as it is now, which
// offers should the customer hear about? Code makes this call, never the model and never the page's own words.
// The same rule serves a flat to rent and anything else with a price.
import { listingKey } from "@/lib/agent/research/listings";
import { checkAffordability } from "@/lib/finance/affordability";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { fact } from "@/lib/finance/facts";
import { round2 } from "@/lib/finance/math";
import { housingEffect } from "@/lib/finance/housing";
import { rentFacts, rentFit, withinBudget } from "@/lib/finance/rent";
import type { Fact, Listing, Overview, PropertyWatch, WatchNotification, WatchRequirements } from "@/lib/types";
import { checkRequirements } from "./requirements";

// requirements and today (YYYY-MM-DD) added 15 Nov: a Project's other requirements, applied after the price.
export type WatchRule = { budgetEur: number; minRooms: number | null; floorEur?: number; requirements?: WatchRequirements; today?: string };
export type FitEvent = { kind: WatchNotification["kind"]; listing: Listing; previousPriceEur: number | null };

const MAX_EVENTS_PER_PAGE = 5;
// For a price watch: an offer at under this share of the price limit is almost always a part or an accessory
// (a phone case on a page of phones), so it is not reported. Flats have no floor.
export const ACCESSORY_SHARE = 0.3;

const todayOf = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

export const ruleFor = (watch: Pick<PropertyWatch, "budgetEur" | "minRooms" | "topic"> & { requirements?: WatchRequirements | null }, now?: Date): WatchRule => ({
  budgetEur: watch.budgetEur,
  minRooms: watch.minRooms,
  floorEur: watch.topic ? round2(watch.budgetEur * ACCESSORY_SHARE) : 0,
  ...(watch.requirements ? { requirements: watch.requirements, today: todayOf(now) } : {}),
});

// An offer fits when its price is at or under the limit (and not under the floor), if rooms were asked for the
// page states enough of them, and it meets the Project's other requirements (a field the page does not state is
// not held against it).
export const fits = (listing: Listing, rule: WatchRule): boolean =>
  withinBudget(listing.priceEur, rule.budgetEur) && listing.priceEur >= (rule.floorEur ?? 0) && (rule.minRooms === null || (listing.rooms ?? 0) >= rule.minRooms) && (!rule.requirements || checkRequirements(listing, rule.requirements, rule.today ?? todayOf()).ok);

// Compares two readings of the same page. An offer is reported when it fits now AND it is news: it was not on the
// page before, or its price has come down. One that already fitted at the same price is not reported again, and a
// price drop that still leaves it over the limit is not reported at all.
export function detectFits(previous: Listing[], current: Listing[], rule: WatchRule): FitEvent[] {
  const before = new Map(previous.map((listing) => [listingKey(listing), listing]));
  const events = current.flatMap((listing): FitEvent[] => {
    if (!fits(listing, rule)) return [];
    const earlier = before.get(listingKey(listing));
    if (!earlier) return [{ kind: "new_listing", listing, previousPriceEur: null }];
    if (listing.priceEur < earlier.priceEur) return [{ kind: "price_drop", listing, previousPriceEur: earlier.priceEur }];
    return [];
  });
  return events.sort((a, b) => a.listing.priceEur - b.listing.priceEur).slice(0, MAX_EVENTS_PER_PAGE);
}

const describe = (listing: Listing): string =>
  [listing.rooms === null ? null : `${listing.rooms} room${listing.rooms === 1 ? "" : "s"}`, listing.areaM2 === null ? null : `${listing.areaM2} m²`, listing.district, listing.details].filter(Boolean).join(", ");

type Checked = { sentence: string; leftOverAfterEur: number | null; balanceAfterEur: number | null; facts: Fact[] };

// The price checked against the customer's own figures: a rent against what an average month leaves over, a price
// paid once against the balance expected just before payday.
function checkAgainstFigures(id: string, monthly: boolean, price: number, overview: Overview): Checked {
  if (monthly) {
    const fit = rentFit(overview, price);
    return {
      sentence: fit.verdict === "over" ? `With this rent an average month would come out about €${Math.round(-fit.leftOverAfterEur)} short on your own figures.` : `With this rent an average month would leave about €${Math.round(fit.leftOverAfterEur)} over.`,
      leftOverAfterEur: fit.leftOverAfterEur,
      balanceAfterEur: null,
      facts: rentFacts(`watch:${id}`, fit, overview),
    };
  }
  const afford = checkAffordability(overview, buildCashFlow(overview), price);
  if (typeof afford === "string") return { sentence: "", leftOverAfterEur: null, balanceAfterEur: null, facts: [] };
  const low = afford.projectedLowPointEur ?? afford.balanceAfterEur;
  return {
    sentence: afford.verdict === "not-yet" ? `Paying it now would leave your account about €${Math.round(-low)} below zero just before payday, on your own figures.` : `After paying it you would have about €${Math.round(low)} just before payday${afford.verdict === "tight" ? ", which is less than a month of essential costs" : ""}.`,
    leftOverAfterEur: null,
    balanceAfterEur: low,
    facts: [fact(`watch:${id}:balance`, "Balance today", overview.balance, "EUR", `account balance on ${overview.dataTimestamp}`), fact(`watch:${id}:after`, "Expected balance just before payday, after paying this", low, "EUR", "payday projection minus the price", { source: "calculation" })],
  };
}

type SummaryParts = { listing: Listing; monthly: boolean; previousPriceEur: number | null; budgetEur: number; underBudgetByEur: number; effect: string | null; unchecked: string[]; simulated: boolean };

// The finding in a few sentences: the price against the limit, the listing, its effect on the customer's money,
// what the page does not state, and where it came from.
function findingSummary(parts: SummaryParts): string {
  const { listing, monthly } = parts;
  const per = monthly ? " a month" : "";
  const limit = monthly ? "your budget" : "the price you set";
  const details = describe(listing);
  return [
    `€${Math.round(listing.priceEur)}${per}${parts.previousPriceEur === null ? "" : `, down from €${Math.round(parts.previousPriceEur)}`}: €${Math.round(parts.underBudgetByEur)} under ${limit} of €${Math.round(parts.budgetEur)}.`,
    details ? `${details}.` : null,
    parts.effect,
    parts.unchecked.length ? `Not on the page, so not checked: ${parts.unchecked.join(", ")}.` : null,
    parts.simulated ? `Simulated monitoring update. Simulated for the demo: the page did not really change. Source reference: ${new URL(listing.url).hostname.replace(/^www\./, "")}; this simulated price is not a live offer.` : `Check the ${monthly ? "listing" : "offer"}'s own page before you act: Sisu read it, it did not contact anyone.`,
  ]
    .filter(Boolean)
    .join(" ");
}

// A flat's finding after the Project's requirements changed: its housing effect (moving costs, the buffer to keep,
// the savings goal) worked out again with the requirements as they are now, and its summary to match. The price,
// the limit and when it was found stay as they were. Other findings come back unchanged.
export function withCurrentRequirements(note: WatchNotification, watch: PropertyWatch, overview: Overview, now: Date = new Date()): WatchNotification {
  if (watch.priceUnit !== "EUR/month" || !note.housing) return note;
  const requirements = watch.requirements ?? {};
  const housing = housingEffect(overview, note.listing, requirements, `watch:${note.id}:housing`, { simulated: note.simulated });
  const unchecked = checkRequirements(note.listing, requirements, todayOf(now)).unchecked;
  const summary = findingSummary({ listing: note.listing, monthly: true, previousPriceEur: note.previousPriceEur, budgetEur: note.budgetEur, underBudgetByEur: note.underBudgetByEur, effect: housing.sentence, unchecked, simulated: note.simulated });
  return { ...note, housing, summary };
}

// Turns a finding into what the customer is told, with a receipt for every number in it.
export function toNotification(watch: PropertyWatch, overview: Overview, event: FitEvent, detectedBy: WatchNotification["detectedBy"], now: Date): WatchNotification {
  const { listing } = event;
  const monthly = watch.priceUnit === "EUR/month";
  const per = monthly ? " a month" : "";
  const price = listing.priceEur;
  const under = round2(watch.budgetEur - price);
  const simulated = detectedBy === "simulation";
  const id = crypto.randomUUID();
  const checked = checkAgainstFigures(id, monthly, price, overview);
  // Flats: the whole effect of moving in (recurring and upfront), in place of the rent-only sentence.
  const housing = monthly ? housingEffect(overview, listing, watch.requirements ?? {}, `watch:${id}:housing`, { simulated }) : null;
  const unchecked = watch.requirements ? checkRequirements(listing, watch.requirements, todayOf(now)).unchecked : [];
  const limit = monthly ? "your budget" : "the price you set";
  const what = monthly ? "rent per month" : "price";
  return {
    id,
    watchId: watch.id,
    customerId: watch.customerId,
    kind: event.kind,
    title: event.kind === "price_drop" ? `Price drop: ${listing.title} is now €${Math.round(price)}${per}` : `New ${monthly ? "listing" : "offer"}: ${listing.title} at €${Math.round(price)}${per}`,
    summary: findingSummary({ listing, monthly, previousPriceEur: event.previousPriceEur, budgetEur: watch.budgetEur, underBudgetByEur: under, effect: housing?.sentence ?? (checked.sentence || null), unchecked, simulated }),
    listing,
    previousPriceEur: event.previousPriceEur,
    budgetEur: watch.budgetEur,
    underBudgetByEur: under,
    leftOverAfterEur: checked.leftOverAfterEur,
    balanceAfterEur: checked.balanceAfterEur,
    detectedAt: now.toISOString(),
    detectedBy,
    simulated,
    facts: [
      fact(`watch:${id}:price`, `${listing.title}: ${what}`, price, watch.priceUnit, simulated ? "made up by the demo's simulate button" : "read from the page", simulated ? { source: "assumption" } : { source: "context.dev", url: listing.url }),
      ...(event.previousPriceEur === null ? [] : [fact(`watch:${id}:before`, `${listing.title}: ${what} before`, event.previousPriceEur, watch.priceUnit, "read from the page earlier", { source: "context.dev", url: listing.url })]),
      fact(`watch:${id}:budget`, monthly ? "Your rent budget per month" : "The price you set", watch.budgetEur, watch.priceUnit, "the figure you gave", { source: "customer-stated" }),
      fact(`watch:${id}:under`, `Under ${limit} by`, under, watch.priceUnit, "limit minus price", { source: "calculation" }),
      ...checked.facts,
    ],
    readAt: null,
    housing,
  };
}
