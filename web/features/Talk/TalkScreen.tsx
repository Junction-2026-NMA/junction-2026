"use client";
// Talk, the main page. Port of ios/Sisu/Features/Talk/TalkScreen.swift. Before the first question it is Liito in the
// middle, the microphone and Start / End right under it, and a line that says when a conversation started and
// ended. From the first question on it becomes a chat: Liito shrinks into a small circle at the top (it visibly
// travels there), the status sits beside it, and the conversation rises in underneath with every answer in full
// (the same AssistantAnswer as the Ask screen). "New conversation" clears the chat and brings Liito back to the
// middle. While Sisu works, Liito does what the backend is doing: listening, searching, calculating, comparing,
// writing, presenting (web/core/LiitoTask.ts). Each task stays on screen long enough to read, in the order the
// events came (web/shared/useLiitoMood.ts); both badges draw that one sequenced mood.
//
// The conversation is hands-free (web/voice/ConversationController.ts): Sisu listens, notices the pause, answers out
// loud through the backend's voice turn, then listens again until End. Typing opens the Ask screen as a sheet.
// All logic is in web/core (ConversationFlow, ConversationPresenter, LiitoTask) and in the controller; this file
// lays it out.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAppModel, useAppSelector, useCoach, useCoachSessionState, useConversation, useVoice } from "@/web/app/AppProvider";
import type { CoachStore } from "@/web/app/CoachStore";
import { ConversationText } from "@/web/core/AppLogic/Conversation";
import { FirstInsightPresenter } from "@/web/core/AppLogic/OnboardingCopy";
import type { CoachMessage, CoachSession } from "@/web/core/CoachSession";
import { LiitoTask } from "@/web/core/LiitoTask";
import { SisuButton } from "@/web/shared/SisuStyle";
import { useLiitoMood } from "@/web/shared/useLiitoMood";
import { springEasing } from "@/web/theme/theme";
import { useReducedMotion } from "@/web/theme/motion";
import { unlockAudio } from "@/web/voice/AudioUnlock";
import { ConversationController } from "@/web/voice/ConversationController";
import { PlaceholderScreen } from "@/web/features/Ask/PlaceholderScreen";
import { KeyboardIcon, LiitoBadge, MicButton, PencilSquareIcon, RoundControl, RoundIconButton, StatusLine } from "./TalkParts";
import { TalkLaunch } from "./TalkLaunch";
import { TalkTranscript } from "./TalkTranscript";
import "./talk.css";

/** One key per session object (Swift `.id(ObjectIdentifier(session))`): a new session starts a fresh screen. */
const sessionKeys = new WeakMap<CoachSession, number>();
let nextKey = 0;
function keyOf(session: CoachSession): number {
  const known = sessionKeys.get(session);
  if (known !== undefined) return known;
  nextKey += 1;
  sessionKeys.set(session, nextKey);
  return nextKey;
}

export default function TalkScreen() {
  const coach = useCoach();
  const model = useAppModel();
  if (!coach.session || !coach.conversation) {
    return <PlaceholderScreen title="Talk to Sisu" mood="idle" line="Pick a profile and Sisu is ready to talk." testId="screen.talk" />;
  }
  return <TalkContent key={keyOf(coach.session)} session={coach.session} talk={coach.conversation} store={model.coach} />;
}

/** The hero-to-chat move of the badge: a soft spring (SwiftUI .spring(response: 0.6, dampingFraction: 0.86)). */
const layoutSpring = springEasing(0.6, 0.86);

/** What the answer in progress has done so far (LiitoTask.answering): the session worked on it, Sisu said part of it. */
const noAnswer = { worked: false, spoke: false };

/** The newest question's id: a new question starts Liito's moods afresh (useLiitoMood's `turn`). */
function newestQuestion(messages: readonly CoachMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) if (messages[index].role === "user") return messages[index].id;
  return null;
}

function TalkContent({ session, talk, store }: { session: CoachSession; talk: ConversationController; store: CoachStore }) {
  const model = useAppModel();
  const state = useCoachSessionState(session);
  const conversation = useConversation(talk);
  const voice = useVoice();
  const overview = useAppSelector((s) => s.overview);
  const firstInsightPending = useAppSelector((s) => s.firstInsightPending);
  const flaggedBill = useAppSelector((s) => s.flaggedBill);
  useAppSelector((s) => s.confirmedBillNames);
  const conversationShown = useAppSelector((s) => s.conversationShown);
  const reduceMotion = useReducedMotion();
  const visible = usePageVisible();

  const flow = conversation?.flow ?? talk.flow;
  const messages = state?.messages ?? [];
  /** The chat layout, from the first question on. */
  const chatting = messages.length > 0;

  // Before the first conversation after the first run, Liito says the first insight (Today's callout figures).
  const opening = firstInsightPending && flow.lastEnded === null && overview
    ? FirstInsightPresenter.state(overview, flaggedBill ? model.confirmedName(flaggedBill) : null)
    : null;
  const screen = talk.screen(session.activity, opening ? { title: opening.eyebrow, detail: opening.headline } : null);

  // Liito's mood: the presenter's, corrected while Sisu answers with what the session really does (real work beats
  // a filler sentence, the pauses between spoken sentences stay "presenting"), then sequenced so each real task can
  // be read. `answer` is what this answer has done so far (derived state, reset when Sisu listens again).
  const isThinking = state?.isThinking ?? false;
  const task = state?.task ?? null;
  const answering = flow.phase === "thinking" || flow.phase === "speaking";
  const [answer, setAnswer] = useState(noAnswer);
  const nextAnswer = answering
    ? {
        worked: answer.worked || isThinking,
        spoke: answer.spoke || (flow.phase === "speaking" && !(isThinking && LiitoTask.isWork(task))),
      }
    : noAnswer;
  if (nextAnswer.worked !== answer.worked || nextAnswer.spoke !== answer.spoke) setAnswer(nextAnswer);
  const target = answering
    ? LiitoTask.answering(screen.mood, {
        phase: flow.phase === "speaking" ? "speaking" : "thinking", working: isThinking, task,
        spoke: nextAnswer.spoke, workedThisAnswer: nextAnswer.worked,
      })
    : screen.mood;
  const busy = answering || flow.phase === "hearing" || isThinking || (state?.isSpeaking ?? false) || (state?.isRecording ?? false);
  const mood = useLiitoMood(target, { busy, turn: newestQuestion(messages) });

  // Held while Talk is not what the person sees: the conversation sheet is up or the page is in the background.
  const held = conversationShown || !visible;
  useEffect(() => { talk.setHeld(held); }, [talk, held]);
  useEffect(() => () => talk.setHeld(true), [talk]);

  // -sisu.talkStart: start a conversation once Talk is first on screen (once per page load).
  useEffect(() => {
    if (!TalkLaunch.current().startsConversation || TalkLaunch.startHandled) return;
    const timer = window.setTimeout(() => {
      if (TalkLaunch.startHandled) return;
      TalkLaunch.markStartHandled();
      talk.start();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [talk]);

  // Liito visibly travels between the middle and the chat header (a FLIP of the badge that is shown).
  const badge = useRef<HTMLDivElement>(null);
  const lastBadge = useRef<{ rect: DOMRect; liito: number } | null>(null);
  const wasChatting = useRef(chatting);
  // The chat rises in only when it starts on this screen, not when Talk opens on an existing chat.
  const [chatEntered, setChatEntered] = useState(false);
  const [shownChatting, setShownChatting] = useState(chatting);
  if (shownChatting !== chatting) {
    setShownChatting(chatting);
    if (chatting) setChatEntered(true);
  }
  useLayoutEffect(() => {
    const element = badge.current;
    const switched = wasChatting.current !== chatting;
    wasChatting.current = chatting;
    if (switched && element && lastBadge.current) flip(element, lastBadge.current, reduceMotion);
    if (element) lastBadge.current = { rect: element.getBoundingClientRect(), liito: Number(element.dataset.liito) || 1 };
  });

  const interrupt = () => talk.interrupt();
  const start = () => {
    // Inside the tap: the browser lets the page play Sisu's voice from now on.
    unlockAudio();
    talk.toggle();
  };

  // A voice problem (speech failed, the microphone refused or interrupted) is said in one calm line by the controls.
  const notice = conversation?.notice ?? null;
  const noticeLine = notice ? <p className="sisu-talk-notice" role="status" data-testid="talk.notice">{notice}</p> : null;

  const controls = (
    <div className="sisu-talk-controls" data-chatting={chatting ? "true" : "false"} data-clips={voice?.clipsPlayed ?? 0}
      data-testid={`talk.clips.${voice?.clipsPlayed ?? 0}`}>
      <MicButton muted={flow.micMuted} enabled={screen.micEnabled} label={screen.micLabel} onPress={() => talk.toggleMute()} />
      <div className="sisu-talk-main-button" data-testid={screen.live ? "talk.end" : "talk.start"}>
        <SisuButton label={screen.buttonLabel} style={screen.live ? "secondary" : "primary"} action={start} />
      </div>
      <RoundControl label={ConversationText.typeInstead} testId="talk.type" onPress={() => model.setConversationShown(true)}>
        <KeyboardIcon />
      </RoundControl>
    </div>
  );

  return (
    <div className="sisu-talk" data-testid="screen.talk" data-phase={flow.phase} data-chatting={chatting ? "true" : "false"}
      data-mood={mood} data-mood-target={target} data-chat-entered={chatEntered ? "true" : "false"}
      aria-hidden={conversationShown || undefined}>
      {chatting ? (
        <>
          <header className="sisu-talk-chat-header">
            <LiitoBadge badgeRef={badge} mood={mood} target={target} talk={talk} listening={flow.micOpen} diameter={56} liito={64} filled
              canInterrupt={screen.canInterrupt} onInterrupt={interrupt} />
            <div className="sisu-talk-chat-titles">
              <h2 className="sisu-talk-chat-title" data-testid="talk.title">{screen.title}</h2>
              <StatusLine flow={flow} live={screen.live} statusLine={screen.statusLine} detail={screen.detail} compact />
            </div>
            <RoundIconButton label={ConversationText.newConversation} testId="talk.new" onPress={() => talk.newConversation()}>
              <PencilSquareIcon />
            </RoundIconButton>
          </header>
          {state ? <TalkTranscript session={session} state={state} store={store} reduceMotion={reduceMotion} /> : null}
          {noticeLine}
          {controls}
        </>
      ) : (
        <div className="sisu-talk-hero">
          <div className="sisu-talk-topbar"><h1 className="sisu-talk-heading">Talk</h1></div>
          <div className="sisu-talk-spacer" data-min="8" />
          <div className="sisu-talk-caption">
            <h2 className="sisu-talk-caption-title" data-testid="talk.title">{screen.title}</h2>
            {screen.detail ? <p className="sisu-talk-caption-detail">{screen.detail}</p> : null}
            {!flow.isOn && flow.lastEnded === null && opening ? (
              <button type="button" className="sisu-talk-link" onClick={() => model.showEvidence(opening.evidenceTitle, opening.evidence)}>
                {opening.linkLabel}
              </button>
            ) : null}
          </div>
          <div className="sisu-talk-hero-liito">
            <LiitoBadge badgeRef={badge} mood={mood} target={target} talk={talk} listening={flow.micOpen} diameter={236} liito={248}
              canInterrupt={screen.canInterrupt} onInterrupt={interrupt} />
          </div>
          {controls}
          <StatusLine flow={flow} live={screen.live} statusLine={screen.statusLine} detail={screen.detail} compact={false} />
          {noticeLine}
          <div className="sisu-talk-spacer" data-min="16" />
        </div>
      )}
    </div>
  );
}

/** Animates `element` from where the other badge was (position and Liito's size) to where it is now. */
function flip(element: HTMLElement, from: { rect: DOMRect; liito: number }, reduceMotion: boolean): void {
  if (typeof element.animate !== "function") return;
  if (reduceMotion) {
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease-in-out" });
    return;
  }
  const to = element.getBoundingClientRect();
  const liito = Number(element.dataset.liito) || 1;
  const dx = from.rect.left + from.rect.width / 2 - (to.left + to.width / 2);
  const dy = from.rect.top + from.rect.height / 2 - (to.top + to.height / 2);
  const scale = from.liito / liito;
  element.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: "translate(0px, 0px) scale(1)" }],
    { duration: layoutSpring.durationMs, easing: layoutSpring.easing },
  );
}

/** True while the page is visible (document.visibilityState). */
function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => true);
}

function subscribeVisibility(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
