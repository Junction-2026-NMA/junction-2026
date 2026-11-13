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
  offers: RawOffer[];
  citations: Citation[];
  errors: string[];
};
