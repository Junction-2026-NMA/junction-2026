"use client";
// "Show the maths": the estimated budget until payday step by step (balance, each bill due before payday, the
// buffer, what is left, the weeks to payday), where payday can be changed and a bill added (v2 payday), the usual
// pace and what it leaves just before payday, one practical cut-back, and the assumptions behind it. Every figure
// comes from WeeklyBudget and the cash flow; nothing here is called "safe to spend".
import { useState } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { PaydayBudget } from "@/web/core/AppLogic/PaydayBudget";
import type { CashFlow } from "@/web/core/CoachModels";
import { Money } from "@/web/core/Presentation";
import { PaydayEditor } from "@/web/features/Today/PaydayEditor";
import { TodayFocus, TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { type BudgetLine, WeeklyBudget, WeeklyBudgetText } from "@/web/core/AppLogic/WeeklyBudget";
import type { Overview } from "@/web/core/Models";
import { SisuCard } from "@/web/shared/SisuStyle";
import { SheetFrame } from "./SheetFrame";
import "./sheets.css";
import "./maths.css";

export function MathsSheet({ open, overview, budget, cashFlow = null, cashFlowAssumptions, onBuffer, onClose }: {
  open: boolean;
  overview: Overview | null;
  budget: WeeklyBudget.Result | null;
  /** The cash flow the budget came from (its basis and cut-back), null when not loaded. */
  cashFlow?: CashFlow | null;
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
    <SheetFrame open={open && current !== null} onClose={onClose} title={WeeklyBudgetText.mathsTitle} testId="sheet.maths">
      {current ? (
        <MathsContent budget={current.budget} overview={current.overview} cashFlow={cashFlow} cashFlowAssumptions={cashFlowAssumptions}
          onBuffer={onBuffer} onClose={onClose} />
      ) : null}
    </SheetFrame>
  );
}

function MathsContent({ budget, overview, cashFlow, cashFlowAssumptions, onBuffer, onClose }: {
  budget: WeeklyBudget.Ready;
  overview: Overview;
  cashFlow: CashFlow | null;
  cashFlowAssumptions: readonly string[];
  onBuffer: () => void;
  onClose: () => void;
}) {
  const model = useAppModel();
  const customerId = useAppSelector((s) => s.customer?.customerId ?? null);
  const pace = WeeklyBudgetText.pace(budget);
  const cut = cashFlow?.cutBack ?? null;
  const adjustment = cut
    ? `Spend ${cut.cutPct}% less at ${cut.category.toLowerCase()} → about ${Money.format(cut.freesPerMonthEur, "en", true)} a month freed. ${cut.baselineText ?? ""}`.trim()
    : WeeklyBudgetText.adjustment(budget);
  const assumptions = [...PaydayBudget.assumptions(cashFlow?.basis, budget.bufferIsDefault), ...WeeklyBudgetText.assumptions, ...cashFlowAssumptions.slice(0, 1)];
  const headline = `${WeeklyBudgetText.budgetTitle}: ${Money.format(Math.max(budget.leftEur, 0), "en", true)} ${WeeklyBudgetText.period(budget, cashFlow?.basis)}.`;
  const ask = () => { onClose(); model.askSisu(TodayFocus.paydayQuestion); };

  return (
    <div className="sisu-sheet-content">
      <p className="sisu-sheet-button-text" data-testid="maths.headline">{headline}</p>
      <p className="sisu-sheet-text">What is left after the bills Sisu knows about and your buffer, spread over the weeks until payday.</p>
      <Lines lines={WeeklyBudgetText.lines(budget, overview.dataTimestamp)} />
      <button type="button" className="sisu-maths-link" onClick={onBuffer}>
        {budget.bufferIsDefault ? "Set your buffer" : "Change your buffer"}
      </button>
      {customerId ? (
        <>
          <h3 className="sisu-maths-heading">Change payday or add a bill</h3>
          <SisuCard>
            <PaydayEditor customerId={customerId} dataDate={overview.dataTimestamp} nextPayday={budget.nextPayday} testPrefix="maths" />
          </SisuCard>
        </>
      ) : null}
      {pace.length > 0 ? (
        <>
          <h3 className="sisu-maths-heading">At your usual pace</h3>
          <Lines lines={pace} />
        </>
      ) : null}
      {adjustment ? (
        <>
          <h3 className="sisu-maths-heading">{cut ? "One thing to cut back on" : "One adjustment"}</h3>
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
