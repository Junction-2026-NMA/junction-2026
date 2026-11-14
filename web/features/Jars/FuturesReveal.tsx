"use client";
// What the futures question reveals: the chart with one row per future, the three sliders and the assumptions.
// Port of FuturesSection.reveal(_:) in ios/Sisu/Features/Jars/JarsScreen.swift.
import type { Branch, ScenarioResponse } from "@/web/core/Models";
import { roundAway } from "@/web/core/Presentation";
import { JarsPresenter } from "@/web/core/AppLogic/AppPresenters";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import { FuturesChart } from "./FuturesChart";
import { SliderRow } from "./SisuSlider";
import { branchColor } from "./chartScale";

export function FuturesReveal({ response, failed, onRetry, billSaving, onBillSaving, trim, onTrim, years, onYears }: {
  response: ScenarioResponse | null;
  failed: boolean;
  onRetry: () => void;
  billSaving: number;
  onBillSaving: (value: number) => void;
  trim: number;
  onTrim: (value: number) => void;
  years: number;
  onYears: (value: number) => void;
}) {
  return (
    <>
      <SisuCard>
        {response ? (
          <>
            <p className="sisu-jars-freed">{JarsPresenter.freedPerMonth(response)}</p>
            <FuturesChart branches={response.branches} />
            {response.branches.map((branch) => <BranchRow key={branch.id} branch={branch} />)}
          </>
        ) : failed ? (
          <>
            <p className="sisu-jars-failed">The futures could not be worked out.</p>
            <SisuButton label="Try again" style="secondary" action={onRetry} />
          </>
        ) : (
          <div className="sisu-jars-pending">
            <div className="sisu-jars-spinner" role="progressbar" aria-label="In progress" />
          </div>
        )}
      </SisuCard>
      <SisuCard>
        <SliderRow title="Saving from switching a bill" value={billSaving} onChange={onBillSaving} min={0} max={100} step={1}
          text={JarsPresenter.billSavingText(roundAway(billSaving))} />
        <SliderRow title="Trim everyday spending by" value={trim} onChange={onTrim} min={0} max={50} step={1}
          text={JarsPresenter.trimText(trim)} />
        <SliderRow title="Look ahead" value={years} onChange={onYears} min={1} max={10} step={1}
          text={JarsPresenter.yearsText(roundAway(years))} />
      </SisuCard>
      {response && response.assumptions.length > 0 ? (
        <div className="sisu-jars-assumptions">
          {response.assumptions.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
        </div>
      ) : null}
    </>
  );
}

/** One future: its colour, its name, and where it ends (with the invest future's range). Read as one element. */
function BranchRow({ branch }: { branch: Branch }) {
  return (
    <div className="sisu-jars-branch" role="text">
      <span className="sisu-jars-branch-dot" style={{ background: branchColor(branch.id) }} aria-hidden="true" />
      <span className="sisu-jars-branch-label">{branch.label}</span>
      <span className="sisu-jars-branch-figures">
        <span className="sisu-jars-branch-total">{JarsPresenter.endTotal(branch)}</span>
        {branch.id === "invest" ? <span className="sisu-jars-branch-range">{JarsPresenter.endRange(branch)}</span> : null}
      </span>
    </div>
  );
}
