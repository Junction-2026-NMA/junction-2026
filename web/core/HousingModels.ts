// v2 housing on the web: the intake card's data, the results of POST /api/housing/search and the project's
// evaluation. The shapes are the backend's own (lib/types.ts, type-only import: nothing from lib runs here), read
// defensively: anything that is not the expected object is null, so an older backend never breaks the screen.
import type { HousingBudget, HousingEvaluation, HousingIntake, HousingResearchRecord, HousingSearchResult, ListingEvaluation } from "@/lib/types";
import { JSONRead } from "./Models";

export type { HousingBudget, HousingChange, HousingCheck, HousingConversation, HousingCost, HousingCriteria, HousingEvaluation, HousingIntake, HousingResearchRecord, HousingSearchResult, ListingEvaluation } from "@/lib/types";

const isObject = (json: unknown): json is Record<string, unknown> => JSONRead.isObject(json);
const has = (json: unknown, keys: string[]): boolean => isObject(json) && keys.every((key) => key in json);

export const HousingModels = {
  intake: (json: unknown): HousingIntake | null => (has(json, ["tenure", "budget"]) ? (json as unknown as HousingIntake) : null),
  budget: (json: unknown): HousingBudget | null => (has(json, ["maxRentEur", "steps", "reasoning"]) ? (json as unknown as HousingBudget) : null),
  evaluation: (json: unknown): HousingEvaluation | null => (has(json, ["verdict", "fitting", "needsChecking", "excluded"]) ? (json as unknown as HousingEvaluation) : null),
  result: (json: unknown): HousingSearchResult => {
    if (!has(json, ["verdict", "fitting", "needsChecking", "excluded", "research"])) throw new Error("Sisu sent search results the app could not read.");
    return json as unknown as HousingSearchResult;
  },
  research: (json: unknown): HousingResearchRecord | null => (has(json, ["exaQuery", "sources"]) ? (json as unknown as HousingResearchRecord) : null),
} as const;

/** Every evaluated listing, best first: fitting, then needs checking, then excluded. */
export const allEvaluated = (evaluation: HousingEvaluation): ListingEvaluation[] => [...evaluation.fitting, ...evaluation.needsChecking, ...evaluation.excluded];

/** What the intake card sends to POST /api/housing/search. */
export interface HousingSearchRequest {
  customerId: string;
  city: string;
  budgetEur: number;
  budgetFrom: "customer" | "sisu-suggested";
  minRooms: number | null;
  requirements: Record<string, number | string | null>;
  question: string;
  conversationId: string | null;
}

const eur = (value: number): string => `€${Math.round(value).toLocaleString("en-GB")}`;

export const HousingText = {
  eur,
  /** "€560 a month" or "unknown". */
  cost: (value: number | null, per: "month" | "once"): string => (value === null ? "unknown" : `${eur(value)}${per === "month" ? " a month" : ""}`),
  /** "Retrieved 14:05" or "Cached, retrieved 13:52". */
  retrieved: (iso: string, cached: boolean): string => {
    const date = new Date(iso);
    const time = Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
    return cached ? `Cached, retrieved ${time}` : `Retrieved ${time}`;
  },
  time: (iso: string | null | undefined): string => {
    if (!iso) return "not yet";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
  },
  facts: (one: ListingEvaluation): string => [one.listing.areaM2 === null ? "size unknown" : `${one.listing.areaM2} m²`, one.listing.rooms === null ? "rooms unknown" : `${one.listing.rooms} room${one.listing.rooms === 1 ? "" : "s"}`, one.listing.district ?? "district unknown"].join(" · "),
  effect: (one: ListingEvaluation): string => {
    const change = one.monthlyEffectEur;
    const change1 = change === 0 ? "the same as housing today" : `${eur(Math.abs(change))} a month ${change > 0 ? "more" : "less"} than housing today`;
    const left = one.leftOverAfterEur < 0 ? `an average month would come out ${eur(-one.leftOverAfterEur)} short` : `an average month would leave ${eur(one.leftOverAfterEur)} for saving`;
    return `${change1}; ${left}.`;
  },
} as const;
