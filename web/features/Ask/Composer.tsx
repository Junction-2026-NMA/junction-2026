"use client";
// The ask box: a text field that grows to four lines, Send (or Stop while Sisu works) and the hold-to-talk
// VoiceButton. Port of `composer` in AskScreen.swift. Return sends (the `.submitLabel(.send)` / `.onSubmit`);
// Shift+Return adds a line on a hardware keyboard.
import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { SisuButton } from "@/web/shared/SisuStyle";
import { VoiceHoldButton } from "./VoiceHoldButton";

/** Four lines of body text (16 px at 1.4) plus the field's 12 px top and bottom padding. */
const MAX_HEIGHT = Math.ceil(16 * 1.4 * 4) + 24;

export function Composer({ draft, setDraft, thinking, sendIsPrimary, onSend, onStop, inputRef }: {
  draft: string;
  setDraft: (text: string) => void;
  thinking: boolean;
  /** One primary button on screen: Send is primary only when there is text and nothing else holds the primary. */
  sendIsPrimary: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const composing = useRef(false);
  const canSend = draft.trim() !== "";

  // Grow with the text, one to four lines (`.lineLimit(1...4)`), then scroll inside.
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
    onSend(draft);
  };

  return (
    <div className="sisu-ask-composer">
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
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        data-testid="ask.field"
      />
      {/* Keeps the field (and the keyboard) up when Send or Stop is tapped, as on iOS. */}
      <div className="sisu-ask-send" onMouseDown={(event) => event.preventDefault()}>
        {thinking ? (
          <SisuButton label="Stop" style="secondary" action={onStop} />
        ) : (
          <SisuButton label="Send" style={sendIsPrimary ? "primary" : "secondary"} enabled={canSend}
            action={() => { if (canSend) onSend(draft); }} />
        )}
      </div>
      <VoiceHoldButton />
    </div>
  );
}
