// Turns shared market data into one customer's comparison. All arithmetic lives here, never in the model.
import type { BillType, Offer, ResearchResult } from "@/lib/types";
import type { RawOffer, RawResearch } from "./types";

// A small flat's yearly electricity use. Shown to the user as an assumption they can question.
export const ASSUMED_KWH_PER_YEAR = 2_000;
const PLAUSIBLE_CENTS_PER_KWH: [number, number] = [1, 40];
const PLAUSIBLE_MONTHLY_EUR: [number, number] = [0, 200];
const SPOT_PATTERN = /spot|pörssi|market|hourly/i;

const round2 = (x: number) => Math.round(x * 100) / 100;
const within = (x: number, [lo, hi]: [number, number]) => x >= lo && x <= hi;

function isSpot(offer: RawOffer): boolean {
  return SPOT_PATTERN.test(`${offer.contractType ?? ""} ${offer.plan ?? ""}`);
}

function monthlyCost(offer: RawOffer, billType: BillType): number | null {
  if (billType === "electricity") {
    // A spot contract's listed price is only the margin on top of a market price that changes hourly,
    // so it cannot be compared fairly with a fixed price.
    if (isSpot(offer) || offer.energyPriceCentsPerKwh === null) return null;
    if (!within(offer.energyPriceCentsPerKwh, PLAUSIBLE_CENTS_PER_KWH)) return null;
    const energy = (ASSUMED_KWH_PER_YEAR / 12) * (offer.energyPriceCentsPerKwh / 100);
    return round2(energy + (offer.monthlyPriceEur ?? 0));
  }
  if (offer.monthlyPriceEur === null || !within(offer.monthlyPriceEur, PLAUSIBLE_MONTHLY_EUR)) return null;
  return round2(offer.monthlyPriceEur + (offer.setupFeeEur ?? 0) / 12);
}

function dedupe(offers: RawOffer[]): RawOffer[] {
  const seen = new Set<string>();
  return offers.filter((o) => {
    const id = `${o.provider}|${o.plan ?? ""}|${o.contractMonths ?? ""}`.toLowerCase();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function assumptionsFor(billType: BillType, baseline: number | null): string[] {
  const shared = [
    "Prices are as stated on the linked pages at the time shown. Check the provider's own page before switching.",
    baseline === null
      ? "No current bill was found for this customer, so savings cannot be calculated."
      : `Savings compare each offer with your average bill of €${baseline.toFixed(2)} a month over the last 12 months.`,
    "The bank data has no payee names, so which bill this is rests on the name you confirmed.",
  ];
  if (billType !== "electricity") return [...shared, "A setup fee is spread over the first 12 months."];
  return [
    ...shared,
    `Electricity cost assumes ${ASSUMED_KWH_PER_YEAR} kWh a year, typical for a small flat. Your real use may differ.`,
    "Your bill may include grid (distribution) fees, which do not change when you switch seller. Real savings may be smaller.",
    "Spot-price contracts are listed but not ranked, because their price changes every hour.",
  ];
}

export function toResult(raw: RawResearch, baselineMonthlyEur: number | null): ResearchResult {
  const offers: Offer[] = dedupe(raw.offers)
    .map((offer) => {
      const cost = monthlyCost(offer, raw.billType);
      const saving = cost !== null && baselineMonthlyEur !== null ? round2((baselineMonthlyEur - cost) * 12) : null;
      return { ...offer, comparable: cost !== null, estimatedMonthlyCostEur: cost, estimatedYearlySavingEur: saving };
    })
    .sort((a, b) => (a.estimatedMonthlyCostEur ?? Infinity) - (b.estimatedMonthlyCostEur ?? Infinity));

  const cheapest = offers.find((o) => o.comparable) ?? null;
  const best = cheapest && (cheapest.estimatedYearlySavingEur ?? 0) > 0 ? cheapest : null;
  const end = raw.finishedAt ?? Date.now();

  return {
    key: raw.key,
    billType: raw.billType,
    city: raw.city,
    status: raw.status,
    mock: raw.mock,
    query: raw.query,
    startedAt: new Date(raw.startedAt).toISOString(),
    finishedAt: raw.finishedAt ? new Date(raw.finishedAt).toISOString() : null,
    tookMs: end - raw.startedAt,
    pagesDone: raw.pagesDone,
    pagesTotal: raw.pagesTotal,
    baselineMonthlyEur,
    offers,
    best,
    citations: raw.citations,
    assumptions: assumptionsFor(raw.billType, baselineMonthlyEur),
    errors: raw.errors,
  };
}

export function comparableCount(raw: RawResearch): number {
  return dedupe(raw.offers).filter((o) => monthlyCost(o, raw.billType) !== null).length;
}
