// The voice side of the person's preferences, read where speech happens. The voice, "Speak replies" and the
// session language live in AppPrefs (`sisu.prefs`, AppModel.setPrefs). "I speak" (the speech recogniser's language)
// and "Sisu answers in" are two separate choices, because a chosen language also fixes the recogniser: they are
// kept here under `sisu.voiceLanguages`, and the session language (AppPrefs.language) is derived from them.
// Read from the same defaults the AppModel uses (LaunchOptions.current().defaults), so every SpeechPlayer and
// VoiceController, which are rebuilt with each coach session, picks up the stored choice without extra wiring.
import { AppPrefs } from "@/web/app/AppPrefs";
import { Keys } from "@/web/app/AppState";
import { LaunchOptions } from "@/web/app/LaunchOptions";
import type { SisuDefaults } from "@/web/app/Defaults";

/** `speak`: `auto` or a code (`fi`); `reply`: `same` (as I speak) or a code. */
export interface VoiceLanguages {
  readonly speak: string;
  readonly reply: string;
}

const KEY = Keys.voiceLanguages;
const PREFS_KEY = Keys.prefs;
const code = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i;

const defaults = (): SisuDefaults | null => {
  try {
    return LaunchOptions.current().defaults;
  } catch {
    return null;
  }
};

export const VoiceLanguages = {
  initial: { speak: "auto", reply: "same" } as VoiceLanguages,

  decode(json: unknown): VoiceLanguages {
    if (!json || typeof json !== "object") return VoiceLanguages.initial;
    const o = json as Record<string, unknown>;
    const speak = typeof o.speak === "string" && (o.speak === "auto" || code.test(o.speak)) ? o.speak : "auto";
    const reply = typeof o.reply === "string" && (o.reply === "same" || code.test(o.reply)) ? o.reply : "same";
    return { speak, reply };
  },

  /** What the coach session sends as `language`: the answer language for typed questions (`auto` = the language
   *  the question is written in). Spoken questions are answered in the language heard (today's backend). */
  sessionLanguage(languages: VoiceLanguages): string {
    return languages.reply === "same" ? languages.speak : languages.reply;
  },
} as const;

export const VoicePrefs = {
  /** The stored AppPrefs (voice, speak replies, language). */
  prefs(store: SisuDefaults | null = defaults()): AppPrefs {
    return AppPrefs.decode(store?.json(PREFS_KEY) ?? null);
  },

  languages(store: SisuDefaults | null = defaults()): VoiceLanguages {
    // Before this key existed, AppPrefs.language was the only choice: read it as "I speak".
    const stored = store?.json(KEY);
    if (stored) return VoiceLanguages.decode(stored);
    const language = VoicePrefs.prefs(store).language;
    return { speak: language, reply: "same" };
  },

  setLanguages(languages: VoiceLanguages, store: SisuDefaults | null = defaults()): void {
    store?.setJSON(KEY, VoiceLanguages.decode(languages));
  },

  /** The language hint for the speech recogniser (`auto` lets it detect). */
  recogniserLanguage(store: SisuDefaults | null = defaults()): string {
    return VoicePrefs.languages(store).speak;
  },
} as const;
