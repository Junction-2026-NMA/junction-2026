"use client";
// "How safe to spend is worked out": each step of the safe-to-spend maths with its basis, then what is left
// and what is actually spent, and the data date. Port of MathsSheet in Sheets.swift.
import { useState } from "react";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { Overview } from "@/web/core/Models";
import { SisuCard } from "@/web/shared/SisuStyle";
import { SheetFrame } from "./SheetFrame";
import "./sheets.css";

export function MathsSheet({ open, overview, onClose }: { open: boolean; overview: Overview | null; onClose: () => void }) {
  // Keep the last overview while the sheet slides out.
  const [shown, setShown] = useState(overview);
  if (overview && overview !== shown) setShown(overview);
  const current = overview ?? shown;

  return (
    <SheetFrame open={open && current !== null} onClose={onClose} title="How safe to spend is worked out"
      testId="sheet.maths">
      {current ? (
        <div className="sisu-sheet-content">
          <SisuCard>
            {TodayPresenter.mathsLines(current).map((line, index) => (
              <div key={line.id} className="sisu-maths-item">
                {index > 0 ? <hr className={line.isResult ? "sisu-sheet-divider sisu-sheet-divider-strong" : "sisu-sheet-divider"} /> : null}
                <div className="sisu-maths-line" role="group" aria-label={`${line.label}, ${line.basis}, ${line.amount}`}>
                  <div className="sisu-maths-text">
                    <span className={line.isResult ? "sisu-sheet-button-text" : "sisu-sheet-text"}>{line.label}</span>
                    <span className="sisu-sheet-caption">{line.basis}</span>
                  </div>
                  <span className={line.isResult ? "sisu-sheet-h2" : "sisu-sheet-button-text"}>{line.amount}</span>
                </div>
              </div>
            ))}
          </SisuCard>
          <p className="sisu-sheet-caption">{TodayPresenter.dataDate(current)}</p>
        </div>
      ) : null}
    </SheetFrame>
  );
}
