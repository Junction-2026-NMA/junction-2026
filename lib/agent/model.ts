// Streaming chat client for any OpenAI-compatible endpoint (NVIDIA Build, a Verda vLLM server, Gemini).
import { recordFailure, recordSuccess, shouldSkip } from "./breaker";
import { type ModelEndpoint, getConfig, missingKey } from "./config";
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
  | { type: "end"; toolCalls: ToolCall[]; model: string; provider: string; usedBackup: boolean; firstTokenMs: number | null; totalMs: number };

// Internal: the first token of any kind has arrived (text or the start of a tool call). The stall timer stops here,
// so a model that is busy writing a long tool call is never mistaken for one that has hung.
type RawChunk = ModelChunk | { type: "started" };

export type StreamOptions = {
  messages: ChatMessage[];
  tools: ToolSchema[];
  maxTokens: number;
  useFastModel?: boolean;
  forceTool?: boolean | string; // true: the reply must be a tool call. A name: it must be that tool. Used when the model described an action instead of taking it
  signal?: AbortSignal;
};

const MODEL_TIMEOUT_MS = 25_000;
// If the main model has produced nothing by now, the backup takes the turn. Measured first tokens on our GPU:
// p50 0.26 s, p95 0.34 s alone, and up to about 1.5 s with twelve turns at once. Two seconds leaves room for a
// busy GPU without making a customer wait long for a dead one. MODEL_FIRST_TOKEN_LIMIT_MS overrides it.
const firstTokenLimitMs = (): number => Number(process.env.MODEL_FIRST_TOKEN_LIMIT_MS) || 2_000;

// MODEL_FORCE_TOOL=off switches forcing off, for a model server that does not support it.
function toolChoice(force: StreamOptions["forceTool"]): unknown {
  if (!force || process.env.MODEL_FORCE_TOOL === "off") return "auto";
  return typeof force === "string" ? { type: "function", function: { name: force } } : "required";
}

type Delta = {
  content?: string | null;
  tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
};

// Yields text as it arrives, then one "end" chunk carrying any tool calls the model asked for.
// Stall protection: if the main model errors or stays silent past FIRST_TOKEN_LIMIT_MS, the same
// request goes to the backup model (the same Nemotron on another host) and the trace says so.
export async function* streamChat(options: StreamOptions): AsyncGenerator<ModelChunk> {
  const config = getConfig();
  if (config.isMock) {
    yield* mockStream(options.messages, options);
    return;
  }
  const backup = config.fallbackModel;
  if (!backup) {
    yield* withoutStarted(streamFrom(config.model, options, options.signal, false));
    return;
  }

  // During an outage the first failed step opens the breaker; later steps skip the wait and go straight to the backup.
  if (shouldSkip(config.model)) {
    yield* withoutStarted(streamFrom(backup, options, options.signal, true));
    return;
  }

  const giveUp = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, giveUp.signal]) : giveUp.signal;
  const main = streamFrom(config.model, options, signal, false);
  const firstChunk = main.next();
  firstChunk.catch(() => undefined); // handled below; this stops a late failure being reported twice
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = firstTokenLimitMs();
  const tooSlow = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no reply within ${limit} ms`)), limit);
  });

  let first: IteratorResult<RawChunk>;
  try {
    first = await Promise.race([firstChunk, tooSlow]);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    giveUp.abort();
    recordFailure(config.model);
    console.error(`[agent] ${config.model.provider} model failed or stalled (${(error as Error).message}); switching to ${backup.provider}`);
    yield* withoutStarted(streamFrom(backup, options, options.signal, true));
    return;
  } finally {
    clearTimeout(timer);
  }
  if (first.done) return;
  recordSuccess(config.model);
  // The main model has started. If its connection then breaks before it has said anything to the user
  // (for example while it was still writing a tool call), the backup can take the whole step over unnoticed.
  let saidSomething = false;
  try {
    if (first.value.type !== "started") {
      saidSomething = first.value.type === "delta";
      yield first.value;
    }
    for await (const chunk of main) {
      if (chunk.type === "started") continue;
      saidSomething ||= chunk.type === "delta";
      yield chunk;
    }
  } catch (error) {
    if (options.signal?.aborted || saidSomething) throw error;
    recordFailure(config.model);
    console.error(`[agent] ${config.model.provider} model broke off mid-step (${(error as Error).message}); switching to ${backup.provider}`);
    yield* withoutStarted(streamFrom(backup, options, options.signal, true));
  }
}

async function* withoutStarted(chunks: AsyncGenerator<RawChunk>): AsyncGenerator<ModelChunk> {
  for await (const chunk of chunks) if (chunk.type !== "started") yield chunk;
}

async function* streamFrom(endpoint: ModelEndpoint, options: StreamOptions, outerSignal: AbortSignal | undefined, usedBackup: boolean): AsyncGenerator<RawChunk> {
  const { thinking } = getConfig();
  const prefix = { nvidia: "NEMOTRON", verda: "VERDA", gemini: "GEMINI", mock: "" }[endpoint.provider];
  if (!endpoint.baseUrl) throw missingKey("The reasoning model", `${prefix}_BASE_URL`);
  if (!endpoint.apiKey) throw missingKey("The reasoning model", `${prefix}_API_KEY`);

  const model = options.useFastModel && endpoint.fastName ? endpoint.fastName : endpoint.name;
  const started = Date.now();
  const timeout = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const signal = outerSignal ? AbortSignal.any([outerSignal, timeout]) : timeout;

  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: options.messages,
      stream: true,
      max_tokens: options.maxTokens,
      temperature: 0.3,
      ...(options.tools.length ? { tools: options.tools, tool_choice: toolChoice(options.forceTool) } : {}),
      ...(endpoint.sendsThinkingFlag ? { chat_template_kwargs: { enable_thinking: thinking } } : {}),
    }),
  });
  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.error(`[agent] ${endpoint.provider} model ${model} returned ${response.status}: ${detail}`);
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
      if (firstTokenMs === null && (delta.content || delta.tool_calls?.length)) {
        firstTokenMs = Date.now() - started;
        yield { type: "started" };
      }
      if (delta.content) yield { type: "delta", text: delta.content };
      for (const part of delta.tool_calls ?? []) {
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
  yield { type: "end", toolCalls, model, provider: endpoint.provider, usedBackup, firstTokenMs, totalMs: Date.now() - started };
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

// Sends the prompt once and throws the answer away. vLLM keeps the processed prompt in its cache, so the
// user's first real question skips about 2 s of prompt reading. Only the main model is primed.
export async function primeModel(messages: ChatMessage[], tools: ToolSchema[]): Promise<void> {
  const config = getConfig();
  if (config.isMock) return;
  try {
    for await (const chunk of streamFrom(config.model, { messages, tools, maxTokens: 1 }, undefined, false)) void chunk;
  } catch (error) {
    console.error(`[agent] could not prime the ${config.model.provider} model:`, (error as Error).message);
  }
}
