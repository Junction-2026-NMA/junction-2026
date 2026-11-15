"use client";
// Today answers "What needs my attention today?" at a glance: the money overview (estimated weekly budget until
// payday, balance, payday, data date), one primary insight or action with one tap into Sisu, the three spending
// baskets as buttons (amounts only once tapped), and the newest transactions with "See all".
// The sheets: Show the maths (MathsSheet, where payday can be changed and a bill added), the buffer, one basket,
// and Settings.
import { useEffect, useRef, useState } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { LoadState } from "@/web/app/AppTypes";
import { TodayFocus } from "@/web/core/AppLogic/AppPresenters";
import { WeeklyBudget } from "@/web/core/AppLogic/WeeklyBudget";
import type { CashFlow } from "@/web/core/CoachModels";
import type { BasketId, Overview } from "@/web/core/Models";
import { DataFreshness } from "@/web/shared/DataFreshness";
import { Screen } from "@/web/shared/Screen";
import { MathsSheet } from "@/web/features/Sheets/MathsSheet";
import { SettingsSheet } from "@/web/features/Sheets/SettingsSheet";
import { BasketButtons } from "./BasketButtons";
import { BasketSheet } from "./BasketSheet";
import { BufferSheet } from "./BufferSheet";
import { MoneyOverview } from "./MoneyOverview";
import { PrimaryInsight } from "./PrimaryInsight";
import { RecentTransactions } from "./RecentTransactions";
import { ErrorState, LoadingState } from "./States";
import { TodayHeader } from "./TodayHeader";
import { useCashFlow } from "./todayData";
import { applyTodayLaunch } from "./todayScroll";
import "./today.css";

export default function TodayScreen() {
  const model = useAppModel();
  const overviewState = useAppSelector((s) => s.overviewState, LoadState.equals);
  const overview = useAppSelector((s) => s.overview);
  const todaySheet = useAppSelector((s) => s.todaySheet);
  const bufferEur = useAppSelector((s) => s.prefs.bufferEur);
  const cashFlow = useCashFlow();
  const [bufferOpen, setBufferOpen] = useState(false);

  useEffect(() => {
    if (overviewState.kind === "loaded") DataFreshness.overviewLoaded(overview);
  }, [overviewState, overview]);

  const flow = cashFlow.kind === "loaded" ? cashFlow.value : null;
  const budget = cashFlow.kind === "loading" || !overview ? null
    : WeeklyBudget.compute(WeeklyBudget.inputs(overview, flow, bufferEur));
  const openBuffer = () => setBufferOpen(true);

  return (
    <>
      <Screen header={<TodayHeader />} className="sisu-today-screen" testId="screen.today">
        {overviewState.kind === "failed" ? (
          <ErrorState message={overviewState.message} retry={() => void model.retry()} />
        ) : overviewState.kind === "loaded" ? (
          overview ? <TodayContent overview={overview} budget={budget} cashFlow={flow} onBuffer={openBuffer} /> : null
        ) : (
          <LoadingState />
        )}
      </Screen>
      <MathsSheet open={todaySheet === "maths"} overview={overview} budget={budget} cashFlow={flow}
        cashFlowAssumptions={flow?.assumptions ?? []} onBuffer={openBuffer} onClose={() => model.setTodaySheet(null)} />
      <BufferSheet open={bufferOpen} onClose={() => setBufferOpen(false)} defaultEur={WeeklyBudget.defaultBuffer(flow)} />
      <SettingsSheet open={todaySheet === "settings"} onClose={() => model.setTodaySheet(null)} />
    </>
  );
}

function TodayContent({ overview, budget, cashFlow, onBuffer }: {
  overview: Overview;
  /** Null while the cash flow loads. */
  budget: WeeklyBudget.Result | null;
  cashFlow: CashFlow | null;
  onBuffer: () => void;
}) {
  const model = useAppModel();
  const confirmedName = useAppSelector((s) => (s.flaggedBill ? model.confirmedName(s.flaggedBill) : null));
  const [basket, setBasket] = useState<BasketId | null>(null);
  const stack = useRef<HTMLDivElement>(null);

  // The screenshot harness's launch options: scroll to a section or open a sheet. Once, when the content appears.
  useEffect(() => {
    const timer = window.setTimeout(() => applyTodayLaunch(model, stack.current, { basket: setBasket, buffer: onBuffer }), 400);
    return () => window.clearTimeout(timer);
    // Once, when the content first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Until the cash flow has answered, the payday checks are not known: wait rather than show a lesser insight first.
  const focus = budget === null ? null : TodayFocus.primary(overview, budget, cashFlow, confirmedName);

  return (
    <div ref={stack} className="sisu-screen-stack sisu-today-stack">
      <div data-scroll-id="overview">
        <MoneyOverview overview={overview} budget={budget} basis={cashFlow?.basis} onMaths={() => model.setTodaySheet("maths")} onBuffer={onBuffer} />
      </div>
      {focus ? (
        <div data-scroll-id="focus" className="sisu-today-enter">
          <PrimaryInsight focus={focus} />
        </div>
      ) : null}
      <div data-scroll-id="baskets">
        <BasketButtons overview={overview} onOpen={setBasket} />
      </div>
      <div data-scroll-id="recent">
        <RecentTransactions overview={overview} />
      </div>
      <BasketSheet basketId={basket} overview={overview} onClose={() => setBasket(null)} />
    </div>
  );
}
