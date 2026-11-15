// The ONE rule a housing Project is judged by: results, match counts, findings and notifications all use it, so a
// listing can never be a match in one place and an alternative in another. Rent limit, city, rooms, the stated
// requirements and (when the customer named an amount to keep saving) the separate "Savings goal" check.
import { savingsFigures } from "@/lib/finance/housing";
import type { Overview, PropertyWatch } from "@/lib/types";
import type { EvaluationRule } from "./evaluate";

export const dayOf = (now: Date): string => now.toISOString().slice(0, 10);

export function watchEvaluationRule(watch: Pick<PropertyWatch, "budgetEur" | "minRooms" | "city" | "requirements">, overview: Overview | null, now: Date = new Date()): EvaluationRule {
  return { budgetEur: watch.budgetEur, minRooms: watch.minRooms, city: watch.city, requirements: watch.requirements ?? null, today: dayOf(now), savings: overview ? savingsFigures(overview, watch.requirements) : null };
}
