"use client";
// "What Sisu is doing" while an answer is on its way, "What Sisu did" afterwards: one row per tool call, in order,
// from CoachMessage.steps through SisuCore's StepPresenter (ChartPresentation.swift). The iOS screen does not draw
// this list yet; the web port shows it because the session fills it and the visible tool trace is part of the demo.
import { StepPresenter, type StepRow } from "@/web/core/ChartPresentation";
import type { CoachMessage } from "@/web/core/CoachSession";

const language = "en";

export function StepsCard({ message }: { message: CoachMessage }) {
  const rows = StepPresenter.rows(message, language);
  if (rows.length === 0) return null;
  return (
    <section className="sisu-ask-steps" aria-label={StepPresenter.heading(message.pending, language)} data-testid="ask.steps">
      <span className="sisu-ask-label">{StepPresenter.heading(message.pending, language)}</span>
      <ol className="sisu-ask-steps-list" aria-live={message.pending ? "polite" : "off"}>
        {rows.map((row) => (
          <li key={row.id} className="sisu-ask-step" data-state={row.state}>
            <StepMark state={row.state} />
            <div className="sisu-ask-step-text">
              <div className="sisu-ask-tool-top">
                <span className="sisu-ask-body">{row.label}</span>
                {row.duration ? <span className="sisu-ask-caption sisu-ask-muted">{row.duration}</span> : null}
              </div>
              {row.result ? <span className="sisu-ask-caption sisu-ask-muted">{row.result}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepMark({ state }: { state: StepRow.State }) {
  const label = state === "running" ? "Running" : state === "failed" ? "Did not finish" : "Done";
  return (
    <span className="sisu-ask-step-mark" role="img" aria-label={label}>
      {state === "running" ? <span className="sisu-ask-spinner" /> : null}
      {state === "done" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill="var(--sisu-green-700)" />
          <path d="M4.6 8.2 7 10.5l4.4-4.8" fill="none" stroke="var(--sisu-white)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {state === "failed" ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="8" fill="var(--sisu-amber-mark)" />
          <path d="M8 4.4v4.4" stroke="var(--sisu-white)" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="8" cy="11.4" r="1" fill="var(--sisu-white)" />
        </svg>
      ) : null}
    </span>
  );
}
