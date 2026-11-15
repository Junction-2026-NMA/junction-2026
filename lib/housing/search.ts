// POST /api/housing/search: the requirements the customer confirmed in the intake card, applied in code to the
// listings Exa found and Context.dev read. Only the city goes to Exa (the query is recorded exactly as sent); the
// budget, the size and the customer's figures stay here. The answer is the results and a Project proposal (a
// property_watch awaiting approval) that carries the conversation and the research it came from.
import { saveDraft } from "@/lib/actions";
import { buildWatchDraft } from "@/lib/actions/watch";
import { type ListingSearch, cleanCity, hostName, searchListings } from "@/lib/agent/research/listings";
import { safeName } from "@/lib/agent/tools/untrusted";
import { buildOverview } from "@/lib/finance/overview";
import { RENT_BUDGET_LIMITS } from "@/lib/finance/rent";
import { cleanRequirements } from "@/lib/watch/requirements";
import type { HousingConversation, HousingCriteria, HousingResearchRecord, HousingSearchResult } from "@/lib/types";
import { DEFAULT_SAVINGS_PER_MONTH, suggestedBudget } from "./budget";
import { evaluateListings } from "./evaluate";

export type SearchInput = { customerId: string; criteria: HousingCriteria; question: string; conversationId: string | null };
export type Parsed = { ok: true; input: SearchInput } | { ok: false; reason: string };
const CACHED_AFTER_MS = 60_000; // a copy older than a minute is shown as cached, with the time it was read

export function parseSearch(body: Record<string, unknown>, customerId: string): Parsed {
  const city = cleanCity(body.city);
  if (!city) return { ok: false, reason: "Say which city to search in." };
  const budget = body.budgetEur;
  if (typeof budget !== "number" || !Number.isFinite(budget) || budget < RENT_BUDGET_LIMITS[0] || budget > RENT_BUDGET_LIMITS[1]) return { ok: false, reason: `The rent budget must be between €${RENT_BUDGET_LIMITS[0]} and €${RENT_BUDGET_LIMITS[1].toLocaleString("en-US")} a month.` };
  const rooms = body.minRooms;
  if (rooms !== undefined && rooms !== null && (typeof rooms !== "number" || !Number.isInteger(rooms) || rooms < 1 || rooms > 6)) return { ok: false, reason: "Rooms must be a whole number from 1 to 6." };
  // The customer typed or confirmed every figure in the card, so each counts as said (as in the project editor).
  const { requirements, dropped } = cleanRequirements(body.requirements);
  if (dropped.length) return { ok: false, reason: `Some requirements could not be used: ${dropped.join(", ")}.` };
  const question = typeof body.question === "string" ? body.question.replace(/[\u0000-\u001f<>]/g, " ").slice(0, 500).trim() : "";
  const conversationId = typeof body.conversationId === "string" && /^[\w-]{1,80}$/.test(body.conversationId) ? body.conversationId : null;
  return { ok: true, input: { customerId, question, conversationId, criteria: { city, budgetEur: Math.round(budget), budgetFrom: body.budgetFrom === "sisu-suggested" ? "sisu-suggested" : "customer", minRooms: typeof rooms === "number" ? rooms : null, requirements } } };
}

export function researchRecord(search: ListingSearch): HousingResearchRecord {
  const read = search.pages.map((page) => {
    const cached = (page.cacheAgeMs ?? 0) > CACHED_AFTER_MS;
    const at = cached ? new Date(Date.parse(search.retrievedAt) - (page.cacheAgeMs ?? 0)).toISOString() : search.retrievedAt;
    return { url: page.url, title: page.title, host: hostName(page.url), retrievedAt: at, cacheAgeMs: page.cacheAgeMs, cached, readBy: "context.dev" as const };
  });
  return { exaQuery: search.query, retrievedAt: search.retrievedAt, sources: search.found.map((found) => ({ url: found.url, title: safeName(found.title, 90) ?? hostName(found.url), host: hostName(found.url) })), read, cached: read.some((page) => page.cached), mock: search.mock, problems: search.errors };
}

const goalOf = (criteria: HousingCriteria): string => {
  const size = typeof criteria.requirements.minAreaM2 === "number" ? `, ${criteria.requirements.minAreaM2} m² or more` : "";
  return `Rent a home in ${criteria.city} for up to €${criteria.budgetEur} a month${size}`;
};

function conversationOf(input: SearchInput, budgetReasoning: string, now: Date): HousingConversation {
  const { criteria } = input;
  const req = criteria.requirements;
  const parts = [
    `Rent in ${criteria.city}`,
    `up to €${criteria.budgetEur} a month (${criteria.budgetFrom === "sisu-suggested" ? "Sisu's suggestion, confirmed" : "your figure"})`,
    typeof req.minAreaM2 === "number" ? `${req.minAreaM2} m² or more` : null,
    criteria.minRooms ? `${criteria.minRooms}+ rooms` : null,
    req.commuteTo ? `commute to ${req.commuteTo}${typeof req.maxCommuteMinutes === "number" ? ` within ${req.maxCommuteMinutes} min` : ""}` : null,
    req.moveBy ? `move by ${req.moveBy}` : null,
    typeof req.savingsGoalEurPerMonth === "number" ? `keep saving €${req.savingsGoalEurPerMonth} a month` : null,
  ].filter(Boolean);
  return { conversationId: input.conversationId, question: input.question || goalOf(criteria), summary: `${parts.join(", ")}.`, budgetReasoning, savedAt: now.toISOString() };
}

export type SearchOutcome = { ok: true; result: HousingSearchResult } | { ok: false; status: 404 | 503; reason: string };

export async function runHousingSearch(input: SearchInput, signal?: AbortSignal, now: Date = new Date()): Promise<SearchOutcome> {
  const overview = buildOverview(input.customerId);
  if (!overview) return { ok: false, status: 404, reason: "We could not find that customer." };
  const { criteria } = input;
  let search: ListingSearch;
  try {
    search = await searchListings(criteria.city, signal);
  } catch (error) {
    return { ok: false, status: 503, reason: `The live listing search is unavailable right now (${(error as Error).message}). Try again in a minute.` };
  }
  const budget = suggestedBudget(overview, criteria.requirements.savingsGoalEurPerMonth ?? DEFAULT_SAVINGS_PER_MONTH);
  const evaluation = evaluateListings(overview, search.pages.flatMap((page) => page.listings), criteria, now.toISOString().slice(0, 10));
  const research = researchRecord(search);
  const conversation = conversationOf(input, budget.reasoning, now);
  const built = search.pages.length ? buildWatchDraft(input.customerId, { city: criteria.city, budgetEur: criteria.budgetEur, minRooms: criteria.minRooms, search, preparedBy: "sisu-agent", goal: goalOf(criteria), requirements: criteria.requirements, conversation, research }) : { ok: false as const, status: 409 as const, reason: "No listing page could be read, so there is nothing to monitor yet." };
  const saved = built.ok ? saveDraft(input.customerId, built.draft, now) : built;
  const shown = evaluation.best ?? evaluation.closest;
  return {
    ok: true,
    result: {
      ...evaluation,
      research,
      budget,
      action: saved.ok ? saved.action : null,
      actionProblem: saved.ok ? null : saved.reason,
      facts: [...budget.facts, ...(shown?.housing.facts ?? [])],
    },
  };
}
