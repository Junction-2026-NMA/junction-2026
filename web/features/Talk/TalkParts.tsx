"use client";
// The pieces of the Talk screen (port of the private views of ios/Sisu/Features/Talk/TalkScreen.swift): Liito in a
// soft green circle that breathes with the microphone, the round microphone and keyboard buttons, the round icon
// button of the chat header, and the status line with the live dot.
import { useEffect, useRef, useState, type Ref } from "react";
import { useConversationLevel } from "@/web/app/AppProvider";
import { ConversationPresenter, type ConversationFlow } from "@/web/core/AppLogic/Conversation";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { useReducedMotion } from "@/web/theme/motion";
import { ConversationController } from "@/web/voice/ConversationController";

/** Liito in a soft green circle that breathes with the microphone level. Big in the middle before the first
 *  question, a small filled circle at the top of the chat after it. Tapping it interrupts while Sisu answers. */
export function LiitoBadge({ mood, talk, listening, diameter, liito, filled = false, canInterrupt, onInterrupt, badgeRef }: {
  mood: RiveBindings.LiitoMood;
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
  const size = filled ? diameter : Math.max(diameter, liito);
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
        <RiveComponent component="Liito" values={RiveBindings.liito(mood)} sizing="contain" style={{ width: liito, height: liito }} />
      </div>
      {filled && listening ? (
        <div className="sisu-talk-badge-stroke" aria-hidden="true" style={{ opacity: 0.35 + level * 0.65 }} />
      ) : null}
    </div>
  );
}

/** The round microphone button: on (white with a hairline) or muted (dark, with the slashed microphone). Greyed
 *  out when there is no conversation to mute. */
export function MicButton({ muted, enabled, label, onPress }: { muted: boolean; enabled: boolean; label: string; onPress: () => void }) {
  return (
    <button type="button" className="sisu-talk-round" data-variant={muted ? "dark" : "light"} disabled={!enabled}
      aria-label={label} aria-pressed={muted} data-testid="talk.mic" onClick={onPress}>
      <span className="sisu-talk-round-face">{muted ? <MicSlashIcon /> : <MicIcon />}</span>
    </button>
  );
}

/** A round 60 px control beside Start / End, the same size and press as the microphone button. */
export function RoundControl({ label, testId, onPress, children }: { label: string; testId: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="sisu-talk-round" data-variant="light" aria-label={label} data-testid={testId} onClick={onPress}>
      <span className="sisu-talk-round-face">{children}</span>
    </button>
  );
}

/** A round 48 px icon button on a white card surface (the chat header's "New conversation"). */
export function RoundIconButton({ label, testId, onPress, children }: { label: string; testId: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="sisu-talk-icon-button" aria-label={label} data-testid={testId} onClick={onPress}>
      {children}
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
    return <p className="sisu-talk-status" data-compact={compact ? "true" : "false"} data-muted="true" data-testid="talk.status">{statusLine}</p>;
  }
  if (compact) {
    return <p className="sisu-talk-status" data-compact="true" data-muted="true">{detail ?? ""}</p>;
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

export function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8.4" y="2.6" width="7.2" height="12.4" rx="3.6" fill="currentColor" />
      <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17.8" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MicSlashIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8.4" y="2.6" width="7.2" height="12.4" rx="3.6" fill="currentColor" />
      <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17.8" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="3.4" x2="20" y2="20.6" stroke="var(--sisu-color-text)" strokeWidth="4.4" strokeLinecap="round" />
      <line x1="4" y1="3.4" x2="20" y2="20.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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
