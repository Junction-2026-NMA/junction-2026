"use client";
// "Money in and out": the cash-flow chart and the "How Sisu calculated this" disclosure with the assumptions.
// Port of CashflowSection in TodaySections.swift.
import { useId, useState } from "react";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { Overview } from "@/web/core/Models";
import { useReducedMotion } from "@/web/theme/motion";
import { SectionTitle, SisuCard, SisuMotion } from "@/web/shared/SisuStyle";
import { CashflowChart } from "./CashflowChart";
import { Chevron } from "./Glyphs";
import "./today.css";
import "./cashflow.css";

export function CashflowSection({ overview }: { overview: Overview }) {
  const [showHow, setShowHow] = useState(false);
  const reduceMotion = useReducedMotion();
  const panel = useId();

  return (
    <section className="sisu-today-section">
      <SectionTitle title="Money in and out" detail="Each month, by basket. The line is money in." />
      <SisuCard>
        <CashflowChart overview={overview} />
        <div className="sisu-cashflow-disclosure">
          <button type="button" className="sisu-today-plain-button sisu-cashflow-disclosure-label"
            aria-expanded={showHow} aria-controls={panel} onClick={() => setShowHow((open) => !open)}>
            <span className="sisu-today-button-green">How Sisu calculated this</span>
            <span className={showHow ? "sisu-cashflow-disclosure-chevron sisu-cashflow-disclosure-chevron-open" : "sisu-cashflow-disclosure-chevron"}>
              <Chevron size={14} />
            </span>
          </button>
          {showHow ? (
            <div id={panel} className={`sisu-cashflow-disclosure-content ${SisuMotion.entrance(reduceMotion)}`}>
              {overview.assumptions.map((line, index) => <p key={index}>{line}</p>)}
              <p>{TodayPresenter.dataDate(overview)}</p>
            </div>
          ) : null}
        </div>
      </SisuCard>
    </section>
  );
}
