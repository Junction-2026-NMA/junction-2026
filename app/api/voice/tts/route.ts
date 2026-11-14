import { TOO_MANY, allowRequest, jsonError } from "@/lib/agent/http";
import { MAX_TTS_CHARS, listLanguages, listVoices, synthesize } from "@/lib/agent/speech";

export const runtime = "nodejs";

type Body = { text?: unknown; format?: unknown; previousText?: unknown; model?: unknown; voiceId?: unknown; language?: unknown };
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

// One sentence in, audio out. The client calls this once per "sentence" or "filler" event and plays them in order.
// format "pcm" (default) streams raw samples the browser can play as they arrive; "mp3" returns a normal file.
export async function POST(request: Request) {
  if (!allowRequest(request, "tts", 120)) return TOO_MANY();
  const body = (await request.json().catch(() => null)) as Body | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return jsonError("There is nothing to say.", 400);
  if (text.length > MAX_TTS_CHARS) return jsonError("That is too long to speak in one go.", 413);
  try {
    const speech = await synthesize(text, {
      format: body?.format === "mp3" ? "mp3" : "pcm",
      previousText: optionalText(body?.previousText),
      model: optionalText(body?.model),
      voiceId: optionalText(body?.voiceId),
      language: optionalText(body?.language),
    });
    return new Response(speech.body, {
      headers: { "Content-Type": speech.contentType, "Cache-Control": "no-store", "X-Sisu-Tts-Cache": speech.cached ? "hit" : "miss" },
    });
  } catch (error) {
    return jsonError((error as Error).message, 502);
  }
}

// The voices and models available, so one can be chosen by ear on the test bench.
export async function GET() {
  const [voices, languages] = await Promise.all([listVoices(), listLanguages()]);
  return Response.json({ ...voices, languages });
}
