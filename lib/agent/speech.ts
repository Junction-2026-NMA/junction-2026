// ElevenLabs speech to text and text to speech. In mock mode both work without keys.
import { getConfig, missingKey } from "./config";
import { mockPcm, mockWav } from "./mock";

const STT_TIMEOUT_MS = 12_000;
const TTS_TIMEOUT_MS = 12_000;
const TTS_CACHE_MAX_CHARS = 240; // short sentences and fillers repeat, so they are worth keeping
const TTS_CACHE_MAX_ENTRIES = 120;
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

export type SpeechFormat = "pcm" | "mp3";
export type SpeechOptions = {
  format?: SpeechFormat; // pcm streams into the browser's audio engine with no decoding delay; mp3 is a normal file
  previousText?: string; // what Sisu said just before, so each sentence continues naturally from the last
  model?: string; // override, for comparing voices by ear on the test bench
  voiceId?: string;
};
export type Speech = { body: ReadableStream<Uint8Array> | Uint8Array<ArrayBuffer>; contentType: string; cached: boolean };

export const PCM_SAMPLE_RATE = 24_000;
// Models the test bench may choose between. The default comes from ELEVENLABS_TTS_MODEL.
export const TTS_MODELS = ["eleven_v4_turbo", "eleven_v4", "eleven_v3_conversational", "eleven_turbo_v2_5"];
const SUPPORTS_PREVIOUS_TEXT = ["eleven_v4_turbo", "eleven_v4", "eleven_turbo_v2_5"];
const VOICE_ID = /^[A-Za-z0-9]{10,40}$/;
const FORMAT = {
  pcm: { query: `pcm_${PCM_SAMPLE_RATE}`, contentType: `audio/pcm;rate=${PCM_SAMPLE_RATE}` },
  mp3: { query: "mp3_44100_64", contentType: "audio/mpeg" },
};

// Returns audio as a stream so the browser can start playing before the whole clip exists.
export async function synthesize(text: string, options: SpeechOptions = {}): Promise<Speech> {
  const { isMock, eleven } = getConfig();
  const format = options.format ?? "pcm";
  if (isMock) return format === "pcm" ? { body: mockPcm(PCM_SAMPLE_RATE), contentType: FORMAT.pcm.contentType, cached: false } : { body: mockWav(), contentType: "audio/wav", cached: false };
  if (!eleven.apiKey) throw missingKey("Text to speech", "ELEVENLABS_API_KEY");

  const model = options.model && TTS_MODELS.includes(options.model) ? options.model : eleven.ttsModel;
  const voiceId = options.voiceId && VOICE_ID.test(options.voiceId) ? options.voiceId : eleven.voiceId;
  if (!voiceId) throw missingKey("Text to speech", "ELEVENLABS_VOICE_ID");
  const previousText = SUPPORTS_PREVIOUS_TEXT.includes(model) ? options.previousText?.slice(-300) : undefined;

  const cacheKey = `${format}|${model}|${voiceId}|${previousText ?? ""}|${text}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) return { body: cached, contentType: FORMAT[format].contentType, cached: true };

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${FORMAT[format].query}`, {
    method: "POST",
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    headers: { "xi-api-key": eleven.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model, ...(previousText ? { previous_text: previousText } : {}) }),
  });
  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    console.error(`[agent] text to speech returned ${response.status}: ${detail}`);
    if (/quota|credit/i.test(detail)) throw new Error("Sisu's voice has used up its ElevenLabs credit. The answer is shown as text.");
    throw new Error("Sisu's voice is unavailable right now. The answer is shown as text.");
  }

  if (text.length > TTS_CACHE_MAX_CHARS) return { body: response.body, contentType: FORMAT[format].contentType, cached: false };

  // Send the audio to the caller and keep a copy for next time, without delaying either.
  const [forCaller, forCache] = response.body.tee();
  void new Response(forCache)
    .arrayBuffer()
    .then((buffer) => {
      if (ttsCache.size >= TTS_CACHE_MAX_ENTRIES) ttsCache.delete(ttsCache.keys().next().value as string);
      ttsCache.set(cacheKey, new Uint8Array(buffer));
    })
    .catch((error) => console.error("[agent] could not cache speech", error));
  return { body: forCaller, contentType: FORMAT[format].contentType, cached: false };
}

export type VoiceOption = { id: string; name: string; accent: string | null; style: string | null };

// The voices on the account, for choosing one by ear on the test bench.
export async function listVoices(): Promise<{ voices: VoiceOption[]; models: string[]; current: { model: string; voiceId: string } }> {
  const { isMock, eleven } = getConfig();
  const current = { model: eleven.ttsModel, voiceId: eleven.voiceId };
  if (isMock || !eleven.apiKey) return { voices: [], models: TTS_MODELS, current };
  const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": eleven.apiKey }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return { voices: [], models: TTS_MODELS, current };
  const body = (await response.json()) as { voices?: { voice_id: string; name: string; labels?: { accent?: string; use_case?: string } }[] };
  const voices = (body.voices ?? []).map((v) => ({ id: v.voice_id, name: v.name, accent: v.labels?.accent ?? null, style: v.labels?.use_case ?? null }));
  return { voices, models: TTS_MODELS, current };
}
