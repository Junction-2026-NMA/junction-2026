// Streaming chat client for any OpenAI-compatible endpoint (NVIDIA Build, a Verda vLLM server, Gemini).
import { getConfig, missingKey } from "./config";
import { mockStream } from "./mock";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSchema = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type ModelChunk =
  | { type: "delta"; text: string }
  | { type: "end"; toolCalls: ToolCall[]; model: string; firstTokenMs: number | null; totalMs: number };

export type StreamOptions = {
  messages: ChatMessage[];
  tools: ToolSchema[];
  maxTokens: number;
  useFastModel?: boolean;
  signal?: AbortSignal;
};

const MODEL_TIMEOUT_MS = 25_000;

type Delta = {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
};

// Yields text as it arrives, then one "end" chunk carrying any tool calls the model asked for.
export async function* streamChat(options: StreamOptions): AsyncGenerator<ModelChunk> {
  const config = getConfig();
  if (config.isMock) {
    yield* mockStream(options.messages);
    return;
  }
  if (!config.model.baseUrl) throw missingKey("The reasoning model", "NEMOTRON_BASE_URL");
  if (!config.model.apiKey) throw missingKey("The reasoning model", "NEMOTRON_API_KEY");

  const model = options.useFastModel && config.model.fastName ? config.model.fastName : config.model.name;
  const started = Date.now();
  const timeout = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  const response = await fetch(`${config.model.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${config.model.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: options.messages,
      stream: true,
      max_tokens: options.maxTokens,
      temperature: 0.3,
      ...(options.tools.length ? { tools: options.tools, tool_choice: "auto" } : {}),
      ...(config.model.sendsThinkingFlag ? { chat_template_kwargs: { enable_thinking: config.model.thinking } } : {}),
    }),
  });
  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.error(`[agent] model ${model} returned ${response.status}: ${detail}`);
    throw new Error(`The reasoning model returned an error (${response.status}).`);
  }

  const calls = new Map<number, { id: string; name: string; args: string }>();
  let firstTokenMs: number | null = null;
  let buffer = "";
  const decoder = new TextDecoder();

  for await (const bytes of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const delta = parseDelta(line);
      if (!delta) continue;
      if (delta.content) {
        firstTokenMs ??= Date.now() - started;
        yield { type: "delta", text: delta.content };
      }
      for (const part of delta.tool_calls ?? []) {
        firstTokenMs ??= Date.now() - started;
        const current = calls.get(part.index) ?? { id: "", name: "", args: "" };
        calls.set(part.index, {
          id: part.id || current.id,
          name: current.name + (part.function?.name ?? ""),
          args: current.args + (part.function?.arguments ?? ""),
        });
      }
    }
  }

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, call]) => ({
      id: call.id || `call_${index}`,
      type: "function",
      function: { name: call.name, arguments: call.args || "{}" },
    }));
  yield { type: "end", toolCalls, model, firstTokenMs, totalMs: Date.now() - started };
}

function parseDelta(line: string): Delta | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const parsed = JSON.parse(payload) as { choices?: { delta?: Delta }[] };
    return parsed.choices?.[0]?.delta ?? null;
  } catch {
    return null; // a partial or keep-alive line; the stream carries on
  }
}
