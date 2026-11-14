"use client";
// "Your biggest bill after rent": the flagged bill, its figures, and confirming or changing its name in place.
// Port of BillCard in TodaySections.swift.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { billKey } from "@/web/app/AppState";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { RecurringBill } from "@/web/core/Models";
import { useReducedMotion } from "@/web/theme/motion";
import { SectionTitle, SisuButton, SisuCard, SisuMotion } from "@/web/shared/SisuStyle";
import { Chevron } from "./Glyphs";
import "./today.css";

export function BillCard({ bill, onDone = () => {} }: {
  bill: RecurringBill;
  /** Called after the name is confirmed or saved, so Today can bring the card back into view. */
  onDone?: () => void;
}) {
  const model = useAppModel();
  const reduceMotion = useReducedMotion();
  const confirmedName = useAppSelector((s) => (s.customer ? s.confirmedBillNames[billKey(s.customer.customerId, bill.id)] ?? null : null));
  const overview = useAppSelector((s) => s.overview);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const state = TodayPresenter.bill(bill, confirmedName);

  // `focused = true` once the field is on screen.
  useEffect(() => {
    if (editing) field.current?.focus({ preventScroll: true });
  }, [editing]);

  const save = () => {
    model.billConfirmed(bill, draft);
    setEditing(false);
    field.current?.blur();
    onDone();
  };

  const startEditing = (text: string) => {
    setDraft(text);
    setEditing(true);
  };

  const openEvidence = () => {
    if (!overview) return;
    model.showEvidence(`${bill.category} payments`, { from: overview.windowFrom, to: overview.windowTo, category: bill.category });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Same rule as the disabled "Save the name" button: an empty field confirms nothing.
    if (draft.trim() === "") return;
    save();
  };

  // The part that changes animates in with the state spring (or a fade with Reduce Motion), not on first show.
  const enter = SisuMotion.entrance(reduceMotion);
  const phase = editing ? "editing" : state.isConfirmed ? "confirmed" : "guess";
  const [firstPhase] = useState(phase);
  const [changed, setChanged] = useState(false);
  if (!changed && phase !== firstPhase) setChanged(true);

  return (
    <section className="sisu-today-section" data-testid="today.bill">
      <SectionTitle title="Your biggest bill after rent" />
      <SisuCard>
        <p className="sisu-today-h2">{state.headline}</p>
        <p className={state.isConfirmed ? "sisu-today-label-green" : "sisu-today-label-muted"}>{state.nameNote}</p>

        <button type="button" className="sisu-today-plain-button sisu-today-bill-figure" onClick={openEvidence}
          aria-label={`${state.monthly} ${state.monthlyUnit}. Show the payments`}>
          <span className="sisu-today-h1">{state.monthly}</span>
          <span className="sisu-today-body-muted sisu-today-grow">{state.monthlyUnit}</span>
          <span className="sisu-today-chevron-green"><Chevron size={14} /></span>
        </button>

        <div className="sisu-today-bill-facts">
          <span>{state.range}</span>
          <span>{state.confidence}</span>
          <span className="sisu-today-muted">{state.basis}</span>
        </div>

        <PhaseBox key={phase} enter={changed || phase !== firstPhase ? enter : null}>
          {editing ? (
            <>
              <form onSubmit={onSubmit} className="sisu-today-form">
                <input ref={field} className="sisu-input" type="text" value={draft} placeholder="What is this bill?"
                  enterKeyHint="done" autoComplete="off" aria-label="What is this bill?"
                  onChange={(event) => setDraft(event.target.value)} />
              </form>
              <SisuButton label="Save the name" style="secondary" enabled={draft !== ""}
                action={() => { if (draft !== "") save(); }} />
            </>
          ) : !state.isConfirmed ? (
            <>
              <SisuButton label="Yes, that's it" style="secondary" action={() => {
                model.billConfirmed(bill, bill.guessLabel);
                onDone();
              }} />
              <SisuButton label="No, change the name" style="quiet" action={() => startEditing(bill.guessLabel)} />
            </>
          ) : (
            <SisuButton label="Change the name" style="quiet" action={() => startEditing(state.headline)} />
          )}
        </PhaseBox>
      </SisuCard>
    </section>
  );
}

/** The buttons (or the field) for one phase of the card. Its entrance class is chosen once, when it appears. */
function PhaseBox({ enter, children }: { enter: string | null; children: ReactNode }) {
  const [className] = useState(enter ? `sisu-today-bill-actions ${enter}` : "sisu-today-bill-actions");
  return <div className={className}>{children}</div>;
}
