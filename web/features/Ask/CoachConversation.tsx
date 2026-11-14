"use client";
// The conversation with one session: header with Liito, the fallback notice, the scrolling answers, the voice
// notice and the ask box. Port of CoachConversation in AskScreen.swift. All logic is in web/core (CoachSession and
// the presenters) and in CoachStore; this file lays it out.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAppModel, useAppSelector, useCoach, useCoachSessionState, useVoice } from "@/web/app/AppProvider";
import type { CoachStore } from "@/web/app/CoachStore";
import { CoachMood } from "@/web/core/AppLogic/CoachAppLogic";
import { ActionStatus } from "@/web/core/CoachModels";
import { CoachSession, type CoachMessage } from "@/web/core/CoachSession";
import { SisuMotion } from "@/web/shared/SisuStyle";
import { useReducedMotion } from "@/web/theme/motion";
import { AskEmptyState, AskHeader, FallbackNotice, UserBubble } from "./AskParts";
import { AssistantAnswer } from "./AssistantAnswer";
import { COACH_BOTTOM, runLaunch } from "./askLaunch";
import { Composer } from "./Composer";
import { useFollowBottom } from "./useFollowBottom";
import { useKeyboardInset } from "./useKeyboardInset";
import "./ask.css";

/** The last investigation request this screen has answered (AppModel.investigationRequests). */
let seenInvestigations = 0;

function waitingAction(message: CoachMessage): boolean {
  const action = message.action ?? message.stages.flatMap((stage) => (stage.data.kind === "action" ? [stage.data.action] : []))[0];
  return action?.status === ActionStatus.awaitingApproval;
}

export function CoachConversation({ session, store }: { session: CoachSession; store: CoachStore }) {
  const model = useAppModel();
  const state = useCoachSessionState(session);
  const coach = useCoach();
  const voice = useVoice(coach.voice);
  const investigations = useAppSelector((s) => s.investigationRequests);
  const reduceMotion = useReducedMotion();
  const keyboard = useKeyboardInset();

  const [draft, setDraft] = useState("");
  const [stageJustLanded, setStageJustLanded] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  // Swift `.scrollDismissesKeyboard(.interactively)`: dragging the answers lets the keyboard go.
  const { scroller, follow, setFollowing, scrollToAnchor } = useFollowBottom(reduceMotion, () => {
    if (document.activeElement === input.current) input.current?.blur();
  });

  const messages = state?.messages ?? [];
  const isThinking = state?.isThinking ?? false;
  const newest = [...messages].reverse().find((message) => message.role === "assistant") ?? null;
  const stageCount = newest?.stages.length ?? 0;
  const textLength = newest?.text.length ?? 0;
  const cardCount = (newest?.steps.length ?? 0) + (newest?.visuals.length ?? 0);
  const decisionWaiting = messages.some(waitingAction);
  const sendIsPrimary = draft.trim() !== "" && !decisionWaiting;

  // Cards on screen when it appeared come without the entrance motion (SwiftUI transitions are for insertions).
  const [initial] = useState(() => new Set(messages.flatMap((m) =>
    [m.id, ...m.stages.map((s) => `${m.id}/${s.id}`), ...m.visuals.map((v) => `${m.id}/visual/${v.id}`)])));
  const isNew = (id: string) => !initial.has(id);

  // Follow the answer as it grows, while the user is at the bottom.
  // (Like SwiftUI's onChange, these run on changes only, not when the screen appears.)
  const growth = `${textLength}|${stageCount}|${cardCount}`;
  useOnChange(growth, follow);
  // A new question: always show it.
  useOnChange(messages.length, () => {
    setFollowing(true);
    follow();
  });
  // An investigation started from Today: show its run from the bottom, once per request.
  useEffect(() => {
    if (investigations <= seenInvestigations) return;
    seenInvestigations = investigations;
    setFollowing(true);
    follow();
  }, [investigations, setFollowing, follow]);
  // The keyboard came up while at the bottom: keep the newest line in view.
  useEffect(() => { if (keyboard.bottom > 0) follow(); }, [keyboard.bottom, follow]);

  // Liito finds something for 1.2 s whenever a stage card lands.
  const lastStageCount = useRef(stageCount);
  useEffect(() => {
    const grew = stageCount > lastStageCount.current;
    lastStageCount.current = stageCount;
    if (!grew) return;
    setStageJustLanded(true);
    const timer = window.setTimeout(() => setStageJustLanded(false), 1200);
    return () => window.clearTimeout(timer);
  }, [stageCount]);

  // A new turn ends the cheering.
  useEffect(() => { if (isThinking) store.setCheering(false); }, [isThinking, store]);

  // Launch options (screenshots): once per session.
  useEffect(() => {
    let gone = false;
    void runLaunch({ session, store, model, setFollowing, scrollToAnchor, cancelled: () => gone });
    return () => { gone = true; };
  }, [session, store, model, setFollowing, scrollToAnchor]);

  const send = (text: string) => {
    const question = text.trim();
    if (question === "") return;
    setDraft("");
    store.ask(question);
  };

  const investigate = () => {
    setDraft("");
    if (!model.isDone("investigate")) model.complete("investigate");
    store.investigate();
  };

  /** Asks the question of a failed answer again. */
  const retry = (reply: CoachMessage) => {
    const all = session.getSnapshot().messages;
    const index = all.findIndex((message) => message.id === reply.id);
    if (index <= 0) return;
    const question = all[index - 1].text;
    if (question === CoachSession.investigateText) store.investigate();
    else store.ask(question);
  };

  const mood = CoachMood.liito(isThinking, stageJustLanded, coach.cheering);
  const keyboardStyle = { "--sisu-ask-kb": `${keyboard.bottom}px`, "--sisu-ask-vv-top": `${keyboard.top}px` } as CSSProperties;

  return (
    <div className="sisu-ask" style={keyboardStyle} data-testid="screen.ask" data-keyboard={keyboard.bottom > 0 ? "true" : "false"}>
      <AskHeader mood={mood} />
      <FallbackNotice session={session} notice={state?.fallbackNotice ?? null} fellBackToSample={coach.fellBackToSample} />
      <div className="sisu-ask-scroll" ref={scroller}>
        <div className="sisu-ask-stack">
          {messages.length === 0 ? (
            <AskEmptyState draftEmpty={draft === ""} onAsk={send} onInvestigate={investigate} />
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} data-anchor={message.id} className={isNew(message.id) ? enterClass(reduceMotion) : undefined}>
                  <UserBubble text={message.text} pending={message.pending} />
                </div>
              ) : (
                <div key={message.id} data-anchor={message.id} className={isNew(message.id) ? enterClass(reduceMotion) : undefined}>
                  <AssistantAnswer message={message} actions={state?.actions ?? []} retry={() => retry(message)} isNew={isNew} />
                </div>
              ),
            )
          )}
          <div className="sisu-ask-bottom" data-anchor={COACH_BOTTOM} aria-hidden="true" />
        </div>
      </div>
      {voice?.notice ? <p className="sisu-ask-voice-notice" role="status">{voice.notice}</p> : null}
      <Composer draft={draft} setDraft={setDraft} thinking={isThinking} sendIsPrimary={sendIsPrimary}
        onSend={send} onStop={() => session.cancel()} inputRef={input} />
    </div>
  );
}

/** Calls `action` after a render in which `value` changed (not on the first render). */
function useOnChange<T>(value: T, action: () => void): void {
  const last = useRef(value);
  const latest = useRef(action);
  useEffect(() => { latest.current = action; });
  useEffect(() => {
    if (Object.is(last.current, value)) return;
    last.current = value;
    latest.current();
  }, [value]);
}

/** Swift `cardTransition`: rise from the bottom and fade in, or a plain fade with Reduce Motion. */
function enterClass(reduceMotion: boolean): string {
  return SisuMotion.entrance(reduceMotion);
}
