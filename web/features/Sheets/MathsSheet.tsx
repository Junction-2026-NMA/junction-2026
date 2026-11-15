"use client";
// "How this is worked out": the estimated weekly budget step by step (balance, each bill due before payday, the
// buffer, what is left, the weeks to payday), the usual pace and what it leaves just before payday, one realistic
// adjustment and its effect, and the assumptions behind it. Every figure comes from WeeklyBudget; nothing here is
// called "safe to spend".
import { useState } from "react";
import { useAppModel } from "@/web/app/AppProvider";
import { TodayFocus, TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { type BudgetLine, WeeklyBudget, WeeklyBudgetText } from "@/web/core/AppLogic/WeeklyBudget";
import type { Overview } from "@/web/core/Models";
import { SisuCard } from "@/web/shared/SisuStyle";
import { SheetFrame } from "./SheetFrame";
import "./sheets.css";
import "./maths.css";

export function MathsSheet({ open, overview, budget, cashFlowAssumptions, onBuffer, onClose }: {
  open: boolean;
  overview: Overview | null;
  budget: WeeklyBudget.Result | null;
  /** The cash flow's own assumptions (the payday day, the averages). */
  cashFlowAssumptions: readonly string[];
  onBuffer: () => void;
  onClose: () => void;
}) {
  // Keep the last figures while the sheet slides out.
  const ready = budget?.kind === "ready" && overview ? { budget, overview } : null;
  const [shown, setShown] = useState(ready);
  if (ready && (ready.budget !== shown?.budget || ready.overview !== shown?.overview)) setShown(ready);
  const current = ready ?? shown;

  return (
    <SheetFrame open={open && current !== null} onClose={onClose} title="How this is worked out" testId="sheet.maths">
      {current ? (
        <MathsContent budget={current.budget} overview={current.overview} cashFlowAssumptions={cashFlowAssumptions}
          onBuffer={onBuffer} onClose={onClose} />
      ) : null}
    </SheetFrame>
  );
}

function MathsContent({ budget, overview, cashFlowAssumptions, onBuffer, onClose }: {
  budget: WeeklyBudget.Ready;
  overview: Overview;
  cashFlowAssumptions: readonly string[];
  onBuffer: () => void;
  onClose: () => void;
}) {
  const model = useAppModel();
  const pace = WeeklyBudgetText.pace(budget);
  const adjustment = WeeklyBudgetText.adjustment(budget);
  const assumptions = [...WeeklyBudgetText.assumptions, ...cashFlowAssumptions.slice(0, 1)];
  const ask = () => { onClose(); model.askSisu(TodayFocus.paydayQuestion); };

  return (
    <div className="sisu-sheet-content">
      <p className="sisu-sheet-text">What is left after the bills Sisu knows about and your buffer, spread over the weeks until payday.</p>
      <Lines lines={WeeklyBudgetText.lines(budget, overview.dataTimestamp)} />
      <button type="button" className="sisu-maths-link" onClick={onBuffer}>
        {budget.bufferIsDefault ? "Set your buffer" : "Change your buffer"}
      </button>
      {pace.length > 0 ? (
        <>
          <h3 className="sisu-maths-heading">At your usual pace</h3>
          <Lines lines={pace} />
        </>
      ) : null}
      {adjustment ? (
        <>
          <h3 className="sisu-maths-heading">One adjustment</h3>
          <SisuCard>
            <p className="sisu-sheet-text" data-testid="maths.adjustment">{adjustment}</p>
            <button type="button" className="sisu-maths-link" onClick={ask}>Plan this week with Sisu</button>
          </SisuCard>
        </>
      ) : null}
      <h3 className="sisu-maths-heading">Assumptions</h3>
      <ul className="sisu-maths-assumptions">
        {assumptions.map((text) => <li key={text} className="sisu-sheet-caption">{text}</li>)}
      </ul>
      <p className="sisu-sheet-caption">{TodayPresenter.dataDate(overview)}</p>
    </div>
  );
}

function Lines({ lines }: { lines: readonly BudgetLine[] }) {
  return (
    <SisuCard>
      {lines.map((line, index) => (
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
  );
}
