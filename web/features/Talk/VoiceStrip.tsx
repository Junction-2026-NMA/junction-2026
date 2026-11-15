"use client";
// The Sisu tab while the hands-free conversation is on. The header carries the live state and the stop control:
// `VoiceStatus` (a dot that breathes with the microphone, then Listening / Hearing you / Thinking / Answering and the
// conversation's clock) under the title, and `VoiceStopButton` at the trailing edge (Stop interrupts Sisu's answer
// and Sisu listens again; End ends voice). The dock's live microphone (mute) and keyboard button are SisuDock.tsx.
// The words are web/core/AppLogic/VoiceBar.ts.
import { useConversationLevel } from "@/web/app/AppProvider";
import { ConversationPresenter, ConversationText, type ConversationFlow } from "@/web/core/AppLogic/Conversation";
import type { VoiceBarState } from "@/web/core/AppLogic/VoiceBar";
import { useReducedMotion } from "@/web/theme/motion";
import { ConversationController } from "@/web/voice/ConversationController";
import { useSecondTicker } from "./TalkParts";

/** Under the title: the live dot and "Thinking · 0:11" ("Microphone off · 0:11" while muted). */
export function VoiceStatus({ bar, flow, talk }: { bar: VoiceBarState; flow: ConversationFlow; talk: ConversationController }) {
  const now = useSecondTicker(true);
  const level = useConversationLevel(talk);
  const reduceMotion = useReducedMotion();
  const hearing = bar.tone === "hearing" || bar.tone === "listening";
  const scale = reduceMotion || !hearing ? 1 : 1 + level * 0.9;
  const parts = [flow.micMuted ? ConversationText.mutedTitle : bar.label, ConversationPresenter.clock(flow.elapsed(now))];
  return (
    <p className="sisu-talk-voice-status" data-tone={bar.tone} data-muted={flow.micMuted ? "true" : "false"} role="status" aria-live="polite"
      data-testid="talk.voice.state">
      <span className="sisu-talk-strip-dot" aria-hidden="true">
        <span className="sisu-talk-strip-halo" style={{ transform: `scale(${scale})` }} />
        <span className="sisu-talk-strip-core" />
      </span>
      <span className="sisu-talk-status-text">{parts.join(" · ")}</span>
    </p>
  );
}

/** The header's stop control: Stop while Sisu answers (interrupt), End otherwise. */
export function VoiceStopButton({ bar, onStop }: { bar: VoiceBarState; onStop: () => void }) {
  return (
    <button type="button" className="sisu-talk-strip-stop" data-kind={bar.stop} aria-label={bar.stopLabel}
      data-testid={bar.stop === "interrupt" ? "talk.stop" : "talk.end"} onClick={onStop}>
      <span className="sisu-talk-strip-stop-mark" aria-hidden="true" />
      <span aria-hidden="true">{bar.stop === "interrupt" ? "Stop" : "End"}</span>
    </button>
  );
}
