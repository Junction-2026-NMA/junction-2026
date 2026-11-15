"use client";
// The Rive VoiceButton, press and hold to talk: its `pressDown` / `pressUp` drive CoachStore.voiceDown() /
// voiceUp(), as in AskScreen.swift. The web also watches the pointer itself (touch, pen or mouse), so a finger that
// slides off the canvas, a cancelled touch or a canvas still loading never leaves the microphone open; each press
// starts and ends once, whichever reports it first. Assistive tech cannot hold: Enter/Space toggles instead.
import { useEffect, useRef, type PointerEvent } from "react";
import { useCoachStore, useVoice, useVoiceController } from "@/web/app/AppProvider";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { riveAccessible } from "@/web/shared/SisuStyle";

export function VoiceHoldButton() {
  const store = useCoachStore();
  const controller = useVoiceController();
  const voice = useVoice(controller);
  const state = voice?.state ?? "idle";
  const held = useRef(false);
  const release = useRef<(() => void) | null>(null);

  const up = () => {
    release.current?.();
    release.current = null;
    if (!held.current) return;
    held.current = false;
    store.voiceUp();
  };
  const down = () => {
    if (held.current) return;
    held.current = true;
    store.voiceDown();
  };

  // Listen for the end of the press on the window, not the canvas: the Rive canvas keeps its own pointer events.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    down();
    release.current?.();
    const pointerId = event.pointerId;
    const end = (other: globalThis.PointerEvent) => { if (other.pointerId === pointerId) up(); };
    const hidden = () => { if (document.visibilityState === "hidden") up(); };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", up);
    document.addEventListener("visibilitychange", hidden);
    release.current = () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", up);
      document.removeEventListener("visibilitychange", hidden);
    };
  };

  // Leaving the screen mid-press ends the recording (and sends what was heard, like a release).
  useEffect(() => () => {
    release.current?.();
    release.current = null;
    if (held.current) {
      held.current = false;
      store.voiceUp();
    }
  }, [store]);

  return (
    <div className="sisu-ask-voice" onPointerDown={onPointerDown} onContextMenu={(event) => event.preventDefault()}>
      <RiveComponent
        component="VoiceButton"
        values={RiveBindings.voiceButton(state)}
        sizing="contain"
        style={{ width: 56, height: 56 }}
        touchScroll={false}
        onTrigger={(trigger) => {
          if (trigger === "pressDown") down();
          if (trigger === "pressUp") up();
        }}
        // For the UI checks: the spoken clips so far.
        testId={`ask.voice.clips.${voice?.clipsPlayed ?? 0}`}
        {...riveAccessible(controller?.accessibilityLabel ?? "Talk to Sisu", {
          isButton: true,
          value: state,
          action: () => controller?.toggleFromAccessibility(),
        })}
      />
    </div>
  );
}

