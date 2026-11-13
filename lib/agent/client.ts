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
  unlock: () => void; // call inside a tap or click so the browser allows audio
  whenQuiet: () => Promise<void>; // resolves when the queue has finished playing
};

// Plays sentences one after another. Each sentence's audio is requested the moment it is queued,
// so by the time the previous one finishes, the next is usually already downloaded.
export function createSpeaker(onSpeakingChange?: (speaking: boolean) => void): Speaker {
  const player = new Audio();
  let queue: Promise<string | null>[] = [];
  let generation = 0; // bumping this cancels a playback loop in progress
  let running: Promise<void> | null = null;

  async function fetchClip(text: string): Promise<string | null> {
    const response = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => null);
    return response?.ok ? URL.createObjectURL(await response.blob()) : null;
  }

  function playClip(url: string): Promise<void> {
    return new Promise((resolve) => {
      player.onended = () => resolve();
      player.onerror = () => resolve();
      player.src = url;
      player.play().catch(() => resolve()); // autoplay blocked: carry on silently, the text is on screen
    });
  }

  async function drain(mine: number): Promise<void> {
    onSpeakingChange?.(true);
    while (queue.length && mine === generation) {
      const url = await queue[0];
      if (mine !== generation) break;
      queue = queue.slice(1);
      if (!url) continue;
      await playClip(url);
      URL.revokeObjectURL(url);
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
      player.pause();
      player.removeAttribute("src");
      onSpeakingChange?.(false);
    },
    unlock() {
      // A silent play inside a user gesture lets later play() calls through on phones.
      player.muted = true;
      player.play().catch(() => undefined).finally(() => {
        player.pause();
        player.muted = false;
      });
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
