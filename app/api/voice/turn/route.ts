import { TOO_MANY, allowRequest, eventStream, jsonError, parseAgentRequest } from "@/lib/agent/http";
import { runTurn } from "@/lib/agent/orchestrator";
import { warmUp } from "@/lib/agent/warm";
import { AUTO } from "@/lib/agent/languages";
import { MAX_AUDIO_BYTES, lastWords, transcribe } from "@/lib/agent/speech";
import type { AgentRequest, SisuEvent } from "@/lib/types";
import { withVisitor } from "@/lib/agent/visitor";

export const runtime = "nodejs";
export const maxDuration = 60;

// `spoken` is "auto" (detect the language) or the code the customer chose.
async function* voiceTurn(audio: Blob, base: Omit<AgentRequest, "text">, spoken: string, signal: AbortSignal): AsyncGenerator<SisuEvent> {
  let transcript;
  try {
    transcript = await transcribe(audio, spoken);
  } catch (error) {
    yield { type: "error", message: (error as Error).message };
    return;
  }
  yield { type: "transcript", text: transcript.text, tookMs: transcript.tookMs, language: transcript.language, languageProbability: transcript.languageProbability };
  if (!transcript.text) {
    yield { type: "error", message: "Sisu did not catch any words. Please say that again." };
    return;
  }
  // Sisu answers in the language that was spoken, when that is known.
  yield* runTurn({ ...base, text: lastWords(transcript.text, 500), language: transcript.language ?? undefined }, signal, transcript.tookMs);
}

// Recorded speech in, the same event stream as /api/agent/query out, starting with the transcript.
export const POST = withVisitor(async function POST(request: Request) {
  if (!allowRequest(request, "agent", 30)) return TOO_MANY();
  void warmUp(); // no-op after the first request
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return jsonError("No recording was received.", 400);
  if (audio.size > MAX_AUDIO_BYTES) return jsonError("That recording is too long. Keep it under a minute, or type your question.", 413);

  const history = (() => {
    try {
      return JSON.parse(String(form?.get("history") ?? "[]"));
    } catch {
      return [];
    }
  })();
  // The text is filled in after transcription; a placeholder lets the same validation run now.
  // bufferEur: the protected buffer the customer set in the app, so Sisu's weekly budget matches Today's.
  const parsed = parseAgentRequest({ customerId: form?.get("customerId"), text: "voice", history, focusBill: form?.get("focusBill"), bufferEur: form?.get("bufferEur"), paydayDate: form?.get("paydayDate") ?? undefined, extraBills: form?.get("extraBills") ?? undefined }, "voice");
  if (typeof parsed === "string") return jsonError(parsed, 400);
  const { customerId, history: turns, focusBill, bufferEur, paydayDate, extraBills } = parsed;
  const spoken = typeof form?.get("language") === "string" ? String(form?.get("language")) : AUTO;
  return eventStream(voiceTurn(audio, { customerId, mode: "voice", history: turns, focusBill, ...(bufferEur === undefined ? {} : { bufferEur }), ...(paydayDate ? { paydayDate } : {}), ...(extraBills ? { extraBills } : {}) }, spoken, request.signal));
});
