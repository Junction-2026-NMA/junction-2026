// The languages Sisu can hear and speak. Safe to import in the browser: no server code here.
// ElevenLabs' current models (Scribe v3 for speech in, Eleven v4 for speech out) cover 90+ languages. This list
// is the ones a customer of a Finnish bank is most likely to speak: Finland's own languages, its neighbours,
// its larger immigrant communities (including the main languages of India), and the major world languages.
// Any other language still works in "auto" mode; it just has no entry in the picker.

export type VoiceLanguage = {
  code: string; // ISO 639-1, the form ElevenLabs text to speech takes as language_code
  iso3: string; // ISO 639-3, the form ElevenLabs speech to text reports
  name: string; // in English, used in the model's instructions ("Reply in Finnish")
  nativeName: string; // what to show in a picker
};

export const AUTO = "auto"; // let speech to text detect the language

export const LANGUAGES: VoiceLanguage[] = [
  { code: "fi", iso3: "fin", name: "Finnish", nativeName: "Suomi" },
  { code: "sv", iso3: "swe", name: "Swedish", nativeName: "Svenska" },
  { code: "en", iso3: "eng", name: "English", nativeName: "English" },
  { code: "de", iso3: "deu", name: "German", nativeName: "Deutsch" },
  { code: "et", iso3: "est", name: "Estonian", nativeName: "Eesti" },
  { code: "ru", iso3: "rus", name: "Russian", nativeName: "Русский" },
  { code: "uk", iso3: "ukr", name: "Ukrainian", nativeName: "Українська" },
  { code: "ar", iso3: "ara", name: "Arabic", nativeName: "العربية" },
  { code: "so", iso3: "som", name: "Somali", nativeName: "Soomaali" },
  { code: "fa", iso3: "fas", name: "Persian", nativeName: "فارسی" },
  { code: "ku", iso3: "kur", name: "Kurdish", nativeName: "Kurdî" },
  { code: "tr", iso3: "tur", name: "Turkish", nativeName: "Türkçe" },
  { code: "hi", iso3: "hin", name: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", iso3: "ben", name: "Bengali", nativeName: "বাংলা" },
  { code: "ta", iso3: "tam", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te", iso3: "tel", name: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", iso3: "mar", name: "Marathi", nativeName: "मराठी" },
  { code: "gu", iso3: "guj", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", iso3: "kan", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", iso3: "mal", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "pa", iso3: "pan", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "ur", iso3: "urd", name: "Urdu", nativeName: "اردو" },
  { code: "ne", iso3: "nep", name: "Nepali", nativeName: "नेपाली" },
  { code: "zh", iso3: "zho", name: "Chinese", nativeName: "中文" },
  { code: "vi", iso3: "vie", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "th", iso3: "tha", name: "Thai", nativeName: "ไทย" },
  { code: "tl", iso3: "fil", name: "Filipino", nativeName: "Filipino" },
  { code: "id", iso3: "ind", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ja", iso3: "jpn", name: "Japanese", nativeName: "日本語" },
  { code: "ko", iso3: "kor", name: "Korean", nativeName: "한국어" },
  { code: "es", iso3: "spa", name: "Spanish", nativeName: "Español" },
  { code: "fr", iso3: "fra", name: "French", nativeName: "Français" },
  { code: "it", iso3: "ita", name: "Italian", nativeName: "Italiano" },
  { code: "pt", iso3: "por", name: "Portuguese", nativeName: "Português" },
  { code: "nl", iso3: "nld", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", iso3: "pol", name: "Polish", nativeName: "Polski" },
  { code: "ro", iso3: "ron", name: "Romanian", nativeName: "Română" },
  { code: "hu", iso3: "hun", name: "Hungarian", nativeName: "Magyar" },
  { code: "cs", iso3: "ces", name: "Czech", nativeName: "Čeština" },
  { code: "el", iso3: "ell", name: "Greek", nativeName: "Ελληνικά" },
  { code: "bg", iso3: "bul", name: "Bulgarian", nativeName: "Български" },
  { code: "da", iso3: "dan", name: "Danish", nativeName: "Dansk" },
  { code: "no", iso3: "nor", name: "Norwegian", nativeName: "Norsk" },
  { code: "lt", iso3: "lit", name: "Lithuanian", nativeName: "Lietuvių" },
  { code: "lv", iso3: "lav", name: "Latvian", nativeName: "Latviešu" },
  { code: "sw", iso3: "swa", name: "Swahili", nativeName: "Kiswahili" },
  { code: "am", iso3: "amh", name: "Amharic", nativeName: "አማርኛ" },
];

// Other ISO 639-3 codes the same languages are reported under.
const ALIASES: Record<string, string> = { cmn: "zh", yue: "zh", nob: "no", nno: "no", pes: "fa", prs: "fa", arb: "ar", ckb: "ku", kmr: "ku", tgl: "tl", fil: "tl", msa: "id", zsm: "id", npi: "ne", swh: "sw", ekk: "et", lvs: "lv" };

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));
const BY_ISO3 = new Map(LANGUAGES.map((language) => [language.iso3, language]));

// Turns whatever arrived ("fi", "FIN", "fi-FI", "fin") into a language Sisu knows, or null for "auto" and anything else.
export function findLanguage(code: unknown): VoiceLanguage | null {
  if (typeof code !== "string") return null;
  const key = code.trim().toLowerCase().split(/[-_]/)[0];
  return BY_CODE.get(key) ?? BY_ISO3.get(key) ?? BY_CODE.get(ALIASES[key] ?? "") ?? null;
}

export const languageCode = (code: unknown): string | null => findLanguage(code)?.code ?? null;
