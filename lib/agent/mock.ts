// Mock mode (MODEL_PROVIDER=mock): no keys, no network. Emits the same shapes and realistic timing
// so the frontend and finance lanes can build against the real endpoints. Everything here is labelled mock.
import type { BillType } from "@/lib/types";
import { scriptedMockModel } from "./mock-model";
import type { ChatMessage, ModelChunk, StreamOptions } from "./model";
import type { RawOffer } from "./research/types";

// Tests replace the scripted model with their own, to drive the orchestrator through exact tool calls.
export type MockScript = (options: StreamOptions) => AsyncGenerator<ModelChunk>;
const scriptStore = globalThis as unknown as { __sisuMockScript?: MockScript | null };
export function setMockScript(script: MockScript | null): void {
  scriptStore.__sisuMockScript = script;
}

export async function* mockStream(messages: ChatMessage[], options?: StreamOptions): AsyncGenerator<ModelChunk> {
  const script = scriptStore.__sisuMockScript ?? scriptedMockModel;
  yield* script(options ?? { messages, tools: [], maxTokens: 200 });
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

// The same beep as raw 16-bit samples, which is what the browser's streamed player expects.
export function mockPcm(sampleRate: number, seconds = 0.25, frequency = 660): Uint8Array<ArrayBuffer> {
  const samples = Math.floor(sampleRate * seconds);
  const view = new DataView(new ArrayBuffer(samples * 2));
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 400, (samples - i) / 400);
    view.setInt16(i * 2, Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 6000 * fade, true);
  }
  return new Uint8Array(view.buffer as ArrayBuffer);
}
