"use client";
// The dock of the Sisu tab: one microphone and one keyboard control that stay on screen and change shape between
// three modes, so switching between talking and typing is one continuous movement instead of a swap.
// - voice: the microphone in the middle (64 px), the round keyboard button at the trailing edge.
// - typing: the keyboard button stretches into the text field (beUI's PromptInput, Send inside, Stop while Sisu
//   works) and the microphone glides to the field's leading side, a little smaller (52 px, the field's height).
// - live (hands-free voice on): the voice layout, the microphone shows beUI's VoiceOrb moving with the voice level
//   (tap to mute; muted it turns white with a slash), the keyboard button goes back to typing.
// The microphone is the same control in every mode: Sisu green, the same glyph, the same press. The movement is CSS
// (dock.css) on elements that are never unmounted, so the text field can take focus inside the tap that opens it
// (iOS raises the keyboard only then). Under Reduce Motion the change is a short fade.
import { PromptInput } from "@/web/agents/PromptInput";
import { VoiceOrb } from "@/web/agents/VoiceOrb";
import { useConversationLevel } from "@/web/app/AppProvider";
import type { ConversationFlow } from "@/web/core/AppLogic/Conversation";
import { VoiceBarText } from "@/web/core/AppLogic/VoiceBar";
import { useReducedMotion } from "@/web/theme/motion";
import type { ConversationController } from "@/web/voice/ConversationController";
import type { RefObject } from "react";
import { KeyboardIcon } from "./TalkParts";
import "./dock.css";

export type DockMode = "voice" | "typing" | "live";

export function SisuDock({ mode, draft, setDraft, thinking, onSend, onStop, inputRef, onFocusChange, onVoice, onKeyboard, onTypeInstead,
  flow, talk, micLabel, voiceEnabled = true }: {
  mode: DockMode;
  draft: string;
  setDraft: (text: string) => void;
  /** Sisu is working on a typed question: Send is Stop. */
  thinking: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onFocusChange?: (focused: boolean) => void;
  /** The microphone outside live voice: start talking with Sisu. */
  onVoice: () => void;
  /** The keyboard button outside live voice: open the text field (focus it inside the tap). */
  onKeyboard: () => void;
  /** The keyboard button during live voice: end voice and type. */
  onTypeInstead: () => void;
  flow: ConversationFlow;
  talk: ConversationController;
  /** The microphone's label during live voice (mute or unmute). */
  micLabel: string;
  /** False where the browser cannot record: the microphone is greyed out, typing still works. */
  voiceEnabled?: boolean;
}) {
  const typing = mode === "typing";
  const live = mode === "live";
  const testId = typing ? "talk.composer" : live ? "talk.voice" : "talk.launcher";
  return (
    <div className="sisu-dock" data-mode={mode} data-testid={testId}>
      <span className="sisu-dock-spacer" aria-hidden="true" />
      <DockMic live={live} flow={flow} talk={talk} label={live ? micLabel : "Talk to Sisu"} enabled={live || voiceEnabled}
        onPress={live ? () => talk.toggleMute() : onVoice} />
      <div className="sisu-dock-field">
        <button type="button" className="sisu-dock-keyboard" aria-label={VoiceBarText.typeInstead} aria-hidden={typing || undefined}
          tabIndex={typing ? -1 : undefined} inert={typing} data-testid={live ? "talk.type" : "talk.keyboard"}
          onClick={live ? onTypeInstead : onKeyboard}>
          <KeyboardIcon />
        </button>
        <div className="sisu-dock-prompt" aria-hidden={!typing || undefined} inert={!typing}>
          <PromptInput value={draft} onValueChange={setDraft} onSubmit={onSend} loading={thinking} onStop={onStop} bare
            placeholder="Ask Sisu anything" label="Your question" textareaRef={inputRef} maxRows={4} onFocusChange={onFocusChange}
            testIds={{ field: "ask.field", send: "ask.send", stop: "ask.stop" }} />
        </div>
      </div>
    </div>
  );
}

/** The one microphone: solid Sisu green with the white glyph; live, the orb inside it and a halo that follows the
 *  level; muted, white with a slash. */
function DockMic({ live, flow, talk, label, enabled, onPress }: {
  live: boolean;
  flow: ConversationFlow;
  talk: ConversationController;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const level = useConversationLevel(talk);
  const reduceMotion = useReducedMotion();
  const muted = live && flow.micMuted;
  const listening = live && !muted && flow.micOpen;
  const scale = reduceMotion || !listening ? 1 : 1 + level * 0.5;
  // Pressing the microphone does not take focus from the text field, so the field stays up until the tap lands;
  // starting voice then lets the field go (TalkScreen blurs it) and the dock moves to the voice layout.
  return (
    <button type="button" className="sisu-dock-mic" data-live={live ? "true" : "false"} data-muted={muted ? "true" : "false"}
      aria-label={label} disabled={!enabled} data-testid={live ? "talk.mute" : "talk.start"}
      onMouseDown={(event) => { if (!live) event.preventDefault(); }}
      onClick={onPress}>
      {live && !muted ? (
        <>
          <span className="sisu-dock-mic-halo" aria-hidden="true" style={{ transform: `scale(${scale})` }} />
          <VoiceOrb activity={listening ? level : 0} className="sisu-dock-orb" />
        </>
      ) : null}
      <MicGlyph />
      {muted ? <span className="sisu-dock-mic-slash" aria-hidden="true" /> : null}
    </button>
  );
}

export function MicGlyph() {
  return (
    <svg className="sisu-dock-mic-glyph" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8.4" y="2.6" width="7.2" height="12.4" rx="3.6" fill="currentColor" />
      <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17.8" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
