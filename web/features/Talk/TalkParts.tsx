"use client";
// The pieces of the Sisu tab (port of the private views of ios/Sisu/Features/Talk/TalkScreen.swift): Liito in a
// soft green circle that breathes with the microphone, the Sisu logo that opens the chat history, the status line
// with the live dot, and the drawn icons.
import { useEffect, useRef, useState, type Ref } from "react";
import { useConversationLevel } from "@/web/app/AppProvider";
import { ConversationPresenter, type ConversationFlow } from "@/web/core/AppLogic/Conversation";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { useReducedMotion } from "@/web/theme/motion";
import { ConversationController } from "@/web/voice/ConversationController";

/** Reduced motion: how long Liito runs after a mood change before it is held still (the blend, plus the one-shot
 *  arrivals of cheering, found and searching), so the held pose is the new mood's own. */
const stillAfter: Partial<Record<RiveBindings.LiitoMood, number>> = { cheering: 1400, found: 1400, searching: 800 };

/** Liito in a soft green circle that breathes with the microphone level. Big in the middle before the first
 *  question, a small filled circle at the top of the chat after it (Liito stands in front of it, not cut by it, so
 *  every prop of a task shows). Tapping it interrupts while Sisu answers. `mood` is what is drawn (the sequenced
 *  mood, web/shared/useLiitoMood.ts), `target` what the events say right now. */
export function LiitoBadge({ mood, target, talk, listening, diameter, liito, filled = false, canInterrupt, onInterrupt, badgeRef }: {
  mood: RiveBindings.LiitoMood;
  target?: RiveBindings.LiitoMood;
  talk: ConversationController;
  listening: boolean;
  diameter: number;
  liito: number;
  filled?: boolean;
  canInterrupt: boolean;
  onInterrupt: () => void;
  badgeRef?: Ref<HTMLDivElement>;
}) {
  const level = useConversationLevel(talk);
  const reduceMotion = useReducedMotion();
  const size = Math.max(diameter, liito);
  const scale = reduceMotion ? 1 : 1 + level * (filled ? 0.12 : 0.16);
  const ringOpacity = filled ? 1 : listening ? 0.55 + level * 0.45 : 0;
  // Rive canvases cancel touchend (no compatibility clicks), so the tap is read from pointer events.
  const down = useRef<{ x: number; y: number } | null>(null);
  const label = canInterrupt ? "Liito the flying squirrel. Tap to interrupt" : `Liito the flying squirrel, ${mood}`;
  return (
    <div
      ref={badgeRef}
      className="sisu-talk-badge"
      data-size={filled ? "small" : "hero"}
      data-mood={mood}
      data-mood-target={target ?? mood}
      data-liito={liito}
      data-listening={listening ? "true" : "false"}
      data-testid="talk.liito"
      style={{ width: size, height: size }}
      role={canInterrupt ? "button" : "img"}
      aria-label={label}
      tabIndex={canInterrupt ? 0 : undefined}
      onPointerDown={(event) => { down.current = { x: event.clientX, y: event.clientY }; }}
      onPointerUp={(event) => {
        const start = down.current;
        down.current = null;
        if (start && canInterrupt && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 12) onInterrupt();
      }}
      onKeyDown={(event) => {
        if (canInterrupt && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onInterrupt();
        }
      }}
    >
      <div className="sisu-talk-ring" aria-hidden="true"
        style={{ width: diameter, height: diameter, transform: `scale(${scale})`, opacity: ringOpacity }} />
      <div className="sisu-talk-liito" aria-hidden="true" style={{ width: liito, height: liito }}>
        <RiveComponent component="Liito" values={RiveBindings.liito(mood)} sizing="contain" style={{ width: liito, height: liito }}
          stillAfterMs={reduceMotion ? stillAfter[mood] ?? 450 : undefined} />
      </div>
      {filled && listening ? (
        <div className="sisu-talk-badge-stroke" aria-hidden="true"
          style={{ width: diameter, height: diameter, opacity: 0.35 + level * 0.65 }} />
      ) : null}
    </div>
  );
}

/** The Sisu logo at the top left: Liito's face in a small circle. It opens the chat history drawer; a small dot
 *  says a saved project has findings not read yet (and the button's name says so too, for screen readers). */
export function SisuLogoButton({ open, unread, onPress, buttonRef }: {
  open: boolean;
  unread: boolean;
  onPress: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={buttonRef} type="button" className="sisu-talk-logo" aria-label={unread ? "Open chat history, new project findings" : "Open chat history"} aria-expanded={open}
      aria-controls="sisu-history" aria-haspopup="dialog" data-testid="history.open" data-unread={unread ? "true" : "false"} onClick={onPress}>
      <span className="sisu-talk-logo-face" aria-hidden="true" />
      <span className="sisu-talk-logo-lines" aria-hidden="true"><HistoryLinesIcon /></span>
      {unread ? <span className="sisu-talk-logo-dot" aria-hidden="true" /> : null}
    </button>
  );
}

/** The start and end of a conversation: a blinking dot and the clock while it runs, the summary after it. */
export function StatusLine({ flow, live, statusLine, detail, compact }: {
  flow: ConversationFlow;
  live: boolean;
  statusLine: string | null;
  detail: string | null;
  compact: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const now = useSecondTicker(live);
  if (live) {
    const paused = flow.micMuted || flow.held;
    const lit = reduceMotion || paused || Math.floor(now) % 2 === 0;
    return (
      <p className="sisu-talk-status" data-compact={compact ? "true" : "false"} data-live="true" data-testid="talk.status">
        <span className="sisu-talk-dot" data-paused={paused ? "true" : "false"} data-lit={lit ? "true" : "false"} aria-hidden="true" />
        <span className="sisu-talk-status-text">{ConversationPresenter.statusLine(flow, ConversationController.now()) ?? ""}</span>
      </p>
    );
  }
  if (statusLine) {
    return (
      <p className="sisu-talk-status" data-compact={compact ? "true" : "false"} data-muted="true" data-testid="talk.status">
        <span className="sisu-talk-status-text">{statusLine}</span>
      </p>
    );
  }
  if (compact) {
    return (
      <p className="sisu-talk-status" data-compact="true" data-muted="true">
        <span className="sisu-talk-status-text">{detail ?? ""}</span>
      </p>
    );
  }
  return <p className="sisu-talk-status" aria-hidden="true">{" "}</p>;
}

/** Seconds on the monotonic clock, re-rendering once a second while `on` (the status clock and the live dot). */
function useSecondTicker(on: boolean): number {
  const [now, setNow] = useState(() => ConversationController.now());
  useEffect(() => {
    if (!on) return;
    const timer = window.setInterval(() => setNow(ConversationController.now()), 1000);
    return () => window.clearInterval(timer);
  }, [on]);
  return now;
}

// MARK: - Icons (drawn stand-ins for the SF Symbols the iOS screen uses)

export function KeyboardIcon() {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true" focusable="false">
      <rect x="1.5" y="3.5" width="23" height="15" rx="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
      {[5.5, 9.5, 13.5, 17.5, 21].map((x) => <rect key={`a${x}`} x={x - 1.1} y="7" width="2.2" height="2.2" rx="0.6" fill="currentColor" />)}
      {[7.5, 11.5, 15.5, 19.5].map((x) => <rect key={`b${x}`} x={x - 1.1} y="10.6" width="2.2" height="2.2" rx="0.6" fill="currentColor" />)}
      <rect x="8" y="14.2" width="10" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export function PencilSquareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M9 3.6H5.2A2.2 2.2 0 0 0 3 5.8v9a2.2 2.2 0 0 0 2.2 2.2h9a2.2 2.2 0 0 0 2.2-2.2V11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M14.6 2.6a1.7 1.7 0 0 1 2.4 2.4l-6.7 6.7-3.1.7.7-3.1z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

/** Three short lines: the logo's "there is a list behind this" hint. */
function HistoryLinesIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true" focusable="false">
      <path d="M1 1.5h10M1 5h7M1 8.5h9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
