// Sisu's voice: web/core's `SpeechOutput` for the app. Port of ios/Sisu/Voice/SpeechPlayer.swift. Each sentence is
// fetched from the backend's text to speech (`CoachClient.speech`, POST /api/voice/tts, mp3) as soon as it
// arrives, and the clips play strictly in order with no gap, even when a later clip finishes downloading first
// (`VoiceClipQueue`). `stop()` is immediate.
//
// Web Audio instead of AVAudioPlayer: clips are decoded with `decodeAudioData` and played on the app's shared
// AudioContext (web/voice/AudioUnlock.ts), which the first tap anywhere unlocks, because mobile browsers block
// sound that does not start inside a gesture. Raw PCM gets a WAV header first, as on iOS. A context that iOS
// marks "interrupted" (a call, another app) stops the answer; it stays on screen as text.
import type { CoachClient } from "@/web/core/CoachClient";
import type { CoachSession, SpeechOutput } from "@/web/core/CoachSession";
import { SpeechRequest, type SpeechAudio } from "@/web/core/CoachModels";
import { VoiceAudioFormat, VoiceClipQueue, VoiceText } from "@/web/core/AppLogic/VoiceLogic";
import { audioContext } from "./AudioUnlock";

/** One downloaded and decoded sentence. */
export type SpeechClip = AudioBuffer;

const RESUME_WAIT_MS = 400;

export class SpeechPlayer implements SpeechOutput {
  /** The session owns the player (`session.speech`); set to null by `dispose()`. */
  session: CoachSession | null;
  /** On: sentences are dropped and nothing is fetched. */
  isMuted = false;
  /** Called with a sentence when a clip could not be fetched or played. */
  onFailure: ((sentence: string) => void) | null = null;
  /** Counts clips that started playing, for the voice lab and its tests. */
  clipsPlayed = 0;
  onClipStarted: ((count: number) => void) | null = null;
  /** Called when the last queued sentence has finished playing and nothing is downloading (the hands-free
   *  conversation waits for it before it listens again). */
  onDrained: (() => void) | null = null;

  /** Nothing is playing and no sentence is still downloading. */
  get isIdle(): boolean { return this.current === null && !this.starting && this.pending === 0; }

  private queue = new VoiceClipQueue<SpeechClip>();
  private downloads: AbortController[] = [];
  private current: AudioBufferSourceNode | null = null;
  private starting = false;
  private previousText: string | null = null;
  /** Sentences asked for and not yet delivered to the queue. */
  private pending = 0;
  private readonly watched: AudioContext | null;
  private readonly onStateChange = () => {
    // Safari's "interrupted": a call or another app took the audio. Stop and drop the rest of this answer.
    if ((this.watched?.state as string) === "interrupted") this.stop();
  };

  constructor(private readonly client: CoachClient, session: CoachSession | null = null) {
    this.session = session;
    this.watched = audioContext();
    this.watched?.addEventListener("statechange", this.onStateChange);
  }

  /** Stops and lets go of the context listener. Call when the session is replaced. */
  dispose(): void {
    this.stop();
    this.watched?.removeEventListener("statechange", this.onStateChange);
    this.session = null;
  }

  // MARK: SpeechOutput

  speak(text: string, order: number): void {
    if (this.isMuted) return;
    const generation = this.queue.generation;
    const request = SpeechRequest.make({ text, format: "mp3", previousText: this.previousText });
    this.previousText = text;
    const abort = new AbortController();
    this.downloads = [...this.downloads, abort];
    this.pending += 1;
    void (async () => {
      let clip: SpeechClip | null = null;
      try {
        clip = await SpeechPlayer.playable(await this.client.speech(request, abort.signal));
      } catch {
        clip = null;
      }
      this.downloads = this.downloads.filter((d) => d !== abort);
      if (abort.signal.aborted || generation !== this.queue.generation) return;
      this.pending = Math.max(0, this.pending - 1);
      if (clip === null) this.onFailure?.(VoiceText.speechFailed);
      if (this.queue.deliver(clip, order, generation)) await this.playNextIfIdle();
      if (this.isIdle) this.onDrained?.();
    })();
  }

  stop(): void {
    this.queue.stop();
    this.downloads.forEach((d) => d.abort());
    this.downloads = [];
    this.pending = 0;
    this.previousText = null;
    const player = this.current;
    this.current = null;
    if (player) {
      player.onended = null;
      try {
        player.stop();
      } catch {
        // Already finished.
      }
    }
    this.session?.setSpeaking(false);
  }

  // MARK: Playback

  /** Decoded audio by the response's content type. Raw PCM gets a WAV header. Null when it cannot be played. */
  private static async playable(audio: SpeechAudio): Promise<SpeechClip | null> {
    if (audio.data.length === 0) return null;
    const ctx = audioContext();
    if (!ctx) return null;
    const bytes = VoiceAudioFormat.isPCM(audio.contentType)
      ? VoiceAudioFormat.wav(audio.data, VoiceAudioFormat.pcmRate(audio.contentType))
      : audio.data;
    // decodeAudioData takes (and detaches) its own ArrayBuffer.
    const copy = bytes.slice().buffer as ArrayBuffer;
    try {
      return await ctx.decodeAudioData(copy);
    } catch {
      return null;
    }
  }

  private async playNextIfIdle(): Promise<void> {
    if (this.current || this.starting) return;
    const generation = this.queue.generation;
    for (let clip = this.queue.next(); clip !== null; clip = this.queue.next()) {
      const ctx = audioContext();
      if (ctx && ctx.state !== "running") {
        this.starting = true;
        await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, RESUME_WAIT_MS))]);
        this.starting = false;
        if (generation !== this.queue.generation) return;
      }
      if (!ctx || ctx.state !== "running") {
        this.onFailure?.(VoiceText.speechFailed);
        continue;
      }
      try {
        const source = ctx.createBufferSource();
        source.buffer = clip;
        source.connect(ctx.destination);
        source.onended = () => this.finished(source);
        source.start();
        this.current = source;
        this.clipsPlayed += 1;
        this.onClipStarted?.(this.clipsPlayed);
        this.session?.setSpeaking(true);
        return;
      } catch {
        this.onFailure?.(VoiceText.speechFailed);
      }
    }
    // Nothing ready. Keep "speaking" only while the turn may still send sentences.
    this.session?.setSpeaking(false);
  }

  private finished(source: AudioBufferSourceNode): void {
    if (this.current !== source) return;
    this.current = null;
    void this.playNextIfIdle().then(() => {
      if (this.isIdle) this.onDrained?.();
    });
  }
}
