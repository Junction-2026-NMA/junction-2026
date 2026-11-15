// Current electricity inputs come only from the customer's messages or their saved facts.
// They never come from the model's arguments, a listing or a bank payment that may include grid fees.
import { getMemory, remember, statedYearlyKwh } from "@/lib/memory";
import type { CustomerMemory } from "@/lib/types";

export type ElectricityTariff = { energyPriceCentsPerKwh: number; monthlyFeeEur: number };
type Inputs = { yearlyKwh: number | null; tariff: ElectricityTariff | null; missing: string[] };
const KEY = "electricity-current-tariff";
const number = (text: string): number => Number(text.replace(/(?<=\d)[ ,](?=\d{3}(?:\D|$))/g, "").replace(/\s/g, "").replace(",", "."));
const valid = (value: unknown, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;

export function savedTariff(memory: CustomerMemory): ElectricityTariff | null {
  const saved = memory.items.find((item) => item.kind === "preference" && item.key === KEY);
  try {
    const value = JSON.parse(saved?.value ?? "null") as ElectricityTariff | null;
    return value && valid(value.energyPriceCentsPerKwh, 100) && valid(value.monthlyFeeEur, 200) ? value : null;
  } catch { return null; }
}

// Explicit units are required. A housing budget, target offer price or spot margin is not a current tariff.
export function tariffFromTexts(texts: string[]): { yearlyKwh: number | null; tariff: Partial<ElectricityTariff> } {
  let yearlyKwh: number | null = null;
  let tariff: Partial<ElectricityTariff> = {};
  for (const text of texts) {
    const usage = [...text.matchAll(/(?<![-\d])\b(\d[\d ,]*(?:\.\d+)?)\s*kwh\b/gi)].at(-1);
    const usageSuffix = usage ? text.slice((usage.index ?? 0) + usage[0].length) : "";
    if (usage && !/^\s*(?:\/|per\s*|a\s*)month\b/i.test(usageSuffix) && number(usage[1]) >= 500 && number(usage[1]) <= 30_000) yearlyKwh = number(usage[1]);
    const futureOnly = /\b(want|find|under|at most|maximum|looking for|offer)\b/i.test(text) && !/\b(pay|currently|current tariff|my tariff|my rate)\b/i.test(text);
    if (futureOnly || /\b(spot|margin)\b/i.test(text)) continue;
    const rate = [...text.matchAll(/(?<![-\d])\b(\d+(?:[.,]\d+)?)\s*(?:c|cents?|snt)\s*(?:\/|per\s*)\s*kwh\b/gi)].filter(match => !/(?:under|at most|max(?:imum)?|less than|offer(?: at| of)?|want(?: to pay)?|budget(?: of)?)\s*$/i.test(text.slice(0, match.index))).at(-1);
    if (rate && valid(number(rate[1]), 100)) tariff = { ...tariff, energyPriceCentsPerKwh: number(rate[1]) };
    const fee = text.match(/(?:monthly|base)\s*fee\s*(?:of|is|:)?\s*€?\s*(\d+(?:[.,]\d+)?)/i)
      ?? text.match(/€?\s*(\d+(?:[.,]\d+)?)\s*(?:euros?|eur|€)?\s*(?:monthly|base)\s*fee/i)
      ?? (rate ? text.match(/€\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*(?:month|mo)|per month|a month)/i) ?? text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:euros?|eur|€)\s*(?:\/\s*(?:month|mo)|per month|a month)/i) : null);
    if (fee && valid(number(fee[1]), 200)) tariff = { ...tariff, monthlyFeeEur: number(fee[1]) };
  }
  return { yearlyKwh, tariff };
}

export function electricityInputs(customerId: string, texts: string[], persist = true): Inputs {
  const memory = getMemory(customerId);
  const said = tariffFromTexts(texts);
  const yearlyKwh = said.yearlyKwh ?? statedYearlyKwh(memory);
  const combined = { ...savedTariff(memory), ...said.tariff };
  const tariff = valid(combined.energyPriceCentsPerKwh, 100) && valid(combined.monthlyFeeEur, 200)
    ? { energyPriceCentsPerKwh: combined.energyPriceCentsPerKwh, monthlyFeeEur: combined.monthlyFeeEur } : null;
  if (persist && memory.consent) {
    if (said.yearlyKwh !== null && statedYearlyKwh(memory) !== said.yearlyKwh) remember(customerId, { kind: "yearly_kwh", key: "electricity", value: String(said.yearlyKwh), source: "user-said-in-chat" });
    if (tariff && JSON.stringify(savedTariff(memory)) !== JSON.stringify(tariff)) remember(customerId, { kind: "preference", key: KEY, value: JSON.stringify(tariff), source: "user-said-in-chat" });
  }
  return { yearlyKwh, tariff, missing: [...(yearlyKwh === null ? ["your yearly electricity use in kWh (from your bill)"] : []), ...(tariff === null ? ["your current electricity price per kWh and monthly fee (energy sales only, excluding grid fees)"] : [])] };
}
