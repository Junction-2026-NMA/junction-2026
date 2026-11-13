// Mock mode (MODEL_PROVIDER=mock): no keys, no network. Emits the same shapes and realistic timing
// so the frontend and finance lanes can build against the real endpoints. Everything here is labelled mock.
import type { BillType } from "@/lib/types";
import type { ChatMessage, ModelChunk, ToolCall } from "./model";
import type { RawOffer } from "./research/types";
import { speculate } from "./speculate";

const WORD_DELAY_MS = 25;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function* speak(text: string): AsyncGenerator<ModelChunk> {
  const started = Date.now();
  let firstTokenMs: number | null = null;
  for (const word of text.split(" ")) {
    await sleep(WORD_DELAY_MS);
    firstTokenMs ??= Date.now() - started;
    yield { type: "delta", text: `${word} ` };
  }
  yield { type: "end", toolCalls: [], model: "mock", provider: "mock", usedBackup: false, firstTokenMs, totalMs: Date.now() - started };
}

function lastUserText(messages: ChatMessage[]): string {
  const user = [...messages].reverse().find((m) => m.role === "user");
  return user && typeof user.content === "string" ? user.content : "";
}

// A scripted stand-in for the model: asks for research when the question is about a better deal,
// words the tool result when one comes back, and otherwise answers from the summary in the prompt.
export async function* mockStream(messages: ChatMessage[]): AsyncGenerator<ModelChunk> {
  const last = messages[messages.length - 1];

  if (last.role === "tool") {
    const result = safeParse(last.content);
    const best = result?.best as { provider?: string; estimatedYearlySavingEur?: number } | undefined;
    if (best?.provider) {
      yield* speak(`Mock answer. ${best.provider} looks cheapest, saving about ${Math.round(best.estimatedYearlySavingEur ?? 0)} euros a year. Shall I prepare the switch checklist?`);
      return;
    }
    yield* speak("Mock answer. I ran the numbers with the tool you can see in the trace.");
    return;
  }

  const question = lastUserText(messages);
  const guess = speculate(question);
  if (guess) {
    await sleep(300);
    const call: ToolCall = {
      id: "mock_call_1",
      type: "function",
      function: { name: "search_offers", arguments: JSON.stringify({ billType: guess.billType }) },
    };
    yield { type: "end", toolCalls: [call], model: "mock", provider: "mock", usedBackup: false, firstTokenMs: 300, totalMs: 300 };
    return;
  }

  const system = messages.find((m) => m.role === "system");
  const perWeek = typeof system?.content === "string" ? /"perWeek":\s*([\d.]+)/.exec(system.content)?.[1] : null;
  yield* speak(
    perWeek
      ? `Mock answer. You can safely spend about ${Math.round(Number(perWeek))} euros a week. Ask me about a cheaper electricity deal to see the research flow.`
      : "Mock answer. Ask me about a cheaper electricity deal to see the research flow.",
  );
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Example offers. Invented providers, so nobody mistakes them for live prices.
export function mockRawOffers(billType: BillType): RawOffer[] {
  const sourceUrl = "https://example.com/mock-offers";
  if (billType === "electricity") {
    return [
      { provider: "Example Energia", plan: "Fixed 24", contractType: "fixed", contractMonths: 24, monthlyPriceEur: 3.9, energyPriceCentsPerKwh: 8.9, setupFeeEur: null, sourceUrl },
      { provider: "Demo Sähkö", plan: "Fixed 12", contractType: "fixed", contractMonths: 12, monthlyPriceEur: 4.5, energyPriceCentsPerKwh: 9.8, setupFeeEur: null, sourceUrl },
      { provider: "Sample Voima", plan: "Spot", contractType: "spot", contractMonths: null, monthlyPriceEur: 0, energyPriceCentsPerKwh: 0.6, setupFeeEur: null, sourceUrl },
    ];
  }
  return [
    { provider: "Example Tel", plan: "Basic", contractType: "fixed", contractMonths: 12, monthlyPriceEur: 17.9, energyPriceCentsPerKwh: null, setupFeeEur: 0, sourceUrl },
    { provider: "Demo Net", plan: "Plus", contractType: "fixed", contractMonths: 24, monthlyPriceEur: 21.9, energyPriceCentsPerKwh: null, setupFeeEur: 9.9, sourceUrl },
  ];
}

// A short beep as a WAV file, so the audio path can be built and tested without ElevenLabs.
export function mockWav(seconds = 0.25, frequency = 660): Uint8Array<ArrayBuffer> {
  const sampleRate = 16_000;
  const samples = Math.floor(sampleRate * seconds);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 400, (samples - i) / 400);
    view.setInt16(44 + i * 2, Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 6000 * fade, true);
  }
  return new Uint8Array(buffer);
}
