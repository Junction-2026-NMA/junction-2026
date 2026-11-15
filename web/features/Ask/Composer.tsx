"use client";
// The ask box of the Sisu tab: beUI's PromptInput (web/agents) in the Sisu look, a text field that grows to four
// lines with Send inside it (Stop while Sisu works), and beside it the microphone that starts the hands-free
// conversation (web/voice/ConversationController.ts). Typed and spoken questions go to the same session, so they
// are one conversation. Return sends; Shift+Return adds a line on a hardware keyboard; IME composition is respected.
import type { RefObject } from "react";
import { PromptInput } from "@/web/agents/PromptInput";

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
  return (
    <div className="sisu-ask-composer">
      <PromptInput value={draft} onValueChange={setDraft} onSubmit={onSend} loading={thinking} onStop={onStop}
        placeholder="Ask Sisu anything" label="Your question" textareaRef={inputRef} maxRows={4} onFocusChange={onFocusChange}
        testIds={{ field: "ask.field", send: "ask.send", stop: "ask.stop" }} />
      <button type="button" className="sisu-ask-mic" aria-label="Talk to Sisu" disabled={!voiceEnabled} data-testid="talk.start"
        onClick={onVoice}>
        <MicGlyph />
      </button>
    </div>
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
