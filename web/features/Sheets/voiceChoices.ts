// What the voice and language pickers offer (Settings and the first run). Plain data and small helpers; no React.
import type { VoiceLanguage, VoiceOptions } from "@/web/core/CoachModels";

/** A voice the pickers offer. `id` null is the server's own default voice. */
export interface VoiceChoice {
  readonly id: string | null;
  readonly name: string;
  readonly detail: string;
}

/** The server's default voice (ElevenLabs "Sarah" on the hosted backend), always offered. */
export const defaultVoice: VoiceChoice = { id: null, name: "Sarah", detail: "Sisu’s usual voice. Calm and clear." };

/** A few voices that suit a coach. Offered only when the backend's account lists them (GET /api/voice/tts). */
export const curatedVoices: readonly VoiceChoice[] = [
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", detail: "Clear and friendly, British English." },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", detail: "Relaxed and neutral." },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", detail: "Warm and steady." },
];

/** The voices to show: the default first, then the curated ones the server has. Only the default when the list
 *  could not be read or is empty (sample mode, mock server): a voice the server cannot speak is never offered. */
export function voicesOffered(options: VoiceOptions | null): VoiceChoice[] {
  const available = new Set((options?.voices ?? []).map((voice) => voice.id));
  return [defaultVoice, ...curatedVoices.filter((voice) => voice.id !== null && available.has(voice.id))];
}

/** Pinned at the top of the language lists: Finland's languages and English. */
export const pinnedLanguages: readonly VoiceLanguage[] = [
  { code: "fi", name: "Finnish", nativeName: "Suomi" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "en", name: "English", nativeName: "English" },
];

/** A short list for when the server's list is not available (same codes as lib/agent/languages.ts). */
const fallbackMore: readonly VoiceLanguage[] = [
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "et", name: "Estonian", nativeName: "Eesti" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "so", name: "Somali", nativeName: "Soomaali" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
];

/** The other languages, from the server when it answered, without the pinned ones. */
export function moreLanguages(options: VoiceOptions | null): VoiceLanguage[] {
  const pinned = new Set(pinnedLanguages.map((language) => language.code));
  const list = options?.languages?.length ? options.languages : fallbackMore;
  return list.filter((language) => typeof language?.code === "string" && !pinned.has(language.code));
}

/** The name to show for a code (`Suomi`), or the code itself. */
export function languageName(code: string, options: VoiceOptions | null): string {
  const all = [...pinnedLanguages, ...(options?.languages ?? []), ...fallbackMore];
  return all.find((language) => language.code === code)?.nativeName ?? code;
}

/** The preview sentence, in the language Sisu will speak when it has one (English otherwise), and the language
 *  to send with it (null: let the voice read it as written). Under 240 characters, so the server can cache it. */
export function previewSentence(language: string): { text: string; language: string | null } {
  switch (language) {
    case "fi": return { text: "Hei, olen Sisu. Pidän vastaukset lyhyinä ja näytän luvut niiden takana.", language: "fi" };
    case "sv": return { text: "Hej, jag är Sisu. Jag håller svaren korta och visar siffrorna bakom dem.", language: "sv" };
    case "de": return { text: "Hallo, ich bin Sisu. Ich halte die Antworten kurz und zeige dir die Zahlen dahinter.", language: "de" };
    default: return { text: "Hi, I’m Sisu. I keep answers short and show you the numbers behind them.", language: language === "en" ? "en" : null };
  }
}
