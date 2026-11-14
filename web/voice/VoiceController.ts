// Push to talk for any screen that has a `CoachSession`. Port of ios/Sisu/Voice/VoiceController.swift.
// A store (subscribe/getSnapshot, immutable `VoiceControllerState`), read through `useVoice()` in
// web/app/AppProvider.tsx. In CoachStore it is `voice` (made in `use(next)`), with
//   coach.voiceState  what the Rive VoiceButton shows       coach.voiceDown() / coach.voiceUp()  its pressDown / pressUp
// On screen: show `notice` when it is set, and a Rive `Toggle` bound to `isMuted` (`setMuted`).
// Assistive tech cannot hold a button: give the VoiceButton `ariaLabel={voice.accessibilityLabel}` and
// `onActivate={() => voice.toggleFromAccessibility()}` (first activation listens, the second sends).
//
// The controller installs a `SpeechPlayer` as `session.speech`, so replies are spoken (unless muted).
// Voice failing never blocks typing: every failure is a sentence in `notice`.
//
// Web difference: the recorder's stop is async (MediaRecorder), so `pressUp()` ends the recording state at once
// and sends a moment later, when the last audio chunk is in.
import { Store, type CoachSession } from "@/web/core/CoachSession";
import { VoiceAudioFormat, VoiceButtonPresenter, VoicePressRule, VoiceText } from "@/web/core/AppLogic/VoiceLogic";
import type { RiveBindings } from "@/web/core/RiveContract";
import { VoicePrefs } from "./VoicePrefs";
import { SpeechPlayer } from "./SpeechPlayer";
import { VoiceRecorder, VoiceRecording } from "./VoiceRecorder";

export interface VoiceControllerState {
  /** What the Rive `VoiceButton` shows. */
  readonly state: RiveBindings.VoiceState;
  /** A sentence to show: microphone denied, too short a press, speech failed. Null when all is well. */
  readonly notice: string | null;
  /** Spoken clips that started playing (for the voice lab). */
  readonly clipsPlayed: number;
  /** On: replies are not spoken; answers continue as text. */
  readonly isMuted: boolean;
  /** On: typed questions and investigations are spoken too. Off (the default): only voice questions are. */
  readonly speakTypedReplies: boolean;
  /** True while the microphone is (or is being) opened for a press. */
  readonly isRecording: boolean;
}

/** A one-second bundled test clip (a soft tone as 16 kHz WAV), sent instead of the microphone in fixture mode. */
export function fixtureRecording(): VoiceRecording {
  return { data: VoiceAudioFormat.testRecording(), seconds: 1, fileName: "speech.wav", mimeType: "audio/wav" };
}

export class VoiceController extends Store<VoiceControllerState> {
  readonly player: SpeechPlayer;
  /** Records from the microphone, or sends `fixture` when it is set (tests without a microphone). */
  fixture: VoiceRecording | null;

  private readonly recorder = new VoiceRecorder();
  private pressedAt: number | null = null;
  private readonly unsubscribe: () => void;

  constructor(readonly session: CoachSession, fixture: VoiceRecording | null = null) {
    // "Speak replies" off in the person's preferences starts the new session muted.
    const muted = !VoicePrefs.prefs().speakReplies;
    super({ state: "idle", notice: null, clipsPlayed: 0, isMuted: muted, speakTypedReplies: false, isRecording: false });
    this.fixture = fixture;
    this.player = new SpeechPlayer(session.client, session);
    this.player.isMuted = muted;
    session.speech = this.player;
    session.speakReplies = false;
    this.player.onFailure = (sentence) => this.update({ notice: sentence });
    this.player.onClipStarted = (count) => this.update({ clipsPlayed: count });
    this.recorder.onAutoStop = (interrupted) => {
      if (interrupted) {
        this.recorder.discard();
        this.finishRecording();
        this.update({ notice: VoiceText.interrupted });
      } else {
        this.pressUp();
      }
    };
    this.unsubscribe = session.subscribe(() => this.updateState());
  }

  /** Stops listening and speaking and lets go of the session. Called when the session is replaced. */
  dispose(): void {
    this.unsubscribe();
    if (this.state.isRecording) {
      this.recorder.discard();
      this.finishRecording();
    }
    this.recorder.release();
    this.player.dispose();
    if (this.session.speech === this.player) this.session.speech = null;
  }

  get isMuted(): boolean { return this.state.isMuted; }

  /** Swift `isMuted { didSet }`. */
  setMuted(muted: boolean): void {
    if (muted === this.state.isMuted) return;
    this.player.isMuted = muted;
    if (muted) {
      this.session.speakReplies = false;
      this.player.stop();
    }
    this.update({ isMuted: muted, notice: muted ? VoiceText.muted : null });
  }

  setSpeakTypedReplies(on: boolean): void {
    if (on !== this.state.speakTypedReplies) this.update({ speakTypedReplies: on });
  }

  /** Clears the notice (a screen dismissed it). */
  setNotice(notice: string | null): void {
    if (notice !== this.state.notice) this.update({ notice });
  }

  /** Call before a typed question or an investigation starts: sets whether that reply is spoken. */
  beginTypedTurn(): void {
    this.session.speakReplies = this.state.speakTypedReplies && !this.state.isMuted;
  }

  /** The `VoiceButton`'s out triggers: `pressDown` and `pressUp`. */
  handle(trigger: string): void {
    if (trigger === "pressDown") this.pressDown();
    else if (trigger === "pressUp") this.pressUp();
  }

  /** Assistive tech cannot hold a button: the first activation starts listening, the second sends. */
  toggleFromAccessibility(): void {
    if (this.state.isRecording) this.pressUp();
    else this.pressDown();
  }

  get accessibilityLabel(): string { return "Talk to Sisu. " + VoiceButtonPresenter.label(this.state.state); }

  /** Starts listening. Asks for the microphone the first time. Stops anything Sisu is saying. */
  pressDown(): void {
    if (this.state.isRecording) return;
    this.pressedAt = Date.now();
    this.update({ notice: null, isRecording: true });
    this.updateState();
    this.session.setRecording(true);
    if (this.fixture) return;
    void (async () => {
      const problem = await this.recorder.prepare();
      if (problem) {
        this.finishRecording();
        this.update({ notice: problem === "denied" ? VoiceText.microphoneDenied : VoiceText.recordingFailed });
        return;
      }
      // The finger may have lifted while the permission prompt was up.
      if (!this.state.isRecording) {
        this.recorder.release();
        return;
      }
      try {
        this.recorder.start();
      } catch {
        this.recorder.release();
        this.finishRecording();
        this.update({ notice: VoiceText.recordingFailed });
      }
    })();
  }

  /** Stops listening and sends what was heard, unless the press was too short or silent. */
  pressUp(): void {
    if (!this.state.isRecording) return;
    const held = this.pressedAt === null ? 0 : (Date.now() - this.pressedAt) / 1000;
    const pending = this.fixture ? Promise.resolve(this.fixture) : this.recorder.stop();
    this.finishRecording();
    void pending.then((recording) => {
      const outcome = VoicePressRule.outcome(held, recording ? VoiceRecording.size(recording) : 0);
      if (outcome === "tooShort") return this.update({ notice: VoiceText.holdHint });
      if (outcome === "tooLarge") return this.update({ notice: VoiceText.tooLong });
      if (!recording) return;
      this.session.speakReplies = !this.state.isMuted;
      void this.session.sendVoice(recording.data, recording.fileName, recording.mimeType, VoicePrefs.recogniserLanguage());
    });
  }

  private finishRecording(): void {
    this.pressedAt = null;
    if (this.state.isRecording) this.update({ isRecording: false });
    this.session.setRecording(false);
    this.updateState();
  }

  private updateState(): void {
    const next = VoiceButtonPresenter.state(this.state.isRecording, this.session.status);
    if (next !== this.state.state) this.update({ state: next });
  }
}
