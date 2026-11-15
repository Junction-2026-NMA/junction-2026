"use client";
// The composer while the hands-free conversation is on: one live line (Listening, Hearing you, Thinking, Answering)
// whose dot breathes with the microphone, a keyboard button that goes back to typing, and the stop control. While
// Sisu answers, Stop interrupts it and Sisu listens again; otherwise End ends voice. The words are
// web/core/AppLogic/VoiceBar.ts.
import { useConversationLevel } from "@/web/app/AppProvider";
import type { VoiceBarState } from "@/web/core/AppLogic/VoiceBar";
import { VoiceBarText } from "@/web/core/AppLogic/VoiceBar";
import { useReducedMotion } from "@/web/theme/motion";
import type { ConversationController } from "@/web/voice/ConversationController";
import { KeyboardIcon } from "./TalkParts";

export function VoiceStrip({ bar, talk, onStop, onType }: {
  bar: VoiceBarState;
  talk: ConversationController;
  onStop: () => void;
  onType: () => void;
}) {
  const level = useConversationLevel(talk);
  const reduceMotion = useReducedMotion();
  const hearing = bar.tone === "hearing" || bar.tone === "listening";
  const scale = reduceMotion || !hearing ? 1 : 1 + level * 0.9;
  return (
    <div className="sisu-talk-strip" data-tone={bar.tone} data-testid="talk.voice">
      <button type="button" className="sisu-talk-strip-type" aria-label={VoiceBarText.typeInstead} data-testid="talk.type" onClick={onType}>
        <KeyboardIcon />
      </button>
      <div className="sisu-talk-strip-status" role="status" aria-live="polite" data-testid="talk.voice.state">
        <span className="sisu-talk-strip-dot" aria-hidden="true">
          <span className="sisu-talk-strip-halo" style={{ transform: `scale(${scale})` }} />
          <span className="sisu-talk-strip-core" />
        </span>
        <span className="sisu-talk-strip-text">
          <span className="sisu-talk-strip-label">{bar.label}</span>
          {bar.detail ? <span className="sisu-talk-strip-detail">{bar.detail}</span> : null}
        </span>
      </div>
      <button type="button" className="sisu-talk-strip-stop" data-kind={bar.stop} aria-label={bar.stopLabel}
        data-testid={bar.stop === "interrupt" ? "talk.stop" : "talk.end"} onClick={onStop}>
        <span className="sisu-talk-strip-stop-mark" aria-hidden="true" />
        <span aria-hidden="true">{bar.stop === "interrupt" ? "Stop" : "End"}</span>
      </button>
    </div>
  );
}
