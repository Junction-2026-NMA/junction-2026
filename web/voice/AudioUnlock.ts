// The shared audio output: the web side of VoiceAudioSession's playback half. Mobile browsers keep a page's
// sound blocked until a user gesture, and Sisu's replies start long after the tap that asked for them. So one
// AudioContext is made for the whole app and unlocked (resumed, plus a silent one-sample buffer for iOS Safari)
// on the first tap, key press or touch anywhere. After that every clip plays without a gesture.
// `installAudioUnlock()` is called once by the app root.

type AudioContextClass = typeof AudioContext;

let context: AudioContext | null = null;
let unlocked = false;

/** iOS Safari's audio session kinds (Safari 16.4+ / iOS 17). Elsewhere `navigator.audioSession` is missing. */
export type AudioSessionKind = "playback" | "play-and-record";

/**
 * Tells iOS Safari what the page's sound is. By default iOS treats Web Audio as "ambient", so the ringer
 * (silent) switch mutes it: a clip decodes and "plays" but nothing is heard. "playback" makes it media,
 * like a video, which the silent switch does not mute. While the microphone is open the recorder asks for
 * "play-and-record" instead, and goes back to "playback" when it lets the microphone go.
 */
export function setAudioSessionKind(kind: AudioSessionKind): void {
  if (typeof navigator === "undefined") return;
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = kind;
  } catch {
    // Older Safari: nothing to set.
  }
}

/** The app's AudioContext, made on first use. Null where the browser has no Web Audio. */
export function audioContext(): AudioContext | null {
  if (context) return context;
  if (typeof window === "undefined") return null;
  const Context: AudioContextClass | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
  if (!Context) return null;
  setAudioSessionKind("playback");
  try {
    context = new Context();
  } catch {
    return null;
  }
  return context;
}

/** True once a gesture has let the page play sound (or the context already runs). */
export function audioUnlocked(): boolean {
  return unlocked || context?.state === "running";
}

/** Call inside a user gesture: resumes the context and plays one silent sample. Safe to call often. */
export function unlockAudio(): void {
  const ctx = audioContext();
  if (!ctx) return;
  try {
    if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    unlocked = true;
  } catch {
    // Not allowed yet; the next gesture tries again.
  }
}

const gestureEvents = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
let installed = false;

/** Unlocks audio on gestures anywhere in the page (while it is not running). Returns the uninstall function. */
export function installAudioUnlock(): () => void {
  if (typeof document === "undefined" || installed) return () => undefined;
  installed = true;
  // Kept for the page's life: iOS can suspend the context again (background, a call), and the next tap
  // must wake it. A running context is left alone, so this costs nothing per tap.
  const onGesture = () => {
    if (context?.state !== "running") unlockAudio();
  };
  const remove = () => {
    gestureEvents.forEach((name) => document.removeEventListener(name, onGesture, true));
    installed = false;
  };
  gestureEvents.forEach((name) => document.addEventListener(name, onGesture, { capture: true, passive: true }));
  return remove;
}
