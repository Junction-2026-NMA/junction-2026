"use client";
// v2 payday: under a payday answer (get_cash_flow) Jack can change payday or add a bill; the figure is worked out
// again by the backend (GET /api/coach/cash-flow with the overrides, the same as Today) and shown as the updated
// estimated budget. The overrides are kept for this customer and go with later questions. Under a payday answer or
// a category cut there is also the Path lesson that shows how the figure is worked out, opened directly.
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { usePaydayOverrides } from "@/web/app/PaydayStore";
import { PaydayBudget } from "@/web/core/AppLogic/PaydayBudget";
import { WeeklyBudget, WeeklyBudgetText } from "@/web/core/AppLogic/WeeklyBudget";
import type { CoachMessage } from "@/web/core/CoachSession";
import { Money } from "@/web/core/Presentation";
import { PaydayEditor } from "@/web/features/Today/PaydayEditor";
import { useCashFlow } from "@/web/features/Today/todayData";
import { Disclosure } from "./Disclosure";
import "./payday-answer.css";

export const lessonLabel = "Lesson: how your payday budget is worked out";

/** True for a finished answer that worked out the budget until payday, or a category cut. */
export function paydayAnswerKind(message: CoachMessage): "cash-flow" | "cut" | null {
  if (message.pending || message.role !== "assistant") return null;
  const names = message.tools.filter((tool) => tool.ok).map((tool) => tool.name);
  if (names.includes("get_cash_flow")) return "cash-flow";
  return names.includes("run_scenario") && /categoryCutPct/.test(JSON.stringify(message.tools.map((tool) => tool.args))) ? "cut" : null;
}

export function PaydayAnswerPanel({ message }: { message: CoachMessage }) {
  const model = useAppModel();
  const kind = paydayAnswerKind(message);
  if (kind === null) return null;
  return (
    <div className="sisu-payday-answer" data-testid="answer.payday">
      {kind === "cash-flow" ? <PaydayUpdate /> : null}
      <button type="button" className="sisu-payday-answer-lesson" onClick={() => model.openLesson("safe-to-spend")} data-testid="answer.payday.lesson">
        {lessonLabel}
      </button>
    </div>
  );
}

function PaydayUpdate() {
  const customerId = useAppSelector((s) => s.customer?.customerId ?? null);
  const overview = useAppSelector((s) => s.overview);
  const bufferEur = useAppSelector((s) => s.prefs.bufferEur);
  const overrides = usePaydayOverrides(customerId);
  const remote = useCashFlow();
  if (!customerId || !overview) return null;
  const flow = remote.kind === "loaded" ? remote.value : null;
  const result = flow ? WeeklyBudget.compute(WeeklyBudget.inputs(overview, flow, bufferEur)) : null;
  const ready = result?.kind === "ready" ? result : null;
  const updated = ready && !PaydayBudget.isEmpty(overrides)
    ? `Updated: ${WeeklyBudgetText.budgetTitle} ${Money.format(Math.max(ready.leftEur, 0), "en", true)} ${WeeklyBudgetText.period(ready, flow?.basis)} (about ${Money.format(ready.weeklyEur, "en", true)} a week).`
    : null;
  return (
    <>
      {updated ? <p className="sisu-payday-answer-updated" role="status" data-testid="answer.payday.updated">{updated}</p> : null}
      <Disclosure label="Change payday or add a bill" testId="payday-edit">
        <PaydayEditor customerId={customerId} dataDate={overview.dataTimestamp} nextPayday={ready?.nextPayday ?? flow?.nextPayday ?? null} testPrefix="answer" />
      </Disclosure>
    </>
  );
}
