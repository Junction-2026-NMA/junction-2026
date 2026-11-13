// Browser side of the agent. No React here, so any UI can use it.
// It does three things: reads the event stream, records the microphone, and plays speech in order.
import type { AgentEvent, BillType, ChatTurn, ResearchResult } from "@/lib/types";

export type TurnInput = {
  customerId: string;
  text?: string; // typed question
  audio?: Blob; // or a recording
  mode?: "voice" | "text";
  history?: ChatTurn[];
  focusBill?: BillType;
  signal?: AbortSignal;
};

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Sisu could not answer just now. Please try again.";
}

// Sends one question (typed or recorded) and yields each event as the server produces it.
export async function* streamTurn(input: TurnInput): AsyncGenerator<AgentEvent> {
  const response = input.audio
    ? await fetch("/api/voice/turn", { method: "POST", signal: input.signal, body: voiceForm(input) })
    : await fetch("/api/agent/query", {
        method: "POST",
        signal: input.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: input.customerId, text: input.text, mode: input.mode ?? "text", history: input.history, focusBill: input.focusBill }),
      });
  if (!response.ok || !response.body) {
    yield { type: "error", message: await readError(response) };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";
    for (const message of messages) {
      if (message.startsWith("data: ")) yield JSON.parse(message.slice(6)) as AgentEvent;
    }
  }
}

function voiceForm(input: TurnInput): FormData {
  const form = new FormData();
  form.set("audio", input.audio as Blob, "speech");
  form.set("customerId", input.customerId);
  form.set("history", JSON.stringify(input.history ?? []));
  if (input.focusBill) form.set("focusBill", input.focusBill);
  return form;
}

// Call when the app opens: opens the server's connections and says whether it is in mock mode.
export async function warmAgent(): Promise<{ mock: boolean; provider: string; model: string } | null> {
  const response = await fetch("/api/agent/warm").catch(() => null);
  return response?.ok ? ((await response.json()) as { mock: boolean; provider: string; model: string }) : null;
}

// Call when the user confirms a bill's name, so offers are ready before they ask.
export async function prefetchOffers(customerId: string, billType: BillType): Promise<ResearchResult | null> {
  const response = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId, billType, wait: false }),
  }).catch(() => null);
  return response?.ok ? ((await response.json()) as ResearchResult) : null;
}

export type Speaker = {
  say: (text: string) => void; // queue a sentence; audio is fetched at once and played in order
  stop: () => void; // drop everything, used when the user interrupts
  unlock: () => void; // call inside a tap or click so the browser allows sound
  whenQuiet: () => Promise<void>; // resolves when the queue has finished playing
};

type AudioContextClass = typeof AudioContext;

// Plays sentences one after another through the Web Audio API. Each sentence's audio is requested the
// moment it is queued, so the next one is usually ready before the previous one ends.
// Web Audio is used instead of an <audio> element because, once unlocked by one tap, it keeps working
// in Safari and on phones, where <audio>.play() is blocked outside a tap.
export function createSpeaker(onSpeakingChange?: (speaking: boolean) => void, onError?: (message: string) => void): Speaker {
  let context: AudioContext | null = null;
  let queue: Promise<AudioBuffer | null>[] = [];
  let current: AudioBufferSourceNode | null = null;
  let generation = 0; // bumping this cancels a playback loop in progress
  let running: Promise<void> | null = null;

  function audio(): AudioContext | null {
    if (context) return context;
    const Context: AudioContextClass | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
    if (!Context) {
      onError?.("This browser cannot play Sisu's voice. The answer is shown as text.");
      return null;
    }
    context = new Context();
    return context;
  }

  async function fetchClip(text: string): Promise<AudioBuffer | null> {
    try {
      const response = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        onError?.(body?.error ?? "Sisu's voice is unavailable right now. The answer is shown as text.");
        return null;
      }
      const ctx = audio();
      return ctx ? await ctx.decodeAudioData(await response.arrayBuffer()) : null;
    } catch {
      onError?.("Sisu's voice could not be loaded. The answer is shown as text.");
      return null;
    }
  }

  function playClip(ctx: AudioContext, buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (current === source) current = null;
        resolve();
      };
      current = source;
      source.start();
    });
  }

  async function drain(mine: number): Promise<void> {
    onSpeakingChange?.(true);
    while (queue.length && mine === generation) {
      const buffer = await queue[0];
      if (mine !== generation) break;
      queue = queue.slice(1);
      const ctx = audio();
      if (!buffer || !ctx) continue;
      if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
      if (ctx.state !== "running") {
        onError?.("Your browser is blocking sound. Tap anywhere on the page, then ask again.");
        continue;
      }
      await playClip(ctx, buffer);
    }
    if (mine === generation) {
      running = null;
      onSpeakingChange?.(false);
    }
  }

  return {
    say(text) {
      queue = [...queue, fetchClip(text)];
      running ??= drain(generation);
    },
    stop() {
      generation += 1;
      queue = [];
      running = null;
      try {
        current?.stop();
      } catch {
        // already stopped
      }
      current = null;
      onSpeakingChange?.(false);
    },
    unlock() {
      void audio()?.resume().catch(() => undefined);
    },
    whenQuiet: () => running ?? Promise.resolve(),
  };
}

export type Recorder = { start: () => Promise<void>; stop: () => Promise<Blob | null>; release: () => void };

const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

// Push-to-talk recording. start() on press, stop() on release. The microphone stays open between
// presses so the second question has no permission delay; release() closes it.
export function createRecorder(): Recorder {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  return {
    async start() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot record audio. Type your question instead.");
      stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => {
        throw new Error("Sisu needs microphone access. Allow it in the browser, or type your question.");
      });
      const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      chunks = [];
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks = [...chunks, event.data];
      };
      recorder.start();
    },
    stop() {
      return new Promise((resolve) => {
        const active = recorder;
        if (!active || active.state === "inactive") return resolve(null);
        active.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: active.mimeType }) : null);
        active.stop();
      });
    },
    release() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    },
  };
}
