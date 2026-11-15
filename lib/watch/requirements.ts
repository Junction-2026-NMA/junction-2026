// A Project's requirements: cleaned from what the model or the app sends, and applied to a listing in code.
// Money figures must be ones the customer said (the caller passes a check for that); anything that does not pass
// is dropped and reported back, never guessed. A listing that does not state a field is kept, not excluded, and
// the gap is named so the customer can check it.
import { safeName } from "@/lib/agent/tools/untrusted";
import type { Listing, WatchRequirements } from "@/lib/types";

const MONEY_LIMIT = 100_000;
const MAX_DISTRICTS = 6;
const MAX_GOAL_CHARS = 160;

const money = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MONEY_LIMIT ? Math.round(value) : null);
const isoDay = (value: unknown): string | null => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null);

// The goal in the customer's own words: plain text, short, one line.
export function cleanGoal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_GOAL_CHARS);
  return text.length >= 3 ? text : null;
}

export type Cleaned = { requirements: WatchRequirements; dropped: string[] };

// `said` answers whether the customer said this figure themselves. Without it (the app's own edit form, where the
// customer types the figure) every figure counts as said.
export function cleanRequirements(input: unknown, said: (value: number) => boolean = () => true): Cleaned {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const dropped: string[] = [];
  const out: WatchRequirements = {};
  const own = (key: keyof WatchRequirements, label: string): number | null | undefined => {
    if (!(key in raw)) return undefined;
    if (raw[key] === null) return null; // an explicit null clears it
    const value = money(raw[key]);
    if (value === null || !said(value)) {
      dropped.push(label);
      return undefined;
    }
    return value;
  };
  for (const [key, label] of [["maxDepositEur", "deposit limit"], ["movingCostEur", "moving cost"], ["bufferToKeepEur", "buffer to keep"], ["savingsGoalEur", "savings goal"], ["monthlySavingsEur", "monthly savings"]] as const) {
    const value = own(key, label);
    if (value !== undefined) out[key] = value;
  }
  if ("minAreaM2" in raw) {
    const area = raw.minAreaM2;
    if (area === null) out.minAreaM2 = null;
    else if (typeof area === "number" && area >= 10 && area <= 300) out.minAreaM2 = Math.round(area);
    else dropped.push("minimum floor area (10 to 300 m²)");
  }
  if ("districts" in raw) {
    const list = Array.isArray(raw.districts) ? raw.districts.map((name) => safeName(name, 40)).filter((name): name is string => !!name && /^[\p{L} .'-]+$/u.test(name)) : [];
    out.districts = [...new Set(list)].slice(0, MAX_DISTRICTS);
  }
  if ("moveBy" in raw) {
    const day = raw.moveBy === null ? null : isoDay(raw.moveBy);
    if (day === null && raw.moveBy !== null) dropped.push("move-by date (use YYYY-MM-DD)");
    else out.moveBy = day;
  }
  if ("maxCommuteMinutes" in raw) {
    const minutes = raw.maxCommuteMinutes;
    if (minutes === null) out.maxCommuteMinutes = null;
    else if (typeof minutes === "number" && minutes >= 5 && minutes <= 180) out.maxCommuteMinutes = Math.round(minutes);
    else dropped.push("commute limit (5 to 180 minutes)");
  }
  if ("commuteTo" in raw) {
    const place = raw.commuteTo === null ? null : safeName(raw.commuteTo, 60);
    out.commuteTo = place && /^[\p{L}0-9 .,'-]+$/u.test(place) ? place : null;
  }
  return { requirements: out, dropped };
}

export const mergeRequirements = (current: WatchRequirements | undefined, change: WatchRequirements): WatchRequirements => ({ ...(current ?? {}), ...change });

// "1.12.2026", "01.12.2026" or "2026-12-01" as a day; "heti" / "now" / "immediately" as free now. Anything else: unknown.
export function availableDay(text: string | null | undefined, today: string): string | null {
  if (!text) return null;
  const value = text.trim().toLowerCase();
  if (/^(heti|now|immediately|vapaa heti|available now)/.test(value)) return today;
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fi = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return fi ? `${fi[3]}-${fi[2].padStart(2, "0")}-${fi[1].padStart(2, "0")}` : null;
}

// What the requirements say about one listing: excluded with a reason, or kept with what could not be checked.
export function checkRequirements(listing: Listing, requirements: WatchRequirements | undefined, today: string): { ok: boolean; reasons: string[]; unchecked: string[] } {
  const req = requirements ?? {};
  const reasons: string[] = [];
  const unchecked: string[] = [];
  if (req.districts?.length) {
    if (!listing.district) unchecked.push("district not stated");
    else if (!req.districts.some((name) => listing.district!.toLowerCase().includes(name.toLowerCase()))) reasons.push(`in ${listing.district}, not ${req.districts.join(" or ")}`);
  }
  if (req.moveBy) {
    const day = availableDay(listing.availableFrom, today);
    if (!day) unchecked.push("move-in date not stated");
    else if (day > req.moveBy) reasons.push(`free from ${day}, after ${req.moveBy}`);
  }
  if (typeof req.maxDepositEur === "number") {
    if (typeof listing.depositEur !== "number") unchecked.push("deposit not stated");
    else if (listing.depositEur > req.maxDepositEur) reasons.push(`deposit €${Math.round(listing.depositEur)} is over €${req.maxDepositEur}`);
  }
  if (typeof req.minAreaM2 === "number") {
    if (typeof listing.areaM2 !== "number") unchecked.push("floor area not stated");
    else if (listing.areaM2 < req.minAreaM2) reasons.push(`${listing.areaM2} m² is under ${req.minAreaM2} m²`);
  }
  if (typeof req.maxCommuteMinutes === "number") unchecked.push("commute time not measured");
  return { ok: reasons.length === 0, reasons, unchecked };
}
