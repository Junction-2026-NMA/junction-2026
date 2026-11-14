"use client";
// Today: a fixed header, then the safe-to-spend hero, today's three small actions, the baskets, the flagged
// bill, what Sisu noticed, the cash-flow chart, how it was calculated, and one primary button.
// Port of ios/Sisu/Features/Today/TodayScreen.swift. The sections are in this folder (TodaySections.swift).
import { useEffect, useRef } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { LoadState } from "@/web/app/AppTypes";
import type { Overview } from "@/web/core/Models";
import { useReducedMotion } from "@/web/theme/motion";
import { DataFreshness } from "@/web/shared/DataFreshness";
import { Screen } from "@/web/shared/Screen";
import { SisuButton } from "@/web/shared/SisuStyle";
import { FirstInsightCallout } from "@/web/features/Onboarding/FirstInsightCallout";
import { MathsSheet } from "@/web/features/Sheets/MathsSheet";
import { SettingsSheet } from "@/web/features/Sheets/SettingsSheet";
import { BasketsSection } from "./BasketsSection";
import { BillCard } from "./BillCard";
import { CashflowSection } from "./CashflowSection";
import { DailyActionsCard } from "./DailyActionsCard";
import { HeroBlock } from "./HeroBlock";
import { InsightsSection } from "./InsightsSection";
import { ErrorState, LoadingState } from "./States";
import { TodayHeader } from "./TodayHeader";
import { applyTodayLaunch, scrollToSection } from "./todayScroll";
import "./today.css";

export default function TodayScreen() {
  const model = useAppModel();
  const overviewState = useAppSelector((s) => s.overviewState, LoadState.equals);
  const overview = useAppSelector((s) => s.overview);
  const todaySheet = useAppSelector((s) => s.todaySheet);

  useEffect(() => {
    if (overviewState.kind === "loaded") DataFreshness.overviewLoaded(overview);
  }, [overviewState, overview]);

  return (
    <>
      <Screen header={<TodayHeader />} testId="screen.today">
        {overviewState.kind === "failed" ? (
          <ErrorState message={overviewState.message} retry={() => void model.retry()} />
        ) : overviewState.kind === "loaded" ? (
          overview ? <TodayContent overview={overview} /> : null
        ) : (
          <LoadingState />
        )}
      </Screen>
      <MathsSheet open={todaySheet === "maths" && overview !== null} overview={overview}
        onClose={() => model.setTodaySheet(null)} />
      <SettingsSheet open={todaySheet === "settings"} onClose={() => model.setTodaySheet(null)} />
    </>
  );
}

function TodayContent({ overview }: { overview: Overview }) {
  const model = useAppModel();
  const reduceMotion = useReducedMotion();
  const flaggedBill = useAppSelector((s) => s.flaggedBill);
  const stack = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const later = (ms: number, run: () => void) => {
    timers.current = [...timers.current, window.setTimeout(run, ms)];
  };
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  // The screenshot harness's launch options: scroll to a section or open a sheet.
  useEffect(() => {
    later(400, () => applyTodayLaunch(model, stack.current));
    // Once, when the content first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showBill = () => scrollToSection(stack.current, "bill", "top", false);
  const billDone = () => later(350, () => scrollToSection(stack.current, "bill", "top", !reduceMotion));

  return (
    <div ref={stack} className="sisu-screen-stack sisu-today-stack">
      <FirstInsightCallout />
      <HeroBlock overview={overview} />
      <div className="sisu-today-gap-after">
        <DailyActionsCard showBill={showBill} />
      </div>
      <div data-scroll-id="baskets" className="sisu-today-gap-after">
        <BasketsSection overview={overview} />
      </div>
      {flaggedBill ? (
        <div data-scroll-id="bill" className="sisu-today-gap-after">
          <BillCard key={flaggedBill.id} bill={flaggedBill} onDone={billDone} />
        </div>
      ) : null}
      <div data-scroll-id="insights" className="sisu-today-gap-after sisu-today-optional">
        <InsightsSection overview={overview} />
      </div>
      <div data-scroll-id="cashflow">
        <CashflowSection overview={overview} />
      </div>
      <div data-scroll-id="end" className="sisu-today-end">
        <SisuButton label="Look into my finances" action={() => model.startInvestigation()} />
      </div>
    </div>
  );
}
