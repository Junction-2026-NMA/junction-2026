import type { BillType, Citation, ResearchStatus } from "@/lib/types";

// An offer exactly as extracted from a page, before any customer-specific maths.
export type RawOffer = {
  provider: string;
  plan: string | null;
  contractType: string | null;
  contractMonths: number | null;
  monthlyPriceEur: number | null;
  energyPriceCentsPerKwh: number | null;
  setupFeeEur: number | null;
  greenEnergy?: boolean | null; // electricity: renewable energy, as the page states it; null or missing when it does not say
  // Electricity with two prices (kausisähkö: a winter price and one for the rest of the year; aikasähkö: day and night).
  // Its cost depends on when the electricity is used, so it is listed but never ranked. Null or missing = one price.
  winterPriceCentsPerKwh?: number | null;
  otherPriceCentsPerKwh?: number | null;
  sourceUrl: string;
};

// Market data for one bill type in one city. Shared by every customer, so it holds nothing personal.
export type RawResearch = {
  key: string;
  billType: BillType;
  city: string;
  status: ResearchStatus;
  mock: boolean;
  query: string;
  startedAt: number; // epoch ms
  finishedAt: number | null;
  pagesDone: number;
  pagesTotal: number;
  found?: { url: string; title: string }[]; // the pages the search returned, before any of them is read
  offers: RawOffer[];
  citations: Citation[];
  errors: string[];
};
