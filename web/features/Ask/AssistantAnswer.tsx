"use client";
// The cards of one answer from Sisu: the text, the live research stage, the stage cards in arrival order, the offer
// table, the quiz, the approval card, the grounding line and the "How Sisu worked this out" drawer. Port of
// AssistantAnswer in AskCards.swift. Every figure and sentence comes from the payload or a SisuCore presenter.
// Web additions (the session fills them, the iOS screen does not draw them yet): the steps list and the agent's
// charts (`visuals`), and the TypingDots beside "Sisu is thinking…".
import type { AgentAction } from "@/web/core/CoachModels";
import { GroundingPresenter, StagePresenter } from "@/web/core/CoachPresentation";
import type { CoachMessage } from "@/web/core/CoachSession";
import type { Visual } from "@/web/core/PlanModels";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { SisuButton, SisuCard, SisuMotion, riveAccessible } from "@/web/shared/SisuStyle";
import { useReducedMotion } from "@/web/theme/motion";
import { ActionCard } from "./ActionCard";
import { MemoryCard } from "./CardParts";
import { ChartCard } from "./ChartCard";
import { ResearchCard } from "./Offers";
import { QuizCard } from "./QuizCard";
import { StageView } from "./StageView";
import { StepsCard } from "./StepsCard";
import { TraceDrawer } from "./TraceDrawer";

const language = "en";

export function AssistantAnswer({ message, actions, retry, isNew }: {
  message: CoachMessage;
  /** The session's actions, newest copy of each (an action stage shows the newest). */
  actions: readonly AgentAction[];
  retry: () => void;
  /** True for a card id that arrived after the screen appeared: it comes in with the entrance motion. */
  isNew: (id: string) => boolean;
}) {
  const reduceMotion = useReducedMotion();
  const enter = (id: string) => (isNew(id) ? SisuMotion.entrance(reduceMotion) : undefined);
  const kinds = new Set(message.stages.map((stage) => String(stage.kind)));
  const stage = message.pending ? StagePresenter.researchStage(message) : null;
  const teaching = message.teaching;
  const action = message.action;
  const anchor = (suffix: string) => `${message.id}-${suffix}`;

  return (
    <div className="sisu-ask-answer">
      <TextCard message={message} retry={retry} />
      {stage != null && stage !== "done" ? (
        <div data-anchor={anchor("indicator")}>
          <RiveComponent component="StageIndicator" values={RiveBindings.stageIndicator(stage, language)}
            {...riveAccessible(RiveBindings.stageLabel(stage, language))} />
        </div>
      ) : null}
      <StepsCard message={message} />
      {message.stages.map((one) => (
        <div key={one.id} data-anchor={anchor(String(one.kind))} className={enter(`${message.id}/${one.id}`)}>
          <StageView stage={one} message={message} actions={actions} />
        </div>
      ))}
      {extraVisuals(message, kinds).map((visual) => (
        <div key={visual.id} data-anchor={anchor(`visual-${visual.id}`)} className={enter(`${message.id}/visual/${visual.id}`)}>
          <ChartCard visual={visual} />
        </div>
      ))}
      {message.research && !kinds.has("extraction") ? (
        <div data-anchor={anchor("offers")}><ResearchCard research={message.research} /></div>
      ) : null}
      {teaching && !message.stages.some((one) => one.data.kind === "teaching" && one.data.card.id === teaching.id) ? (
        <div data-anchor={anchor("quiz")}><QuizCard card={teaching} /></div>
      ) : null}
      {action && !message.stages.some((one) => one.data.kind === "action" && one.data.action.id === action.id) ? (
        <div data-anchor={anchor("action")}><ActionCard action={action} /></div>
      ) : null}
      {message.remembered.length > 0 && !kinds.has("memory")
        ? message.remembered.map((item) => <MemoryCard key={item.id} text={item.value} />)
        : null}
      {!message.pending ? <Receipts message={message} /> : null}
    </div>
  );
}

/** The agent's charts that say more than the cards already on screen: the offer bars repeat the offer table, the
 *  futures lines the futures card and the waterfall the working, so those are left to the cards iOS draws. */
function extraVisuals(message: CoachMessage, kinds: Set<string>): Visual[] {
  return message.visuals.filter((visual) => {
    switch (visual.content.kind) {
      case "offerBars": return !kinds.has("extraction") && message.research == null;
      case "futuresLines": return !kinds.has("impact") && !(message.action?.impact);
      case "waterfall": return !kinds.has("calculation");
      default: return true;
    }
  });
}

function TextCard({ message, retry }: { message: CoachMessage; retry: () => void }) {
  const thinking = message.text === "" && message.pending;
  return (
    <SisuCard>
      {message.text !== "" ? <p className="sisu-ask-body-large" data-selectable>{message.text}</p> : null}
      {thinking ? (
        <div className="sisu-ask-thinking" role="status">
          <span aria-hidden="true" className="sisu-ask-dots">
            <RiveComponent component="TypingDots" values={RiveBindings.typingDots(true)} />
          </span>
          <p className="sisu-ask-body-large sisu-ask-muted">{message.filler ?? "Sisu is thinking…"}</p>
        </div>
      ) : null}
      {message.pending && message.text !== "" && message.filler && message.runningTool != null ? (
        <span className="sisu-ask-label sisu-ask-muted">{message.filler}</span>
      ) : null}
      {message.error ? (
        <>
          <p className="sisu-ask-body" role="alert">{message.error}</p>
          <SisuButton label="Try again" style="secondary" action={retry} />
        </>
      ) : null}
    </SisuCard>
  );
}

function Receipts({ message }: { message: CoachMessage }) {
  const grounding = message.grounding ? GroundingPresenter.line(message.grounding, language) : null;
  const hasTrace = message.tools.length > 0 || message.citations.length > 0;
  if (!grounding && !hasTrace) return null;
  return (
    <div className="sisu-ask-receipts">
      {grounding ? (
        <span className="sisu-ask-label sisu-ask-grounding" data-warning={grounding.isWarning ? "true" : "false"}>{grounding.text}</span>
      ) : null}
      {hasTrace ? <TraceDrawer message={message} /> : null}
    </div>
  );
}
