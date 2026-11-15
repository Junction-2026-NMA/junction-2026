// The intake card for a housing question: what the question already says, and a rent Sisu suggests from the
// customer's own figures. Built in code, the same for typed and spoken questions, in mock and live mode.
import type { HousingIntake, Overview } from "@/lib/types";
import { DEFAULT_SAVINGS_PER_MONTH, suggestedBudget } from "./budget";
import { housingHints } from "./intent";

export const INTAKE_TEXT = "Before I search: do you want to rent? I'll need a few details.";

export function buildIntake(overview: Overview, question: string, homeCity: string | null): HousingIntake {
  const hints = housingHints(question);
  return {
    question: question.slice(0, 500),
    tenure: hints.tenure ?? "rent",
    city: hints.city ?? homeCity,
    minRooms: hints.minRooms,
    minAreaM2: hints.minAreaM2,
    commuteTo: null,
    maxCommuteMinutes: null,
    moveBy: null,
    savingsGoalEurPerMonth: DEFAULT_SAVINGS_PER_MONTH,
    budget: suggestedBudget(overview, DEFAULT_SAVINGS_PER_MONTH),
  };
}
