// The hands-free conversation on the Talk screen. Port of ios/Sisu/Voice/ConversationController.swift. Every
// decision is web/core's `ConversationFlow` (and its `SpeechEndpointer`); this controller only carries out the
// commands it returns: it opens and closes the microphone, reads its level 20 times a second, sends a finished
// question through the backend's existing voice turn (`CoachSession.sendVoice`: speech to text, the agent with
// Nemotron and Exa, spoken sentences) and tells the flow when the answer has been fully spoken, so it listens again.
//
// It shares the voice controller's `SpeechPlayer`, so replies sound the same and the "Speak replies" setting applies
// to both. Voice failing never blocks typing: the conversation sheet (the Ask screen) always works.
//
// A store (subscribe/getSnapshot) with an immutable `ConversationControllerState`; the Talk screen reads it with
// `useConversation()` (web/app/AppProvider.tsx).
//
// Web differences: the microphone is opened for each question (getUserMedia) and closed again while Sisu answers,
// so iOS Safari plays the answer through the speaker at full volume (a live microphone track routes or ducks it);
// MediaRecorder's stop is async, so a question is sent a moment after the pause that ends it.
import { Store, type CoachSession } from "@/web/core/CoachSession";
import type { SisuActivity } from "@/web/core/Activity";
import { ConversationFlow, ConversationPresenter, type ConversationCommand, type ConversationEnd, type ConversationScreenState } from "@/web/core/AppLogic/Conversation";
import { VoicePressRule } from "@/web/core/AppLogic/VoiceLogic";
import type { SpeechPlayer } from "./SpeechPlayer";
import { VoiceRecorder, VoiceRecording } from "./VoiceRecorder";

export interface ConversationControllerState {
  /** Where the conversation is, as last published (a copy: it changes only when something on screen changes). */
  readonly flow: ConversationFlow;
  /** How loud the microphone is right now, 0 to 1 above the room, for the ring around Liito. */
  readonly level: number;
  /** Bumped when a conversation starts and when it ends (haptics, tests). */
  readonly starts: number;
  readonly ends: number;
}

const METER_MS = 50;

export class ConversationController extends Store<ConversationControllerState> {
  /** Records from the microphone, or "hears" this clip once when set (screenshots and tests). */
  fixture: VoiceRecording | null;
  /** In fixture mode: seconds of quiet after the microphone opens before the clip is "spoken". */
  fixtureDelay = 1;
  /** True when replies must stay silent (the "Speak replies" setting is off). */
  repliesMuted: () => boolean = () => false;

  /** The running state machine: fed 20 times a second, published to `state.flow` when the screen would change. */
  private machine = new ConversationFlow();
  private readonly recorder = new VoiceRecorder();
  private meter: ReturnType<typeof setInterval> | null = null;
  /** The voice turn on its way, if any. */
  private turn: Promise<void> | null = null;
  /** Bumped whenever a recording is opened, sent or dropped, so a late async step of an old one changes nothing. */
  private token = 0;
  private waitingForSpeech = false;
  /** The screen came back while someone else's turn (a typed question) was still running: listen after it. */
  private resumeWhenQuiet = false;
  private micOpenedAt = 0;
  private fixtureQuestionsLeft = 1;
  private disposed = false;
  private readonly unsubscribe: () => void;

  constructor(readonly session: CoachSession, private readonly player: SpeechPlayer, fixture: VoiceRecording | null = null) {
    super({ flow: new ConversationFlow(), level: 0, starts: 0, ends: 0 });
    this.fixture = fixture;
    player.onDrained = () => this.speechDrained();
    this.recorder.onAutoStop = (interrupted) => {
      if (!interrupted) {
        // The recorder's own one-minute limit: send what there is.
        this.send();
        return;
      }
      this.recorder.discard();
      this.session.setRecording(false);
      // The page went to the background: that is a pause (the screen holds the conversation), not an end.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        this.run(this.machine.setHeld(true, ConversationController.now()));
        return;
      }
      this.run(this.machine.microphoneFailed("interrupted", ConversationController.now()));
    };
    this.unsubscribe = session.subscribe(() => this.sessionChanged());
  }

  /** A monotonic clock in seconds. */
  static now(): number {
    return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  }

  // MARK: What the screen shows

  /** The flow as last published. */
  get flow(): ConversationFlow { return this.state.flow; }

  screen(activity: SisuActivity, opening: { title: string; detail: string } | null, now = ConversationController.now()): ConversationScreenState {
    return ConversationPresenter.state(this.state.flow, activity, now, opening, this.session.getSnapshot().task);
  }

  // MARK: The person

  /** The Start / End button. */
  toggle(): void {
    if (this.machine.isOn) this.end();
    else this.start();
  }

  start(): void {
    if (this.machine.isOn || this.disposed) return;
    this.fixtureQuestionsLeft = 1;
    const commands = this.machine.start(ConversationController.now());
    this.update({ starts: this.state.starts + 1 });
    haptic(12);
    this.run(commands);
  }

  end(): void {
    if (!this.machine.isOn) return;
    this.run(this.machine.end("byUser", ConversationController.now()));
  }

  toggleMute(): void {
    this.run(this.machine.setMicMuted(!this.machine.micMuted, ConversationController.now()));
  }

  /** Tapping Liito while Sisu answers. */
  interrupt(): void {
    this.run(this.machine.interrupt(ConversationController.now()));
  }

  /** "New conversation": clears the chat, so Liito comes back to the middle. A running conversation keeps
   *  listening; an answer on its way stops. */
  newConversation(): void {
    if (this.machine.isAnswering) this.run(this.machine.interrupt(ConversationController.now()));
    this.session.reset();
    this.machine.clearSummary();
    this.publish();
  }

  // MARK: The app

  /** The Talk screen is not visible (another tab, the conversation sheet, the app in the background). */
  setHeld(held: boolean): void {
    if (this.disposed) return;
    const s = this.session.getSnapshot();
    if (!held && (s.isThinking || s.isSpeaking || !this.player.isIdle) && !this.machine.isAnswering) {
      // Someone else's turn is still running (a question typed in the sheet): do not cut it off.
      this.resumeWhenQuiet = true;
      return;
    }
    this.resumeWhenQuiet = false;
    this.run(this.machine.setHeld(held, ConversationController.now()));
  }

  /** Forgets the conversation (the customer changed). */
  shutDown(): void {
    this.run(this.machine.end("byUser", ConversationController.now()));
    this.disposed = true;
    if (this.player.onDrained) this.player.onDrained = null;
    this.unsubscribe();
    this.stopMeter();
    this.recorder.release();
  }

  // MARK: Commands

  private run(commands: ConversationCommand[]): void {
    for (const command of commands) this.perform(command);
    this.publish();
    this.syncMeter();
  }

  /** Publishes the machine when anything the screen shows has changed. */
  private publish(): void {
    const shown = this.state.flow, next = this.machine;
    const same = shown.phase === next.phase && shown.micMuted === next.micMuted && shown.held === next.held
      && shown.micOpen === next.micOpen && shown.questions === next.questions && shown.startedAt === next.startedAt
      && shown.lastEnded === next.lastEnded;
    if (same) return;
    const ended = shown.isOn && !next.isOn;
    if (ended) haptic([8, 40, 8]);
    this.update({ flow: next.copy(), ends: ended ? this.state.ends + 1 : this.state.ends });
  }

  private perform(command: ConversationCommand): void {
    switch (command) {
      case "openMicrophone": this.openMicrophone(); break;
      case "discardRecording":
        this.token += 1;
        this.recorder.discard();
        this.session.setRecording(false);
        break;
      case "sendRecording": this.send(); break;
      case "stopSisu":
        this.token += 1;
        this.turn = null;
        this.waitingForSpeech = false;
        this.session.cancel();
        break;
    }
  }

  private openMicrophone(): void {
    this.micOpenedAt = ConversationController.now();
    this.token += 1;
    const token = this.token;
    // Opening the microphone tells the session it is listening (Liito and the activity follow).
    this.session.setRecording(true);
    if (this.fixture) return;
    void (async () => {
      const problem = await this.recorder.prepare();
      if (token !== this.token || !this.machine.micOpen) {
        // Closed while the permission prompt was up, or a newer open replaced this one. Let the microphone go
        // unless a newer open is about to record on it.
        if (!this.machine.micOpen && !this.recorder.isRecording) this.recorder.release();
        return;
      }
      if (problem) {
        this.session.setRecording(false);
        this.fail(problem === "denied" ? "microphoneDenied" : "microphoneFailed");
        return;
      }
      if (this.recorder.isRecording) return;
      try {
        this.recorder.start(true);
      } catch {
        this.recorder.release();
        this.session.setRecording(false);
        this.fail("microphoneFailed");
      }
    })();
  }

  private fail(reason: ConversationEnd): void {
    this.run(this.machine.microphoneFailed(reason, ConversationController.now()));
  }

  /** Stops the recording and sends it. The flow has already moved to `thinking`. */
  private send(): void {
    this.token += 1;
    const token = this.token;
    const recording = this.fixture ? Promise.resolve(this.fixture) : this.recorder.stop();
    this.session.setRecording(false);
    void recording.then((heard) => {
      if (token !== this.token || this.machine.phase !== "thinking") return;
      const size = heard ? VoiceRecording.size(heard) : 0;
      if (!heard || size === 0 || size > VoicePressRule.maximumBytes) {
        this.run(this.machine.nothingToSend(ConversationController.now()));
        return;
      }
      this.session.speakReplies = !this.repliesMuted();
      const turn = this.session.sendVoice(heard.data, heard.fileName, heard.mimeType);
      this.turn = turn;
      void turn.then(() => {
        if (this.turn !== turn || token !== this.token) return;
        this.answerArrived();
      });
    });
  }

  /** The answer's stream has ended. Its last sentences may still be playing. */
  private answerArrived(): void {
    this.turn = null;
    if (!this.machine.isAnswering) return;
    if (this.player.isIdle) this.run(this.machine.replyFinished(ConversationController.now()));
    else this.waitingForSpeech = true;
  }

  private speechDrained(): void {
    if (this.waitingForSpeech && this.turn === null) {
      this.waitingForSpeech = false;
      this.run(this.machine.replyFinished(ConversationController.now()));
    }
    this.resumeIfQuiet();
  }

  private sessionChanged(): void {
    if (this.disposed) return;
    const speaking = this.session.getSnapshot().isSpeaking;
    if ((speaking && this.machine.phase === "thinking") || (!speaking && this.machine.phase === "speaking")) {
      this.machine.sisuSpeaking(speaking);
      this.publish();
    }
    this.resumeIfQuiet();
  }

  private resumeIfQuiet(): void {
    const s = this.session.getSnapshot();
    if (!this.resumeWhenQuiet || s.isThinking || s.isSpeaking || !this.player.isIdle) return;
    this.resumeWhenQuiet = false;
    this.run(this.machine.setHeld(false, ConversationController.now()));
  }

  // MARK: Level

  private syncMeter(): void {
    if (this.machine.micOpen) {
      if (this.meter === null) this.meter = setInterval(() => this.tick(), METER_MS);
    } else {
      this.stopMeter();
    }
  }

  private stopMeter(): void {
    if (this.meter !== null) clearInterval(this.meter);
    this.meter = null;
    if (this.state.level !== 0) this.update({ level: 0 });
  }

  private tick(): void {
    if (!this.machine.micOpen) return;
    const now = ConversationController.now();
    let reading: number;
    if (this.fixture) {
      reading = this.fixtureLevel(now - this.micOpenedAt);
    } else {
      const measured = this.recorder.level();
      // The recorder is still starting (permission prompt, getUserMedia): nothing to read yet.
      if (measured === null) return;
      reading = measured;
    }
    const ring = ConversationPresenter.ringLevel(reading, this.machine.endpointer.noiseFloor);
    if (Math.abs(ring - this.state.level) > 0.02) this.update({ level: ring });
    const commands = this.machine.level(reading, now);
    if (commands.includes("sendRecording")) this.fixtureQuestionsLeft -= 1;
    if (commands.length > 0) this.run(commands);
    else this.publish();
  }

  /** Fixture mode "speaks" once: a quiet start, about a second of speech, then quiet, so the real endpointer
   *  decides when the question ends. After that it stays quiet. */
  private fixtureLevel(seconds: number): number {
    if (this.fixtureQuestionsLeft <= 0) return -62;
    const speaking = seconds > this.fixtureDelay && seconds < this.fixtureDelay + 1.1;
    return speaking ? -18 + Math.sin(seconds * 19) * 5 : -62;
  }
}

/** A short vibration where the browser can (`.sensoryFeedback(.start / .stop)`; not on iOS Safari). */
function haptic(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // Not allowed here.
  }
}
