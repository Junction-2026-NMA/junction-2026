// Reads every setting the agent needs from the environment. Server-side only: never import this in a client component.

export type Provider = "mock" | "nvidia" | "verda" | "gemini";

const PROVIDERS: Provider[] = ["mock", "nvidia", "verda", "gemini"];
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NEMOTRON_MODEL = "nvidia/nemotron-3.5-super-vl-120b-a12b";

export type ModelEndpoint = {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  name: string;
  fastName: string | null; // optional smaller model for the tool-choice step
  sendsThinkingFlag: boolean; // only Nemotron endpoints understand chat_template_kwargs
};

export type AgentConfig = {
  provider: Provider;
  isMock: boolean;
  model: ModelEndpoint;
  fallbackModel: ModelEndpoint | null; // takes over if the main model errors or stalls
  thinking: boolean;
  exa: { apiKey: string; searchType: string; deepType: string };
  contextDev: { apiKey: string };
  eleven: { apiKey: string; ttsModel: string; sttModel: string; sttLanguage: string; voiceId: string };
};

const env = (name: string, fallback = ""): string => (process.env[name] ?? fallback).trim();

// Each provider has its own settings, so switching for the demo is one line: MODEL_PROVIDER=verda.
function endpointFor(provider: Provider): ModelEndpoint {
  const settings = {
    mock: { baseUrl: "", apiKey: "", name: "mock" },
    nvidia: { baseUrl: env("NEMOTRON_BASE_URL", NVIDIA_BASE_URL), apiKey: env("NEMOTRON_API_KEY"), name: env("NEMOTRON_MODEL", NEMOTRON_MODEL) },
    verda: { baseUrl: env("VERDA_BASE_URL"), apiKey: env("VERDA_API_KEY"), name: env("VERDA_MODEL", NEMOTRON_MODEL) },
    gemini: { baseUrl: env("GEMINI_BASE_URL", GEMINI_BASE_URL), apiKey: env("GEMINI_API_KEY"), name: env("GEMINI_MODEL", "gemini-flash-latest") },
  }[provider];
  return {
    provider,
    ...settings,
    fastName: provider === "nvidia" ? env("NEMOTRON_FAST_MODEL") || null : null,
    sendsThinkingFlag: provider !== "gemini",
  };
}

export function getConfig(): AgentConfig {
  const requested = env("MODEL_PROVIDER", "mock") as Provider;
  const provider = PROVIDERS.includes(requested) ? requested : "mock";
  const backup = env("MODEL_FALLBACK") as Provider;
  const hasBackup = provider !== "mock" && backup !== provider && backup !== "mock" && PROVIDERS.includes(backup);

  return {
    provider,
    isMock: provider === "mock",
    model: endpointFor(provider),
    fallbackModel: hasBackup ? endpointFor(backup) : null,
    thinking: env("NEMOTRON_THINKING", "off") === "on",
    exa: { apiKey: env("EXA_API_KEY"), searchType: env("EXA_SEARCH_TYPE", "lite"), deepType: env("EXA_DEEP_TYPE", "deep-lite") },
    contextDev: { apiKey: env("CONTEXT_DEV_API_KEY") },
    eleven: {
      apiKey: env("ELEVENLABS_API_KEY"),
      ttsModel: env("ELEVENLABS_TTS_MODEL", "eleven_v4_turbo"),
      sttModel: env("ELEVENLABS_STT_MODEL", "scribe_v3"),
      sttLanguage: env("ELEVENLABS_STT_LANGUAGE"), // empty = detect the language; set a code such as "fi" to always assume one
      voiceId: env("ELEVENLABS_VOICE_ID"),
    },
  };
}

// A short, safe description of a missing setting. Never includes key values.
export function missingKey(service: string, variable: string): Error {
  return new Error(`${service} is not set up on this server (${variable} is empty).`);
}
