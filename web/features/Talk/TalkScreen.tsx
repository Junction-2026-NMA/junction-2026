"use client";
// Sisu, the main page (it was Talk; port of ios/Sisu/Features/Talk/TalkScreen.swift). It opens on the conversation
// and the ask box at once: no extra screen to start typing. Typed and spoken questions go to the same session, so
// they are one conversation with one context; switching between them keeps everything.
// - Header: the Sisu logo (opens the chat history drawer, web/features/History, with a dot for unread project
//   findings), the title, the live status while voice is on, and once the chat has started the small Liito badge.
// - A project opened from the drawer (openProjectId) is shown in place of the conversation; the conversation stays
//   mounted under it (hidden), so its reading position, draft and voice state come back with Back.
// - Settings opens from the drawer's last row (the same sheet as on Today and Path).
// - Empty: Liito, larger, one friendly line and the suggested questions (web/core/AppLogic/SisuSuggestions.ts).
// - The transcript keeps the reading position (TalkTranscript.tsx). The composer is pinned at the bottom: the text
//   field, Send and the microphone; while voice is on it shows the live state with a stop control (VoiceStrip.tsx).
// The hands-free logic is web/voice/ConversationController.ts and web/core (ConversationFlow, VoiceBar, LiitoTask).
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useAppModel, useAppSelector, useCoach, useCoachSessionState, useConversation, useVoice } from "@/web/app/AppProvider";
import type { CoachStore } from "@/web/app/CoachStore";
import { SisuSuggestions } from "@/web/core/AppLogic/SisuSuggestions";
import { VoiceBar } from "@/web/core/AppLogic/VoiceBar";
import type { CoachMessage, CoachSession } from "@/web/core/CoachSession";
import { LiitoTask } from "@/web/core/LiitoTask";
import { useLiitoMood } from "@/web/shared/useLiitoMood";
import { springEasing } from "@/web/theme/theme";
import { useReducedMotion } from "@/web/theme/motion";
import { unlockAudio } from "@/web/voice/AudioUnlock";
import type { ConversationController } from "@/web/voice/ConversationController";
import { FallbackNotice } from "@/web/features/Ask/AskParts";
import { runLaunch } from "@/web/features/Ask/askLaunch";
import { Composer } from "@/web/features/Ask/Composer";
import { PlaceholderScreen } from "@/web/features/Ask/PlaceholderScreen";
import { useKeyboardInset } from "@/web/features/Ask/useKeyboardInset";
import { HistoryDrawer } from "@/web/features/History/HistoryDrawer";
import { ProjectScreen } from "@/web/features/Projects/ProjectScreen";
import { useProjectsUnread } from "@/web/features/Projects/useProjects";
import { SettingsSheet } from "@/web/features/Sheets/SettingsSheet";
import { SisuEmptyState } from "./SisuEmptyState";
import { LiitoBadge, SisuLogoButton, StatusLine } from "./TalkParts";
import { TalkLaunch } from "./TalkLaunch";
import { TalkTranscript, type TranscriptHandle } from "./TalkTranscript";
import { VoiceStrip } from "./VoiceStrip";
import "@/web/features/Ask/ask.css";
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
    return <PlaceholderScreen title="Sisu" mood="idle" line="Pick a profile and Sisu is ready for your questions." testId="screen.talk" />;
  }
  return <TalkContent key={keyOf(coach.session)} session={coach.session} talk={coach.conversation} store={model.coach} />;
}

/** The empty-to-chat move of the badge: a soft spring (SwiftUI .spring(response: 0.6, dampingFraction: 0.86)). */
const layoutSpring = springEasing(0.6, 0.86);

/** What the answer in progress has done so far (LiitoTask.answering): the session worked on it, Sisu said part of it. */
const noAnswer = { worked: false, spoke: false };

function newestQuestion(messages: readonly CoachMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) if (messages[index].role === "user") return messages[index].id;
  return null;
}

function TalkContent({ session, talk, store }: { session: CoachSession; talk: ConversationController; store: CoachStore }) {
  const model = useAppModel();
  const coach = useCoach();
  const state = useCoachSessionState(session);
  const conversation = useConversation(talk);
  const voice = useVoice();
  const overview = useAppSelector((s) => s.overview);
  const flaggedBill = useAppSelector((s) => s.flaggedBill);
  const customerName = useAppSelector((s) => s.customer?.displayName ?? null);
  useAppSelector((s) => s.confirmedBillNames);
  const historyOpen = useAppSelector((s) => s.historyOpen);
  const openProjectId = useAppSelector((s) => s.openProjectId);
  const reduceMotion = useReducedMotion();
  const visible = usePageVisible();
  const keyboard = useKeyboardInset();
  const unread = useProjectsUnread() > 0;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const logo = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<TranscriptHandle | null>(null);
  const [draft, setDraft] = useState("");

  const flow = conversation?.flow ?? talk.flow;
  const messages = state?.messages ?? [];
  const chatting = messages.length > 0;
  const screen = talk.screen(session.activity, null);
  const bar = VoiceBar.state(flow, session.activity, conversation?.answerReady ?? false);
  const isThinking = state?.isThinking ?? false;

  // Liito's mood: the presenter's, corrected while Sisu answers with what the session really does (real work beats
  // a filler sentence), then sequenced so each real task can be read (useLiitoMood). An approval cheers.
  const task = state?.task ?? null;
  const answering = flow.phase === "thinking" || flow.phase === "speaking";
  const [answer, setAnswer] = useState(noAnswer);
  const nextAnswer = answering
    ? { worked: answer.worked || isThinking, spoke: answer.spoke || (flow.phase === "speaking" && !(isThinking && LiitoTask.isWork(task))) }
    : noAnswer;
  if (nextAnswer.worked !== answer.worked || nextAnswer.spoke !== answer.spoke) setAnswer(nextAnswer);
  const answered = answering
    ? LiitoTask.answering(screen.mood, {
        phase: flow.phase === "speaking" ? "speaking" : "thinking", working: isThinking, task, spoke: nextAnswer.spoke, workedThisAnswer: nextAnswer.worked,
      })
    : screen.mood;
  const target = coach.cheering && !isThinking ? "cheering" : answered;
  const busy = answering || flow.phase === "hearing" || isThinking || (state?.isSpeaking ?? false) || (state?.isRecording ?? false);
  const mood = useLiitoMood(target, { busy, turn: newestQuestion(messages) });
  const canInterrupt = flow.isAnswering || isThinking || (state?.isSpeaking ?? false);

  // The microphone is held while the page is in the background or a project covers the conversation; leaving the
  // tab holds it too (the unmount), and coming back listens again.
  const held = !visible || openProjectId !== null;
  useEffect(() => { talk.setHeld(held); }, [talk, held]);
  useEffect(() => () => talk.setHeld(true), [talk]);
  useEffect(() => { if (isThinking) store.setCheering(false); }, [isThinking, store]);

  // talkStart=1: start a conversation once the tab is first on screen (once per page load).
  useEffect(() => {
    if (!TalkLaunch.current().startsConversation || TalkLaunch.startHandled) return;
    const timer = window.setTimeout(() => {
      if (TalkLaunch.startHandled) return;
      TalkLaunch.markStartHandled();
      talk.start();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [talk]);

  // Launch options of the coach (screenshots): ask, quiz, decide, scroll. Once per session.
  useEffect(() => {
    let gone = false;
    void runLaunch({
      session, store, model, setFollowing: () => {}, cancelled: () => gone,
      scrollToAnchor: (id, anchor) => transcript.current?.scrollToAnchor(id, anchor) ?? false,
    });
    return () => { gone = true; };
  }, [session, store, model]);

  // Liito visibly travels from the empty state up into the header (a FLIP of the badge that is shown).
  const badge = useRef<HTMLDivElement>(null);
  const lastBadge = useRef<{ rect: DOMRect; liito: number } | null>(null);
  const wasChatting = useRef(chatting);
  useLayoutEffect(() => {
    const element = badge.current;
    const switched = wasChatting.current !== chatting;
    wasChatting.current = chatting;
    if (switched && element && lastBadge.current) flip(element, lastBadge.current, reduceMotion);
    if (element) lastBadge.current = { rect: element.getBoundingClientRect(), liito: Number(element.dataset.liito) || 1 };
  });

  const interrupt = () => {
    if (flow.isAnswering) talk.interrupt();
    else session.cancel();
  };
  const send = (text: string) => {
    const question = text.trim();
    if (question === "") return;
    setDraft("");
    store.ask(question);
  };
  /** A suggestion: asked as typed, in this conversation. A running voice conversation ends first. */
  const ask = (question: string) => {
    if (flow.isOn) talk.end();
    store.ask(question);
  };
  const startVoice = () => {
    // Inside the tap: the browser lets the page play Sisu's voice from now on.
    unlockAudio();
    input.current?.blur();
    talk.start();
  };
  const typeInstead = () => {
    talk.end();
    window.setTimeout(() => input.current?.focus(), 60);
  };

  const notice = conversation?.notice ?? voice?.notice ?? null;
  const suggestions = SisuSuggestions.make(overview, flaggedBill ? model.confirmedName(flaggedBill) : null);
  const keyboardStyle = { "--sisu-talk-kb": `${keyboard.bottom}px`, "--sisu-talk-vv-top": `${keyboard.top}px` } as CSSProperties;
  const liitoBadge = (size: "small" | "hero") => (
    <LiitoBadge badgeRef={badge} mood={mood} target={target} talk={talk} listening={flow.micOpen}
      diameter={size === "small" ? 44 : 124} liito={size === "small" ? 52 : 140} filled={size === "small"}
      canInterrupt={canInterrupt} onInterrupt={interrupt} />
  );

  return (
    <div className="sisu-talk" style={keyboardStyle} data-testid="screen.talk" data-phase={flow.phase} data-chatting={chatting ? "true" : "false"}
      data-project={openProjectId ? "true" : "false"}
      data-voice={flow.isOn ? "true" : "false"} data-mood={mood} data-mood-target={target} data-keyboard={keyboard.bottom > 0 ? "true" : "false"}>
      <header className="sisu-talk-header">
        <SisuLogoButton buttonRef={logo} open={historyOpen} unread={unread} onPress={() => model.setHistoryOpen(true)} />
        <div className="sisu-talk-titles">
          <h1 className="sisu-talk-title" data-testid="talk.title">Sisu</h1>
          {flow.isOn ? <StatusLine flow={flow} live statusLine={screen.statusLine} detail={null} compact /> : null}
        </div>
        {chatting ? <div className="sisu-talk-header-liito">{liitoBadge("small")}</div> : null}
      </header>
      <FallbackNotice session={session} notice={state?.fallbackNotice ?? null} fellBackToSample={coach.fellBackToSample} />
      {chatting && state ? (
        <TalkTranscript session={session} state={state} store={store} reduceMotion={reduceMotion}
          handle={(next) => { transcript.current = next; }}
          onUserDrag={() => { if (document.activeElement === input.current) input.current?.blur(); }} />
      ) : (
        <div className="sisu-talk-empty-scroll">
          <SisuEmptyState name={overview?.displayName ?? customerName} liito={liitoBadge("hero")} suggestions={suggestions}
            voiceOn={flow.isOn} onAsk={ask} />
        </div>
      )}
      <div className="sisu-talk-dock" data-clips={voice?.clipsPlayed ?? 0} data-testid={`talk.clips.${voice?.clipsPlayed ?? 0}`}>
        {notice ? <p className="sisu-talk-notice" role="status" data-testid="talk.notice">{notice}</p> : null}
        {flow.isOn ? (
          <VoiceStrip bar={bar} talk={talk} onType={typeInstead} onStop={() => (bar.stop === "interrupt" ? talk.interrupt() : talk.end())} />
        ) : (
          <Composer draft={draft} setDraft={setDraft} thinking={isThinking} onSend={send} onStop={() => session.cancel()}
            onVoice={startVoice} inputRef={input} />
        )}
      </div>
      <HistoryDrawer open={historyOpen} onClose={() => model.setHistoryOpen(false)} returnFocus={logo}
        onSettings={() => { model.setHistoryOpen(false); setSettingsOpen(true); }} />
      {openProjectId ? (
        <div className="sisu-talk-project">
          <ProjectScreen id={openProjectId} onClose={() => model.setOpenProjectId(null)} />
        </div>
      ) : null}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
