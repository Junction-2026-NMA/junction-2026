"use client";
// The fixed pieces of the coach screen: the header with Liito, the one-time fallback notice, the empty state with
// suggested questions and the user's bubble. Port of `header`, `fallbackNotice`, `emptyState` and UserBubble in
// AskScreen.swift.
import { useEffect, useRef } from "react";
import type { CoachSession } from "@/web/core/CoachSession";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { TransientNotice } from "@/web/shared/Notice";
import { Eyebrow, SisuButton, SisuIconButton, riveAccessible } from "@/web/shared/SisuStyle";
import { useReducedMotion } from "@/web/theme/motion";

const suggestions = [
  "How much do I spend on everyday things?",
  "Can you find me a cheaper electricity deal?",
  "Can I afford a €200 trip?",
];

/** Reduced motion: how long Liito runs after a mood change before it is held still (the blend, plus the one-shot
 *  arrivals of cheering, found and searching). */
const stillAfter: Partial<Record<RiveBindings.LiitoMood, number>> = { cheering: 1400, found: 1400, searching: 800 };

/** The header. `mood` is what Liito draws (sequenced, web/shared/useLiitoMood.ts), `target` what the events say now. */
export function AskHeader({ mood, target, title = "Ask Sisu", onClose }: {
  mood: RiveBindings.LiitoMood;
  target?: RiveBindings.LiitoMood;
  title?: string;
  onClose?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <header className="sisu-ask-header">
      <h1 className="sisu-ask-title">{title}</h1>
      <span className="sisu-ask-liito" data-mood={mood} data-mood-target={target ?? mood} data-testid="ask.liito">
        <RiveComponent component="Liito" values={RiveBindings.liito(mood)} sizing="contain" style={{ width: 72, height: 72 }}
          stillAfterMs={reduceMotion ? stillAfter[mood] ?? 450 : undefined}
          {...riveAccessible("Liito the flying squirrel", { value: mood })} />
      </span>
      {onClose ? (
        <span className="sisu-ask-close" data-testid="conversation.close">
          <SisuIconButton icon="close" label="Close the conversation" action={onClose} />
        </span>
      ) : null}
    </header>
  );
}

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

export function AskEmptyState({ draftEmpty, onAsk, onInvestigate }: {
  draftEmpty: boolean;
  onAsk: (question: string) => void;
  onInvestigate: () => void;
}) {
  return (
    <div className="sisu-ask-empty">
      <p className="sisu-ask-h2">Ask about your money. Sisu checks your own numbers first.</p>
      <div className="sisu-ask-empty-eyebrow"><Eyebrow text="Try one of these" /></div>
      {suggestions.map((question) => (
        <SisuButton key={question} label={question} style="secondary" action={() => onAsk(question)} />
      ))}
      <div className="sisu-ask-empty-eyebrow"><Eyebrow text="Or let Sisu work through a whole case" /></div>
      <SisuButton label="Look into my finances" style={draftEmpty ? "primary" : "secondary"} action={onInvestigate} />
    </div>
  );
}

/** The user's message: right-aligned, deep green. */
export function UserBubble({ text, pending }: { text: string; pending: boolean }) {
  return (
    <div className="sisu-ask-user" aria-label={`You asked: ${text}`} role="group">
      <p className="sisu-ask-user-bubble" aria-hidden="true" data-selectable>{text === "" && pending ? "Listening…" : text}</p>
    </div>
  );
}
