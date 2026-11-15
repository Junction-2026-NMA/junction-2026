"use client";
// The app root: port of ios/Sisu/App/SisuApp.swift (+ RootView's `.task { await model.start() }`).
// One AppModel for the page, shared through AppProvider; one Rive file for every component (RiveProvider).
// The `.sisu-root` element with the theme tokens and font variables is app/app/layout.tsx's, which wraps this.
// Loaded in the browser only (web/gate/AppLoader.tsx, ssr: false).
import { useEffect, useState } from "react";
import { RiveProvider } from "@/web/rive/RiveLibrary";
import { installAudioUnlock } from "@/web/voice/AudioUnlock";
import { AppModel } from "./AppModel";
import { AppProvider } from "./AppProvider";
import RootView from "./RootView";

export default function SisuApp() {
  const [model] = useState(() => new AppModel());

  useEffect(() => {
    void model.start();
  }, [model]);

  // Mobile browsers play sound only after a gesture: the first tap anywhere unlocks Sisu's voice.
  useEffect(() => installAudioUnlock(), []);

  // Today's progress is per day: look again when the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") model.refreshDay();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [model]);

  return (
    <RiveProvider>
      <AppProvider model={model}>
        <div className="sisu-app">
          <RootView />
        </div>
      </AppProvider>
    </RiveProvider>
  );
}
