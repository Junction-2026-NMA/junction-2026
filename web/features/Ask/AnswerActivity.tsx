"use client";
// The visible tool trace of one answer, drawn with beUI's AgentActivity (web/agents): while the answer is on its way,
// a shimmering line says what Sisu is doing (the server's filler, else "Sisu is thinking…") over one row per tool
// call, in order; once the answer is done it folds into "What Sisu did · 3 steps · Answered in 4.2 s", which opens
// the steps again. The rows come from SisuCore's StepPresenter while pending and from the answer view afterwards
// (AnswerView.steps: humanized, results that only repeat the card's numbers left out). This replaces StepsCard and
// the "What Sisu did" list that sat in the Details, so the trace is said once.
import { AgentActivity, type AgentActivityStep } from "@/web/agents/AgentActivity";
import type { AnswerView } from "@/web/core/AnswerPresentation";
import { StepPresenter, type StepRow } from "@/web/core/ChartPresentation";
import type { CoachMessage } from "@/web/core/CoachSession";

const language = "en";

const STATUS: Record<StepRow.State, { status: AgentActivityStep["status"]; label: string }> = {
  running: { status: "active", label: "Running" },
  done: { status: "complete", label: "Done" },
  failed: { status: "failed", label: "Did not finish" },
};

export function AnswerActivity({ message, view }: { message: CoachMessage; view: AnswerView }) {
  const rows = message.pending ? StepPresenter.rows(message, language) : view.steps;
  if (!message.pending && rows.length === 0) return null;
  const items: AgentActivityStep[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    status: STATUS[row.state].status,
    statusLabel: STATUS[row.state].label,
    detail: row.result ?? undefined,
    meta: row.duration ?? undefined,
  }));
  const count = `${rows.length} ${rows.length === 1 ? "step" : "steps"}`;
  const summary = [StepPresenter.heading(false, language), count, view.timing].filter(Boolean).join(" · ");
  return (
    <AgentActivity items={items} working={message.pending} activeLabel={message.filler ?? "Sisu is thinking…"} summary={summary}
      maxHeight={176} testId="ask.steps" />
  );
}
