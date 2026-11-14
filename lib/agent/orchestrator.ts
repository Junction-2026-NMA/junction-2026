// One conversation turn, as a stream of events. The rules it follows are in context/orchestration.md.
import { buildCashFlow } from "@/lib/finance/cashflow";
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import { findPatterns } from "@/lib/finance/patterns";
import { getMemory } from "@/lib/memory";
import type { AgentRequest, BillType, CashFlow, Citation, Fact, NumberCorrection, SisuEvent, Stage, ToolTrace, TurnTimings } from "@/lib/types";
import { getConfig } from "./config";
import { type Sources, checkGrounding, correctNames, correctNumbers, overviewFacts } from "./grounding";
import { type ChatMessage, type ToolCall, streamChat } from "./model";
import { buildSystemPrompt, customerSummary } from "./prompt";
import { ensureResearch, isResearchReady } from "./research";
import { createSentenceSplitter, forSpeech } from "./sentences";
import { speculate } from "./speculate";
import { TOOL_SCHEMAS, type ToolContext, type ToolOutcome, billTypeOf, executeTool, parseArgs } from "./tools";
import { failure } from "./tools/types";
import { FORGED_NOTE, looksForged } from "./tools/untrusted";

const MAX_MODEL_STEPS = { chat: 4, investigate: 9 };
const MAX_TOOLS_PER_STEP = 4;
const MAX_HISTORY_TURNS = 8;
const MAX_TOKENS = { voice: 220, text: 420, investigate: 520 };
const MAX_NUDGES = 2;
// A short reply that promises to do something instead of doing it. "I can only search for..." is a refusal, not a promise.
export const PROMISE_PATTERN = /\b(i can(?!not|'t| only| not)|i could(?! not|n't)|i'll|i will|let me|shall i)\b[^.?!]*\b(run|check|look|find|search|calculate|work out|pull)\b/i;
const PROMISE_MAX_CHARS = 120;
export const INVESTIGATE_TEXT = "Look into my finances on your own and come back with the one best thing I can do, checked and ready for me to approve.";

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

// In an investigation the model should not stop halfway. This names the step it skipped, if any.
function missingInvestigationStep(called: Set<string>, offerFound: boolean, researched: boolean): string | null {
  if (!called.has("find_patterns")) return "find_patterns";
  if (researched && offerFound && !called.has("run_scenario")) return "run_scenario (use the monthly saving search_offers reported, over 5 years)";
  if (!called.has("explain_concept")) return "explain_concept";
  if (researched && offerFound && !called.has("prepare_action")) return "prepare_action (kind switch_contract)";
  return null;
}

export async function* runTurn(request: AgentRequest, signal?: AbortSignal, sttMs: number | null = null): AsyncGenerator<SisuEvent> {
  const turnStarted = Date.now();
  const sinceStart = () => Date.now() - turnStarted;
  const config = getConfig();
  const customer = findCustomer(request.customerId);
  const overview = buildOverview(request.customerId);
  if (!customer || !overview) {
    yield { type: "error", message: "We could not find that customer." };
    return;
  }
  const investigate = request.investigate === true;
  const turnId = crypto.randomUUID();
  const memory = getMemory(request.customerId);
  let cashFlowCache: CashFlow | null = null;
  const cashFlow = () => (cashFlowCache ??= buildCashFlow(overview));

  yield { type: "start", turnId, provider: config.provider, model: config.model.name, mock: config.isMock };

  // Rule 1: start slow research now if the words suggest it. Nothing here is awaited.
  // An investigation almost always ends at a bill, so it starts research for the strongest bill lead at once.
  const leadBill = investigate ? (findPatterns(overview, cashFlow()).find((p) => p.billType)?.billType ?? null) : null;
  const guess = leadBill ? { billType: leadBill, reason: `An investigation usually needs live ${leadBill} offers, so research started early.` } : speculate(request.text, request.focusBill);
  if (guess) {
    ensureResearch(guess.billType, customer.area);
    yield { type: "speculation", billType: guess.billType, reason: guess.reason };
  }

  if (investigate) yield { type: "filler", text: `Give me a moment, ${overview.displayName}. I'm going through your last twelve months.` };

  const history = (request.history ?? []).slice(-MAX_HISTORY_TURNS);
  // Text dressed up as a tool result or system message is labelled for the model, and its numbers stop counting as "the user said so".
  const forged = looksForged(request.text);
  const userTexts = forged ? [] : [...history.filter((turn) => turn.role === "user").map((turn) => turn.content), request.text];
  const context: ToolContext = { customerId: request.customerId, overview, city: customer.area, memory, cashFlow, userTexts, signal };
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt({ overview, city: customer.area, mode: request.mode, memory, investigate }) },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: forged ? `${request.text}\n\n${FORGED_NOTE}` : request.text },
  ];

  const splitter = createSentenceSplitter();
  const timings: TurnTimings = { sttMs, firstTokenMs: null, firstSentenceMs: null, totalMs: 0, modelSteps: [] };
  const citations: Citation[] = [];
  const toolFacts: Fact[] = [];
  const toolContents: string[] = [];
  const called = new Set<string>();
  const maxSteps = MAX_MODEL_STEPS[investigate ? "investigate" : "chat"];
  let answer = "";
  let sentenceIndex = 0;
  let stageIndex = 0;
  let fillerSent = investigate;
  let nudges = 0;
  let offerFound = false;
  let researched = false;

  // Everything the answer's numbers may be checked against. Tool results are added as they arrive.
  const summaryFacts = overviewFacts(overview);
  const summaryText = customerSummary(overview, customer.area);
  const sources = (): Sources => ({ facts: [...toolFacts, ...summaryFacts], contextTexts: [summaryText, ...toolContents, ...memory.items.map((item) => item.value)], userTexts });
  const corrections: NumberCorrection[] = [];
  const providerNames: string[] = []; // every provider the offer research returned this turn
  const nameCorrections: { said: string; corrected: string }[] = [];
  const fixSlips = (text: string): string => {
    const numbers = correctNumbers(text, sources());
    const names = correctNames(numbers.text, providerNames);
    corrections.push(...numbers.corrections);
    nameCorrections.push(...names.corrections);
    return names.text;
  };

  // A sentence is checked the moment it is complete, before it is shown as a sentence or spoken:
  // a figure the model copied with a slipped digit is replaced by the receipt's value.
  function* emitSentences(sentences: string[]): Generator<SisuEvent> {
    for (const sentence of sentences) {
      const fixed = fixSlips(sentence);
      const text = request.mode === "voice" ? forSpeech(fixed) : fixed;
      if (!text) continue;
      timings.firstSentenceMs ??= sinceStart();
      yield { type: "sentence", index: sentenceIndex++, text };
    }
  }

  try {
    for (let step = 0; step < maxSteps; step++) {
      let toolCalls: ToolCall[] = [];
      let stepText = "";
      const isLastStep = step === maxSteps - 1;

      for await (const chunk of streamChat({
        messages,
        tools: isLastStep ? [] : TOOL_SCHEMAS, // the last step must answer in words
        maxTokens: investigate ? MAX_TOKENS.investigate : MAX_TOKENS[request.mode],
        useFastModel: step === 0,
        signal,
      })) {
        if (chunk.type === "delta") {
          timings.firstTokenMs ??= sinceStart();
          // Text from an earlier step is already on screen; keep the two apart.
          const gap = !stepText && answer && !/\s$/.test(answer) && !/^\s/.test(chunk.text) ? " " : "";
          stepText += chunk.text;
          yield { type: "delta", text: gap + chunk.text };
          yield* emitSentences(splitter.push(gap + chunk.text));
        } else {
          toolCalls = chunk.toolCalls.slice(0, MAX_TOOLS_PER_STEP);
          timings.modelSteps = [...timings.modelSteps, { model: chunk.model, provider: chunk.provider, usedBackup: chunk.usedBackup, firstTokenMs: chunk.firstTokenMs, totalMs: chunk.totalMs }];
        }
      }
      answer += answer && stepText && !/\s$/.test(answer) && !/^\s/.test(stepText) ? ` ${stepText}` : stepText;

      // Rule 4: no tool calls means the model had what it needed. The turn ends here,
      // and any speculative research simply stays in the cache.
      if (!toolCalls.length) {
        const missing = investigate && !isLastStep && nudges < MAX_NUDGES ? missingInvestigationStep(called, offerFound, researched) : null;
        if (missing) {
          nudges += 1;
          yield* emitSentences(splitter.flush());
          messages.push({ role: "assistant", content: stepText || "(working)" }, { role: "user", content: `Keep going with the investigation: call ${missing} now, then continue.` });
          continue;
        }
        // Guard: sometimes the model says "I can run that for you" and stops. Make it follow through once.
        // The same goes when the question was clearly about a better deal and it answered without searching.
        const promised = stepText.length < PROMISE_MAX_CHARS && PROMISE_PATTERN.test(stepText);
        if (!investigate && step === 0 && (promised || guess)) {
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
        called.add(call.function.name);
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
        const outcome = await executeTool(call, context).catch((error): ToolOutcome => {
          console.error(`[agent] tool ${call.function.name} threw`, error);
          return failure("finance", "That tool hit an unexpected problem.");
        });
        return { call, outcome, startedAtMs, tookMs: sinceStart() - startedAtMs };
      });

      const results = new Map<string, ToolOutcome>();
      for await (const { call, outcome, startedAtMs, tookMs } of inCompletionOrder(tasks)) {
        results.set(call.id, outcome);
        citations.push(...outcome.citations.filter((c) => !citations.some((seen) => seen.url === c.url)));
        toolFacts.push(...outcome.facts);
        toolContents.push(outcome.content);
        if (outcome.research) {
          providerNames.push(...outcome.research.offers.map((offer) => offer.provider));
          researched = true;
          offerFound ||= outcome.research.best !== null;
        }
        const trace: ToolTrace = { id: call.id, name: call.function.name, args: parseArgs(call), source: outcome.source, startedAtMs, tookMs, ok: outcome.ok, summary: outcome.summary, joinedPrefetch: outcome.joinedPrefetch };
        yield { type: "tool_end", trace };
        if (outcome.research) yield { type: "research", result: outcome.research };
        for (const draft of outcome.stages) {
          const stage: Stage = { ...draft, id: `${turnId}:${stageIndex++}`, toolCallId: call.id, atMs: sinceStart(), facts: draft.facts ?? outcome.facts };
          yield { type: "stage", stage };
        }
        if (outcome.teaching) yield { type: "teaching", card: outcome.teaching };
        if (outcome.action) yield { type: "action", action: outcome.action };
        if (outcome.memory) yield { type: "memory", item: outcome.memory };
      }
      // Tool results go back in the order the model asked for them.
      messages.push(...toolCalls.map((call): ChatMessage => ({ role: "tool", tool_call_id: call.id, content: results.get(call.id)?.content ?? "{}" })));
    }

    yield* emitSentences(splitter.flush());

    // Every number in the answer is checked against the receipts before the turn is declared done.
    const finalText = correctNames(correctNumbers(answer, sources()).text, providerNames).text;
    const { facts: allFacts, contextTexts } = sources();
    const grounding = { ...checkGrounding(finalText, allFacts, contextTexts, userTexts, corrections), ...(nameCorrections.length ? { nameCorrections } : {}) };
    if (corrections.length) console.error(`[agent] corrected slipped figures: ${corrections.map((c) => `${c.said} -> ${c.corrected}`).join(", ")}`);
    const usedIds = new Set(grounding.numbers.map((n) => n.factId));
    const facts = [...toolFacts, ...summaryFacts.filter((f) => usedIds.has(f.id))].filter((f, index, all) => all.findIndex((other) => other.id === f.id) === index);
    if (!grounding.ok) console.error(`[agent] ungrounded numbers in answer: ${grounding.unverified.join(", ")}`);
    yield { type: "grounding", grounding, facts };

    timings.totalMs = sinceStart();
    yield { type: "done", text: finalText.trim(), citations, timings };
  } catch (error) {
    if (signal?.aborted) return; // the user interrupted; nothing to report
    console.error("[agent] turn failed", error);
    yield { type: "error", message: (error as Error).message || "Sisu could not answer just now. Please try again." };
  }
}
