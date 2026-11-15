"use client";
// Settings for a person, not a developer: Voice and language, Your buffer, Data and privacy, and a collapsed
// "Demo controls" (switch profile, start the demo over, use sample data only, backend status). Changing the
// language or the voice keeps the conversation and projects. Opened from Today and from Path.
import { useState, type FormEvent } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { WeeklyBudget } from "@/web/core/AppLogic/WeeklyBudget";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import { DataSourcesCard, useBackendStatus } from "./DataSourcesCard";
import { SheetFrame } from "./SheetFrame";
import { PushControls } from "@/web/features/Projects/PushControls";
import { SettingsSwitch, VoiceSettings } from "./VoiceSettings";
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
        <Section title="Notifications">
          <NotificationsSetting />
        </Section>
        <DemoControls onClose={onClose} />
      </div>
    </SheetFrame>
  );
}

/** v2 push: whether this phone gets project notifications, and the buttons to turn them on and test them. */
function NotificationsSetting() {
  const baseURL = useAppSelector((s) => s.baseURLString);
  const customerId = useAppSelector((s) => s.customer?.customerId ?? null);
  return <PushControls baseURL={baseURL} customerId={customerId} />;
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
  // The same rule and message as Today's buffer sheet: from 0 to 100,000 (the server refuses more). Empty clears it.
  const empty = text.trim() === "";
  const value = empty ? null : WeeklyBudget.parseBuffer(text);
  const valid = empty || value !== null;
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    model.setPrefs({ bufferEur: value });
    setSaved(true);
  };
  return (
    <form className="sisu-settings-buffer" onSubmit={save}>
      <p className="sisu-sheet-text">Money you want to keep untouched, for surprises. Sisu takes it off before it estimates your weekly budget.</p>
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
        {!valid ? WeeklyBudget.bufferInputError : saved ? (value === null ? "No buffer set." : "Saved.") : "Leave it empty and Sisu assumes a default buffer, marked as assumed."}
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
            <SettingsSwitch label="Use sample data only" on={sampleOnly} testId="settings.sample" toggle={toggleSample} />
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
