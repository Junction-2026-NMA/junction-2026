// Reads every setting the agent needs from the environment. Server-side only: never import this in a client component.

export type Provider = "mock" | "nvidia" | "verda" | "gemini";

const PROVIDERS: Provider[] = ["mock", "nvidia", "verda", "gemini"];
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

export type AgentConfig = {
  provider: Provider;
  isMock: boolean;
  model: {
    baseUrl: string;
    apiKey: string;
    name: string;
    fastName: string | null; // optional smaller model for the tool-choice step
    thinking: boolean;
    sendsThinkingFlag: boolean; // only Nemotron endpoints understand chat_template_kwargs
  };
  exa: { apiKey: string; searchType: string };
  contextDev: { apiKey: string };
  eleven: { apiKey: string; ttsModel: string; sttModel: string; sttLanguage: string; voiceId: string };
};

const env = (name: string, fallback = ""): string => (process.env[name] ?? fallback).trim();

export function getConfig(): AgentConfig {
  const requested = env("MODEL_PROVIDER", "mock") as Provider;
  const provider = PROVIDERS.includes(requested) ? requested : "mock";
  const isGemini = provider === "gemini";

  return {
    provider,
    isMock: provider === "mock",
    model: {
      baseUrl: isGemini ? env("GEMINI_BASE_URL", GEMINI_BASE_URL) : env("NEMOTRON_BASE_URL"),
      apiKey: isGemini ? env("GEMINI_API_KEY") : env("NEMOTRON_API_KEY"),
      name: isGemini ? env("GEMINI_MODEL", "gemini-flash-latest") : env("NEMOTRON_MODEL", "nvidia/nemotron-3.5-super-vl-120b-a12b"),
      fastName: isGemini ? null : env("NEMOTRON_FAST_MODEL") || null,
      thinking: env("NEMOTRON_THINKING", "off") === "on",
      sendsThinkingFlag: !isGemini,
    },
    exa: { apiKey: env("EXA_API_KEY"), searchType: env("EXA_SEARCH_TYPE", "lite") },
    contextDev: { apiKey: env("CONTEXT_DEV_API_KEY") },
    eleven: {
      apiKey: env("ELEVENLABS_API_KEY"),
      ttsModel: env("ELEVENLABS_TTS_MODEL", "eleven_turbo_v2_5"),
      sttModel: env("ELEVENLABS_STT_MODEL", "scribe_v3"),
      sttLanguage: env("ELEVENLABS_STT_LANGUAGE", "en"),
      voiceId: env("ELEVENLABS_VOICE_ID"),
    },
  };
}

// A short, safe description of a missing setting. Never includes key values.
export function missingKey(service: string, variable: string): Error {
  return new Error(`${service} is not set up on this server (${variable} is empty).`);
}
