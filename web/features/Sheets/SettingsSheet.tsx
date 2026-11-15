"use client";
// Settings for a person, not a developer: Voice and language, Your buffer, Data and privacy, and a collapsed
// "Demo controls" (switch profile, start the demo over, use sample data only, backend status). Changing the
// language or the voice keeps the conversation and projects. Opened from Today and from Path.
import { useState, type FormEvent } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { SisuButton, SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import { DataSourcesCard, useBackendStatus } from "./DataSourcesCard";
import { SheetFrame } from "./SheetFrame";
import { VoiceSettings } from "./VoiceSettings";
import "./sheets.css";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SheetFrame open={open} onClose={onClose} title="Settings" testId="sheet.settings">
      <div className="sisu-sheet-content">
        <Section title="Voice and language">
          <VoiceSettings />
        </Section>
        <Section title="Your buffer">
          <BufferSetting />
        </Section>
        <Section title="Data and privacy">
          <DataSourcesCard />
        </Section>
        <DemoControls onClose={onClose} />
      </div>
    </SheetFrame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sisu-settings-section" aria-label={title}>
      <h3 className="sisu-settings-heading">{title}</h3>
      <SisuCard>{children}</SisuCard>
    </section>
  );
}

/** The money to keep untouched (AppPrefs.bufferEur). Empty means not said. */
function BufferSetting() {
  const model = useAppModel();
  const buffer = useAppSelector((s) => s.prefs.bufferEur);
  const [text, setText] = useState(buffer === null ? "" : String(buffer));
  const [saved, setSaved] = useState(false);
  const trimmed = text.trim().replace(/\s/g, "").replace(",", ".");
  const value = trimmed === "" ? null : Number(trimmed);
  const valid = value === null || (Number.isFinite(value) && value >= 0 && value <= 1_000_000);
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    model.setPrefs({ bufferEur: value === null ? null : Math.round(value) });
    setSaved(true);
  };
  return (
    <form className="sisu-settings-buffer" onSubmit={save}>
      <p className="sisu-sheet-text">Money you want to keep untouched, for surprises. Sisu leaves it out when it estimates what you can spend.</p>
      <div className="sisu-settings-buffer-row">
        <label className="sisu-settings-buffer-field">
          <span className="sisu-visually-hidden">Buffer in euros</span>
          <span className="sisu-settings-euro" aria-hidden="true">€</span>
          <input className="sisu-sheet-input sisu-settings-buffer-input" type="text" inputMode="decimal" placeholder="Not set"
            value={text} data-testid="settings.buffer" aria-invalid={!valid || undefined}
            onChange={(event) => { setText(event.target.value); setSaved(false); }} />
        </label>
        <button type="submit" className="sisu-settings-save" disabled={!valid}>Save</button>
      </div>
      <p className="sisu-sheet-caption" role="status">
        {!valid ? "Type an amount in euros, like 500." : saved ? (value === null ? "No buffer set." : "Saved.") : "Leave it empty if you have not decided."}
      </p>
    </form>
  );
}

function DemoControls({ onClose }: { onClose: () => void }) {
  const model = useAppModel();
  const sampleOnly = useAppSelector((s) => s.sampleOnly);
  const status = useBackendStatus();
  const toggleSample = () => {
    model.setSampleOnly(!model.getSnapshot().sampleOnly);
    void model.applySettings();
  };
  return (
    <details className="sisu-settings-demo" data-testid="settings.demo">
      <summary className="sisu-settings-demo-summary">
        <span className="sisu-settings-heading">Demo controls</span>
        <span className="sisu-sheet-caption">Profiles, sample data and the server</span>
      </summary>
      <div className="sisu-settings-demo-body">
        <SisuCard>
          <div className="sisu-settings-status">
            {status.map(([label, text]) => (
              <p key={label} className="sisu-sheet-text"><span className="sisu-sheet-label-muted">{label}: </span>{text}</p>
            ))}
          </div>
          <hr className="sisu-sheet-divider" />
          <div className="sisu-settings-toggle-row">
            <span className="sisu-sheet-text">Use sample data only</span>
            <RiveComponent component="Toggle" values={RiveValues.toggle(sampleOnly)} testId="settings.sample"
              onTrigger={(trigger) => { if (trigger === "toggled") toggleSample(); }}
              {...riveAccessible("Use sample data only", { isButton: true, value: sampleOnly ? "On" : "Off", action: toggleSample })} />
          </div>
        </SisuCard>
        <SisuButton label="Switch profile" style="secondary" action={() => {
          onClose();
          model.switchCustomer();
        }} />
        <SisuButton label="Start the demo over" style="quiet" action={() => {
          model.resetDemo();
          onClose();
        }} />
      </div>
    </details>
  );
}
