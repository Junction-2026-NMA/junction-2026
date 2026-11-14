// What the customer said a new contract must meet, and whether an offer meets it. A requirement whose value the
// page does not state counts as a miss: "not stated" is never read as "fine".
import type { OfferRequirements } from "@/lib/types";
import type { RawOffer } from "./types";

const SPOT_PATTERN = /spot|pörssi|market|hourly/i;
const MONTHS: [number, number] = [1, 60];
const COST: [number, number] = [1, 500];

const inRange = (value: unknown, [lo, hi]: [number, number]): number | null => (typeof value === "number" && Number.isFinite(value) && value >= lo && value <= hi ? Math.round(value * 100) / 100 : null);

export const isSpotOffer = (offer: Pick<RawOffer, "contractType" | "plan">): boolean => SPOT_PATTERN.test(`${offer.contractType ?? ""} ${offer.plan ?? ""}`);

// From tool or route arguments. Unknown or out-of-range values are dropped; null when nothing was asked for.
export function parseRequirements(args: Record<string, unknown> | null | undefined): OfferRequirements | null {
  if (!args) return null;
  const source = typeof args.requirements === "object" && args.requirements !== null ? (args.requirements as Record<string, unknown>) : args;
  const maxContractMonths = inRange(source.maxContractMonths, MONTHS);
  const minContractMonths = inRange(source.minContractMonths, MONTHS);
  const contractType = source.contractType === "fixed" || source.contractType === "spot" ? source.contractType : null;
  const maxMonthlyCostEur = inRange(source.maxMonthlyCostEur, COST);
  const requirements: OfferRequirements = {
    ...(maxContractMonths !== null ? { maxContractMonths } : {}),
    ...(minContractMonths !== null ? { minContractMonths } : {}),
    ...(contractType ? { contractType } : {}),
    ...(source.greenOnly === true ? { greenOnly: true } : {}),
    ...(maxMonthlyCostEur !== null ? { maxMonthlyCostEur } : {}),
    ...(source.noSetupFee === true ? { noSetupFee: true } : {}),
  };
  return Object.keys(requirements).length ? requirements : null;
}

// "12 months or less, fixed price, green energy": the requirements in words, for cards and for the model.
export function requirementsText(requirements: OfferRequirements | null | undefined): string | null {
  if (!requirements) return null;
  const parts = [
    requirements.maxContractMonths !== undefined ? `contract of ${requirements.maxContractMonths} months or less` : null,
    requirements.minContractMonths !== undefined ? `contract of at least ${requirements.minContractMonths} months` : null,
    requirements.contractType === "fixed" ? "fixed price" : requirements.contractType === "spot" ? "spot price" : null,
    requirements.greenOnly ? "renewable energy" : null,
    requirements.maxMonthlyCostEur !== undefined ? `at most €${requirements.maxMonthlyCostEur} a month` : null,
    requirements.noSetupFee ? "no setup fee" : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(", ") : null;
}

// Each requirement the offer misses, in a few words. Empty = it meets them all.
export function missesFor(offer: RawOffer, requirements: OfferRequirements | null | undefined, monthlyCostEur: number | null): string[] {
  if (!requirements) return [];
  const months = offer.contractMonths;
  const misses: (string | null)[] = [
    requirements.maxContractMonths === undefined ? null : months === null ? "contract length not stated" : months > requirements.maxContractMonths ? `${months}-month contract (you asked for ${requirements.maxContractMonths} months or less)` : null,
    requirements.minContractMonths === undefined ? null : months === null ? "contract length not stated" : months < requirements.minContractMonths ? `${months}-month contract (you asked for at least ${requirements.minContractMonths})` : null,
    requirements.contractType === "fixed" && isSpotOffer(offer) ? "spot price, not fixed" : null,
    requirements.contractType === "spot" && !isSpotOffer(offer) ? "not a spot-price contract" : null,
    requirements.greenOnly ? (offer.greenEnergy === true ? null : offer.greenEnergy === false ? "not renewable energy" : "energy source not stated") : null,
    requirements.maxMonthlyCostEur === undefined ? null : monthlyCostEur === null ? "cost could not be compared" : monthlyCostEur > requirements.maxMonthlyCostEur ? `about €${monthlyCostEur.toFixed(2)} a month (you asked for at most €${requirements.maxMonthlyCostEur})` : null,
    requirements.noSetupFee ? (offer.setupFeeEur === null ? "setup fee not stated" : offer.setupFeeEur > 0 ? `€${offer.setupFeeEur} setup fee` : null) : null,
  ];
  return [...new Set(misses.filter((miss): miss is string => miss !== null))];
}
