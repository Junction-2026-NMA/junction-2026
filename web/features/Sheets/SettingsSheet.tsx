"use client";
// Settings: data and sources, the backend address, "Use sample data only", "Start the demo over" and
// "Switch customer". Port of SettingsSheet in ios/Sisu/Features/Sheets/Sheets.swift.
import { useState, type FormEvent } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { SisuButton, SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import { DataSourcesCard } from "./DataSourcesCard";
import { SheetFrame } from "./SheetFrame";
import { backendAddress } from "./settingsText";
import "./sheets.css";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const model = useAppModel();
  const sampleOnly = useAppSelector((s) => s.sampleOnly);
  const backendAnswered = useAppSelector((s) => s.backendAnswered);
  const baseURLString = useAppSelector((s) => s.baseURLString);
  const [address, setAddress] = useState(baseURLString);
  // `.onAppear { address = model.baseURLString }`: each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setAddress(baseURLString);
  }

  const statusLine = backendAnswered === true
    ? "The backend answered. Figures are live."
    : backendAnswered === false
      ? "The backend did not answer, so Sisu shows sample data."
      : "Sample data only. Sisu is not asking the backend.";

  const applyAddress = (event: FormEvent) => {
    event.preventDefault();
    model.setBaseURLString(address);
    void model.applySettings();
  };

  const toggleSample = () => {
    model.setSampleOnly(!model.getSnapshot().sampleOnly);
    void model.applySettings();
  };

  return (
    <SheetFrame open={open} onClose={onClose} title="Settings" testId="sheet.settings">
      <div className="sisu-sheet-content">
        <DataSourcesCard />
        <SisuCard>
          <label className="sisu-sheet-label-muted" htmlFor="sisu-settings-address">Backend address</label>
          <form onSubmit={applyAddress} className="sisu-sheet-form">
            <input id="sisu-settings-address" className="sisu-sheet-input" type="text" inputMode="url"
              value={address} placeholder={backendAddress("")}
              autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" enterKeyHint="done"
              aria-label="Backend address" onChange={(event) => setAddress(event.target.value)} />
          </form>
          <p className="sisu-sheet-label">{statusLine}</p>
          <hr className="sisu-sheet-divider" />
          <div className="sisu-settings-toggle-row">
            <span className="sisu-sheet-text">Use sample data only</span>
            <RiveComponent component="Toggle" values={RiveValues.toggle(sampleOnly)} testId="settings.sample"
              onTrigger={(trigger) => { if (trigger === "toggled") toggleSample(); }}
              {...riveAccessible("Use sample data only", { isButton: true, value: sampleOnly ? "On" : "Off", action: toggleSample })} />
          </div>
        </SisuCard>
        <SisuButton label="Start the demo over" style="secondary" action={() => {
          model.resetDemo();
          onClose();
        }} />
        <SisuButton label="Switch customer" style="quiet" action={() => {
          onClose();
          model.switchCustomer();
        }} />
      </div>
    </SheetFrame>
  );
}
