"use client";
// "Your buffer": the euros the person wants to keep untouched before payday. Stored in AppPrefs.bufferEur through
// model.setPrefs; "Use the default" clears it, so the weekly budget goes back to the labelled default assumption.
import { useState } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { WeeklyBudget } from "@/web/core/AppLogic/WeeklyBudget";
import { SisuButton } from "@/web/shared/SisuStyle";
import { SheetFrame } from "@/web/features/Sheets/SheetFrame";
import "./buffer.css";

const presets = [50, 100, 200, 500] as const;
/** The largest buffer the field accepts. */
const maxBuffer = 100_000;

/** The typed text as whole euros, or null when it is not a number from 0 to `maxBuffer`. */
export function parseBuffer(text: string): number | null {
  const clean = text.replace(/[€\s ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Math.round(Number(clean));
  return Number.isFinite(value) && value >= 0 && value <= maxBuffer ? value : null;
}

/** `defaultEur`: the buffer assumed until one is set (`WeeklyBudget.defaultBuffer(cashFlow)`). */
export function BufferSheet({ open, onClose, defaultEur = WeeklyBudget.defaultBufferEur }: { open: boolean; onClose: () => void; defaultEur?: number }) {
  return (
    <SheetFrame open={open} onClose={onClose} title="Your buffer" detents={["medium", "large"]} testId="sheet.buffer">
      {open ? <BufferForm onClose={onClose} defaultEur={defaultEur} /> : null}
    </SheetFrame>
  );
}

function BufferForm({ onClose, defaultEur }: { onClose: () => void; defaultEur: number }) {
  const model = useAppModel();
  const current = useAppSelector((s) => s.prefs.bufferEur);
  const [text, setText] = useState(current === null ? "" : `${current}`);
  const value = parseBuffer(text);
  const invalid = text.trim() !== "" && value === null;

  const save = (amount: number | null) => {
    model.setPrefs({ bufferEur: amount });
    onClose();
  };

  return (
    <div className="sisu-buffer">
      <p className="sisu-buffer-text">
        How much do you want to keep untouched before payday? Sisu takes it off before estimating your weekly budget.
      </p>
      <p className="sisu-buffer-note">
        {current === null
          ? `Until you set one, Sisu assumes ${TodayPresenter.money(defaultEur)}.`
          : `Now: ${TodayPresenter.money(current)}, your setting.`}
      </p>
      <label className="sisu-buffer-field">
        <span className="sisu-buffer-label">Buffer in euros</span>
        <input className="sisu-buffer-input" inputMode="decimal" enterKeyHint="done" value={text} placeholder="e.g. 150"
          onChange={(event) => setText(event.target.value)} aria-invalid={invalid || undefined} data-testid="buffer.input"
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Without this the same key press would also click the button focus returns to ("Set your buffer").
            event.preventDefault();
            if (value !== null) save(value);
          }} />
      </label>
      {invalid ? <p className="sisu-buffer-error" role="alert">Type a whole amount in euros, for example 150.</p> : null}
      <div className="sisu-buffer-presets" role="group" aria-label="Quick amounts">
        {presets.map((amount) => (
          <button key={amount} type="button" className="sisu-buffer-preset" aria-pressed={value === amount}
            onClick={() => setText(`${amount}`)}>
            {TodayPresenter.money(amount)}
          </button>
        ))}
      </div>
      <SisuButton label="Save buffer" enabled={value !== null} action={() => { if (value !== null) save(value); }} />
      {current !== null ? (
        <button type="button" className="sisu-buffer-reset" onClick={() => save(null)}>
          Use the default ({TodayPresenter.money(defaultEur)})
        </button>
      ) : null}
    </div>
  );
}
