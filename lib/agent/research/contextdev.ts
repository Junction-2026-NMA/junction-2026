import type { BillType } from "@/lib/types";
import { getConfig, missingKey } from "../config";
import { safeName } from "../tools/untrusted";
import type { RawOffer } from "./types";

const PAGE_TIMEOUT_MS = 8_000;
const MAX_PAGE_AGE_MS = 15 * 60_000; // accept a copy up to 15 minutes old; its age is reported
const MAX_OFFERS_PER_PAGE = 6;

const OFFER_SCHEMA = {
  type: "object",
  required: ["offers"],
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        required: ["provider", "plan", "contractType", "contractMonths", "monthlyPriceEur", "energyPriceCentsPerKwh", "setupFeeEur"],
        properties: {
          provider: { type: "string", description: "Company selling the contract" },
          plan: { type: ["string", "null"], description: "Plan or product name" },
          contractType: { type: ["string", "null"], description: "fixed, spot, or other" },
          contractMonths: { type: ["number", "null"], description: "Contract length in months" },
          monthlyPriceEur: { type: ["number", "null"], description: "Fixed monthly price or base fee in euros" },
          energyPriceCentsPerKwh: { type: ["number", "null"], description: "Electricity only: energy price in cents per kWh. Null for other products." },
          setupFeeEur: { type: ["number", "null"], description: "One-off opening or setup fee in euros" },
        },
      },
    },
  },
};

const INSTRUCTIONS: Record<BillType, string> = {
  electricity: "Household electricity contract offers. Use only facts stated on the page.",
  mobile: "Consumer mobile phone subscription offers. Use only facts stated on the page.",
  internet: "Home broadband offers. Use only facts stated on the page.",
};

export type PageExtraction = { url: string; offers: RawOffer[]; cacheAgeMs: number | null; tookMs: number; dropped: number };
const MAX_PROVIDER_CHARS = 60;
const MAX_PLAN_CHARS = 80;

type ScrapeResponse = {
  json?: { success?: boolean | null; data?: { offers?: Partial<RawOffer>[] } | null; message?: string };
  cache_metadata?: { age_ms?: number } | null;
};

const numberOrNull = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const textOrNull = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

// Page text is untrusted. An offer is kept only if its provider and plan read like names: short, no links,
// nothing phrased as an instruction. Anything else is dropped and counted, never passed to the model.
export function cleanOffers(extracted: Partial<RawOffer>[], url: string): { offers: RawOffer[]; dropped: number } {
  const candidates = extracted.filter((o) => typeof o.provider === "string" && o.provider.trim()).slice(0, MAX_OFFERS_PER_PAGE);
  const offers = candidates.flatMap((o): RawOffer[] => {
    const provider = safeName(o.provider, MAX_PROVIDER_CHARS);
    const plan = textOrNull(o.plan);
    const safePlan = plan === null ? null : safeName(plan, MAX_PLAN_CHARS);
    if (!provider || (plan !== null && safePlan === null)) return [];
    return [
      {
        provider,
        plan: safePlan,
        contractType: safeName(o.contractType, 30),
        contractMonths: numberOrNull(o.contractMonths),
        monthlyPriceEur: numberOrNull(o.monthlyPriceEur),
        energyPriceCentsPerKwh: numberOrNull(o.energyPriceCentsPerKwh),
        setupFeeEur: numberOrNull(o.setupFeeEur),
        sourceUrl: url,
      },
    ];
  });
  return { offers, dropped: candidates.length - offers.length };
}

// Turns one offer page into typed offers. This is the slowest step in the whole agent (3 to 6 s),
// so callers start it early and share the result; see research/index.ts.
export async function extractOffers(url: string, billType: BillType): Promise<PageExtraction> {
  const { contextDev } = getConfig();
  if (!contextDev.apiKey) throw missingKey("Context.dev", "CONTEXT_DEV_API_KEY");

  const started = Date.now();
  const response = await fetch("https://api.context.dev/v1/web/scrape", {
    method: "POST",
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${contextDev.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: { json: true },
      jsonParams: { schema: OFFER_SCHEMA, instructions: `${INSTRUCTIONS[billType]} At most ${MAX_OFFERS_PER_PAGE} offers.` },
      sharedParams: { mainContentOnly: true },
      maxAgeMs: MAX_PAGE_AGE_MS,
    }),
  });
  if (!response.ok) {
    console.error(`[agent] Context.dev returned ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
    throw new Error(`Context.dev could not read the page (${response.status}).`);
  }

  const body = (await response.json()) as ScrapeResponse;
  // A 200 response can still carry a failed output, so the success flag is checked on its own.
  if (body.json?.success !== true) throw new Error(body.json?.message ?? "Context.dev found no offers on the page.");

  const { offers, dropped } = cleanOffers(body.json.data?.offers ?? [], url);
  return { url, offers, dropped, cacheAgeMs: numberOrNull(body.cache_metadata?.age_ms), tookMs: Date.now() - started };
}
