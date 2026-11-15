"use client";
// An empty Sisu conversation: Liito, larger and animated, and one friendly line, centred above the ask box. No
// suggestion list (the owner removed it, 15 Nov): the ask box and the microphone are the way in. While voice is on
// one short line says Sisu is listening.
import type { ReactNode } from "react";

export function SisuEmptyState({ name, liito, voiceOn }: {
  name: string | null;
  /** The big Liito badge (it travels to the header once the chat starts). */
  liito: ReactNode;
  voiceOn: boolean;
}) {
  return (
    <div className="sisu-talk-empty" data-testid="talk.empty">
      <div className="sisu-talk-empty-hero">
        {liito}
        <h2 className="sisu-talk-empty-line">{name ? `Hi ${name}, what would you like to know?` : "What would you like to know?"}</h2>
        {voiceOn ? <p className="sisu-talk-empty-hint">Sisu is listening. Ask out loud, then pause.</p> : null}
      </div>
    </div>
  );
}
