import { TOO_MANY, allowRequest, jsonError } from "@/lib/agent/http";
import { MAX_TTS_CHARS, synthesize } from "@/lib/agent/speech";

export const runtime = "nodejs";

// One sentence in, audio out. The client calls this once per "sentence" or "filler" event and plays them in order.
export async function POST(request: Request) {
  if (!allowRequest(request, "tts", 120)) return TOO_MANY();
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return jsonError("There is nothing to say.", 400);
  if (text.length > MAX_TTS_CHARS) return jsonError("That is too long to speak in one go.", 413);
  try {
    const speech = await synthesize(text);
    return new Response(speech.body, {
      headers: { "Content-Type": speech.contentType, "Cache-Control": "no-store", "X-Sisu-Tts-Cache": speech.cached ? "hit" : "miss" },
    });
  } catch (error) {
    return jsonError((error as Error).message, 502);
  }
}
