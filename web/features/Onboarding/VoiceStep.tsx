"use client";
// The first run's voice step, before the profile: the language you speak, the language Sisu answers in, a voice
// with a short preview and "Speak replies" (the same section as Settings). Skippable: nothing chosen keeps
// Automatic and Sisu's usual voice. Everything can be changed later in Settings.
import { VoiceSettings } from "@/web/features/Sheets/VoiceSettings";
import { SisuButton } from "@/web/shared/SisuStyle";

export function VoiceStep({ next }: { next: () => void }) {
  return (
    <div className="sisu-onb-step sisu-onb-voice" data-testid="onboarding.voice">
      <div className="sisu-onb-voice-scroll">
        <div className="sisu-onb-voice-content">
          <h1 className="sisu-onb-h1">How should Sisu talk?</h1>
          <p className="sisu-onb-body-large sisu-onb-text">Pick a language and a voice. You can type instead at any time, and change this later in Settings.</p>
          <div className="sisu-onb-voice-card">
            <VoiceSettings testPrefix="onboarding" />
          </div>
        </div>
      </div>
      <div className="sisu-onb-button-row">
        <SisuButton label="Continue" action={next} />
      </div>
    </div>
  );
}
