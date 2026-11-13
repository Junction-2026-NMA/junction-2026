// ElevenLabs speech to text and text to speech. In mock mode both work without keys.
import { getConfig, missingKey } from "./config";
import { mockWav } from "./mock";

const STT_TIMEOUT_MS = 12_000;
const TTS_TIMEOUT_MS = 12_000;
const TTS_CACHE_MAX_CHARS = 240; // short sentences and fillers repeat, so they are worth keeping
const TTS_CACHE_MAX_ENTRIES = 200;
export const MAX_TTS_CHARS = 600;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

const globalStore = globalThis as unknown as { __sisuTts?: Map<string, Uint8Array<ArrayBuffer>> };
const ttsCache: Map<string, Uint8Array<ArrayBuffer>> = (globalStore.__sisuTts ??= new Map());

export type Transcript = { text: string; tookMs: number; mock: boolean };

export async function transcribe(audio: Blob): Promise<Transcript> {
  const { isMock, eleven } = getConfig();
  if (isMock) return { text: "Can you find me a cheaper electricity deal?", tookMs: 0, mock: true };
  if (!eleven.apiKey) throw missingKey("Speech to text", "ELEVENLABS_API_KEY");

  const started = Date.now();
  const form = new FormData();
  form.set("model_id", eleven.sttModel);
  form.set("tag_audio_events", "false");
  if (eleven.sttLanguage) form.set("language_code", eleven.sttLanguage);
  form.set("file", audio, "speech");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    headers: { "xi-api-key": eleven.apiKey },
    body: form,
  });
  if (!response.ok) {
    console.error(`[agent] speech to text returned ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
    throw new Error("Sisu could not hear that. Please try again or type your question.");
  }
  const body = (await response.json()) as { text?: string };
  return { text: (body.text ?? "").trim(), tookMs: Date.now() - started, mock: false };
}

export type Speech = { body: ReadableStream<Uint8Array> | Uint8Array<ArrayBuffer>; contentType: string; cached: boolean };

// Returns audio as a stream so the browser can start playing before the whole clip exists.
export async function synthesize(text: string): Promise<Speech> {
  const { isMock, eleven } = getConfig();
  if (isMock) return { body: mockWav(), contentType: "audio/wav", cached: false };
  if (!eleven.apiKey) throw missingKey("Text to speech", "ELEVENLABS_API_KEY");
  if (!eleven.voiceId) throw missingKey("Text to speech", "ELEVENLABS_VOICE_ID");

  const cacheKey = `${eleven.ttsModel}|${eleven.voiceId}|${text}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) return { body: cached, contentType: "audio/mpeg", cached: true };

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${eleven.voiceId}/stream?output_format=mp3_44100_64`, {
    method: "POST",
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    headers: { "xi-api-key": eleven.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: eleven.ttsModel }),
  });
  if (!response.ok || !response.body) {
    console.error(`[agent] text to speech returned ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
    throw new Error("Sisu's voice is unavailable right now. The answer is shown as text.");
  }

  if (text.length > TTS_CACHE_MAX_CHARS) return { body: response.body, contentType: "audio/mpeg", cached: false };

  // Send the audio to the caller and keep a copy for next time, without delaying either.
  const [forCaller, forCache] = response.body.tee();
  void new Response(forCache)
    .arrayBuffer()
    .then((buffer) => {
      if (ttsCache.size >= TTS_CACHE_MAX_ENTRIES) ttsCache.delete(ttsCache.keys().next().value as string);
      ttsCache.set(cacheKey, new Uint8Array(buffer));
    })
    .catch((error) => console.error("[agent] could not cache speech", error));
  return { body: forCaller, contentType: "audio/mpeg", cached: false };
}
