// v3 watch models (lib/types.ts, "v3" block): what the server can run (SchedulerInfo), the phone notifications it
// sent (ProjectAlert), each listing with its verdict (EvaluatedListing) and "How Sisu found this" (ProjectEvidence).
// Every field is optional: today's hosted backend sends none of it, and a screen then hides what is missing.
// Decoding is tolerant, as in WatchModels: a wrong type is dropped, an entry that is not an object is skipped.
import type { Citation } from "./CoachModels";
import { JSONRead, type JSONObject } from "./Models";
import { type HousingEffect, Listing } from "./WatchModels";

export interface SchedulerInfo {
  /** `cron`: Sisu checks on its own schedule while the app is closed. `on-open`: only when the app checks in. */
  kind: string;
  checkEveryMinutes: number | null;
  /** "HH:MM", Europe/Helsinki. */
  dailyTimes: string[];
  push: boolean;
}

export type AlertReason = "initial_findings" | "match" | "daily_summary" | "deadline" | "deadline_nothing" | (string & {});
export interface ProjectAlert {
  id: string;
  watchId: string;
  findingIds: string[];
  title: string;
  body: string;
  reason: AlertReason;
  createdAt: string | null;
  pushed: string | null;
  simulated: boolean;
  readAt: string | null;
}

export type RequirementStatus = "met" | "failed" | "unknown";
export interface RequirementCheck { requirement: string; status: RequirementStatus; detail: string }
export type ListingVerdict = "match" | "needs_verification" | "fails";
export interface EvaluatedListing { listing: Listing; verdict: ListingVerdict; checks: RequirementCheck[]; housing: HousingEffect | null }

export interface ListingFacts { priceEur: number | null; areaM2: number | null; availableFrom: string | null }
export interface MonitorChange {
  id: string;
  pageUrl: string | null;
  pageTitle: string | null;
  detectedAt: string | null;
  detectedBy: string | null;
  simulated: boolean;
  listingTitle: string | null;
  before: ListingFacts | null;
  after: ListingFacts | null;
  findingId: string | null;
}

export interface ProjectEvidence {
  exa: { query: string; searchedAt: string | null; sources: Citation[]; mock: boolean } | null;
  extraction: { url: string; title: string | null; readAt: string | null; listingsRead: number | null; problem: string | null }[];
  monitoring: MonitorChange[];
  research: { query: string; sources: Citation[]; affects: string | null }[];
}

const str = (o: JSONObject, key: string): string | null => (typeof o[key] === "string" ? (o[key] as string) : null);
const num = (o: JSONObject, key: string): number | null => (typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : null);
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const objects = (value: unknown): JSONObject[] => (Array.isArray(value) ? value.filter(JSONRead.isObject) : []);

const citations = (value: unknown): Citation[] =>
  objects(value).filter((o) => typeof o.url === "string").map((o) => ({ ...(o as unknown as Citation), title: str(o, "title") ?? (o.url as string) }));

const facts = (json: unknown): ListingFacts | null => {
  if (!JSONRead.isObject(json)) return null;
  return { priceEur: num(json, "priceEur"), areaM2: num(json, "areaM2"), availableFrom: str(json, "availableFrom") };
};

export const SchedulerInfo = {
  decode(json: unknown): SchedulerInfo | null {
    if (!JSONRead.isObject(json) || typeof json.kind !== "string") return null;
    return { kind: json.kind, checkEveryMinutes: num(json, "checkEveryMinutes"), dailyTimes: texts(json.dailyTimes), push: json.push === true };
  },
} as const;

export const ProjectAlert = {
  decode(json: unknown): ProjectAlert | null {
    if (!JSONRead.isObject(json) || typeof json.id !== "string" || typeof json.watchId !== "string") return null;
    return {
      id: json.id, watchId: json.watchId, findingIds: texts(json.findingIds), title: str(json, "title") ?? "Sisu",
      body: str(json, "body") ?? "Your project has an update.", reason: str(json, "reason") ?? "match", createdAt: str(json, "createdAt"),
      pushed: str(json, "pushed"), simulated: json.simulated === true, readAt: str(json, "readAt"),
    };
  },
  many(value: unknown): ProjectAlert[] { return objects(value).map(ProjectAlert.decode).filter((a): a is ProjectAlert => a !== null); },
} as const;

const STATUSES: readonly string[] = ["met", "failed", "unknown"];
const VERDICTS: readonly string[] = ["match", "needs_verification", "fails"];

export const RequirementCheck = {
  many(value: unknown): RequirementCheck[] {
    return objects(value).flatMap((o) => (typeof o.requirement === "string" && typeof o.status === "string" && STATUSES.includes(o.status)
      ? [{ requirement: o.requirement, status: o.status as RequirementStatus, detail: str(o, "detail") ?? "" }] : []));
  },
} as const;

export const EvaluatedListing = {
  many(value: unknown): EvaluatedListing[] {
    return objects(value).flatMap((o) => {
      const listing = Listing.decode(o.listing);
      if (!listing || typeof o.verdict !== "string" || !VERDICTS.includes(o.verdict)) return [];
      return [{ listing, verdict: o.verdict as ListingVerdict, checks: RequirementCheck.many(o.checks), housing: JSONRead.isObject(o.housing) ? o.housing : null }];
    });
  },
} as const;

export const MonitorChange = {
  many(value: unknown): MonitorChange[] {
    return objects(value).flatMap((o) => (typeof o.id !== "string" ? [] : [{
      id: o.id, pageUrl: str(o, "pageUrl"), pageTitle: str(o, "pageTitle"), detectedAt: str(o, "detectedAt"), detectedBy: str(o, "detectedBy"),
      simulated: o.simulated === true, listingTitle: str(o, "listingTitle"), before: facts(o.before), after: facts(o.after), findingId: str(o, "findingId"),
    }]));
  },
} as const;

export const ProjectEvidence = {
  decode(json: unknown): ProjectEvidence | null {
    if (!JSONRead.isObject(json)) return null;
    const exa = JSONRead.isObject(json.exa) && typeof json.exa.query === "string"
      ? { query: json.exa.query, searchedAt: str(json.exa, "searchedAt"), sources: citations(json.exa.sources), mock: json.exa.mock === true } : null;
    const extraction = objects(json.extraction).flatMap((o) => (typeof o.url !== "string" ? [] : [{
      url: o.url, title: str(o, "title"), readAt: str(o, "readAt"), listingsRead: num(o, "listingsRead"), problem: str(o, "problem"),
    }]));
    const research = objects(json.research).flatMap((o) => (typeof o.query !== "string" ? [] : [{ query: o.query, sources: citations(o.sources), affects: str(o, "affects") }]));
    return { exa, extraction, monitoring: MonitorChange.many(json.monitoring), research };
  },
} as const;
