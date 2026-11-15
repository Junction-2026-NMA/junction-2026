"use client";
// The Sisu tab's default dock: voice first. A large microphone in the middle starts the hands-free conversation; a
// small keyboard button on the side opens the text field (Ask/Composer.tsx, the field with Send and the microphone
// beside it). TalkScreen switches back here when the field is left empty.
import { VoiceBarText } from "@/web/core/AppLogic/VoiceBar";
import { MicGlyph } from "@/web/features/Ask/Composer";
import { KeyboardIcon } from "./TalkParts";

export function VoiceLauncher({ onVoice, onType, voiceEnabled = true }: {
  onVoice: () => void;
  onType: () => void;
  /** False where the browser cannot record: the microphone is greyed out, typing still works. */
  voiceEnabled?: boolean;
}) {
  return (
    <div className="sisu-talk-launcher" data-testid="talk.launcher">
      <span aria-hidden="true" />
      <button type="button" className="sisu-talk-launcher-mic" aria-label="Talk to Sisu" disabled={!voiceEnabled} data-testid="talk.start"
        onClick={onVoice}>
        <MicGlyph />
      </button>
      <button type="button" className="sisu-talk-launcher-type" aria-label={VoiceBarText.typeInstead} data-testid="talk.keyboard"
        onClick={onType}>
        <KeyboardIcon />
      </button>
    </div>
  );
}
