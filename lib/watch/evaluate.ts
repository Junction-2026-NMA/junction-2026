// The three-way verdict on one listing, shared by the agent's search_flats and the Project screens (v3).
// match: every requirement is met by what the page states.
// needs_verification: nothing fails, but a required detail is not stated on the page (or cannot be measured, such
// as a commute time), so it is NOT counted as a match and the card says what to check.
// fails: the rent or a requirement is not met. A failing listing is never a match; it may be shown as an alternative.
// Code makes this call from the page's figures, never the model and never the page's own words.
import { withinBudget } from "@/lib/finance/rent";
import type { EvaluatedListing, HousingEffect, Listing, RequirementCheck, WatchRequirements } from "@/lib/types";
import { availableDay } from "./requirements";

export type EvaluationRule = { budgetEur: number; minRooms: number | null; city?: string | null; requirements?: WatchRequirements | null; today: string };

const euros = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;

export function requirementChecks(listing: Listing, rule: EvaluationRule): RequirementCheck[] {
  const req = rule.requirements ?? {};
  const checks: RequirementCheck[] = [];
  checks.push(withinBudget(listing.priceEur, rule.budgetEur)
    ? { requirement: "Maximum rent", status: "met", detail: `${euros(listing.priceEur)} a month, within ${euros(rule.budgetEur)}` }
    : { requirement: "Maximum rent", status: "failed", detail: `${euros(listing.priceEur)} a month is over ${euros(rule.budgetEur)}` });
  if (rule.city) {
    const city = listing.city ?? null;
    if (!city) checks.push({ requirement: "Location", status: "unknown", detail: `The page does not state the city; check it is in ${rule.city}` });
    else checks.push(city.toLowerCase().includes(rule.city.toLowerCase()) ? { requirement: "Location", status: "met", detail: `${listing.district ? `${listing.district}, ` : ""}${city}` } : { requirement: "Location", status: "failed", detail: `In ${city}, not ${rule.city}` });
  }
  if (typeof req.minAreaM2 === "number") {
    if (typeof listing.areaM2 !== "number") checks.push({ requirement: "Minimum floor area", status: "unknown", detail: `The page does not state the size; you asked for at least ${req.minAreaM2} m²` });
    else checks.push(listing.areaM2 >= req.minAreaM2 ? { requirement: "Minimum floor area", status: "met", detail: `${listing.areaM2} m², at least ${req.minAreaM2} m²` } : { requirement: "Minimum floor area", status: "failed", detail: `${listing.areaM2} m² is under ${req.minAreaM2} m²` });
  }
  if (rule.minRooms !== null) {
    if (listing.rooms === null) checks.push({ requirement: "Rooms", status: "unknown", detail: `The page does not state the rooms; you asked for ${rule.minRooms}` });
    else checks.push(listing.rooms >= rule.minRooms ? { requirement: "Rooms", status: "met", detail: `${listing.rooms} room${listing.rooms === 1 ? "" : "s"}` } : { requirement: "Rooms", status: "failed", detail: `${listing.rooms} room${listing.rooms === 1 ? "" : "s"}, you asked for ${rule.minRooms}` });
  }
  if (req.districts?.length) {
    if (!listing.district) checks.push({ requirement: "District", status: "unknown", detail: `District not stated; you asked for ${req.districts.join(" or ")}` });
    else checks.push(req.districts.some((name) => listing.district!.toLowerCase().includes(name.toLowerCase())) ? { requirement: "District", status: "met", detail: listing.district } : { requirement: "District", status: "failed", detail: `In ${listing.district}, not ${req.districts.join(" or ")}` });
  }
  if (req.moveBy) {
    const day = availableDay(listing.availableFrom, rule.today);
    if (!day) checks.push({ requirement: "Move-in date", status: "unknown", detail: `The page does not state when it is free; you need it by ${req.moveBy}` });
    else checks.push(day <= req.moveBy ? { requirement: "Move-in date", status: "met", detail: `Free from ${day}` } : { requirement: "Move-in date", status: "failed", detail: `Free from ${day}, after ${req.moveBy}` });
  }
  if (typeof req.maxDepositEur === "number") {
    if (typeof listing.depositEur !== "number") checks.push({ requirement: "Deposit", status: "unknown", detail: `Deposit not stated; your limit is ${euros(req.maxDepositEur)}` });
    else checks.push(listing.depositEur <= req.maxDepositEur ? { requirement: "Deposit", status: "met", detail: `${euros(listing.depositEur)}` } : { requirement: "Deposit", status: "failed", detail: `${euros(listing.depositEur)} is over ${euros(req.maxDepositEur)}` });
  }
  if (typeof req.maxCommuteMinutes === "number") {
    checks.push({ requirement: "Commute", status: "unknown", detail: `Sisu does not measure commute times${req.commuteTo ? ` to ${req.commuteTo}` : ""}; check the journey (limit ${req.maxCommuteMinutes} min) yourself` });
  }
  return checks;
}

export function verdictOf(checks: RequirementCheck[]): EvaluatedListing["verdict"] {
  if (checks.some((check) => check.status === "failed")) return "fails";
  if (checks.some((check) => check.status === "unknown")) return "needs_verification";
  return "match";
}

const ORDER: Record<EvaluatedListing["verdict"], number> = { match: 0, needs_verification: 1, fails: 2 };

// Every listing with its verdict, matches first, then those that need verification, then the alternatives; cheapest first inside each group.
export function evaluateListings(listings: Listing[], rule: EvaluationRule, housingOf: (listing: Listing) => HousingEffect | null = () => null): EvaluatedListing[] {
  return listings
    .map((listing) => {
      const checks = requirementChecks(listing, rule);
      return { listing, verdict: verdictOf(checks), checks, housing: housingOf(listing) };
    })
    .sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict] || a.listing.priceEur - b.listing.priceEur);
}
