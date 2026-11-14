// One conversation turn, as a stream of events. The rules it follows are in context/orchestration.md.
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import type { AgentEvent, AgentRequest, BillType, Citation, ToolTrace, TurnTimings } from "@/lib/types";
import { getConfig } from "./config";
import { type ChatMessage, type ToolCall, streamChat } from "./model";
import { buildSystemPrompt } from "./prompt";
import { ensureResearch, isResearchReady } from "./research";
import { createSentenceSplitter, forSpeech } from "./sentences";
import { speculate } from "./speculate";
import { TOOL_SCHEMAS, type ToolContext, type ToolOutcome, billTypeOf, executeTool, parseArgs } from "./tools";

const MAX_MODEL_STEPS = 4;
const MAX_HISTORY_TURNS = 8;
const MAX_TOKENS = { voice: 220, text: 420 };
// A short reply that promises to do something instead of doing it.
const PROMISE_PATTERN = /\b(i can|i could|i'll|i will|let me|shall i)\b[^.?!]*\b(run|check|look|find|search|calculate|work out|pull)\b/i;
const PROMISE_MAX_CHARS = 120;

const FILLER: Record<BillType, (city: string) => string> = {
  electricity: (city) => `Let me check today's electricity deals in ${city}.`,
  mobile: () => "Let me check today's mobile plans.",
  internet: (city) => `Let me check today's broadband deals in ${city}.`,
};

type Settled = { call: ToolCall; outcome: ToolOutcome; startedAtMs: number; tookMs: number };

// Yields each tool result the moment it finishes, whatever order the tools were started in.
async function* inCompletionOrder<T>(tasks: Promise<T>[]): AsyncGenerator<T> {
  const pending = new Map(tasks.map((task, index) => [index, task.then((value) => ({ index, value }))]));
  while (pending.size) {
    const { index, value } = await Promise.race(pending.values());
    pending.delete(index);
    yield value;
  }
}

export async function* runTurn(request: AgentRequest, signal?: AbortSignal, sttMs: number | null = null): AsyncGenerator<AgentEvent> {
  const turnStarted = Date.now();
  const sinceStart = () => Date.now() - turnStarted;
  const config = getConfig();
  const customer = findCustomer(request.customerId);
  const overview = buildOverview(request.customerId);
  if (!customer || !overview) {
    yield { type: "error", message: "We could not find that customer." };
    return;
  }

  yield { type: "start", turnId: crypto.randomUUID(), provider: config.provider, model: config.model.name, mock: config.isMock };

  // Rule 1: start slow research now if the words suggest it. Nothing here is awaited.
  const guess = speculate(request.text, request.focusBill);
  if (guess) {
    ensureResearch(guess.billType, customer.area);
    yield { type: "speculation", billType: guess.billType, reason: guess.reason };
  }

  const context: ToolContext = { customerId: request.customerId, overview, city: customer.area, signal };
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(overview, request.mode, customer.area) },
    ...(request.history ?? []).slice(-MAX_HISTORY_TURNS).map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: request.text },
  ];

  const splitter = createSentenceSplitter();
  const timings: TurnTimings = { sttMs, firstTokenMs: null, firstSentenceMs: null, totalMs: 0, modelSteps: [] };
  const citations: Citation[] = [];
  let answer = "";
  let sentenceIndex = 0;
  let fillerSent = false;

  function* emitSentences(sentences: string[]): Generator<AgentEvent> {
    for (const sentence of sentences) {
      const text = request.mode === "voice" ? forSpeech(sentence) : sentence;
      if (!text) continue;
      timings.firstSentenceMs ??= sinceStart();
      yield { type: "sentence", index: sentenceIndex++, text };
    }
  }

  try {
    for (let step = 0; step < MAX_MODEL_STEPS; step++) {
      let toolCalls: ToolCall[] = [];
      let stepText = "";
      const isLastStep = step === MAX_MODEL_STEPS - 1;

      for await (const chunk of streamChat({
        messages,
        tools: isLastStep ? [] : TOOL_SCHEMAS, // the last step must answer in words
        maxTokens: MAX_TOKENS[request.mode],
        useFastModel: step === 0,
        signal,
      })) {
        if (chunk.type === "delta") {
          timings.firstTokenMs ??= sinceStart();
          stepText += chunk.text;
          yield { type: "delta", text: chunk.text };
          yield* emitSentences(splitter.push(chunk.text));
        } else {
          toolCalls = chunk.toolCalls;
          timings.modelSteps = [...timings.modelSteps, { model: chunk.model, provider: chunk.provider, usedBackup: chunk.usedBackup, firstTokenMs: chunk.firstTokenMs, totalMs: chunk.totalMs }];
        }
      }
      answer += stepText;

      // Rule 4: no tool calls means the model had what it needed. The turn ends here,
      // and any speculative research simply stays in the cache.
      if (!toolCalls.length) {
        // Guard: sometimes the model says "I can run that for you" and stops. Make it follow through once.
        // The same goes when the question was clearly about a better deal and it answered without searching.
        const promised = stepText.length < PROMISE_MAX_CHARS && PROMISE_PATTERN.test(stepText);
        if (step === 0 && (promised || guess)) {
          yield* emitSentences(splitter.flush());
          messages.push({ role: "assistant", content: stepText }, { role: "user", content: guess ? `Go ahead: call search_offers for ${guess.billType} now, then answer with the result.` : "Go ahead: call the tool now, then answer with the result." });
          continue;
        }
        break;
      }

      yield* emitSentences(splitter.flush());
      messages.push({ role: "assistant", content: stepText || null, tool_calls: toolCalls });

      // Rule 6: if offer research was asked for and is not ready, say so at once instead of going quiet.
      for (const call of toolCalls) {
        const args = parseArgs(call);
        yield { type: "tool_start", id: call.id, name: call.function.name, args };
        const billType = call.function.name === "search_offers" ? billTypeOf(args) : null;
        if (!billType) continue;
        const { key } = ensureResearch(billType, customer.area);
        if (!fillerSent && !stepText.trim() && !isResearchReady(key)) {
          fillerSent = true;
          yield { type: "filler", text: FILLER[billType](customer.area) };
        }
      }

      // Rule 7: every tool the model asked for in this step runs at the same time.
      const tasks = toolCalls.map(async (call): Promise<Settled> => {
        const startedAtMs = sinceStart();
        const outcome = await executeTool(call, context).catch(
          (error): ToolOutcome => ({
            content: JSON.stringify({ error: (error as Error).message }),
            ok: false,
            summary: (error as Error).message,
            source: "finance",
            joinedPrefetch: false,
            citations: [],
          }),
        );
        return { call, outcome, startedAtMs, tookMs: sinceStart() - startedAtMs };
      });

      const results = new Map<string, ToolOutcome>();
      for await (const { call, outcome, startedAtMs, tookMs } of inCompletionOrder(tasks)) {
        results.set(call.id, outcome);
        citations.push(...outcome.citations.filter((c) => !citations.some((seen) => seen.url === c.url)));
        const trace: ToolTrace = {
          id: call.id,
          name: call.function.name,
          args: parseArgs(call),
          source: outcome.source,
          startedAtMs,
          tookMs,
          ok: outcome.ok,
          summary: outcome.summary,
          joinedPrefetch: outcome.joinedPrefetch,
        };
        yield { type: "tool_end", trace };
        if (outcome.research) yield { type: "research", result: outcome.research };
      }
      // Tool results go back in the order the model asked for them.
      messages.push(...toolCalls.map((call): ChatMessage => ({ role: "tool", tool_call_id: call.id, content: results.get(call.id)?.content ?? "{}" })));
    }

    yield* emitSentences(splitter.flush());
    timings.totalMs = sinceStart();
    yield { type: "done", text: answer.trim(), citations, timings };
  } catch (error) {
    if (signal?.aborted) return; // the user interrupted; nothing to report
    console.error("[agent] turn failed", error);
    yield { type: "error", message: (error as Error).message || "Sisu could not answer just now. Please try again." };
  }
}
