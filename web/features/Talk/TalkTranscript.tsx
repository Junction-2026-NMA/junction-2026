"use client";
// The conversation on Talk as a chat: each question, and each answer in full with its cards (the same
// AssistantAnswer as the Ask screen). Port of TalkTranscript in ios/Sisu/Features/Talk/TalkScreen.swift. As an answer
// grows, the chat scrolls until the question sits at the top, then stops, so the answer reads from its first line.
// It never fights the person's own scrolling: a drag away stops the following; back near the bottom starts it again.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CoachStore } from "@/web/app/CoachStore";
import { CoachSession, type CoachMessage, type CoachSessionState } from "@/web/core/CoachSession";
import { SisuMotion } from "@/web/shared/SisuStyle";
import { UserBubble } from "@/web/features/Ask/AskParts";
import { AssistantAnswer } from "@/web/features/Ask/AssistantAnswer";

const NEAR_BOTTOM = 120;

export function TalkTranscript({ session, state, store, reduceMotion }: {
  session: CoachSession;
  state: CoachSessionState;
  store: CoachStore;
  reduceMotion: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const dragging = useRef(false);
  const messages = state.messages;
  const newest = [...messages].reverse().find((m) => m.role === "assistant") ?? null;
  const newestQuestion = [...messages].reverse().find((m) => m.role === "user") ?? null;
  const growth = newest
    ? `${newest.text.length}|${newest.stages.length}|${newest.steps.length}|${newest.visuals.length}|${newest.pending ? 1 : 0}`
    : "";

  // Cards on screen when the chat appeared come without the entrance motion.
  const [initial] = useState(() => new Set(messages.flatMap((m) =>
    [m.id, ...m.stages.map((s) => `${m.id}/${s.id}`), ...m.visuals.map((v) => `${m.id}/visual/${v.id}`)])));
  const isNew = useCallback((id: string) => !initial.has(id), [initial]);

  /** Brings the newest question up towards the top (as far as the content allows). */
  const follow = useCallback((animated: boolean) => {
    const element = scroller.current;
    if (!element || !following.current || !newestQuestion) return;
    const target = Array.from(element.querySelectorAll<HTMLElement>("[data-anchor]")).find((n) => n.dataset.anchor === newestQuestion.id);
    if (!target) return;
    const top = target.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop - 16;
    const max = element.scrollHeight - element.clientHeight;
    const goal = Math.max(0, Math.min(top, max));
    if (Math.abs(goal - element.scrollTop) < 1) return;
    element.scrollTo({ top: goal, behavior: animated && !reduceMotion ? "smooth" : "auto" });
  }, [newestQuestion, reduceMotion]);

  // The person's own scrolling decides whether to follow.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let wheelTimer = 0;
    const onScroll = () => {
      const near = element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM;
      if (near && !following.current) following.current = true;
      if (!near && dragging.current && following.current) following.current = false;
    };
    const start = () => { dragging.current = true; };
    const end = () => { dragging.current = false; };
    const wheel = () => {
      start();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(end, 200);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchend", end, { passive: true });
    element.addEventListener("touchcancel", end, { passive: true });
    element.addEventListener("wheel", wheel, { passive: true });
    element.addEventListener("mousedown", start);
    window.addEventListener("mouseup", end);
    return () => {
      window.clearTimeout(wheelTimer);
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("mousedown", start);
      window.removeEventListener("mouseup", end);
    };
  }, []);

  // On appearing: the newest question at the top, at once.
  useLayoutEffect(() => { follow(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A new question always follows; a growing answer follows while following.
  const lastCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length === lastCount.current) return;
    lastCount.current = messages.length;
    following.current = true;
    follow(true);
  }, [messages.length, follow]);
  const lastGrowth = useRef(growth);
  useEffect(() => {
    if (growth === lastGrowth.current) return;
    lastGrowth.current = growth;
    follow(true);
  }, [growth, follow]);

  /** Asks the question of a failed answer again (typed, as the Ask screen does). */
  const retry = (reply: CoachMessage) => {
    const all = session.getSnapshot().messages;
    const index = all.findIndex((m) => m.id === reply.id);
    if (index <= 0) return;
    const question = all[index - 1].text;
    if (question === CoachSession.investigateText) store.investigate();
    else store.ask(question);
  };

  const enter = (id: string) => (isNew(id) ? SisuMotion.entrance(reduceMotion) : undefined);
  return (
    <div className="sisu-talk-scroll" ref={scroller} data-testid="talk.transcript">
      <div className="sisu-talk-stack">
        {messages.map((message) => (
          <div key={message.id} data-anchor={message.id} data-role={message.role} className={enter(message.id)}>
            {message.role === "user"
              ? <UserBubble text={message.text} pending={message.pending} />
              : <AssistantAnswer message={message} actions={state.actions} retry={() => retry(message)} isNew={isNew} />}
          </div>
        ))}
        <div className="sisu-talk-bottom" aria-hidden="true" />
      </div>
    </div>
  );
}
