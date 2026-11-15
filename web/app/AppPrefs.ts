// The person's voice, language and money preferences, chosen in onboarding and changed in Settings. Stored in the
// app's defaults under "sisu.prefs" (AppState `Keys.prefs`) as one JSON object, read back defensively: a missing or
// wrong value takes its default, so an old or hand-edited store never breaks the app.

export interface AppPrefs {
  /** `auto` (answer in the language asked in) or a language code such as `fi`. Applied to the coach session. */
  readonly language: string;
  /** The ElevenLabs voice Sisu speaks with, or null for the server's default voice. */
  readonly voiceId: string | null;
  /** Speak Sisu's replies out loud. */
  readonly speakReplies: boolean;
  /** Euros the person wants to keep untouched (the protected buffer), or null when not said. */
  readonly bufferEur: number | null;
}

const languagePattern = /^(auto|[a-z]{2,3}(-[a-z0-9]{2,8})?)$/i;
const defaultPrefs: AppPrefs = { language: "auto", voiceId: null, speakReplies: true, bufferEur: null };

export const AppPrefs = {
  defaults: defaultPrefs,

  /** The stored JSON as prefs: every field checked on its own; a missing or invalid one takes `fallback`'s value.
   *  `voiceId` and `bufferEur` may be null on purpose (the server's voice, no buffer said). */
  decode(json: unknown, fallback: AppPrefs = defaultPrefs): AppPrefs {
    if (typeof json !== "object" || json === null || Array.isArray(json)) return fallback;
    const o = json as Record<string, unknown>;
    const language = typeof o.language === "string" && languagePattern.test(o.language.trim()) ? o.language.trim() : fallback.language;
    const voiceId = o.voiceId === null ? null : typeof o.voiceId === "string" && o.voiceId.trim() !== "" ? o.voiceId.trim() : fallback.voiceId;
    const speakReplies = typeof o.speakReplies === "boolean" ? o.speakReplies : fallback.speakReplies;
    const buffer = o.bufferEur;
    const bufferEur = buffer === null ? null : typeof buffer === "number" && Number.isFinite(buffer) && buffer >= 0 ? buffer : fallback.bufferEur;
    return { language, voiceId, speakReplies, bufferEur };
  },

  /** `prefs` with `change` applied, each value checked as when stored (an invalid one keeps the current value). */
  merge(prefs: AppPrefs, change: Partial<AppPrefs>): AppPrefs {
    return AppPrefs.decode(change, prefs);
  },

  equals(a: AppPrefs, b: AppPrefs): boolean {
    return a.language === b.language && a.voiceId === b.voiceId && a.speakReplies === b.speakReplies && a.bufferEur === b.bufferEur;
  },
} as const;
