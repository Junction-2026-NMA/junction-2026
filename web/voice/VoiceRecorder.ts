// The microphone: push to talk with getUserMedia + MediaRecorder. Port of ios/Sisu/Voice/VoiceRecorder.swift.
// iOS records AAC (.m4a, audio/mp4); browsers record what they can: Opus in WebM (Chrome, Firefox, newer
// Safari) or AAC in MP4 (iOS Safari). The backend hands the file to ElevenLabs speech to text, which reads all
// of them; the only server limit is 5 MB (lib/agent/speech.ts MAX_AUDIO_BYTES), and ~32 kbit/s keeps a full
// minute near 240 KB. The microphone is opened for each press and closed after it, as on iOS.
//
// Differences from AVAudioRecorder: opening the microphone is async (`prepare()`, which also asks for
// permission), and so is `stop()` (MediaRecorder hands the last chunk over in an event).
//
// Metering (`start(true)`, `level()`), for the hands-free conversation (web/voice/ConversationController.ts): an
// AnalyserNode on the app's shared AudioContext reads the microphone (it is never connected to the speakers), and
// `level()` is 20·log10 of the RMS of its latest samples, in dBFS like AVAudioRecorder.averagePower (0 is loudest,
// -160 silence).
import { VoicePressRule } from "@/web/core/AppLogic/VoiceLogic";
import { audioContext } from "./AudioUnlock";

/** One finished recording. */
export interface VoiceRecording {
  readonly data: Blob | Uint8Array;
  readonly seconds: number;
  readonly fileName: string;
  readonly mimeType: string;
}

export const VoiceRecording = {
  /** The bytes' size, for VoicePressRule. */
  size(recording: VoiceRecording): number {
    return recording.data instanceof Blob ? recording.data.size : recording.data.length;
  },
} as const;

/** Why the microphone could not be opened. */
export type MicrophoneProblem = "denied" | "failed";

/** The containers tried, in order. The first the browser can record is used. */
export const recordingTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"] as const;

/** A file name the backend (and ElevenLabs) recognise for a recorded content type. */
export function recordingFileName(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("mp4") || type.includes("aac") || type.includes("m4a")) return "speech.m4a";
  if (type.includes("ogg")) return "speech.ogg";
  if (type.includes("wav")) return "speech.wav";
  return "speech.webm";
}

function supportedType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of recordingTypes) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // isTypeSupported can throw on very old engines: try the next.
    }
  }
  return null;
}

/** The microphone's level meter: a source and an analyser on the shared AudioContext. */
interface Meter {
  readonly source: MediaStreamAudioSourceNode;
  readonly analyser: AnalyserNode;
  readonly samples: Float32Array<ArrayBuffer>;
}

/** The quietest level `level()` reports, in dBFS (AVAudioRecorder's floor). */
export const silenceLevel = -160;

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private meter: Meter | null = null;
  private chunks: Blob[] = [];
  private startedAt: number | null = null;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onHidden = () => {
    if (document.visibilityState === "hidden" && this.isRecording) this.onAutoStop?.(true);
  };

  /** Called when recording stopped on its own: the 60 second limit (false) or an interruption (true). */
  onAutoStop: ((interrupted: boolean) => void) | null = null;

  get isRecording(): boolean { return this.recorder?.state === "recording"; }

  /** Opens the microphone (asking the first time). Swift `VoiceAudioSession.requestMicrophone()`. Calls made while
   *  one is still asking share its answer, so two quick opens never leave a second microphone stream running. */
  prepare(): Promise<MicrophoneProblem | null> {
    if (this.stream) return Promise.resolve(null);
    this.preparing ??= this.openStream().finally(() => { this.preparing = null; });
    return this.preparing;
  }

  private preparing: Promise<MicrophoneProblem | null> | null = null;

  private async openStream(): Promise<MicrophoneProblem | null> {
    const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    // No microphone API (an old browser, or a plain-http page, where browsers hide it) or no MediaRecorder.
    if (!devices?.getUserMedia || typeof MediaRecorder === "undefined") return "failed";
    try {
      this.stream = await devices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      return null;
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError" ? "denied" : "failed";
    }
  }

  /**
   * Starts recording on the opened microphone. Throws when it cannot. Call `prepare()` first.
   * @param metering also measure the level, for `level()` (the hands-free conversation needs it).
   */
  start(metering = false): void {
    const stream = this.stream;
    if (!stream) throw new Error("microphone not open");
    const mimeType = supportedType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    this.chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks = [...this.chunks, event.data];
    };
    recorder.onerror = () => {
      if (this.recorder === recorder) this.onAutoStop?.(true);
    };
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (this.recorder === recorder) this.onAutoStop?.(true);
      };
    });
    recorder.start();
    this.recorder = recorder;
    this.meter = metering ? VoiceRecorder.makeMeter(stream) : null;
    this.startedAt = Date.now();
    this.limitTimer = setTimeout(() => {
      if (this.recorder === recorder) this.onAutoStop?.(false);
    }, VoicePressRule.maximumSeconds * 1000);
    document.addEventListener("visibilitychange", this.onHidden);
  }

  /** The microphone's level right now in dBFS (0 is loudest, -160 silence). Null when not recording or not metering. */
  level(): number | null {
    const meter = this.meter;
    if (!meter || !this.isRecording) return null;
    const samples = meter.samples;
    meter.analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
    const rms = Math.sqrt(sum / Math.max(samples.length, 1));
    return rms > 0 ? Math.max(20 * Math.log10(rms), silenceLevel) : silenceLevel;
  }

  /** Stops and returns what was recorded (null when nothing was). Always closes the microphone. */
  stop(): Promise<VoiceRecording | null> {
    const recorder = this.recorder;
    const startedAt = this.startedAt;
    // This recording's microphone and meter are let go of here and now, so a new `prepare()` right after (the
    // conversation reopens the microphone at once after a false start) gets its own stream, which the end of this
    // stop never closes.
    const stream = this.stream;
    this.stream = null;
    this.recorder = null;
    this.startedAt = null;
    VoiceRecorder.closeMeter(this.meter);
    this.meter = null;
    if (this.limitTimer !== null) clearTimeout(this.limitTimer);
    this.limitTimer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onHidden);
    if (!recorder || recorder.state === "inactive") {
      VoiceRecorder.closeStream(stream);
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const finish = () => {
        VoiceRecorder.closeStream(stream);
        const seconds = startedAt === null ? 0 : (Date.now() - startedAt) / 1000;
        const type = recorder.mimeType || this.chunks[0]?.type || "audio/webm";
        const data = this.chunks.length > 0 ? new Blob(this.chunks, { type }) : null;
        this.chunks = [];
        resolve(data && data.size > 0 ? { data, seconds, fileName: recordingFileName(type), mimeType: type.split(";")[0] } : null);
      };
      recorder.onstop = finish;
      try {
        recorder.stop();
      } catch {
        finish();
      }
    });
  }

  /** Throws the recording away. */
  discard(): void {
    void this.stop();
  }

  /** Closes the microphone (the browser's recording indicator goes away). */
  release(): void {
    VoiceRecorder.closeMeter(this.meter);
    this.meter = null;
    VoiceRecorder.closeStream(this.stream);
    this.stream = null;
  }

  private static closeStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  }

  /** A level meter on the shared AudioContext, or null where Web Audio is missing. Not connected to the speakers. */
  private static makeMeter(stream: MediaStream): Meter | null {
    const ctx = audioContext();
    if (!ctx) return null;
    try {
      if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      return { source, analyser, samples: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)) };
    } catch {
      return null;
    }
  }

  private static closeMeter(meter: Meter | null): void {
    if (!meter) return;
    try {
      meter.source.disconnect();
      meter.analyser.disconnect();
    } catch {
      // Already disconnected.
    }
  }
}
