"use client";
// "Voice and language": I speak, Sisu answers in, the voice (with a short preview) and "Speak replies". Used by
// Settings and by the first run's voice step. Changing any of them keeps the conversation and projects: the
// language goes to the current coach session (AppModel.setPrefs), the voice to the next sentence spoken.
// "I speak" and "Sisu answers in" stay separate, because a chosen spoken language also fixes the speech recogniser.
import { useEffect, useMemo, useState } from "react";
import { useAppModel, useAppSelector, useVoiceController } from "@/web/app/AppProvider";
import { CoachClient } from "@/web/core/CoachClient";
import type { VoiceOptions } from "@/web/core/CoachModels";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { riveAccessible } from "@/web/shared/SisuStyle";
import { SpeechPlayer } from "@/web/voice/SpeechPlayer";
import { VoiceLanguages, VoicePrefs } from "@/web/voice/VoicePrefs";
import { languageName, moreLanguages, pinnedLanguages, previewSentence, voicesOffered, type VoiceChoice } from "./voiceChoices";
import "./sheets.css";

type Preview = { id: string; state: "loading" | "played" | "unavailable" | "blocked" };

/** The live voice options (GET /api/voice/tts), once per page; null until they arrive or when they cannot. */
let optionsCache: Promise<VoiceOptions | null> | null = null;
function loadOptions(client: CoachClient): Promise<VoiceOptions | null> {
  optionsCache ??= client.voiceOptions().catch(() => null);
  return optionsCache;
}

export function VoiceSettings({ testPrefix = "settings" }: { testPrefix?: string }) {
  const model = useAppModel();
  const voice = useVoiceController();
  const prefs = useAppSelector((s) => s.prefs);
  const sampleOnly = useAppSelector((s) => s.sampleOnly);
  const baseURL = useAppSelector((s) => s.baseURLString);
  const client = useMemo(() => (sampleOnly ? null : CoachClient.live(baseURL)), [sampleOnly, baseURL]);
  const [options, setOptions] = useState<VoiceOptions | null>(null);
  const [languages, setLanguages] = useState(() => VoicePrefs.languages(model.launch.defaults));
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!client) return;
    let live = true;
    void loadOptions(client).then((value) => { if (live) setOptions(value); });
    return () => { live = false; };
  }, [client]);

  const voices = voicesOffered(options);
  const more = moreLanguages(options);
  const setLanguage = (change: Partial<VoiceLanguages>) => {
    const next = VoiceLanguages.decode({ ...languages, ...change });
    VoicePrefs.setLanguages(next, model.launch.defaults);
    setLanguages(next);
    model.setPrefs({ language: VoiceLanguages.sessionLanguage(next) });
  };
  const toggleSpeak = () => {
    const on = !prefs.speakReplies;
    model.setPrefs({ speakReplies: on });
    voice?.setMuted(!on);
  };
  const play = async (choice: VoiceChoice) => {
    const id = choice.id ?? "default";
    if (!client) {
      setPreview({ id, state: "unavailable" });
      return;
    }
    setPreview({ id, state: "loading" });
    const sentence = previewSentence(VoiceLanguages.sessionLanguage(languages));
    const result = await SpeechPlayer.preview(client, sentence.text, choice.id, sentence.language);
    setPreview((current) => (current?.id === id ? { id, state: result } : current));
  };

  const speakName = languages.speak === "auto" ? null : languageName(languages.speak, options);
  const replyName = languages.reply === "same" ? null : languageName(languages.reply, options);
  const languageNote = replyName
    ? `Typed questions get answers in ${replyName}. Spoken questions are answered in the language Sisu hears.`
    : speakName
      ? `Sisu listens for ${speakName} and answers in it. The app’s own text stays in English.`
      : "Sisu works out the language from what you say or type, and answers in it.";

  return (
    <div className="sisu-settings-voice" data-testid={`${testPrefix}.voicesettings`}>
      <LanguageSelect id={`${testPrefix}-speak`} label="I speak" value={languages.speak} first={{ value: "auto", label: "Automatic" }}
        more={more} onChange={(speak) => setLanguage({ speak })} />
      <LanguageSelect id={`${testPrefix}-reply`} label={"Sisu answers\u00a0in"} value={languages.reply} first={{ value: "same", label: "Same as I speak" }}
        more={more} onChange={(reply) => setLanguage({ reply })} />
      <p className="sisu-sheet-caption">{languageNote}</p>

      <div className="sisu-settings-group" role="radiogroup" aria-label="Voice">
        <span className="sisu-sheet-label-muted">Voice</span>
        {voices.map((choice) => {
          const id = choice.id ?? "default";
          const selected = (prefs.voiceId ?? null) === choice.id;
          const state = preview?.id === id ? preview.state : null;
          return (
            <div key={id} className="sisu-settings-voice-row" data-selected={selected}>
              <button type="button" role="radio" aria-checked={selected} className="sisu-settings-voice-pick"
                data-testid={`${testPrefix}.voice.${id}`} onClick={() => model.setPrefs({ voiceId: choice.id })}>
                <span className="sisu-settings-radio" aria-hidden="true" />
                <span className="sisu-settings-voice-text">
                  <span className="sisu-sheet-button-text">{choice.name}</span>
                  <span className="sisu-sheet-caption">{state === "unavailable" ? "Preview needs the live voice service, which is not answering." : state === "blocked" ? "Your browser kept the sound off. Tap again." : choice.detail}</span>
                </span>
              </button>
              <button type="button" className="sisu-settings-preview" data-state={state ?? "idle"}
                data-testid={`${testPrefix}.preview.${id}`} aria-label={`Play a sample of ${choice.name}`}
                onClick={() => { void play(choice); }}>
                {state === "loading" ? <span className="sisu-settings-spinner" aria-hidden="true" /> : <PlayGlyph />}
                <span>{state === "loading" ? "Loading" : "Play"}</span>
              </button>
            </div>
          );
        })}
        {voices.length === 1 ? (
          <p className="sisu-sheet-caption">Other voices are not available on this server right now, so Sisu uses its usual voice.</p>
        ) : null}
      </div>

      <div className="sisu-settings-toggle-row">
        <span className="sisu-settings-toggle-text">
          <span className="sisu-sheet-text">Speak replies</span>
          <span className="sisu-sheet-caption" data-testid={`${testPrefix}.speak.caption`}>
            {prefs.speakReplies ? "Sisu reads its answers aloud. Typing always works." : "Sisu answers in text only. Typing always works."}
          </span>
        </span>
        <SettingsSwitch label="Speak replies" on={prefs.speakReplies} testId={`${testPrefix}.speak`} toggle={toggleSpeak} />
      </div>
    </div>
  );
}

/** The Rive toggle in a 44 px tall hit area. A press on the edge around the toggle flips it too; a press on the
 *  toggle itself is the toggle's own (its `toggled` trigger), so it never counts twice. */
export function SettingsSwitch({ label, on, testId, toggle }: { label: string; on: boolean; testId: string; toggle: () => void }) {
  return (
    <span className="sisu-settings-switch" onClick={(event) => { if (event.target === event.currentTarget) toggle(); }}>
      <RiveComponent component="Toggle" values={RiveValues.toggle(on)} testId={testId}
        onTrigger={(trigger) => { if (trigger === "toggled") toggle(); }}
        {...riveAccessible(label, { isButton: true, value: on ? "On" : "Off", action: toggle })} />
    </span>
  );
}

function LanguageSelect({ id, label, value, first, more, onChange }: {
  id: string;
  label: string;
  value: string;
  first: { value: string; label: string };
  more: readonly { code: string; nativeName: string }[];
  onChange: (value: string) => void;
}) {
  const known = value === first.value || pinnedLanguages.some((l) => l.code === value) || more.some((l) => l.code === value);
  return (
    <label className="sisu-settings-select-row" htmlFor={id}>
      <span className="sisu-sheet-text">{label}</span>
      <select id={id} className="sisu-settings-select" value={value} data-testid={id} onChange={(event) => onChange(event.target.value)}>
        <option value={first.value}>{first.label}</option>
        <optgroup label="Suggested">
          {pinnedLanguages.map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
        </optgroup>
        {more.length ? (
          <optgroup label="More languages">
            {more.map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
          </optgroup>
        ) : null}
        {known ? null : <option value={value}>{value}</option>}
      </select>
    </label>
  );
}

function PlayGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}
