"use client";
// The Sisu tab while the hands-free conversation is on. The header carries the live state and the stop control:
// `VoiceStatus` (a dot that breathes with the microphone, then Listening / Hearing you / Thinking / Answering and the
// conversation's clock) under the title, and `VoiceStopButton` at the trailing edge (Stop interrupts Sisu's answer
// and Sisu listens again; End ends voice). The dock keeps the voice-first layout (`VoiceDock`): the microphone in the
// middle, which mutes and unmutes, and the keyboard button that goes back to typing. While the microphone is open
// the button is beUI's VoiceOrb (web/agents) in Sisu's greens, moving with the voice level. The words are
// web/core/AppLogic/VoiceBar.ts.
import { useConversationLevel } from "@/web/app/AppProvider";
import { ConversationPresenter, ConversationText, type ConversationFlow } from "@/web/core/AppLogic/Conversation";
import type { VoiceBarState } from "@/web/core/AppLogic/VoiceBar";
import { VoiceBarText } from "@/web/core/AppLogic/VoiceBar";
import { MicGlyph } from "@/web/features/Ask/Composer";
import { VoiceOrb } from "@/web/agents/VoiceOrb";
import { useReducedMotion } from "@/web/theme/motion";
import { ConversationController } from "@/web/voice/ConversationController";
import { KeyboardIcon, useSecondTicker } from "./TalkParts";

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

/** The dock: the live microphone in the middle (tap to mute or unmute), the keyboard button at the trailing edge. */
export function VoiceDock({ flow, talk, micLabel, onType }: {
  flow: ConversationFlow;
  talk: ConversationController;
  micLabel: string;
  onType: () => void;
}) {
  const level = useConversationLevel(talk);
  const reduceMotion = useReducedMotion();
  const scale = reduceMotion || flow.micMuted || !flow.micOpen ? 1 : 1 + level * 0.5;
  return (
    <div className="sisu-talk-launcher" data-testid="talk.voice">
      <span aria-hidden="true" />
      <button type="button" className="sisu-talk-launcher-mic" data-live="true" data-muted={flow.micMuted ? "true" : "false"}
        aria-label={micLabel} data-testid="talk.mute" onClick={() => talk.toggleMute()}>
        <span className="sisu-talk-launcher-halo" aria-hidden="true" style={{ transform: `scale(${scale})` }} />
        {flow.micMuted ? null : <VoiceOrb activity={flow.micOpen ? level : 0} className="sisu-talk-launcher-orb" />}
        <MicGlyph />
        {flow.micMuted ? <span className="sisu-talk-launcher-slash" aria-hidden="true" /> : null}
      </button>
      <button type="button" className="sisu-talk-launcher-type" aria-label={VoiceBarText.typeInstead} data-testid="talk.type" onClick={onType}>
        <KeyboardIcon />
      </button>
    </div>
  );
}
