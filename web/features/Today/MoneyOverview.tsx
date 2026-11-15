"use client";
// The top of Today: the estimated weekly budget until payday (never "safe to spend"), the balance and the days to
// payday, the buffer it keeps aside, and "How this is worked out". When an input is missing it says which one
// instead of showing a guessed figure. Every number comes from WeeklyBudget (web/core/AppLogic/WeeklyBudget.ts).
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { WeeklyBudget, WeeklyBudgetText } from "@/web/core/AppLogic/WeeklyBudget";
import type { Overview } from "@/web/core/Models";
import { Dates } from "@/web/core/Presentation";
import { SisuCard } from "@/web/shared/SisuStyle";
import { ProgressSpinner } from "./Glyphs";
import "./overview.css";

export function MoneyOverview({ overview, budget, onMaths, onBuffer }: {
  overview: Overview;
  /** Null while the cash flow is still loading. */
  budget: WeeklyBudget.Result | null;
  onMaths: () => void;
  onBuffer: () => void;
}) {
  const money = TodayPresenter.money;
  return (
    <SisuCard className="sisu-overview-card">
      <div data-testid="today.budget">
        <p className="sisu-overview-eyebrow">{WeeklyBudgetText.title}</p>
        {budget === null ? (
          <div className="sisu-overview-loading" role="status">
            <ProgressSpinner />
            <span>Checking the bills due before payday</span>
          </div>
        ) : budget.kind === "ready" ? (
          <Headline headline={WeeklyBudgetText.headline(budget)} />
        ) : (
          <p className="sisu-overview-missing" data-testid="today.budget.missing">{WeeklyBudgetText.missing(budget)}</p>
        )}
      </div>
      <div className="sisu-overview-facts">
        <Fact label="Balance" value={money(overview.balance)} />
        {budget?.kind === "ready" ? (
          <Fact label={WeeklyBudgetText.payday(budget)} value={Dates.short(budget.nextPayday, "en")} />
        ) : (
          <Fact label="Next payday" value={budget === null ? "…" : "Not known"} />
        )}
      </div>
      {budget?.kind === "ready" ? (
        <div className="sisu-overview-actions">
          <button type="button" className="sisu-overview-link" onClick={onMaths} data-testid="today.maths">
            How this is worked out
          </button>
          <button type="button" className="sisu-overview-chip" onClick={onBuffer} data-testid="today.buffer"
            aria-label={budget.bufferIsDefault ? "Set your buffer" : `${WeeklyBudgetText.buffer(budget)}. Change it`}>
            {budget.bufferIsDefault ? "Set your buffer" : `Buffer ${money(budget.bufferEur)}`}
          </button>
        </div>
      ) : null}
      <p className="sisu-overview-date">{TodayPresenter.dataDate(overview)}</p>
    </SisuCard>
  );
}

/** The weekly figure, or "Bills before payday are covered" when that figure is far above the usual pace (it would
 *  be most of the balance). The full working stays in "How this is worked out". */
function Headline({ headline }: { headline: WeeklyBudgetText.Headline }) {
  if (headline.kind === "covered") {
    return (
      <>
        <p className="sisu-overview-covered" data-testid="today.budget.covered">{headline.title}</p>
        <p className="sisu-overview-basis">{headline.detail}</p>
      </>
    );
  }
  return (
    <>
      <p className="sisu-overview-figure">
        <span className="sisu-overview-amount" data-testid="today.budget.amount">{headline.amount}</span>
        <span className="sisu-overview-unit">{headline.unit}</span>
      </p>
      <p className="sisu-overview-basis">{headline.detail}</p>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="sisu-overview-fact">
      <span className="sisu-overview-fact-label">{label}</span>
      <span className="sisu-overview-fact-value">{value}</span>
    </div>
  );
}
