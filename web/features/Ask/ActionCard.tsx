"use client";
// The approval card of a prepared action, drawn with beUI's ToolApproval (web/agents): an icon and a badge that
// follow the decision, a clear "Simulated" tag under the title (a switch or a transfer here never happens for
// real), what it does, the warning, what it frees (a switch) or moves (a transfer: `€50` once, never "a month"),
// what a real switch or transfer takes (closed at first) and the action row with Approve / Decline (Sisu's own
// buttons), which gives way to the outcome once decided. Once approved, a switch's
// five-year projection stays behind a closed "If you keep the saving for 5 years" (the person asked about a
// monthly saving, not about investing, so the invest line is left out); a transfer shows the server's sentence.
// Its assumptions and sources are in the answer's Details, said once there.
// Port of ActionCard in AskCards.swift, reworked on 15 Nov.
import { useRef } from "react";
import { useAppModel, useCoach, useCoachStore } from "@/web/app/AppProvider";
import type { AgentAction } from "@/web/core/CoachModels";
import type { ActionImpact } from "@/web/core/CoachModels";
import { SourceTags } from "@/web/core/AnswerPresentation";
import { ActionPresenter, CoachText, FuturesPresenter } from "@/web/core/CoachPresentation";
import { rawOf } from "@/web/core/Presentation";
import { ToolApproval, type ToolApprovalStatus } from "@/web/agents/ToolApproval";
import { SisuButton } from "@/web/shared/SisuStyle";
import { decideAction } from "./answerActions";
import { Footnote, Note } from "./CardParts";
import { Disclosure } from "./Disclosure";
import { ImpactChart } from "./ImpactChart";
import { SourceChips } from "./ResultLine";
import { isWatchKind } from "@/web/core/WatchModels";
import { WatchActionCard, showsWatchCard } from "@/web/features/Projects/WatchActionCard";

const language = "en";

/** A watch (property_watch, price_watch) gets the Projects card once it handles the action (`showsWatchCard`);
 *  every other action, and a watch it does not handle yet, gets the approval card. `mismatch`: the offer does not
 *  meet the requirements the user gave, so the card says so. */
export function ActionCard({ action, mismatch = false }: { action: AgentAction; mismatch?: boolean }) {
  if (isWatchKind(action.kind) && showsWatchCard(action)) return <WatchActionCard action={action} />;
  return <SimulatedActionCard action={action} mismatch={mismatch} />;
}

/** `Simulated, no real switch`, `Simulated, no money moves` for a transfer, or (an action the server says is real,
 *  such as a watch the Projects card does not draw yet) `Needs your approval`. */
function tagText(action: AgentAction): { text: string; tone: "amber" | "neutral" } {
  if (action.simulated === false) return { text: "Needs your approval", tone: "neutral" };
  return { text: CoachText.simulatedTag(language, action.kind), tone: "amber" };
}

/** Where the decision stands, for the card's icon and badge. */
function approvalStatus(action: AgentAction, busy: boolean): { status: ToolApprovalStatus; badge: string } {
  const raw = rawOf(action.status);
  if (raw === "awaiting_approval") return busy ? { status: "approving", badge: "Approving…" } : { status: "pending", badge: "Needs your approval" };
  if (raw === "executed_simulated") return { status: "approved", badge: "Approved" };
  if (raw === "declined") return { status: "denied", badge: "Declined" };
  if (raw === "expired") return { status: "expired", badge: "Expired" };
  return { status: "other", badge: raw };
}

function SimulatedActionCard({ action, mismatch }: { action: AgentAction; mismatch: boolean }) {
  const model = useAppModel();
  const store = useCoachStore();
  const coach = useCoach();
  const card = ActionPresenter.card(action, language);
  const tag = tagText(action);
  const busy = coach.deciding.includes(action.id);
  const notice = coach.decisionNotices[action.id];
  // One decision per card at a time: a second press (a stray tap on the other button while the first one is on
  // its way) is ignored until the server has answered.
  const inFlight = useRef(false);
  const decide = (approve: boolean) => {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    void decideAction(action, approve, store, model).finally(() => { inFlight.current = false; });
  };

  const decision = approvalStatus(action, busy);
  return (
    <ToolApproval
      status={decision.status}
      badge={decision.badge}
      title={card.title}
      tool={tag.tone === "amber" ? tag.text : undefined}
      description={card.summary}
      testId="ask.action"
      detailsLabel={card.checklistLabel}
      details={card.checklist.length > 0 ? (
        <ol className="sisu-ask-checklist">
          {card.checklist.map((step, index) => (
            <li key={index} className="sisu-ask-checklist-step">
              <span className="sisu-ask-label sisu-ask-primary" aria-hidden="true">{`${index + 1}.`}</span>
              <span className="sisu-ask-body">{step}</span>
            </li>
          ))}
        </ol>
      ) : undefined}
      actions={card.canDecide ? (
        <>
          <p className="sisu-ask-caption sisu-ask-muted" role="status">{card.statusSentence}</p>
          <SisuButton label="Approve" style="primary" enabled={!busy} loading={busy} action={() => decide(true)} />
          <SisuButton label="Decline" style="secondary" enabled={!busy} action={() => decide(false)} />
          {card.validUntil ? <Footnote text={card.validUntil} /> : null}
        </>
      ) : undefined}
      result={(
        <>
          <p className="sisu-ask-button-text" role="status">{card.statusSentence}</p>
          {card.confirmation ? <p className="sisu-ask-body">{card.confirmation}</p> : null}
          {action.impact ? <ImpactAfterApproval impact={action.impact} summary={card.impactSummary ?? action.impact.summary} /> : null}
        </>
      )}
    >
      {mismatch ? <Note text="This offer does not meet the requirements you gave. Ask Sisu to keep looking before you approve anything." /> : null}
      {/* The server asks for the warning to be shown prominently, never hidden. */}
      {card.warning ? <Note text={card.warning} /> : null}
      <div className="sisu-ask-baseline">
        <span className="sisu-ask-h3">{card.monthly}</span>
        <span className="sisu-ask-body sisu-ask-muted">{card.amountNote}</span>
      </div>
      {notice ? <Note text={notice} /> : null}
    </ToolApproval>
  );
}

/** After approval: the server's sentence, and for a projection over the years its bars behind a closed control,
 *  labelled as an estimate and without the "invest it" line. */
function ImpactAfterApproval({ impact, summary }: { impact: ActionImpact; summary: string }) {
  const series = FuturesPresenter.series(impact, language).filter((line) => line.id !== "invest");
  if (series.length === 0) return summary !== "" ? <p className="sisu-ask-body">{summary}</p> : null;
  const years = impact.horizonYears;
  const label = `If you keep the saving for ${years} ${years === 1 ? "year" : "years"}`;
  return (
    <Disclosure label={label} testId="impact">
      <SourceChips tags={[SourceTags.estimate(language)]} />
      <ImpactChart series={series} />
      {summary !== "" ? <p className="sisu-ask-caption sisu-ask-muted">{summary}</p> : null}
    </Disclosure>
  );
}
