// Whether a question is about a home to live in (affording or finding one), and what it already says. Pure words
// to fields: no model. A housing question gets the intake card before any search (lib/housing/intake.ts).
import { cleanCity } from "@/lib/agent/research/listings";

const HOME = /\b(house|houses|home|homes|flat|flats|apartment|apartments|studio|listings?|rentals?|place to live|somewhere to live|bigger place|larger place)\b/i;
const LOOKING = /\b(afford|find|look(ing)? for|search|move|moving|rent|renting|listings?|options?|bigger|larger)\b/i;
const BUY = /\b(buy|buying|purchase|mortgage|own home|home loan)\b/i;
const RENT = /\b(rent|renting|rental|lease|vuokra)\b/i;
// Questions about Sisu's own projects or an existing watch are not a new search.
const NOT_NEW = /\b(my project|the project|stop watching|pause|resume|simulate)\b/i;
const CITY = /\bin ([A-ZÅÄÖ][\p{L}-]+)/u;
const KNOWN_CITIES = ["Helsinki", "Espoo", "Vantaa", "Kauniainen", "Tampere", "Turku", "Oulu", "Jyväskylä", "Lahti", "Kuopio"];

export type HousingHints = { tenure: "rent" | "buy" | null; city: string | null; minRooms: number | null; minAreaM2: number | null };

// A rent the question already names ("under 900 euros"): the model's search_flats path takes it from there.
const NAMED_BUDGET = /(€\s?\d|\d[\d ,.]*\s?(€|eur|euros?)\b|\b(under|below|up to|max(imum)?|at most)\s+€?\d)/i;

// "Buy" questions go to the mortgage answer as before; only renting (or not saying) gets the intake card.
export function isHousingQuestion(text: string): boolean {
  if (!text || NOT_NEW.test(text) || NAMED_BUDGET.test(text)) return false;
  if (BUY.test(text) && !RENT.test(text)) return false;
  return HOME.test(text) && LOOKING.test(text);
}

export function housingHints(text: string): HousingHints {
  const named = CITY.exec(text)?.[1] ?? KNOWN_CITIES.find((city) => new RegExp(`\\b${city}\\b`, "i").test(text)) ?? null;
  const rooms = /(\d)\s*(?:-| )?(?:rooms?|bedrooms?|h\b)/i.exec(text)?.[1];
  const area = /(\d{2,3})\s*(?:m2|m²|sq ?m|square met)/i.exec(text)?.[1];
  // "Buy" wins only when the question says it and does not also say rent.
  const tenure = BUY.test(text) && !RENT.test(text) ? "buy" : RENT.test(text) ? "rent" : null;
  return { tenure, city: named ? cleanCity(named) : null, minRooms: rooms ? Number(rooms) : null, minAreaM2: area ? Number(area) : null };
}
