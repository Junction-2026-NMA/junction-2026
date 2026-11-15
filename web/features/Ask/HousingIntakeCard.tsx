"use client";
// v2 housing: the intake card of a housing question. Rent or buy (rent by default; buy asks Sisu the mortgage
// question instead), city, size, commute, move date, savings goal and the rent Sisu suggests from the person's own
// figures (worked out on the server, again whenever the goal changes). The person confirms or edits the rent; only
// then does Search run (POST /api/housing/search, through CoachSession.housingSearch).
import { useEffect, useRef, useState } from "react";
import { useCoach, useCoachSession } from "@/web/app/AppProvider";
import { type HousingBudget, type HousingCriteria, type HousingIntake, type HousingSearchRequest, HousingText } from "@/web/core/HousingModels";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import "@/web/features/Projects/projects.css";
import "./housing.css";

type Draft = { tenure: "rent" | "buy"; city: string; minAreaM2: string; minRooms: string; commuteTo: string; maxCommuteMinutes: string; moveBy: string; savings: string; budget: string; moving: string };

const num = (text: string): number | null => {
  const plain = text.replace(/[\s€]/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(plain) ? Number(plain) : null;
};
const text = (value: number | null | undefined): string => (typeof value === "number" ? String(value) : "");

function draftOf(intake: HousingIntake, previous: HousingCriteria | null): Draft {
  const req = previous?.requirements ?? {};
  return {
    tenure: intake.tenure,
    city: previous?.city ?? intake.city ?? "",
    minAreaM2: text((req.minAreaM2 as number | undefined) ?? intake.minAreaM2),
    minRooms: text(previous?.minRooms ?? intake.minRooms),
    commuteTo: (req.commuteTo as string | undefined) ?? intake.commuteTo ?? "",
    maxCommuteMinutes: text((req.maxCommuteMinutes as number | undefined) ?? intake.maxCommuteMinutes),
    moveBy: (req.moveBy as string | undefined) ?? intake.moveBy ?? "",
    savings: text((req.savingsGoalEurPerMonth as number | undefined) ?? intake.savingsGoalEurPerMonth),
    budget: text(previous?.budgetEur ?? intake.budget.maxRentEur),
    moving: text(req.movingCostEur as number | undefined),
  };
}

/** What is wrong with the draft, field by field ("" key: the form as a whole). */
function errorsOf(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[\p{L}][\p{L} -]{1,39}$/u.test(draft.city.trim())) errors.city = "Enter a city, like Espoo.";
  const budget = num(draft.budget);
  if (budget === null || budget < 200 || budget > 10_000) errors.budget = "Enter a rent between €200 and €10,000 a month.";
  const area = draft.minAreaM2.trim() ? num(draft.minAreaM2) : 0;
  if (area === null || (area !== 0 && (area < 5 || area > 500))) errors.minAreaM2 = "Enter 5 to 500 m², or leave it empty.";
  const rooms = draft.minRooms.trim() ? num(draft.minRooms) : 1;
  if (rooms === null || !Number.isInteger(rooms) || rooms < 1 || rooms > 6) errors.minRooms = "Enter 1 to 6, or leave it empty.";
  const minutes = draft.maxCommuteMinutes.trim() ? num(draft.maxCommuteMinutes) : 5;
  if (minutes === null || minutes < 5 || minutes > 180) errors.maxCommuteMinutes = "Enter 5 to 180 minutes, or leave it empty.";
  if (draft.commuteTo.trim() && !/^[\p{L}0-9 .,'-]{2,60}$/u.test(draft.commuteTo.trim())) errors.commuteTo = "Use a place name only.";
  if (draft.moveBy && !/^\d{4}-\d{2}-\d{2}$/.test(draft.moveBy)) errors.moveBy = "Pick a date.";
  const savings = num(draft.savings);
  if (savings === null || savings > 10_000) errors.savings = "Enter what you want to save a month (0 or more).";
  if (draft.moving.trim() && num(draft.moving) === null) errors.moving = "Enter an amount in euros, or leave it empty.";
  return errors;
}

function requestOf(draft: Draft, customerId: string, suggested: number | null, question: string, conversationId: string): { request: HousingSearchRequest; summary: string } {
  const budget = Math.round(num(draft.budget) ?? 0);
  const area = draft.minAreaM2.trim() ? num(draft.minAreaM2) : null;
  const minutes = draft.maxCommuteMinutes.trim() ? num(draft.maxCommuteMinutes) : null;
  const savings = num(draft.savings) ?? 0;
  const moving = draft.moving.trim() ? num(draft.moving) : null;
  const requirements: Record<string, number | string | null> = {
    savingsGoalEurPerMonth: savings,
    ...(area !== null ? { minAreaM2: area } : {}),
    ...(draft.commuteTo.trim() ? { commuteTo: draft.commuteTo.trim() } : {}),
    ...(minutes !== null ? { maxCommuteMinutes: minutes } : {}),
    ...(draft.moveBy ? { moveBy: draft.moveBy } : {}),
    ...(moving !== null ? { movingCostEur: moving } : {}),
  };
  const city = draft.city.trim();
  const summary = [
    `Rent in ${city}, up to ${HousingText.eur(budget)} a month`,
    area !== null ? `${area} m² or more` : null,
    draft.minRooms.trim() ? `${draft.minRooms.trim()}+ rooms` : null,
    draft.commuteTo.trim() ? `commute to ${draft.commuteTo.trim()}${minutes !== null ? ` within ${minutes} min` : ""}` : null,
    draft.moveBy ? `move by ${draft.moveBy}` : null,
    `keep saving ${HousingText.eur(savings)} a month`,
  ].filter(Boolean).join(", ");
  return {
    request: { customerId, city, budgetEur: budget, budgetFrom: suggested !== null && budget === suggested ? "sisu-suggested" : "customer", minRooms: draft.minRooms.trim() ? Number(draft.minRooms) : null, requirements, question, conversationId },
    summary: `${summary}.`,
  };
}

export function HousingIntakeCard({ intake, previous = null, onDone }: { intake: HousingIntake; previous?: HousingCriteria | null; onDone?: () => void }) {
  const session = useCoachSession();
  const coach = useCoach();
  const [draft, setDraft] = useState<Draft>(() => draftOf(intake, previous));
  const [budget, setBudget] = useState<HousingBudget>(intake.budget);
  const [touchedBudget, setTouchedBudget] = useState(previous !== null);
  const [busy, setBusy] = useState(false);
  const asked = useRef(String(intake.savingsGoalEurPerMonth));
  const errors = errorsOf(draft);
  const invalid = Object.keys(errors).length > 0;
  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  // A new savings goal: the server works the suggested rent out again; an untouched budget follows it.
  useEffect(() => {
    const savings = num(draft.savings);
    if (!session || savings === null || savings > 10_000 || draft.savings === asked.current) return;
    const timer = setTimeout(() => {
      asked.current = draft.savings;
      void session.housingBudget(savings).then((next) => {
        if (!next) return;
        setBudget(next);
        if (!touchedBudget) setDraft((d) => ({ ...d, budget: text(next.maxRentEur) }));
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft.savings, session, touchedBudget]);

  const submit = async () => {
    if (!session || busy) return;
    if (draft.tenure === "buy") {
      void session.ask(`Could I afford to buy a home in ${draft.city.trim() || "my city"}? Check my mortgage readiness.`);
      onDone?.();
      return;
    }
    if (invalid) return;
    setBusy(true);
    const { request, summary } = requestOf(draft, session.customerId, budget.maxRentEur, intake.question, coach.conversationId);
    onDone?.();
    await session.housingSearch(request, summary);
    setBusy(false);
  };

  return (
    <SisuCard className="sisu-project-enter">
      <form className="sisu-housing-card" noValidate data-testid="housing.intake" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <h2 className="sisu-project-h2">{previous ? "Adjust the search" : "A few details before I search"}</h2>
        <div className="sisu-housing-toggle" role="group" aria-label="Rent or buy">
          <button type="button" className="sisu-housing-option" aria-pressed={draft.tenure === "rent"} onClick={() => set("tenure")("rent")}>Rent</button>
          <button type="button" className="sisu-housing-option" aria-pressed={draft.tenure === "buy"} onClick={() => set("tenure")("buy")}>Buy</button>
        </div>
        {draft.tenure === "buy" ? (
          <p className="sisu-project-muted">Buying is a mortgage question. Sisu will check what your bank data says about a mortgage instead of searching for rentals.</p>
        ) : (
          <>
            <div className="sisu-housing-grid">
              <Field id="city" label="City" value={draft.city} error={errors.city} onChange={set("city")} wide />
              <Field id="area" label="Size at least (m²)" value={draft.minAreaM2} error={errors.minAreaM2} onChange={set("minAreaM2")} numeric />
              <Field id="rooms" label="Rooms at least" value={draft.minRooms} error={errors.minRooms} onChange={set("minRooms")} numeric />
              <Field id="commuteTo" label="Commute to" value={draft.commuteTo} error={errors.commuteTo} onChange={set("commuteTo")} wide hint="For example Aalto University, Otaniemi." />
              <Field id="minutes" label="Commute at most (min)" value={draft.maxCommuteMinutes} error={errors.maxCommuteMinutes} onChange={set("maxCommuteMinutes")} numeric />
              <Field id="moveBy" label="Move by" value={draft.moveBy} error={errors.moveBy} onChange={set("moveBy")} date />
              <Field id="savings" label="Keep saving (€ a month)" value={draft.savings} error={errors.savings} onChange={set("savings")} numeric />
              <Field id="moving" label="Moving cost (€, optional)" value={draft.moving} error={errors.moving} onChange={set("moving")} numeric />
            </div>
            <div className="sisu-housing-budget">
              <span className="sisu-project-label">Sisu suggests, from your own figures</span>
              <span className="sisu-project-h3">{budget.maxRentEur === null ? "No rent keeps your month balanced" : `Up to ${HousingText.eur(budget.maxRentEur)} a month`}</span>
              <span className="sisu-project-muted">{budget.reasoning}</span>
            </div>
            <Field id="budget" label="Rent at most (€ a month): confirm or change" value={draft.budget} error={errors.budget} numeric
              onChange={(value) => { setTouchedBudget(true); set("budget")(value); }} wide />
            <p className="sisu-project-muted">Only the city is sent to the web search. Your figures and requirements stay with Sisu.</p>
          </>
        )}
        <SisuButton label={draft.tenure === "buy" ? "Check a mortgage instead" : busy ? "Searching…" : "Search"} style="primary" enabled={!busy && (draft.tenure === "buy" || !invalid)} loading={busy} action={() => void submit()} />
        {invalid && draft.tenure === "rent" ? <p className="sisu-project-muted" role="status">Fix the field marked above to search.</p> : null}
      </form>
    </SisuCard>
  );
}

function Field({ id, label, value, error, onChange, numeric = false, date = false, wide = false, hint }: {
  id: string; label: string; value: string; error?: string; onChange: (value: string) => void; numeric?: boolean; date?: boolean; wide?: boolean; hint?: string;
}) {
  const inputId = `housing-${id}`;
  return (
    <div className={`sisu-project-field${wide ? " sisu-housing-wide" : ""}`}>
      <label className="sisu-project-label" htmlFor={inputId}>{label}</label>
      <input id={inputId} className="sisu-project-input" value={value} type={date ? "date" : "text"} inputMode={numeric ? "decimal" : undefined}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${inputId}-error` : undefined} autoComplete="off"
        onChange={(event) => onChange(event.target.value)} />
      {error ? <p className="sisu-project-field-error" id={`${inputId}-error`}>{error}</p> : hint ? <p className="sisu-project-muted">{hint}</p> : null}
    </div>
  );
}
