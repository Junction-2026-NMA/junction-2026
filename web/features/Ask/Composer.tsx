"use client";
// The ask box of the Sisu tab: a text field that grows to four lines with Send inside it (Stop while Sisu works),
// and beside it the microphone that starts the hands-free conversation (web/voice/ConversationController.ts). Typed
// and spoken questions go to the same session, so they are one conversation. Return sends; Shift+Return adds a line
// on a hardware keyboard; IME composition is respected.
import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";

/** Four lines of body text (16 px at 1.4) plus the field's 10 px top and bottom padding. */
const MAX_HEIGHT = Math.ceil(16 * 1.4 * 4) + 20;

export function Composer({ draft, setDraft, thinking, onSend, onStop, onVoice, voiceEnabled = true, inputRef, onFocusChange }: {
  draft: string;
  setDraft: (text: string) => void;
  thinking: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** The microphone: start talking with Sisu. */
  onVoice: () => void;
  /** False where the browser cannot record: the microphone is greyed out, typing still works. */
  voiceEnabled?: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onFocusChange?: (focused: boolean) => void;
}) {
  const composing = useRef(false);
  const canSend = draft.trim() !== "";

  // Grow with the text, one to four lines, then scroll inside.
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT)}px`;
    field.style.overflowY = field.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [draft, inputRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || composing.current || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!thinking) onSend(draft);
  };

  return (
    <div className="sisu-ask-composer">
      <div className="sisu-ask-box">
        <textarea
          ref={inputRef}
          className="sisu-ask-field"
          rows={1}
          value={draft}
          placeholder="Ask Sisu anything"
          aria-label="Your question"
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          data-testid="ask.field"
        />
        {/* Keeps the field (and the keyboard) up when Send or Stop is tapped, as on iOS. */}
        {thinking ? (
          <button type="button" className="sisu-ask-send" data-variant="stop" aria-label="Stop Sisu" data-testid="ask.stop"
            onMouseDown={(event) => event.preventDefault()} onClick={onStop}>
            <StopGlyph />
          </button>
        ) : (
          <button type="button" className="sisu-ask-send" data-variant={canSend ? "ready" : "idle"} aria-label="Send" disabled={!canSend}
            data-testid="ask.send" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (canSend) onSend(draft); }}>
            <SendGlyph />
          </button>
        )}
      </div>
      <button type="button" className="sisu-ask-mic" aria-label="Talk to Sisu" disabled={!voiceEnabled} data-testid="talk.start"
        onClick={onVoice}>
        <MicGlyph />
      </button>
    </div>
  );
}

function SendGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 16V4.6M5 9.4 10 4.4l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="10" height="10" rx="2.4" fill="currentColor" />
    </svg>
  );
}

export function MicGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8.4" y="2.6" width="7.2" height="12.4" rx="3.6" fill="currentColor" />
      <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17.8" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
