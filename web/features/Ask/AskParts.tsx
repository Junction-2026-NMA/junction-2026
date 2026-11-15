"use client";
// Pieces of the conversation shared by the Sisu tab: the one-time fallback notice and the user's bubble. Port of
// `fallbackNotice` and UserBubble in AskScreen.swift; the bubble is beUI's MessageBubble since 15 Nov.
import { useEffect, useRef } from "react";
import type { CoachSession } from "@/web/core/CoachSession";
import { TransientNotice } from "@/web/shared/Notice";
import { MessageBubble, MessageBubbleCollapsible, MessageTyping } from "@/web/agents/Message";

/**
 * Said once, in place, when Sisu switches from the live server to the recorded answers (or starts on them because
 * the app already found the server unreachable). Not a permanent badge: Settings has the details.
 */
export function FallbackNotice({ session, notice, fellBackToSample }: { session: CoachSession; notice: string | null; fellBackToSample: boolean }) {
  if (notice) {
    return (
      <div className="sisu-ask-notice">
        <DismissOnLeave onLeave={() => session.dismissFallbackNotice()} />
        <TransientNotice id={`coach-fallback-${session.customerId}`} text={notice} />
      </div>
    );
  }
  if (fellBackToSample) {
    return (
      <div className="sisu-ask-notice">
        <TransientNotice id={`coach-unreachable-${session.customerId}`}
          text="Sisu's server could not be reached, so you see recorded sample answers." />
      </div>
    );
  }
  return null;
}

/** Swift `.onDisappear { session.dismissFallbackNotice() }`: when the notice leaves the screen. The call waits a
 *  tick so React's development remount (mount, unmount, mount) does not count as leaving. */
function DismissOnLeave({ onLeave }: { onLeave: () => void }) {
  const latest = useRef(onLeave);
  const mounted = useRef(false);
  useEffect(() => { latest.current = onLeave; });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.setTimeout(() => { if (!mounted.current) latest.current(); }, 0);
    };
  }, []);
  return null;
}

/** The user's message: a beUI MessageBubble (web/agents), right-aligned in Sisu green. A question asked out loud
 *  carries a small microphone mark (the same bubble otherwise: typed and spoken turns are one conversation); one
 *  still being heard shows beUI's typing dots, and the bubble grows smoothly to the words once they arrive. A long
 *  question (a spoken one can run on) is clamped to five lines with "Show more" (beUI MessageBubbleCollapsible). */
/** Characters past which a question is clamped (about five lines of the bubble on a phone). */
const LONG_QUESTION = 240;

export function UserBubble({ text, pending, spoken = false, animateIn = false }: { text: string; pending: boolean; spoken?: boolean; animateIn?: boolean }) {
  const listening = text === "" && pending;
  return (
    <MessageBubble variant="solid" animateIn={animateIn} layoutKey={text} role="group" aria-label={`${spoken ? "You said" : "You asked"}: ${listening ? "Listening…" : text}`}
      data-spoken={spoken ? "true" : "false"} data-testid="ask.user">
      {text.length > LONG_QUESTION ? (
        <MessageBubbleCollapsible lines={5} contentHidden>
          {spoken ? <SpokenMark /> : null}{text}
        </MessageBubbleCollapsible>
      ) : (
        <span aria-hidden="true" data-selectable>
          {spoken ? <SpokenMark /> : null}
          {listening ? <MessageTyping label="Listening…" /> : text}
        </span>
      )}
    </MessageBubble>
  );
}

function SpokenMark() {
  return (
    <svg className="sisu-ask-user-mic" width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
      <rect x="3.6" y="0.8" width="4.8" height="8" rx="2.4" fill="currentColor" />
      <path d="M1.6 6.6a4.4 4.4 0 0 0 8.8 0M6 11v2.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
