// The requirements editor of a project, without React: which fields it offers, what each accepts, and the PATCH
// body of an edit (only the fields that changed). The names and limits are those of `PATCH /api/watch/:id`
// (app/api/watch/[id]/route.ts, lib/watch/project.ts `updateWatch`, lib/watch/requirements.ts `cleanRequirements`),
// so a value the server would refuse is refused here, next to its field, before anything is sent.
import { Money } from "@/web/core/Presentation";
import type { PropertyWatch, WatchRequirements } from "@/web/core/WatchModels";

export type FieldKind = "euros" | "rooms" | "minutes" | "area" | "date" | "places" | "place" | "goal";

export interface RequirementField {
  key: string;
  label: string;
  kind: FieldKind;
  /** The value as saved, as text ("" when not set). */
  initial: string;
  /** A short help line under the field, or null. */
  hint: string | null;
  /** True for the price limit: it cannot be left empty. */
  required: boolean;
}

/** lib/finance/rent.ts RENT_BUDGET_LIMITS and lib/watch/project.ts ONE_OFF_LIMITS. */
export const BUDGET_LIMITS = { rent: [200, 10_000], price: [5, 100_000] } as const;
/** lib/watch/requirements.ts: money figures 0 to 100,000, rooms 1 to 6, a commute of 5 to 180 minutes, 6 districts. */
const MONEY_MAX = 100_000;
const MAX_DISTRICTS = 6;
const money = (eur: number) => Money.format(eur, "en");

const asText = (value: unknown): string =>
  typeof value === "number" && Number.isFinite(value) ? String(value)
    : typeof value === "string" ? value
      : Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").join(", ") : "";

/** Every field the server can change for this kind of project, filled with what is saved. */
export function requirementFields(watch: Pick<PropertyWatch, "budgetEur" | "minRooms" | "goal" | "requirements">, rent: boolean): RequirementField[] {
  const req = watch.requirements ?? {};
  const field = (key: string, label: string, kind: FieldKind, initial: unknown, hint: string | null = null): RequirementField =>
    ({ key, label, kind, initial: asText(initial), hint, required: false });
  const [low, high] = rent ? BUDGET_LIMITS.rent : BUDGET_LIMITS.price;
  const budget: RequirementField = { ...field("budgetEur", rent ? "Rent at most (€ a month)" : "Price at most (€)", "euros", watch.budgetEur,
    `Between ${money(low)} and ${money(high)}.`), required: true };
  const goal = field("goal", "The goal, in your words", "goal", watch.goal, "Shown as the project's title. Leave empty for the default.");
  if (!rent) return [budget, goal];
  return [
    budget,
    field("minRooms", "Rooms at least", "rooms", watch.minRooms, "1 to 6. Leave empty for any."),
    field("minAreaM2", "Size at least (m²)", "area", req.minAreaM2, "5 to 500 m². A listing that does not state its size needs checking."),
    field("savingsGoalEurPerMonth", "Keep saving each month (€)", "euros", req.savingsGoalEurPerMonth, "A home that leaves less than this a month is excluded."),
    field("moveBy", "Move in by", "date", req.moveBy),
    field("districts", "Districts", "places", req.districts, "Separate names with commas. Leave empty for anywhere in the city."),
    field("maxDepositEur", "Deposit at most (€)", "euros", req.maxDepositEur),
    field("movingCostEur", "Moving costs, your estimate (€)", "euros", req.movingCostEur),
    field("bufferToKeepEur", "Keep in the account after moving (€)", "euros", req.bufferToKeepEur),
    field("savingsGoalEur", "Savings goal (€)", "euros", req.savingsGoalEur),
    field("maxCommuteMinutes", "Commute at most (minutes)", "minutes", req.maxCommuteMinutes, "Sisu cannot measure commutes: it lists this for you to check."),
    field("commuteTo", "Commute to", "place", req.commuteTo, "A public place, like a campus or a district."),
    goal,
  ];
}

/** "1 100", "1100", "1100,50" and "€1100" read as numbers; anything else is null. */
export function readNumber(text: string): number | null {
  const plain = text.replace(/[\s €]/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(plain) ? Number(plain) : null;
}

const places = (text: string): string[] => text.split(",").map((name) => name.trim()).filter((name) => name !== "");

/** What is wrong with a field's text, as a sentence, or null when the server would accept it. */
export function fieldError(field: RequirementField, text: string, rent: boolean): string | null {
  const value = text.trim();
  if (value === "") return field.required ? (rent ? "Enter the most you would pay a month." : "Enter the most you would pay.") : null;
  switch (field.kind) {
    case "euros": {
      const eur = readNumber(value);
      if (field.required) {
        const [low, high] = rent ? BUDGET_LIMITS.rent : BUDGET_LIMITS.price;
        return eur !== null && eur >= low && eur <= high ? null : `Enter an amount between ${money(low)} and ${money(high)}.`;
      }
      return eur !== null && eur <= MONEY_MAX ? null : `Enter an amount in euros, up to ${money(MONEY_MAX)}.`;
    }
    case "rooms": {
      const rooms = readNumber(value);
      return rooms !== null && Number.isInteger(rooms) && rooms >= 1 && rooms <= 6 ? null : "Enter a whole number from 1 to 6.";
    }
    case "minutes": {
      const minutes = readNumber(value);
      return minutes !== null && minutes >= 5 && minutes <= 180 ? null : "Enter 5 to 180 minutes.";
    }
    case "area": {
      const area = readNumber(value);
      return area !== null && area >= 5 && area <= 500 ? null : "Enter 5 to 500 m².";
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? null : "Enter a date like 2027-01-31.";
    case "places": {
      const names = places(value);
      if (names.length > MAX_DISTRICTS) return `Name at most ${MAX_DISTRICTS} districts.`;
      return names.every((name) => name.length <= 40 && /^[\p{L} .'-]+$/u.test(name)) ? null : "Use district names only (letters, spaces, hyphens).";
    }
    case "place":
      return value.length <= 60 && /^[\p{L}0-9 .,'-]+$/u.test(value) ? null : "Use a place name only (letters, numbers, spaces).";
    case "goal":
      return value.length >= 3 && value.length <= 160 ? null : "Write the goal in 3 to 160 characters.";
  }
}

/** The text of each field now: the draft when typed, else the saved value. */
const current = (field: RequirementField, draft: Readonly<Record<string, string>>) => draft[field.key] ?? field.initial;
const changed = (field: RequirementField, draft: Readonly<Record<string, string>>) => current(field, draft).trim() !== field.initial.trim();

/** The errors of the fields that changed (unchanged ones are not sent, so they are not checked). */
export function formErrors(fields: readonly RequirementField[], draft: Readonly<Record<string, string>>, rent: boolean): Record<string, string> {
  return Object.fromEntries(fields.flatMap((field) => {
    if (!changed(field, draft)) return [];
    const error = fieldError(field, current(field, draft), rent);
    return error ? [[field.key, error]] : [];
  }));
}

/** The changed fields as the PATCH body's values: a cleared field is null (the server clears it), districts a list. */
export function requirementPatch(fields: readonly RequirementField[], draft: Readonly<Record<string, string>>): WatchRequirements {
  return Object.fromEntries(fields.filter((field) => changed(field, draft)).map((field): [string, unknown] => {
    const text = current(field, draft).trim();
    if (field.kind === "places") return [field.key, places(text)];
    if (text === "") return [field.key, null];
    if (field.kind === "euros" || field.kind === "rooms" || field.kind === "minutes" || field.kind === "area") return [field.key, readNumber(text)];
    return [field.key, text];
  }));
}
