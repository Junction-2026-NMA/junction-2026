"use client";
// /app/lab: a development page with no device gate. Every artboard of rive/contract.json drawn from the same
// public/rive/sisu_ui.riv with its contract defaults, its `in` triggers as buttons, enum pickers, and a log of
// the `out` triggers it fires. Below them the shared pieces: SisuButton, a notice, the bottom sheet and the
// glass tab bar.
import { useState } from "react";
import { allRiveContracts } from "@/web/rive/contract";
import { RiveProvider } from "@/web/rive/RiveLibrary";
import { BottomSheet } from "@/web/shared/BottomSheet";
import { GlassTabBar, defaultTabs } from "@/web/shared/GlassTabBar";
import { TransientNotice } from "@/web/shared/Notice";
import { Eyebrow, SectionTitle, SisuButton, SisuCard, SisuIconButton, SisuPressableCard } from "@/web/shared/SisuStyle";
import { LabArtboard } from "./LabArtboard";
import "./lab.css";

type Tab = (typeof defaultTabs)[number];

export default function RiveLabPage() {
  const [log, setLog] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("today");
  const [sheet, setSheet] = useState(false);
  const [solidBar, setSolidBar] = useState(false);

  const out = (line: string) => {
    console.log(`[Rive lab] out trigger ${line}`);
    setLog((lines) => [`${new Date().toLocaleTimeString()}  ${line}`, ...lines].slice(0, 12));
  };

  return (
    <RiveProvider>
      <main className="sisu-lab">
        <header className="sisu-lab-intro">
          <h1>Rive lab</h1>
          <p>
            {allRiveContracts.length} artboards from /rive/sisu_ui.riv, each with its contract defaults. Taps on
            the artboards fire their out triggers, listed here.
          </p>
          <ol className="sisu-lab-log" aria-live="polite">
            {log.length === 0 ? <li>No out trigger yet.</li> : log.map((line, index) => <li key={index}>{line}</li>)}
          </ol>
        </header>

        {allRiveContracts.map((contract) => (
          <LabArtboard key={contract.name} contract={contract} onOut={out} />
        ))}

        <section className="sisu-lab-card">
          <SectionTitle title="Shared pieces" detail="SisuCard, SisuButton, SisuIconButton, pressable card, notice." />
          <SisuCard>
            <Eyebrow text="Eyebrow" />
            <SisuButton label="Open a sheet" action={() => setSheet(true)} />
            <SisuButton label="Secondary" style="secondary" action={() => out("SisuButton.secondary")} />
            <SisuIconButton icon="settings" style="tinted" label="Settings" action={() => out("SisuIconButton")} />
          </SisuCard>
          <SisuPressableCard onPress={() => out("SisuPressableCard")}>
            <span className="sisu-lab-pressable">A pressable card</span>
          </SisuPressableCard>
          <TransientNotice id="lab-notice" text="A transient notice, said once per launch." />
          <button type="button" className="sisu-lab-button" onClick={() => setSolidBar((value) => !value)}>
            Tab bar: {solidBar ? "solid" : "glass"}
          </button>
        </section>
      </main>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} detents={["medium", "large"]} ariaLabel="Lab sheet"
        header={<div className="sisu-lab-sheet-head"><h2>A sheet</h2></div>}>
        <div className="sisu-lab-sheet-body">
          {Array.from({ length: 30 }, (_, index) => (
            <p key={index}>Row {index + 1}. Drag the grabber down, tap the backdrop or press Escape to close.</p>
          ))}
        </div>
      </BottomSheet>

      <GlassTabBar selection={tab} onSelect={setTab} solid={solidBar} />
    </RiveProvider>
  );
}
