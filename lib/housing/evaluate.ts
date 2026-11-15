// Every listing judged against the requirements the customer confirmed, in code. A listing that fails one is
// excluded, with the reason. A listing that does not state a fact a requirement needs (size, move-in date, commute)
// is not a pass: it goes under "Needs checking" and can never be the best match. Only a listing that meets every
// requirement, checked, is "fits", and the cheapest of those is the best match.
import { listingKey } from "@/lib/agent/research/listings";
import { housingEffect } from "@/lib/finance/housing";
import { leftOverWith, monthFiguresOf } from "@/lib/watch/detect";
import { availableDay } from "@/lib/watch/requirements";
import type { CalcStep, HousingCheck, HousingCost, HousingCriteria, HousingEvaluation, Listing, ListingEvaluation, Overview } from "@/lib/types";

const eur = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const BEST_MATCH_RULE = "A best match meets every requirement you confirmed, each one checked against what the listing states. A listing that leaves a requirement unknown is listed under Needs checking, never as the best match.";

function checksFor(listing: Listing, criteria: HousingCriteria, overview: Overview, today: string): HousingCheck[] {
  const req = criteria.requirements;
  const month = monthFiguresOf(overview);
  const left = leftOverWith(listing, month);
  const checks: HousingCheck[] = [
    listing.priceEur <= criteria.budgetEur
      ? { id: "rent", label: "Rent within budget", status: "pass", detail: `${eur(listing.priceEur)} a month, within ${eur(criteria.budgetEur)}` }
      : { id: "rent", label: "Rent within budget", status: "fail", detail: `${eur(listing.priceEur)} a month is over your ${eur(criteria.budgetEur)} budget` },
    left >= 0
      ? { id: "month", label: "Keeps your month balanced", status: "pass", detail: `an average month would leave about ${eur(left)} over` }
      : { id: "month", label: "Keeps your month balanced", status: "fail", detail: `an average month would come out ${eur(-left)} short` },
  ];
  const goal = req.savingsGoalEurPerMonth;
  if (typeof goal === "number" && goal > 0) {
    checks.push(left >= goal
      ? { id: "savings", label: "Keeps your savings goal", status: "pass", detail: `leaves ${eur(left)} a month, enough to save ${eur(goal)}` }
      : { id: "savings", label: "Keeps your savings goal", status: "fail", detail: `leaves ${left < 0 ? "nothing" : eur(left)} a month, less than your ${eur(goal)} savings goal` });
  }
  if (criteria.minRooms !== null) {
    checks.push(listing.rooms === null
      ? { id: "rooms", label: `${criteria.minRooms}+ rooms`, status: "unknown", detail: "rooms not stated" }
      : listing.rooms >= criteria.minRooms
        ? { id: "rooms", label: `${criteria.minRooms}+ rooms`, status: "pass", detail: `${listing.rooms} room${listing.rooms === 1 ? "" : "s"}` }
        : { id: "rooms", label: `${criteria.minRooms}+ rooms`, status: "fail", detail: `${listing.rooms} room${listing.rooms === 1 ? "" : "s"}, fewer than ${criteria.minRooms}` });
  }
  if (typeof req.minAreaM2 === "number") {
    checks.push(listing.areaM2 === null
      ? { id: "size", label: `${req.minAreaM2} m² or more`, status: "unknown", detail: "size not stated" }
      : listing.areaM2 >= req.minAreaM2
        ? { id: "size", label: `${req.minAreaM2} m² or more`, status: "pass", detail: `${listing.areaM2} m²` }
        : { id: "size", label: `${req.minAreaM2} m² or more`, status: "fail", detail: `${listing.areaM2} m², smaller than ${req.minAreaM2} m²` });
  }
  if (req.moveBy) {
    const day = availableDay(listing.availableFrom, today);
    checks.push(!day
      ? { id: "moveBy", label: `Free by ${req.moveBy}`, status: "unknown", detail: listing.availableFrom ? `"${listing.availableFrom}" is not a date Sisu can read` : "move-in date not stated" }
      : day <= req.moveBy
        ? { id: "moveBy", label: `Free by ${req.moveBy}`, status: "pass", detail: `free from ${day}` }
        : { id: "moveBy", label: `Free by ${req.moveBy}`, status: "fail", detail: `free from ${day}, after ${req.moveBy}` });
  }
  if (typeof req.maxCommuteMinutes === "number") {
    const to = req.commuteTo ? ` to ${req.commuteTo}` : "";
    checks.push({ id: "commute", label: `Commute${to} up to ${req.maxCommuteMinutes} min`, status: "unknown", detail: "not measured: Sisu cannot time a commute, check it in a journey planner" });
  }
  if (req.districts?.length) {
    const named = listing.district;
    checks.push(!named
      ? { id: "district", label: `In ${req.districts.join(" or ")}`, status: "unknown", detail: "district not stated" }
      : req.districts.some((name) => named.toLowerCase().includes(name.toLowerCase()))
        ? { id: "district", label: `In ${req.districts.join(" or ")}`, status: "pass", detail: named }
        : { id: "district", label: `In ${req.districts.join(" or ")}`, status: "fail", detail: `in ${named}` });
  }
  if (typeof req.maxDepositEur === "number") {
    checks.push(typeof listing.depositEur !== "number"
      ? { id: "deposit", label: `Deposit up to ${eur(req.maxDepositEur)}`, status: "unknown", detail: "deposit not stated" }
      : listing.depositEur <= req.maxDepositEur
        ? { id: "deposit", label: `Deposit up to ${eur(req.maxDepositEur)}`, status: "pass", detail: eur(listing.depositEur) }
        : { id: "deposit", label: `Deposit up to ${eur(req.maxDepositEur)}`, status: "fail", detail: `deposit ${eur(listing.depositEur)}` });
  }
  return checks;
}

export function evaluateListing(overview: Overview, listing: Listing, criteria: HousingCriteria, today: string, prefix = "housing"): ListingEvaluation {
  const key = listingKey(listing);
  const checks = checksFor(listing, criteria, overview, today);
  const housing = housingEffect(overview, listing, criteria.requirements, `${prefix}:${key}`);
  const failed = checks.filter((check) => check.status === "fail");
  const unknown = checks.filter((check) => check.status === "unknown");
  const charges = typeof listing.utilitiesPerMonthEur === "number" ? listing.utilitiesPerMonthEur : null;
  const recurring: HousingCost[] = [
    { label: "Rent", eur: listing.priceEur, per: "month", note: null },
    { label: "Water and building charges", eur: charges, per: "month", note: charges === null ? "unknown: not on the listing" : "stated on the listing" },
    { label: "Electricity", eur: null, per: "month", note: "unknown: not on the listing" },
    { label: "Internet", eur: null, per: "month", note: "unknown: not on the listing" },
    { label: "Transport after the move", eur: null, per: "month", note: "unknown: depends on the commute" },
  ];
  const assumed = housing.upfront.depositAssumedEur;
  const upfront: HousingCost[] = [
    { label: "Deposit", eur: housing.upfront.depositEur, per: "once", note: housing.upfront.depositEur !== null ? "stated on the listing" : assumed ? `unknown: usually ${eur(assumed.low)} to ${eur(assumed.high)} (1 to 3 months' rent, an assumption)` : "unknown" },
    { label: "Moving", eur: housing.upfront.movingCostEur, per: "once", note: housing.upfront.movingCostEur !== null ? "your estimate" : "unknown: no estimate given" },
  ];
  return {
    key,
    listing,
    host: hostOf(listing.url),
    verdict: failed.length ? "excluded" : unknown.length ? "needs_checking" : "fits",
    checks,
    reasons: failed.map((check) => `${check.label}: ${check.detail}`),
    unknowns: unknown.map((check) => `${check.label}: ${check.detail}`),
    recurring,
    upfront,
    monthlyEffectEur: housing.recurring.knownChangeEur,
    leftOverAfterEur: housing.recurring.leftOverAfterEur,
    housing,
  };
}

const describe = (one: ListingEvaluation): string => [one.listing.areaM2 === null ? null : `${one.listing.areaM2} m²`, one.listing.district].filter(Boolean).join(" in ");

// Why nothing fits, in one clause: the reason most listings share.
function commonReason(excluded: ListingEvaluation[]): string {
  const counts = new Map<string, number>();
  excluded.forEach((one) => one.checks.filter((check) => check.status === "fail").forEach((check) => counts.set(check.label, (counts.get(check.label) ?? 0) + 1)));
  const [label, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  return label ? `${count === excluded.length ? "all" : `${count} of ${excluded.length}`} fail "${label}"` : "none meets the requirements";
}

export function evaluateListings(overview: Overview, listings: Listing[], criteria: HousingCriteria, today: string, prefix = "housing"): HousingEvaluation {
  const seen = new Set<string>();
  const unique = listings.filter((listing) => !seen.has(listingKey(listing)) && !!seen.add(listingKey(listing)));
  const all = unique.map((listing) => evaluateListing(overview, listing, criteria, today, prefix)).sort((a, b) => a.listing.priceEur - b.listing.priceEur);
  const fitting = all.filter((one) => one.verdict === "fits");
  const needsChecking = all.filter((one) => one.verdict === "needs_checking");
  const excluded = all.filter((one) => one.verdict === "excluded");
  const best = fitting[0] ?? null;
  const closest = best ? null : (needsChecking[0] ?? null);
  const verdict = best
    ? `${best.listing.title} meets all your requirements: ${eur(best.listing.priceEur)} a month${describe(best) ? `, ${describe(best)}` : ""}.`
    : closest
      ? `No listing meets every requirement yet. Closest: ${closest.listing.title} at ${eur(closest.listing.priceEur)} a month, but ${closest.unknowns.length === 1 ? "one requirement needs" : `${closest.unknowns.length} requirements need`} checking.`
      : all.length
        ? `None of the ${all.length} listings read fits your requirements: ${commonReason(excluded)}.`
        : "No listing could be read just now.";
  const shown = best ?? closest;
  const maths: CalcStep[] = shown
    ? [
        { label: "Left over in an average month today", amount: shown.housing.recurring.leftOverNowEur, basis: "monthly budget from averages minus actual everyday spending, 12-month average" },
        { label: "Housing today", amount: shown.housing.recurring.currentHousingEur, basis: "Housing payments, 12-month average" },
        { label: `Rent of ${shown.listing.title}`, amount: -shown.listing.priceEur, basis: "read from the listing" },
        ...(typeof shown.listing.utilitiesPerMonthEur === "number" ? [{ label: "Charges on top of the rent", amount: -shown.listing.utilitiesPerMonthEur, basis: "stated on the listing" }] : []),
        { label: "Left over in an average month after moving", amount: shown.leftOverAfterEur, basis: "left over today plus housing today minus the new costs that are known" },
      ]
    : [];
  return {
    criteria,
    verdict,
    best,
    closest,
    fitting,
    needsChecking,
    excluded,
    maths,
    assumptions: [...new Set([...(shown?.housing.assumptions ?? ["Housing today and what a month leaves over are 12-month averages from your bank data."]), "Rents and sizes are as the pages state them; Sisu has not checked them with the landlord.", "Electricity, internet and transport after the move are unknown and not counted in the monthly effect.", BEST_MATCH_RULE])],
    rule: BEST_MATCH_RULE,
  };
}
