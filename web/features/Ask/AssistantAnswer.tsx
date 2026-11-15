"use client";
// One answer from Sisu, short by default (rework of 15 Nov): the answer card holds the text, then ONE result with
// the most useful number, then the details closed (offers compared, how it was worked out, assumptions, sources),
// each figure said once. While the answer is on its way the live research stage and the steps show under it.
// Charts that say more than the card, the quiz and the approval cards stay open, since they need a look or a tap.
// Every figure and sentence comes from the payload through AnswerPresenter / SisuCore presenters.
import { useMemo } from "react";
import type { AgentAction, TeachingCard } from "@/web/core/CoachModels";
import { useCoachSessionState } from "@/web/app/AppProvider";
import { AnswerPresenter, CardText, messageActions } from "@/web/core/AnswerPresentation";
import { StagePresenter } from "@/web/core/CoachPresentation";
import type { CoachMessage } from "@/web/core/CoachSession";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { SisuButton, SisuCard, SisuMotion, riveAccessible } from "@/web/shared/SisuStyle";
import { useReducedMotion } from "@/web/theme/motion";
import { ActionCard } from "./ActionCard";
import { AnswerDetails } from "./AnswerDetails";
import { MemoryLine } from "./CardParts";
import { ChartCard } from "./ChartCard";
import { QuizCard } from "./QuizCard";
import { ResultLine } from "./ResultLine";
import { StepsCard } from "./StepsCard";
import "./answer.css";

const language = "en";

export function AssistantAnswer({ message, actions, retry, isNew }: {
  message: CoachMessage;
  /** The session's actions, newest copy of each (an action card shows the newest). */
  actions: readonly AgentAction[];
  /** Asks the question again; null when there is no question to repeat (an unheard voice turn). */
  retry: (() => void) | null;
  /** True for a card id that arrived after the screen appeared: it comes in with the entrance motion. */
  isNew: (id: string) => boolean;
}) {
  const reduceMotion = useReducedMotion();
  const enter = (id: string) => (isNew(id) ? SisuMotion.entrance(reduceMotion) : undefined);
  const question = useQuestion(message.id);
  const view = useMemo(() => AnswerPresenter.view(message, language, undefined, question), [message, question]);
  const stage = message.pending ? StagePresenter.researchStage(message) : null;
  const anchor = (suffix: string) => `${message.id}-${suffix}`;
  const teaching = teachingCard(message);
  const own = messageActions(message).map((action) => actions.find((one) => one.id === action.id) ?? action);
  const remembered = [
    ...message.stages.flatMap((one) => (one.data.kind === "memory" ? [one.data.item] : [])),
    ...message.remembered,
  ].filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);

  return (
    <div className="sisu-ask-answer">
      <SisuCard>
        <AnswerText message={message} retry={retry} />
        {view.result ? (
          <div data-anchor={anchor("result")} className={enter(`${message.id}/result`)}>
            <ResultLine result={view.result} />
          </div>
        ) : null}
        {!message.pending ? <div data-anchor={anchor("details")}><AnswerDetails view={view} /></div> : null}
      </SisuCard>
      {stage != null && stage !== "done" ? (
        <div data-anchor={anchor("indicator")}>
          <RiveComponent component="StageIndicator" values={RiveBindings.stageIndicator(stage, language)}
            {...riveAccessible(RiveBindings.stageLabel(stage, language))} />
        </div>
      ) : null}
      {message.pending ? <StepsCard message={message} /> : null}
      {view.visuals.map((visual) => (
        <div key={visual.id} data-anchor={anchor(`visual-${visual.id}`)} className={enter(`${message.id}/visual/${visual.id}`)}>
          <ChartCard visual={visual} />
        </div>
      ))}
      {teaching ? (
        <div data-anchor={anchor("quiz")} className={enter(`${message.id}/quiz`)}>
          <QuizCard card={teaching} askedInText={endsWithQuestion(message.text, teaching.question)} />
        </div>
      ) : null}
      {own.map((action) => (
        <div key={action.id} data-anchor={anchor("action")} className={enter(`${message.id}/action/${action.id}`)}>
          <ActionCard action={action} mismatch={view.mismatchedActionIds.includes(action.id)} />
        </div>
      ))}
      {remembered.map((item) => (
        <div key={item.id} className="sisu-answer-memory"><MemoryLine text={item.value} /></div>
      ))}
    </div>
  );
}

/** What the user asked just before this answer (its requirements apply to the offers), "" when unknown. */
function useQuestion(id: string): string {
  const messages = useCoachSessionState()?.messages ?? [];
  const index = messages.findIndex((one) => one.id === id);
  const previous = index > 0 ? messages[index - 1] : null;
  return previous?.role === "user" ? previous.text : "";
}

/** True when the answer's text ends with the quiz question (case, spacing and punctuation aside). */
function endsWithQuestion(text: string, question: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[\s.?!…]+$/g, "").replace(/\s+/g, " ").trim();
  const asked = norm(question);
  return asked !== "" && norm(text).endsWith(asked);
}

/** The quiz of the answer: from a teaching stage, or the `teaching` event. */
function teachingCard(message: CoachMessage): TeachingCard | null {
  const staged = message.stages.find((one) => one.data.kind === "teaching");
  return staged?.data.kind === "teaching" ? staged.data.card : message.teaching;
}

function AnswerText({ message, retry }: { message: CoachMessage; retry: (() => void) | null }) {
  const thinking = message.text === "" && message.pending;
  return (
    <>
      {message.text !== "" ? <p className="sisu-ask-body-large" data-selectable>{CardText.humanize(message.text, language)}</p> : null}
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
          {retry ? <SisuButton label="Try again" style="secondary" action={retry} /> : null}
        </>
      ) : null}
    </>
  );
}
