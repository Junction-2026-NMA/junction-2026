// Builds a watch for approval, from data the SERVER holds: the pages Sisu has just read and the customer's own
// figures. The model passes only a city or a topic, a price limit and a room count; the limit must be one the
// customer said (the tool checks that), and what it would do to their money is worked out here.
// One builder for both kinds: flats to rent (a rent per month) and anything else with a price (paid once).
// Since 15 Nov the card is a Project proposal: it carries the goal and requirements, asks for consent in plain
// words, says exactly what will run (lib/watch/scheduler.ts), and for flats shows the total effect of the nearest one.
import type { ListingSearch } from "@/lib/agent/research/listings";
import { checkAffordability } from "@/lib/finance/affordability";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { fact } from "@/lib/finance/facts";
import { housingEffect } from "@/lib/finance/housing";
import { buildOverview } from "@/lib/finance/overview";
import { RENT_BUDGET_LIMITS, rentFacts, rentFit } from "@/lib/finance/rent";
import { activeWatch } from "@/lib/watch";
import { fits, ruleFor } from "@/lib/watch/detect";
import { monitoringSentence } from "@/lib/watch/scheduler";
import type { AgentAction, Fact, Overview, WatchRequirements } from "@/lib/types";
import type { DraftResult } from "./drafts";

// city: flats, where. topic: anything else, what (the search carries it). Exactly one of them is set.
export type WatchRequest = { city: string | null; topic?: string | null; budgetEur: number; minRooms: number | null; search: ListingSearch; preparedBy: AgentAction["preparedBy"]; goal?: string | null; requirements?: WatchRequirements | null };

// The requirements in a few words, for the card.
function describeRequirements(req: WatchRequirements): string[] {
  return [
    req.districts?.length ? `in ${req.districts.join(", ")}` : null,
    req.moveBy ? `free by ${req.moveBy}` : null,
    typeof req.maxDepositEur === "number" ? `deposit at most €${req.maxDepositEur}` : null,
    typeof req.maxCommuteMinutes === "number" ? `commute up to ${req.maxCommuteMinutes} min${req.commuteTo ? ` to ${req.commuteTo}` : ""} (you check this)` : null,
    typeof req.bufferToKeepEur === "number" ? `keep €${req.bufferToKeepEur} after moving` : null,
  ].filter((text): text is string => !!text);
}

const ONE_OFF_LIMITS: [number, number] = [5, 100_000];

// The limit the customer gave, checked against their own figures: a warning to show, and the receipts behind it.
function checkLimit(overview: Overview, budget: number, monthly: boolean): { warning: string | null; facts: Fact[] } {
  if (monthly) {
    const fit = rentFit(overview, budget);
    const warning =
      fit.verdict === "over"
        ? `A rent of €${budget} is €${Math.round(fit.changePerMonthEur)} a month more than housing costs you today, and an average month would come out about €${Math.round(-fit.leftOverAfterEur)} short. The watch still uses the budget you gave.`
        : fit.verdict === "tight"
          ? `A rent of €${budget} would be ${Math.round(fit.shareOfIncomePct ?? 0)}% of your average income, which is high. The watch still uses the budget you gave.`
          : null;
    return { warning, facts: rentFacts("watch", fit, overview) };
  }
  const afford = checkAffordability(overview, buildCashFlow(overview), budget);
  if (typeof afford === "string") return { warning: null, facts: [] };
  const low = afford.projectedLowPointEur ?? afford.balanceAfterEur;
  const warning =
    afford.verdict === "not-yet"
      ? `Paying €${budget} today would leave your account about €${Math.round(-low)} below zero just before payday. The watch still uses the price you gave.`
      : afford.verdict === "tight"
        ? `After paying €${budget} you would have about €${Math.round(low)} just before payday, less than a month of must-pay costs. The watch still uses the price you gave.`
        : null;
  return { warning, facts: [fact("watch:balance", "Balance today", overview.balance, "EUR", `account balance on ${overview.dataTimestamp}`), fact("watch:after", "Expected balance just before payday, after paying the price you set", low, "EUR", "payday projection minus the price", { source: "calculation" })] };
}

export function buildWatchDraft(customerId: string, request: WatchRequest): DraftResult {
  const overview = buildOverview(customerId);
  if (!overview) return { ok: false, status: 404, reason: "We could not find that customer." };
  const { city, minRooms, search } = request;
  const topic = request.topic ?? null;
  const monthly = topic === null;
  const budget = Math.round(request.budgetEur);
  const limits = monthly ? RENT_BUDGET_LIMITS : ONE_OFF_LIMITS;
  if (!Number.isFinite(budget) || budget < limits[0] || budget > limits[1]) return { ok: false, status: 400, reason: `${monthly ? "A monthly rent budget" : "A price to watch for"} must be between €${limits[0]} and €${limits[1].toLocaleString("en-US")}.` };
  if (!search.pages.length) return { ok: false, status: 409, reason: "No page could be read just now, so there is nothing to watch yet. Try the search again." };
  const subject = topic ?? `flats in ${city}`;
  const existing = activeWatch(customerId, { city, topic, budgetEur: budget });
  if (existing) return { ok: false, status: 409, reason: existing.status === "paused" ? `You already have a paused project for ${subject} at €${budget} or less: resume it instead.` : `Sisu is already watching ${subject} at €${budget} or less.` };
  const requirements = request.requirements ?? {};

  const unit = monthly ? ("EUR/month" as const) : ("EUR" as const);
  const seen = search.pages.flatMap((page) => page.listings);
  const rule = ruleFor({ budgetEur: budget, minRooms, topic, requirements: monthly ? requirements : null });
  const fitting = seen.filter((listing) => fits(listing, rule));
  // The nearest miss: the cheapest thing read that is a real candidate (enough rooms, not an accessory).
  const cheapest = [...seen].filter((listing) => listing.priceEur >= (rule.floorEur ?? 0) && (minRooms === null || (listing.rooms ?? 0) >= minRooms)).sort((a, b) => a.priceEur - b.priceEur)[0] ?? null;
  const checked = checkLimit(overview, budget, monthly);
  const what = monthly ? `${minRooms ? `flats with ${minRooms} rooms or more` : "flats"} in ${city} at €${budget} a month or less` : `${topic} at €${budget} or less`;
  const things = monthly ? "flats" : "offers";
  const extra = monthly ? describeRequirements(requirements) : [];
  // The nearest real candidate's total effect, so the card says what moving would mean, not just the rent.
  const nearest = monthly ? ([...fitting].sort((a, b) => a.priceEur - b.priceEur)[0] ?? cheapest) : null;
  const housing = nearest ? housingEffect(overview, nearest, requirements, "watch:housing") : null;
  const ask = monthly ? "Would you like me to keep checking for homes that match these requirements?" : "Would you like me to keep checking for offers at this price?";
  return {
    ok: true,
    draft: {
      kind: monthly ? "property_watch" : "price_watch",
      title: monthly ? `Keep checking for homes in ${city} at €${budget} a month or less${minRooms ? ` with ${minRooms}+ rooms` : ""}` : `Keep checking prices for ${topic} at €${budget} or less`,
      summary: [
        ask,
        request.goal ? `Goal: ${request.goal}${/[.!?]$/.test(request.goal) ? "" : "."}` : null,
        `${fitting.length ? `${fitting.length} of the ${seen.length} ${things} read today fit` : `None of the ${seen.length} ${things} read today fit`} (${what}${extra.length ? `; ${extra.join("; ")}` : ""}).`,
        housing && nearest ? `${fitting.length ? "The cheapest that fits" : "The nearest"}, ${nearest.title}: ${housing.sentence}` : null,
        `${monitoringSentence(search.pages.length, !search.mock)}${search.mock ? " (Example data here: no key is set, so nothing is watched on the web.)" : ""}`,
        `Nothing is ${monthly ? "rented, booked" : "bought, ordered"} or paid, and no one is contacted. You can pause or stop it at any time.`,
      ]
        .filter(Boolean)
        .join(" "),
      checklist: [
        `Approve, and Sisu starts watching ${search.pages.map((page) => new URL(page.url).hostname.replace(/^www\./, "")).join(", ")}.`,
        `When a page changes, Sisu reads it again and compares each ${monthly ? "rent" : "price"} with your limit in code.`,
        `A finding appears in the project only when ${monthly ? "a flat meets your requirements" : "an offer fits"}, and only once per ${monthly ? "flat" : "offer"} and price. Check its own page before you ${monthly ? "contact anyone" : "buy"}.`,
        "Pause or stop it whenever you like; its monitors are removed. It also stops by itself if the app has not checked in for 14 days.",
      ],
      draftMessage: null,
      billType: null,
      offer: null,
      monthlyAmountEur: 0, // a watch frees no money; the limit is in watch.budgetEur (the budget here showed up as "€700 a month freed")
      warning: checked.warning,
      watch: { city, topic, priceUnit: unit, budgetEur: budget, minRooms, urls: search.pages.map((page) => page.url), seen, goal: request.goal ?? null, requirements: monthly ? requirements : {}, titles: Object.fromEntries(search.pages.map((page) => [page.url, page.title])) },
      facts: [
        fact("watch:budget", monthly ? "Your rent budget per month" : "The price you set", budget, unit, "the figure you gave", { source: "customer-stated" }),
        fact("watch:read", `${monthly ? "Flats" : "Offers"} read from the pages today`, seen.length, "count", `read with Context.dev at ${search.retrievedAt}`, { source: "context.dev" }),
        fact("watch:fitting", `${monthly ? "Flats" : "Offers"} that fit today`, fitting.length, "count", monthly ? "rent at or under the budget, with the rooms asked for" : "price at or under the limit, leaving out likely accessories", { source: "calculation" }),
        ...(cheapest ? [fact("watch:cheapest", `Lowest ${monthly ? "rent" : "price"} found today (${cheapest.title})`, cheapest.priceEur, unit, "read from the page", { source: "context.dev", url: cheapest.url })] : []),
        ...(cheapest && cheapest.priceEur > budget ? [fact("watch:gap", `Lowest ${monthly ? "rent" : "price"} found is over your limit by`, cheapest.priceEur - budget, unit, "lowest found minus your limit", { source: "calculation" })] : []),
        ...checked.facts,
        ...(housing ? housing.facts : []),
      ],
      sources: search.pages.map((page) => ({ title: page.title, url: page.url, retrievedAt: search.retrievedAt, cacheAgeMs: page.cacheAgeMs, readBy: "context.dev" as const })),
      assumptions: [
        `${monthly ? "Rents" : "Prices"} are as the pages state them; Sisu has not checked them with the ${monthly ? "landlord" : "seller"}.`,
        monthly ? "Housing today and what a month leaves over are 12-month averages from your bank data." : `An offer under €${Math.round(rule.floorEur ?? 0)} is taken to be a part or an accessory and is not reported.`,
        ...(search.errors.length ? [`Not every page could be read: ${search.errors.join("; ")}.`] : []),
        ...(housing ? [...housing.assumptions.slice(1), ...housing.missing.map((gap) => `Missing: ${gap}`)] : []),
      ],
      preparedBy: request.preparedBy,
    },
  };
}
