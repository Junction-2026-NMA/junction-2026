/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Hands-free conversation with Sisu: the rules behind the Talk screen. Port of SisuCore/AppLogic/Conversation.swift.
// The app's controller (web/voice/ConversationController.ts) only moves audio and carries out the commands these
// rules return.
//
// One conversation: Start opens the microphone. `SpeechEndpointer` hears when the person starts and stops talking,
// from the microphone's level alone (no speech model on the phone). The recording then goes to the backend's
// existing voice turn, `CoachSession.sendVoice` (speech to text, the agent with Nemotron and Exa, the answer as
// spoken sentences). Sisu answers out loud, then the microphone opens again, until End. The microphone is closed
// while Sisu talks, so Sisu never hears itself.
//
// Web difference: `SpeechEndpointer` and `ConversationFlow` are small mutable classes (Swift: structs with
// mutating methods), owned by one controller like `VoiceClipQueue`; `copy()` gives the controller an independent
// value to publish to the screen.
import type { SisuActivity } from "@/web/core/Activity";
import { SisuActivityState } from "@/web/core/Activity";
import { LiitoTask } from "@/web/core/LiitoTask";
import type { RiveBindings } from "@/web/core/RiveContract";
import { VoiceText } from "./VoiceLogic";

// MARK: - When a question starts and ends

/**
 * Decides, from the microphone's level in dBFS (0 is loudest, about -160 is silence), when speech starts and when a
 * question has ended. Feed it about 20 levels a second with the time they were read. The noise floor adapts to the
 * room, so a quiet bedroom and a busy booth both work.
 */
export class SpeechEndpointer {
  static readonly initialNoiseFloor = -50;
  private static readonly bucket = 0.25;

  readonly tuning: SpeechEndpointer.Tuning;
  /** The level of the room without speech, in dBFS. */
  noiseFloor: number;
  /** True from the start of speech until the question ends. */
  isSpeaking = false;
  /** True once the question has ended. Nothing more happens until `reset`. */
  isFinished = false;

  private recordingStart: number;
  private loudSince: number | null = null;
  private pauseSince: number | null = null;
  private speech = 0;
  private lastTime: number | null = null;
  /** Until then the room is only measured. */
  private calibratedAt: number;
  private calibrationLow = Infinity;
  /** The quietest level of each quarter second of the floor window, oldest first. */
  private lows: number[] = [];
  private bucketLow = Infinity;
  private bucketStart: number | null = null;

  /** A fresh endpointer measures the room first (`Tuning.calibration`). */
  constructor(tuning: SpeechEndpointer.Tuning = SpeechEndpointer.tuning(), now = 0) {
    this.tuning = tuning;
    this.noiseFloor = SpeechEndpointer.initialNoiseFloor;
    this.recordingStart = now;
    this.calibratedAt = now + tuning.calibration;
  }

  /** An independent copy (Swift value semantics). */
  copy(): SpeechEndpointer {
    const copy = new SpeechEndpointer(this.tuning);
    Object.assign(copy, this);
    copy.lows = [...this.lows];
    return copy;
  }

  /** True while the room is still being measured. */
  isCalibrating(now: number): boolean { return now < this.calibratedAt; }

  /** Levels above this are speech. */
  get threshold(): number { return Math.max(this.noiseFloor + this.tuning.margin, this.tuning.quietest); }

  /** A new recording started at `now`. The noise floor is kept: it is the same room. */
  reset(now: number): void {
    this.recordingStart = now;
    this.loudSince = null;
    this.pauseSince = null;
    this.speech = 0;
    this.lastTime = null;
    this.isSpeaking = false;
    this.isFinished = false;
  }

  /** One level reading. Returns what it means, if anything. */
  feed(reading: number, now: number): SpeechEndpointer.Event | null {
    if (this.isFinished) return null;
    const level = Number.isFinite(reading) ? Math.max(reading, -160) : -160;
    const step = this.lastTime === null ? 0 : Math.min(Math.max(now - this.lastTime, 0), 0.5);
    this.lastTime = now;
    this.learnRoom(level, now);

    if (now < this.calibratedAt) {
      this.calibrationLow = Math.min(this.calibrationLow, level);
      return null;
    }
    if (Number.isFinite(this.calibrationLow)) {
      // The room as measured: its quietest moment, and the window starts from there.
      this.noiseFloor = SpeechEndpointer.clampFloor(this.calibrationLow);
      this.lows = [this.noiseFloor];
      this.calibrationLow = Infinity;
    }

    if (!this.isSpeaking) {
      if (level > this.threshold) {
        const since = this.loudSince ?? now;
        this.loudSince = since;
        if (now - since >= this.tuning.startAfter) {
          this.isSpeaking = true;
          this.speech = now - since;
          this.pauseSince = null;
          return "speechStarted";
        }
      } else {
        this.loudSince = null;
        if (now - this.recordingStart >= this.tuning.restartAfter) {
          this.reset(now);
          return "restart";
        }
      }
      return null;
    }

    if (now - this.recordingStart >= this.tuning.maximumUtterance) return this.finish();
    if (level < this.threshold - this.tuning.hysteresis) {
      const since = this.pauseSince ?? now;
      this.pauseSince = since;
      if (now - since >= this.tuning.endSilence) {
        if (this.speech >= this.tuning.minimumSpeech) return this.finish();
        this.reset(now);
        return "falseStart";
      }
    } else {
      this.pauseSince = null;
      if (level > this.threshold) this.speech += step;
    }
    return null;
  }

  private finish(): SpeechEndpointer.Event {
    this.isSpeaking = false;
    this.isFinished = true;
    return "utteranceEnded";
  }

  /** The floor is the quietest quarter second of the last `floorWindow` seconds, and follows a quieter room at once. */
  private learnRoom(level: number, now: number): void {
    const start = this.bucketStart ?? now;
    this.bucketStart = start;
    this.bucketLow = Math.min(this.bucketLow, level);
    if (level < this.noiseFloor) this.noiseFloor = SpeechEndpointer.clampFloor(level);
    if (now - start < SpeechEndpointer.bucket) return;
    this.lows = [...this.lows, this.bucketLow];
    const keep = Math.max(1, Math.round(this.tuning.floorWindow / SpeechEndpointer.bucket));
    if (this.lows.length > keep) this.lows = this.lows.slice(this.lows.length - keep);
    this.bucketLow = Infinity;
    this.bucketStart = now;
    if (now >= this.calibratedAt && this.lows.length > 0) this.noiseFloor = SpeechEndpointer.clampFloor(Math.min(...this.lows));
  }

  private static clampFloor(level: number): number { return Math.min(Math.max(level, -90), -30); }
}

export namespace SpeechEndpointer {
  export interface Tuning {
    /** Speech is this many dB above the room's noise floor. */
    margin: number;
    /** Nothing quieter than this counts as speech, however quiet the room. */
    quietest: number;
    /** Once speech has started, it must fall this far below the threshold to count as a pause. */
    hysteresis: number;
    /** Sound must stay above the threshold this long to start a question (a click or a knock does not). */
    startAfter: number;
    /** At least this much speech, or it was not a question: the recording is thrown away. */
    minimumSpeech: number;
    /** A pause this long after speech ends the question. */
    endSilence: number;
    /** The question is sent anyway after this long (the backend takes up to a minute). */
    maximumUtterance: number;
    /** With no speech for this long, the recording starts afresh, so it never grows large. */
    restartAfter: number;
    /** At the start of a conversation the room is only measured for this long. */
    calibration: number;
    /** The noise floor is the quietest level of this long a window. */
    floorWindow: number;
  }

  /** Swift `Tuning()`, with optional overrides. */
  export function tuning(overrides: Partial<Tuning> = {}): Tuning {
    return {
      margin: 12, quietest: -48, hysteresis: 4, startAfter: 0.15, minimumSpeech: 0.4, endSilence: 1.1,
      maximumUtterance: 50, restartAfter: 20, calibration: 0.4, floorWindow: 3, ...overrides,
    };
  }

  export type Event =
    /** Someone started talking. */
    | "speechStarted"
    /** The sound stopped before it was long enough to be a question: throw the recording away. */
    | "falseStart"
    /** A question was asked and has ended: send the recording. */
    | "utteranceEnded"
    /** No speech for a while: start the recording afresh. */
    | "restart";
}

// MARK: - The conversation

/** Where the conversation is. */
export type ConversationPhase =
  /** No conversation. */
  | "off"
  /** Waiting for the person to talk (the microphone may be muted or held). */
  | "listening"
  /** The person is talking. */
  | "hearing"
  /** The question was sent; Sisu is working on the answer. */
  | "thinking"
  /** Sisu is saying the answer. */
  | "speaking";

export const ConversationPhase = {
  allCases: ["off", "listening", "hearing", "thinking", "speaking"] as readonly ConversationPhase[],
} as const;

/** What the app must do next. The flow never touches audio itself. */
export type ConversationCommand =
  /** Start a fresh recording with level metering, asking for the microphone the first time. */
  | "openMicrophone"
  /** Stop the recording and throw it away. */
  | "discardRecording"
  /** Stop the recording and send it to Sisu as a voice turn (`CoachSession.sendVoice`). */
  | "sendRecording"
  /** Stop Sisu's answer and its speech now (`CoachSession.cancel`). */
  | "stopSisu";

/** Why a conversation ended. */
export type ConversationEnd = "byUser" | "quiet" | "microphoneDenied" | "microphoneFailed" | "interrupted";

export const ConversationEnd = {
  allCases: ["byUser", "quiet", "microphoneDenied", "microphoneFailed", "interrupted"] as readonly ConversationEnd[],
} as const;

/** The conversation that just ended, for the line that says so. */
export interface ConversationSummary {
  readonly questions: number;
  readonly seconds: number;
  readonly reason: ConversationEnd;
}

/** The conversation's state machine. Every method takes the current time (inject it in tests) and returns the
 *  commands to carry out, in order. */
export class ConversationFlow {
  /** A conversation in which nobody speaks for this long ends by itself. */
  static readonly quietLimit = 60;

  phase: ConversationPhase = "off";
  /** The person muted the microphone. Sisu still finishes what it is saying. */
  micMuted = false;
  /** The app holds the microphone closed: the Talk screen is not on screen. Not shown as muted. */
  held = false;
  /** A recording is running. */
  micOpen = false;
  /** When the conversation started. Null when off. */
  startedAt: number | null = null;
  /** Questions sent in this conversation. */
  questions = 0;
  /** The conversation that ended last. Cleared by the next Start. */
  lastEnded: ConversationSummary | null = null;
  /** The endpointer of the current recording (its noise floor is kept from one recording to the next). */
  endpointer: SpeechEndpointer;

  private lastActivity = 0;

  constructor(tuning: SpeechEndpointer.Tuning = SpeechEndpointer.tuning()) {
    this.endpointer = new SpeechEndpointer(tuning);
  }

  /** An independent copy (Swift value semantics). */
  copy(): ConversationFlow {
    const copy = new ConversationFlow(this.endpointer.tuning);
    Object.assign(copy, this);
    copy.endpointer = this.endpointer.copy();
    return copy;
  }

  get isOn(): boolean { return this.phase !== "off"; }
  /** The microphone may be open now. */
  get canListen(): boolean { return this.isOn && !this.micMuted && !this.held; }
  /** Sisu is working on or saying an answer. */
  get isAnswering(): boolean { return this.phase === "thinking" || this.phase === "speaking"; }

  /** Seconds since the conversation started, 0 when off. */
  elapsed(now: number): number {
    return this.startedAt === null ? 0 : Math.max(0, now - this.startedAt);
  }

  // MARK: The person

  /** Start: the microphone opens (unless the app holds it). */
  start(now: number): ConversationCommand[] {
    if (this.phase !== "off") return [];
    this.phase = "listening";
    this.micMuted = false;
    // A new conversation measures the room again: it may be a different room.
    this.endpointer = new SpeechEndpointer(this.endpointer.tuning, now);
    this.startedAt = now;
    this.questions = 0;
    this.lastEnded = null;
    this.lastActivity = now;
    return this.openIfListening(now);
  }

  /** End: the microphone closes and any answer stops. */
  end(reason: ConversationEnd, now: number): ConversationCommand[] {
    if (!this.isOn) return [];
    const commands: ConversationCommand[] = [];
    if (this.micOpen) {
      this.micOpen = false;
      commands.push("discardRecording");
    }
    if (this.isAnswering) commands.push("stopSisu");
    this.lastEnded = { questions: this.questions, seconds: this.elapsed(now), reason };
    this.phase = "off";
    this.startedAt = null;
    this.micMuted = false;
    return commands;
  }

  /** Mute or unmute the microphone. Muting throws away what was being said. */
  setMicMuted(muted: boolean, now: number): ConversationCommand[] {
    if (!this.isOn || muted === this.micMuted) return [];
    this.micMuted = muted;
    return muted ? this.closeMicrophone() : this.resume(now);
  }

  /** Tapping Liito while Sisu answers: stop the answer and listen again. */
  interrupt(now: number): ConversationCommand[] {
    if (!this.isAnswering) return [];
    this.phase = "listening";
    this.lastActivity = now;
    return ["stopSisu", ...this.openIfListening(now)];
  }

  // MARK: The app

  /** The Talk screen left the screen (`true`) or came back (`false`). */
  setHeld(held: boolean, now: number): ConversationCommand[] {
    if (held === this.held) return [];
    this.held = held;
    if (!this.isOn) return [];
    return held ? this.closeMicrophone() : this.resume(now);
  }

  /** One microphone level reading while recording. */
  level(level: number, now: number): ConversationCommand[] {
    if (!this.micOpen || !(this.phase === "listening" || this.phase === "hearing")) return [];
    switch (this.endpointer.feed(level, now)) {
      case "speechStarted":
        this.phase = "hearing";
        this.lastActivity = now;
        return [];
      case "falseStart":
        this.phase = "listening";
        return ["discardRecording", "openMicrophone"];
      case "restart":
        return ["discardRecording", "openMicrophone"];
      case "utteranceEnded":
        this.micOpen = false;
        this.phase = "thinking";
        this.questions += 1;
        this.lastActivity = now;
        return ["sendRecording"];
      default:
        if (this.phase === "listening" && now - this.lastActivity >= ConversationFlow.quietLimit) return this.end("quiet", now);
        return [];
    }
  }

  /** The recording could not start or stopped by itself. Ends the conversation. */
  microphoneFailed(reason: ConversationEnd, now: number): ConversationCommand[] {
    if (!this.isOn) return [];
    this.micOpen = false;
    return this.end(reason, now);
  }

  /** The recording had nothing usable in it after all: listen again. */
  nothingToSend(now: number): ConversationCommand[] {
    if (this.phase !== "thinking") return [];
    this.questions = Math.max(0, this.questions - 1);
    this.phase = "listening";
    return this.openIfListening(now);
  }

  /** A new conversation was asked for: forget the summary of the last one, so the page starts fresh. */
  clearSummary(): void {
    this.lastEnded = null;
  }

  /** Sisu's speech started or stopped (between sentences it can stop for a moment). */
  sisuSpeaking(speaking: boolean): void {
    if (speaking && this.phase === "thinking") this.phase = "speaking";
    if (!speaking && this.phase === "speaking") this.phase = "thinking";
  }

  /** The answer is complete and fully spoken: listen again. */
  replyFinished(now: number): ConversationCommand[] {
    if (!this.isAnswering) return [];
    this.phase = "listening";
    this.lastActivity = now;
    return this.openIfListening(now);
  }

  // MARK: Microphone

  private closeMicrophone(): ConversationCommand[] {
    if (this.phase === "hearing") this.phase = "listening";
    if (!this.micOpen) return [];
    this.micOpen = false;
    return ["discardRecording"];
  }

  private resume(now: number): ConversationCommand[] {
    this.lastActivity = now;
    return this.openIfListening(now);
  }

  private openIfListening(now: number): ConversationCommand[] {
    if (this.phase !== "listening" || !this.canListen || this.micOpen) return [];
    this.micOpen = true;
    this.endpointer.reset(now);
    return ["openMicrophone"];
  }
}

// MARK: - What the Talk screen shows

/** Everything the Talk screen writes, for one moment. */
export interface ConversationScreenState {
  /** The line under Liito: "Listening", "Searching the web with Exa". */
  readonly title: string;
  /** One more sentence, or null. */
  readonly detail: string | null;
  readonly mood: RiveBindings.LiitoMood;
  /** "Start talking" or "End conversation". */
  readonly buttonLabel: string;
  /** The microphone button's label: "Mute microphone" or "Turn the microphone on". */
  readonly micLabel: string;
  /** The microphone button works only during a conversation. */
  readonly micEnabled: boolean;
  /** "Conversation on · 1:05", "Ended · 2 questions · 1:40". */
  readonly statusLine: string | null;
  /** True while a conversation runs (the status line shows a live dot). */
  readonly live: boolean;
  /** Liito can be tapped to interrupt. */
  readonly canInterrupt: boolean;
}

export namespace ConversationPresenter {
  /**
   * @param activity `CoachSession.activity`, what Sisu is doing (real events only).
   * @param opening Liito's opening line before the first conversation (the first insight), or null.
   * @param task the session's `task` (what Liito visibly does while Sisu works), or null. Web addition.
   */
  export function state(flow: ConversationFlow, activity: SisuActivity, now: number,
    opening: { title: string; detail: string } | null = null, task: LiitoTask | null = null): ConversationScreenState {
    let title: string = ConversationText.idleTitle;
    let detail: string | null = ConversationText.idleDetail;
    let mood: RiveBindings.LiitoMood = "idle";

    switch (flow.phase) {
      case "off":
        if (flow.lastEnded) {
          const ended = flow.lastEnded;
          title = ConversationText.endedTitle;
          detail = ConversationText.endedDetail(ended.reason);
          mood = ended.reason === "byUser" || ended.reason === "quiet" ? "proud" : "cosy";
          if (ended.questions === 0 && ended.reason === "byUser") mood = "idle";
        } else if (opening) {
          title = opening.title;
          detail = opening.detail;
          mood = "found";
        }
        break;
      case "listening":
        if (flow.micMuted) {
          title = ConversationText.mutedTitle;
          detail = ConversationText.mutedDetail;
          mood = "cosy";
        } else if (flow.held) {
          title = ConversationText.pausedTitle;
          detail = ConversationText.pausedDetail;
          mood = "idle";
        } else {
          title = ConversationText.listeningTitle;
          detail = flow.questions === 0 ? ConversationText.listeningFirst : ConversationText.listeningNext;
          mood = "listening";
        }
        // An approval moment or a waiting action stays visible while Sisu listens.
        if (activity.state === "approved" || activity.state === "waiting_for_approval") mood = LiitoTask.mood(activity, null, false);
        break;
      case "hearing":
        title = ConversationText.hearingTitle;
        detail = ConversationText.hearingDetail;
        mood = "listening";
        break;
      case "thinking": {
        const early = activity.state === "idle" || activity.state === "listening";
        title = early ? SisuActivityState.defaultLabel("thinking") : activity.label;
        detail = activity.detail ?? ConversationText.thinkingDetail;
        mood = early ? "thinking" : LiitoTask.mood(activity, task, false);
        break;
      }
      case "speaking":
        title = ConversationText.speakingTitle;
        detail = ConversationText.speakingDetail;
        mood = activity.state === "waiting_for_approval" ? LiitoTask.mood(activity, null, false) : "presenting";
        break;
    }
    return {
      title, detail, mood,
      buttonLabel: flow.isOn ? ConversationText.end : ConversationText.start,
      micLabel: flow.micMuted ? ConversationText.unmute : ConversationText.mute,
      micEnabled: flow.isOn,
      statusLine: statusLine(flow, now),
      live: flow.isOn,
      canInterrupt: flow.isAnswering,
    };
  }

  /** "Conversation on · 0:42" (with "microphone off" when muted) during a conversation; "Ended · 2 questions · 1:40"
   *  after one; null before the first. */
  export function statusLine(flow: ConversationFlow, now: number): string | null {
    if (flow.isOn) {
      let line = `${ConversationText.on} · ${clock(flow.elapsed(now))}`;
      if (flow.micMuted) line += ` · ${ConversationText.micOff}`;
      return line;
    }
    const ended = flow.lastEnded;
    if (!ended) return null;
    return `${ConversationText.ended} · ${questions(ended.questions)} · ${clock(ended.seconds)}`;
  }

  /** `0:05`, `1:05`, `12:00`, `1:02:03`. */
  export function clock(seconds: number): string {
    const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), rest = total % 60;
    const two = (value: number) => String(value).padStart(2, "0");
    return hours > 0 ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`;
  }

  /** `1 question`, `3 questions`, `no questions`. */
  export function questions(count: number): string {
    if (count <= 0) return "no questions";
    return count === 1 ? "1 question" : `${count} questions`;
  }

  /** How loud the microphone is, 0 to 1 above the room's noise floor, for the ring around Liito. */
  export function ringLevel(level: number, noiseFloor: number): number {
    if (!Number.isFinite(level)) return 0;
    const above = level - noiseFloor;
    return Math.min(Math.max((above - 4) / 30, 0), 1);
  }
}

/** The Talk screen's sentences. Calm, short, one next step. */
export namespace ConversationText {
  export const start = "Start talking";
  export const end = "End conversation";
  export const mute = "Mute microphone";
  export const unmute = "Turn the microphone on";
  export const on = "Conversation on";
  export const ended = "Ended";
  export const micOff = "microphone off";

  export const idleTitle = "Talk to Sisu";
  export const idleDetail = "Start a conversation and just speak. Sisu answers out loud, then listens again.";
  export const listeningTitle = "Listening";
  export const listeningFirst = "Ask about your money. Pause when you are done.";
  export const listeningNext = "Ask a follow-up, or end the conversation.";
  export const hearingTitle = "Hearing you";
  export const hearingDetail = "Pause when you are done.";
  export const thinkingDetail = "Sisu checks your own numbers first.";
  export const speakingTitle = "Sisu is answering";
  export const speakingDetail = "Tap Liito to interrupt.";
  export const mutedTitle = "Microphone off";
  export const mutedDetail = "Sisu cannot hear you. Turn the microphone on to talk.";
  export const pausedTitle = "Paused";
  export const pausedDetail = "Sisu listens again when you come back here.";
  export const endedTitle = "Conversation ended";

  export function endedDetail(reason: ConversationEnd): string {
    switch (reason) {
      case "byUser": return "Start again whenever you like.";
      case "quiet": return "It went quiet for a minute, so Sisu stopped listening.";
      case "microphoneDenied": return VoiceText.microphoneDenied;
      case "microphoneFailed": return VoiceText.recordingFailed;
      case "interrupted": return VoiceText.interrupted;
    }
  }

  /** The button that opens the written conversation with the keyboard. */
  export const typeInstead = "Type a question";
  /** The button that clears the chat and brings Liito back to the middle. */
  export const newConversation = "New conversation";
}
