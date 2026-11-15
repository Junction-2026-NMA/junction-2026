/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// What the Sisu tab's composer shows while the hands-free conversation is on: one live line (Listening, Hearing you,
// Thinking, Answering) with a short detail, and what its stop control does. Pure: the screen passes the flow
// (web/core/AppLogic/Conversation.ts) and what the session is doing; the controller carries the command out.
import type { SisuActivity } from "@/web/core/Activity";
import { ConversationPresenter, type ConversationFlow } from "./Conversation";

/** The four states the bar names, plus the microphone waiting for an answer Sisu is already giving. */
export type VoiceBarTone = "listening" | "hearing" | "thinking" | "answering";

export interface VoiceBarState {
  readonly tone: VoiceBarTone;
  /** "Listening", "Hearing you", "Thinking", "Answering". */
  readonly label: string;
  /** One short line under it, or null. */
  readonly detail: string | null;
  /** While Sisu answers the stop control interrupts it (and Sisu listens again); otherwise it ends voice. */
  readonly stop: "interrupt" | "end";
  readonly stopLabel: string;
}

export namespace VoiceBarText {
  export const listening = "Listening";
  export const hearing = "Hearing you";
  export const thinking = "Thinking";
  export const answering = "Answering";
  export const firstQuestion = "Ask about your money, then pause.";
  export const followUp = "Ask a follow-up, or tap End.";
  export const pause = "Pause when you are done.";
  export const answeringDetail = "Tap Stop or Liito to interrupt.";
  export const waitingForAnswer = "The microphone opens after this answer.";
  export const stopAnswer = "Stop Sisu";
  export const endVoice = "End voice";
  /** The composer's microphone button. */
  export const startVoice = "Talk to Sisu";
  /** The voice bar's keyboard button: ends voice and goes back to the text field. */
  export const typeInstead = "Type instead";
}

export namespace VoiceBar {
  /** @param answerReady the answer's stream ended and its sentences are still to be spoken (controller state). */
  export function state(flow: ConversationFlow, activity: SisuActivity, answerReady: boolean): VoiceBarState {
    const working = ConversationPresenter.isWorking(activity);
    const end = { stop: "end" as const, stopLabel: VoiceBarText.endVoice };
    const interrupt = { stop: "interrupt" as const, stopLabel: VoiceBarText.stopAnswer };
    switch (flow.phase) {
      case "hearing":
        return { tone: "hearing", label: VoiceBarText.hearing, detail: VoiceBarText.pause, ...end };
      case "thinking":
        if (answerReady && !working) return { tone: "answering", label: VoiceBarText.answering, detail: VoiceBarText.answeringDetail, ...interrupt };
        return { tone: "thinking", label: VoiceBarText.thinking, detail: working && activity.state !== "thinking" ? activity.label : null, ...interrupt };
      case "speaking":
        return { tone: "answering", label: VoiceBarText.answering, detail: working ? activity.label : VoiceBarText.answeringDetail, ...interrupt };
      case "listening":
      case "off":
      default:
        // Someone else's answer (a suggestion tapped, a lesson's question) runs first: the microphone waits for it.
        if (!flow.micOpen && (working || activity.state === "speaking")) {
          return { tone: "thinking", label: working ? VoiceBarText.thinking : VoiceBarText.answering, detail: VoiceBarText.waitingForAnswer, ...end };
        }
        return { tone: "listening", label: VoiceBarText.listening, detail: flow.questions === 0 ? VoiceBarText.firstQuestion : VoiceBarText.followUp, ...end };
    }
  }
}
