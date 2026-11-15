// Intent rules for the scripted mock model (v3): the housing conversation and the payday follow-ups, read from the
// customer's own messages with simple rules, so natural variations work without keys. Every figure still comes from
// a tool or from CUSTOMER SUMMARY (computed by the bank's code); these rules only pick the tool and its arguments.

type Json = Record<string, unknown>;

const HOME = /\b(house|home|flat|apartment|place|studio|listings?|rent|renting|rental|move out|moving)\b|asun|vuokr|bostad|lägenhet/i;
const WANTS = /\b(afford|find|look(ing)? for|search|listings?|bigger|larger|more space|move|rent)\b|etsi|löydä|isompi|hitta/i;
const CITIES = ["Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu", "Jyväskylä", "Lahti", "Kuopio"];
const CATEGORY_WORDS: [RegExp, string][] = [
  [/eat(ing)? out|dining|restaurant|takeaway|take-away|food delivery|ravintol|caf[eé]/i, "Restaurants"],
  [/grocer/i, "Groceries"],
  [/transport/i, "Transportation"],
  [/entertain/i, "Entertainment"],
  [/health/i, "Health"],
  [/travel/i, "Travel"],
];

export const isHousingTalk = (texts: string[]): boolean => texts.some((text) => HOME.test(text));
export const wantsAHome = (text: string): boolean => HOME.test(text) && WANTS.test(text);
export const cityIn = (texts: string[]): string | null => {
  for (const text of [...texts].reverse()) {
    const named = CITIES.find((city) => new RegExp(`\\b${city}\\b`, "i").test(text));
    if (named) return named;
  }
  return null;
};

const numberAt = (raw: string): number => Number(raw.replace(/[ ,](?=\d{3}\b)/g, "").replace(",", "."));

// Each number the customer said, with what it is: a floor area, a savings amount (monthly or a goal), or a rent.
// Read from the words just before and just after the number, never across another number.
export type HomeRequirements = { budgetEur: number | null; minAreaM2: number | null; monthlySavingsEur: number | null; savingsGoalEur: number | null };
export function homeRequirements(texts: string[]): HomeRequirements {
  const found: HomeRequirements = { budgetEur: null, minAreaM2: null, monthlySavingsEur: null, savingsGoalEur: null };
  for (const text of texts) {
    for (const match of text.matchAll(/(\d{1,3}(?:[ ,]\d{3})+|\d+(?:[.,]\d+)?)/g)) {
      const value = numberAt(match[1]);
      if (!Number.isFinite(value) || value <= 0) continue;
      const start = match.index ?? 0;
      if (/^m2?\b/i.test(text.slice(Math.max(0, start - 1), start + 1)) && value === 2) continue; // the 2 of "m2"
      const rawAfter = text.slice(start + match[0].length, start + match[0].length + 30).toLowerCase();
      // The words of this clause only: before the number back to the last number or punctuation, after it up to the next.
      const before = text.slice(Math.max(0, start - 22), start).toLowerCase().split(/[\d,.;!?]/).at(-1) ?? "";
      const after = rawAfter.split(/[\d,.;!?]/)[0] ?? "";
      if (/^\s*(m²|m2|sq|square|neliö|neli)/.test(rawAfter)) found.minAreaM2 = value;
      else if (/goal|saving (up )?for|save up|tavoite/.test(before) || /^\W*(€|euros?)?\s*(savings )?goal/.test(after)) found.savingsGoalEur = value;
      else if (/keep|sav|put aside|säästä|spara/.test(before) || /sav|säästö/.test(after)) found.monthlySavingsEur = value;
      else if (value >= 200 && value <= 10_000) found.budgetEur = value;
    }
  }
  return found;
}

// The housing step for the mock: a clarifying answer (from CUSTOMER SUMMARY's housingToday) until a rent was said,
// then search_flats with every requirement from the conversation.
export function housingStep(question: string, earlier: string[], summary: Json | null, profileCity: string | null): { speak: string } | { tool: [string, Json] } | null {
  const texts = [...earlier, question];
  if (!wantsAHome(question) && !(isHousingTalk(earlier) && /\d/.test(question))) return null;
  const city = cityIn(texts) ?? profileCity;
  const req = homeRequirements(texts);
  if (req.budgetEur === null) {
    const housing = (summary?.housingToday ?? null) as Json | null;
    const figures = housing ? ` From your bank data, rent today is about ${housing.rentPerMonthEur} euros a month and an average month leaves about ${housing.leftOverInAnAverageMonthEur} euros over, so a rent up to about ${housing.highestRentThatStillBalancesAnAverageMonthEur} euros would still balance an average month (an estimate).` : "";
    return { speak: `Mock answer. I take it you mean renting${city ? ` in ${city}` : ""}.${figures} What is the most rent you would pay a month, the smallest size you would accept, and how much do you want to keep saving each month?` };
  }
  const bigger = texts.some((text) => /bigger|larger|more space|isompi/i.test(text));
  const requirements = Object.fromEntries(Object.entries({ minAreaM2: req.minAreaM2, monthlySavingsEur: req.monthlySavingsEur, savingsGoalEur: req.savingsGoalEur }).filter(([, value]) => value !== null));
  return { tool: ["search_flats", { ...(city ? { city } : {}), budgetEur: req.budgetEur, goal: `Rent a ${bigger ? "larger " : ""}home${city ? ` in ${city}` : ""}`, requirements }] };
}

export const categoryIn = (text: string): string | null => CATEGORY_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

// "What about 10%?" after a category cut: the same category, the new percentage.
export function followUpCut(question: string, earlier: string[]): [string, Json] | null {
  const pct = /(\d{1,3})\s?(%|percent|prosent)/i.exec(question);
  if (!pct || categoryIn(question)) return null;
  const previous = [...earlier].reverse().find((text) => categoryIn(text) && /(\d{1,3})\s?(%|percent)/i.test(text));
  return previous ? ["run_scenario", { category: categoryIn(previous), categoryCutPct: Number(pct[1]) }] : null;
}

// CUSTOMER SUMMARY from the system prompt, as the bank's code wrote it.
export function summaryOf(system: string): Json | null {
  const line = system.split("\n").find((text) => text.startsWith("CUSTOMER SUMMARY"));
  const json = line?.slice(line.indexOf("{"));
  if (!json) return null;
  try {
    return JSON.parse(json) as Json;
  } catch {
    return null;
  }
}

// The biggest everyday category and its monthly average, from the summary's baskets.
export function biggestEveryday(summary: Json | null): { category: string; monthlyEur: number } | null {
  const baskets = (summary?.baskets ?? []) as { basket: string; categories: Record<string, [number, number]> }[];
  const everyday = baskets.find((basket) => /everyday/i.test(basket.basket));
  const top = Object.entries(everyday?.categories ?? {}).sort((a, b) => b[1][0] - a[1][0])[0];
  return top ? { category: top[0], monthlyEur: top[1][0] } : null;
}
