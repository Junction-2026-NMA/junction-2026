"use client";

// One hook for the whole conversation: type or hold-to-talk, streamed answers, spoken replies, interruption.
// Usage is shown in context/frontend-integration.md and app/dev/agent/page.tsx.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentAction, BillType, ChatTurn, Citation, CustomerMemory, Fact, Grounding, MemoryItem, ResearchResult, Stage, TeachingCard, ToolTrace, TurnTimings } from "@/lib/types";
import { type Recorder, type Speaker, type VoiceChoice, approveAction, confirmBill as saveBillName, createRecorder, createSpeaker, declineAction, fetchActions, fetchMemory, streamTurn, warmAgent } from "./client";

export type SisuStatus = "idle" | "recording" | "thinking" | "speaking";

export type SisuMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending: boolean; // still being heard or written
  filler: string | null; // the "let me check" line, if one was said
  startedEarly: BillType | null; // research the server began before the model asked for it
  tools: ToolTrace[];
  research: ResearchResult | null;
  citations: Citation[];
  timings: TurnTimings | null;
  error: string | null;
  // Added 14 Nov (all optional to read; older UI code keeps working):
  stages: Stage[]; // each step of Sisu's work, typed for drawing as cards (see Stage in lib/types.ts)
  action: AgentAction | null; // an action awaiting approval; show Approve and Decline
  teaching: TeachingCard | null; // ask `question`, show `options`, then reveal `reveal`
  remembered: MemoryItem[]; // things Sisu saved this turn ("Sisu will remember…")
  grounding: Grounding | null; // every number in the answer and whether it has a source
  facts: Fact[]; // the receipts: what each number is, where it came from, how to open its rows
};

export type SisuOptions = {
  customerId: string | null;
  focusBill?: BillType; // the bill card the user has open, if any
  speakReplies?: boolean; // default true
};

const blank = (role: "user" | "assistant", text = "", pending = true): SisuMessage => ({
  id: crypto.randomUUID(),
  role,
  text,
  pending,
  filler: null,
  startedEarly: null,
  tools: [],
  research: null,
  citations: [],
  timings: null,
  error: null,
  stages: [],
  action: null,
  teaching: null,
  remembered: [],
  grounding: null,
  facts: [],
});

export function useSisu({ customerId, focusBill, speakReplies = true }: SisuOptions) {
  const [messages, setMessages] = useState<SisuMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [server, setServer] = useState<{ mock: boolean; provider: string; model: string } | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [memory, setMemory] = useState<CustomerMemory | null>(null);

  const speaker = useRef<Speaker | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const controller = useRef<AbortController | null>(null);
  const history = useRef<ChatTurn[]>([]);
  const pressed = useRef(false); // is the talk button held right now?
  const capturing = useRef(false); // is the microphone actually recording?

  useEffect(() => {
    speaker.current = createSpeaker(setSpeaking, setVoiceError);
    recorder.current = createRecorder();
    warmAgent().then(setServer);
    return () => {
      controller.current?.abort();
      speaker.current?.stop();
      recorder.current?.release();
    };
  }, []);

  const patch = (id: string, change: (message: SisuMessage) => SisuMessage) =>
    setMessages((all) => all.map((message) => (message.id === id ? change(message) : message)));

  // Actions and memory belong to the customer, not to one conversation, so they load when the customer changes.
  const refresh = useCallback(async () => {
    if (!customerId) return;
    const [list, remembered] = await Promise.all([fetchActions(customerId), fetchMemory(customerId)]);
    if (list) setActions(list.actions);
    if (remembered) setMemory(remembered);
  }, [customerId]);

  useEffect(() => {
    setActions([]);
    setMemory(null);
    void refresh();
  }, [refresh]);

  const putAction = (action: AgentAction) => {
    setActions((all) => [action, ...all.filter((existing) => existing.id !== action.id)]);
    setMessages((all) => all.map((message) => (message.action?.id === action.id ? { ...message, action } : message)));
  };

  // Stops whatever Sisu is doing. Used when the user interrupts or switches customer.
  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    speaker.current?.stop();
    setBusy(false);
    setMessages((all) => all.map((message) => (message.pending ? { ...message, pending: false } : message)));
  }, []);

  const reset = useCallback(() => {
    cancel();
    history.current = [];
    setMessages([]);
  }, [cancel]);

  const runTurn = useCallback(
    async (input: { text?: string; audio?: Blob; investigate?: boolean }) => {
      if (!customerId) return;
      cancel();
      const abort = new AbortController();
      controller.current = abort;
      const spoken = speakReplies;
      const user = blank("user", input.text ?? "", !input.text);
      const reply = blank("assistant");
      setMessages((all) => [...all, user, reply]);
      setBusy(true);

      let question = input.text ?? "";
      try {
        const events = streamTurn({ customerId, ...input, mode: spoken ? "voice" : "text", history: input.investigate ? [] : history.current, focusBill, signal: abort.signal });
        for await (const event of events) {
          if (abort.signal.aborted) return;
          switch (event.type) {
            case "transcript":
              question = event.text;
              patch(user.id, (m) => ({ ...m, text: event.text || "(nothing heard)", pending: false }));
              break;
            case "speculation":
              patch(reply.id, (m) => ({ ...m, startedEarly: event.billType }));
              break;
            case "filler":
              patch(reply.id, (m) => ({ ...m, filler: event.text }));
              if (spoken) speaker.current?.say(event.text);
              break;
            case "delta":
              patch(reply.id, (m) => ({ ...m, text: m.text + event.text }));
              break;
            case "sentence":
              if (spoken) speaker.current?.say(event.text);
              break;
            case "tool_end":
              patch(reply.id, (m) => ({ ...m, tools: [...m.tools, event.trace] }));
              break;
            case "research":
              patch(reply.id, (m) => ({ ...m, research: event.result }));
              break;
            case "stage":
              patch(reply.id, (m) => ({ ...m, stages: [...m.stages, event.stage] }));
              break;
            case "action":
              patch(reply.id, (m) => ({ ...m, action: event.action }));
              setActions((all) => [event.action, ...all.filter((existing) => existing.id !== event.action.id)]);
              break;
            case "teaching":
              patch(reply.id, (m) => ({ ...m, teaching: event.card }));
              break;
            case "memory":
              patch(reply.id, (m) => ({ ...m, remembered: [...m.remembered, event.item] }));
              void refresh();
              break;
            case "grounding":
              patch(reply.id, (m) => ({ ...m, grounding: event.grounding, facts: event.facts }));
              break;
            case "done":
              patch(reply.id, (m) => ({ ...m, text: event.text || m.text, pending: false, citations: event.citations, timings: event.timings }));
              history.current = [...history.current, { role: "user" as const, content: question }, { role: "assistant" as const, content: event.text }].slice(-12);
              break;
            case "error":
              patch(user.id, (m) => ({ ...m, pending: false }));
              patch(reply.id, (m) => ({ ...m, pending: false, error: event.message }));
              break;
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) patch(reply.id, (m) => ({ ...m, pending: false, error: (error as Error).message || "The connection dropped. Please try again." }));
      } finally {
        if (controller.current === abort) {
          controller.current = null;
          setBusy(false);
          setMessages((all) => all.map((message) => (message.pending ? { ...message, pending: false } : message)));
        }
      }
    },
    [customerId, focusBill, speakReplies, cancel, refresh],
  );

  // Sisu works through a whole case on its own. Watch `stages` on the reply fill in as it goes.
  const investigate = useCallback(() => {
    speaker.current?.unlock();
    setVoiceError(null);
    void runTurn({ text: "Look into my finances and find the best thing I can do.", investigate: true });
  }, [runTurn]);

  // The Approve and Decline buttons. Approval is the only thing that carries an action out, and it is a simulation.
  // Both return the updated action; after an approval `action.impact` holds what it adds up to.
  const approve = useCallback(
    async (actionId: string): Promise<AgentAction | null> => {
      if (!customerId) return null;
      const { action } = await approveAction(customerId, actionId);
      putAction(action);
      return action;
    },
    [customerId],
  );
  const decline = useCallback(
    async (actionId: string): Promise<AgentAction | null> => {
      if (!customerId) return null;
      const { action } = await declineAction(customerId, actionId);
      putAction(action);
      return action;
    },
    [customerId],
  );

  // Call when the user confirms or corrects a bill's name. Saves it and starts offer research for that bill.
  const confirmBill = useCallback(
    async (billId: string, name: string, billType?: BillType) => {
      if (!customerId) return;
      setMemory(await saveBillName(customerId, billId, name, billType));
    },
    [customerId],
  );

  const ask = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question) return;
      speaker.current?.unlock();
      setVoiceError(null);
      void runTurn({ text: question });
    },
    [runTurn],
  );

  // Press: stop Sisu talking and start listening. Release: send what was said.
  const startTalking = useCallback(async () => {
    if (pressed.current) return;
    pressed.current = true;
    cancel();
    speaker.current?.unlock();
    setMicError(null);
    setVoiceError(null);
    try {
      await recorder.current?.start();
    } catch (error) {
      pressed.current = false;
      setMicError((error as Error).message);
      return;
    }
    // The first press shows the browser's permission prompt, and the button is released while it is up.
    if (!pressed.current) {
      await recorder.current?.stop();
      setMicError("The microphone is ready. Hold the button while you speak, then let go.");
      return;
    }
    capturing.current = true;
    setRecording(true);
  }, [cancel]);

  const stopTalking = useCallback(async () => {
    if (!pressed.current) return;
    pressed.current = false;
    if (!capturing.current) return; // still starting; startTalking handles it
    capturing.current = false;
    setRecording(false);
    const audio = await recorder.current?.stop();
    if (audio && audio.size > 2_000) void runTurn({ audio });
    else setMicError("That was too short. Hold the button while you speak, then let go.");
  }, [runTurn]);

  // Tries another ElevenLabs model or voice for everything Sisu says next (test bench only).
  const setVoice = useCallback((choice: VoiceChoice) => speaker.current?.setVoice(choice), []);

  // Says a fixed sentence, to check that sound works on this device.
  const testVoice = useCallback(() => {
    setVoiceError(null);
    speaker.current?.unlock();
    speaker.current?.stop();
    speaker.current?.say("Hi, this is Sisu. I found a cheaper electricity deal that could save you about a hundred and forty euros a year.");
  }, []);

  const status: SisuStatus = recording ? "recording" : busy ? "thinking" : speaking ? "speaking" : "idle";
  // What has been freed so far by approved switches: feed this to the futures chart as the monthly bill saving.
  const approvedMonthlySaving = actions.filter((action) => action.status === "executed_simulated" && action.kind === "switch_contract").reduce((total, action) => total + action.monthlyAmountEur, 0);
  return { status, messages, server, micError, voiceError, ask, startTalking, stopTalking, testVoice, setVoice, cancel, reset, investigate, approve, decline, confirmBill, actions, memory, approvedMonthlySaving, refresh };
}
