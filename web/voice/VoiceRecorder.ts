// The microphone: push to talk with getUserMedia + MediaRecorder. Port of ios/Sisu/Voice/VoiceRecorder.swift.
// iOS records AAC (.m4a, audio/mp4); browsers record what they can: Opus in WebM (Chrome, Firefox, newer
// Safari) or AAC in MP4 (iOS Safari). The backend hands the file to ElevenLabs speech to text, which reads all
// of them; the only server limit is 5 MB (lib/agent/speech.ts MAX_AUDIO_BYTES), and ~32 kbit/s keeps a full
// minute near 240 KB. The microphone is opened for each press and closed after it, as on iOS.
//
// Differences from AVAudioRecorder: opening the microphone is async (`prepare()`, which also asks for
// permission), and so is `stop()` (MediaRecorder hands the last chunk over in an event).
import { VoicePressRule } from "@/web/core/AppLogic/VoiceLogic";

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

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt: number | null = null;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onHidden = () => {
    if (document.visibilityState === "hidden" && this.isRecording) this.onAutoStop?.(true);
  };

  /** Called when recording stopped on its own: the 60 second limit (false) or an interruption (true). */
  onAutoStop: ((interrupted: boolean) => void) | null = null;

  get isRecording(): boolean { return this.recorder?.state === "recording"; }

  /** Opens the microphone (asking the first time). Swift `VoiceAudioSession.requestMicrophone()`. */
  async prepare(): Promise<MicrophoneProblem | null> {
    if (this.stream) return null;
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

  /** Starts recording on the opened microphone. Throws when it cannot. Call `prepare()` first. */
  start(): void {
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
    this.startedAt = Date.now();
    this.limitTimer = setTimeout(() => {
      if (this.recorder === recorder) this.onAutoStop?.(false);
    }, VoicePressRule.maximumSeconds * 1000);
    document.addEventListener("visibilitychange", this.onHidden);
  }

  /** Stops and returns what was recorded (null when nothing was). Always closes the microphone. */
  stop(): Promise<VoiceRecording | null> {
    const recorder = this.recorder;
    const startedAt = this.startedAt;
    this.recorder = null;
    this.startedAt = null;
    if (this.limitTimer !== null) clearTimeout(this.limitTimer);
    this.limitTimer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onHidden);
    if (!recorder || recorder.state === "inactive") {
      this.release();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const finish = () => {
        this.release();
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
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
  }
}
