/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/VoiceLogic.swift. Pure rules behind push-to-talk and Sisu's spoken replies. The web
// recorder and player (web/voice) only move audio; every decision they make comes from here. Audio bytes are
// `Uint8Array` where Swift has `Data`.
import type { CoachStatus } from "@/web/core/CoachSession";
import { rawOf } from "@/web/core/Presentation";
import type { RiveBindings } from "@/web/core/RiveContract";

/** What to do with a finished press of the talk button. */
export type VoicePressOutcome =
  /** Send the recording. */
  | "send"
  /** Too short or silent: send nothing and show `VoiceText.holdHint`. */
  | "tooShort"
  /** Over the server's size limit: send nothing and show `VoiceText.tooLong`. */
  | "tooLarge";

/** The press-length rule: a press shorter than `minimumSeconds`, or an empty recording, sends nothing. */
export namespace VoicePressRule {
  /** About 0.3 seconds: anything shorter is a tap, not speech. */
  export const minimumSeconds = 0.3;
  /** Recording stops on its own after this long. */
  export const maximumSeconds = 60;
  /** The backend's limit for one recording (`MAX_AUDIO_BYTES` in lib/agent/speech.ts). */
  export const maximumBytes = 5 * 1024 * 1024;

  export function outcome(pressedForSeconds: number, bytes: number): VoicePressOutcome {
    if (!Number.isFinite(pressedForSeconds) || !(pressedForSeconds >= minimumSeconds) || !(bytes > 0)) return "tooShort";
    return bytes > maximumBytes ? "tooLarge" : "send";
  }
}

/** The state of the Rive `VoiceButton`, from the microphone and the session. */
export namespace VoiceButtonPresenter {
  /** The recorder wins (it is the user's finger on the button); otherwise the session's status decides. */
  export function state(isRecording: boolean, status: CoachStatus): RiveBindings.VoiceState {
    if (isRecording) return "recording";
    const raw = rawOf(status);
    return raw === "recording" || raw === "thinking" || raw === "speaking" ? raw : "idle";
  }

  /** A short line for the state, for screen readers and the lab screen. */
  export function label(state: RiveBindings.VoiceState): string {
    switch (state) {
      case "idle": return "Hold to talk";
      case "recording": return "Listening";
      case "thinking": return "Thinking";
      case "speaking": return "Speaking";
    }
  }
}

/** The app's sentences about voice. Calm, one next step, typing always works. */
export namespace VoiceText {
  export const holdHint = "Hold the button while you speak.";
  export const microphoneDenied = "Sisu cannot hear you: allow the microphone in Settings. You can still type.";
  export const recordingFailed = "Sisu could not record that. Try again, or type your question.";
  export const tooLong = "That was a long one. Keep it under a minute, or type it.";
  export const speechFailed = "Sisu could not speak this answer. It is here as text.";
  export const interrupted = "The recording stopped because another sound took over. Try again.";
  export const muted = "Spoken replies are off. Answers come as text.";

  /** The line under the "Speak replies" switch. */
  export function speakRepliesDetail(muted: boolean): string {
    return muted ? "Off: answers come as text only." : "On: Sisu reads each answer aloud.";
  }

  /** `1 spoken clip played`, `3 spoken clips played` (the voice lab). */
  export function clipsPlayed(count: number): string { return count === 1 ? "1 spoken clip played" : `${count} spoken clips played`; }
}

/**
 * Puts spoken clips back in order. Sentences are fetched in parallel, so clip 2 can arrive before clip 1; the player
 * asks `next()` and gets clips strictly by `order`, never skipping one that has not arrived. A clip that failed to
 * download is delivered as null and is skipped. `stop()` drops everything and makes any clip that arrives later
 * (from the old turn) count for nothing. A small mutable queue, owned by one player (Swift holds it as a `var`).
 */
export class VoiceClipQueue<Clip> {
  /** Bumped by `stop()`. Tag each download with it and pass it back to `deliver`. */
  private generationValue = 0;
  private expected = 0;
  private arrived = new Map<number, Clip | null>();

  get generation(): number { return this.generationValue; }

  /** Stores the clip of sentence `order` from the download started in `generation`. False when it belongs to a stopped turn or was already played. */
  deliver(clip: Clip | null, order: number, generation: number): boolean {
    if (generation !== this.generationValue || order < this.expected || this.arrived.has(order)) return false;
    this.arrived.set(order, clip);
    return true;
  }

  /** The next clip to play, if it has arrived. Failed clips are passed over on the way. */
  next(): Clip | null {
    while (this.arrived.has(this.expected)) {
      const slot = this.arrived.get(this.expected) ?? null;
      this.arrived.delete(this.expected);
      this.expected += 1;
      if (slot !== null) return slot;
    }
    return null;
  }

  /** True when a clip is waiting at the head of the line. */
  get hasNext(): boolean { return this.arrived.has(this.expected); }

  /** The order the queue waits for next. */
  get waitingFor(): number { return this.expected; }

  /** Drops what is queued and starts over at order 0 for the next turn. */
  stop(): void {
    this.generationValue += 1;
    this.expected = 0;
    this.arrived = new Map();
  }
}

/** Audio formats the backend may send for one sentence. */
export namespace VoiceAudioFormat {
  /** A file type hint from a response's content type (`audio/mpeg` → `mp3`). Null for raw PCM, which needs `wav` first. */
  export function fileTypeHint(contentType: string): string | null {
    const type = (contentType.toLowerCase().split(";").filter((part) => part !== "")[0] ?? "").trim();
    switch (type) {
      case "audio/mpeg": case "audio/mp3": return "mp3";
      case "audio/wav": case "audio/wave": case "audio/x-wav": case "audio/vnd.wave": return "wav";
      case "audio/mp4": case "audio/m4a": case "audio/x-m4a": case "audio/aac": return "m4a";
      default: return null;
    }
  }

  /** True for `audio/pcm` (16-bit little-endian mono, the rate in `rate=`). */
  export function isPCM(contentType: string): boolean {
    const lower = contentType.toLowerCase();
    return lower.startsWith("audio/pcm") || lower.startsWith("audio/l16");
  }

  /** The `rate=` parameter of a PCM content type, or 24 000 (the backend's PCM rate) when it is missing. */
  export function pcmRate(contentType: string): number {
    for (const part of contentType.split(";")) {
      const at = part.indexOf("=");
      if (at < 0) continue;
      const key = part.slice(0, at).trim(), value = part.slice(at + 1).trim();
      if (key.toLowerCase() === "rate" && /^[+-]?\d+$/.test(value) && Number(value) > 0) return Number(value);
    }
    return 24_000;
  }

  /** Wraps 16-bit mono PCM in a WAV header so an `<audio>` element can play it. */
  export function wav(pcm: Uint8Array, sampleRate: number): Uint8Array {
    const out = new Uint8Array(44 + pcm.length);
    const view = new DataView(out.buffer);
    const ascii = (offset: number, text: string) => { for (let i = 0; i < text.length; i += 1) out[offset + i] = text.charCodeAt(i); };
    ascii(0, "RIFF"); view.setUint32(4, 36 + pcm.length, true);
    ascii(8, "WAVE");
    ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, "data"); view.setUint32(40, pcm.length, true);
    out.set(pcm, 44);
    return out;
  }

  /** A one-second test recording: a soft 440 Hz tone, 16 kHz mono 16-bit WAV (the voice lab's fixture mode). */
  export function testRecording(seconds = 1, sampleRate = 16_000): Uint8Array {
    const count = Math.max(1, Math.trunc(sampleRate * seconds));
    const pcm = new Uint8Array(count * 2);
    const view = new DataView(pcm.buffer);
    for (let index = 0; index < count; index += 1) {
      view.setInt16(index * 2, Math.trunc(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 6_000), true);
    }
    return wav(pcm, sampleRate);
  }
}
