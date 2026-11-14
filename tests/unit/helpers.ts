// Shared test setup. Every test file gets its own state file and runs the agent in mock mode (no network, no keys).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelChunk, StreamOptions, ToolCall } from "@/lib/agent/model";
import type { SisuEvent } from "@/lib/types";

process.env.MODEL_PROVIDER = "mock";
// Tests must never read or write the real state in .sisu/, so every test process starts on a throwaway file.
process.env.SISU_STATE_FILE = join(mkdtempSync(join(tmpdir(), "sisu-test-")), "state.json");

export const AINO = "CUST04974";
export const EETU = "CUST04414";
export const SANNA = "CUST02003";
export const ALL = [AINO, EETU, SANNA];

// Points the store at a brand-new empty file.
export function freshState(): string {
  const file = join(mkdtempSync(join(tmpdir(), "sisu-test-")), "state.json");
  process.env.SISU_STATE_FILE = file;
  return file;
}

export async function collect(events: AsyncGenerator<SisuEvent>): Promise<SisuEvent[]> {
  const all: SisuEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

export const ofType = <T extends SisuEvent["type"]>(events: SisuEvent[], type: T) => events.filter((e): e is Extract<SisuEvent, { type: T }> => e.type === type);

const END = { model: "scripted", provider: "mock", usedBackup: false, firstTokenMs: 1, totalMs: 1 };
export const call = (name: string, args: Record<string, unknown> = {}, id = `call_${name}_${Math.random().toString(36).slice(2, 8)}`): ToolCall => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

// A model that plays back fixed steps: each step is either tool calls or a text answer. `seen` records what it was sent.
export function scriptedModel(steps: (ToolCall[] | string)[]) {
  const seen: StreamOptions[] = [];
  let index = 0;
  async function* script(options: StreamOptions): AsyncGenerator<ModelChunk> {
    seen.push({ ...options, messages: [...options.messages] });
    const step = steps[Math.min(index++, steps.length - 1)];
    if (typeof step === "string") {
      for (const word of step.split(/(?<= )/)) yield { type: "delta", text: word };
      yield { type: "end", toolCalls: [], ...END };
      return;
    }
    yield { type: "end", toolCalls: step, ...END };
  }
  return { script, seen };
}

// Replaces global fetch for one test. The handler decides each response from the URL and request.
export function stubFetch(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input instanceof Request ? input.url : input), init)) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

export const sse = (lines: unknown[]): Response =>
  new Response(lines.map((line) => `data: ${typeof line === "string" ? line : JSON.stringify(line)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
