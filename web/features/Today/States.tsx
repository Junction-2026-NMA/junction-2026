"use client";
// The loading and error states of a screen (LoadingState and ErrorState in TodayScreen.swift; Jars, Path and
// the voice lab use them too). Each fills the room between the header and the tab bar, content centred.
import { SisuButton } from "@/web/shared/SisuStyle";
import { ProgressSpinner } from "./Glyphs";
import "./states.css";

export function LoadingState() {
  return (
    <div className="sisu-state" role="status" data-testid="state.loading">
      <ProgressSpinner />
      <p className="sisu-state-muted">Reading your last 12 months</p>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="sisu-state sisu-state-padded" data-testid="state.error">
      <p className="sisu-state-message">{message}</p>
      <SisuButton label="Try again" style="secondary" action={retry} />
    </div>
  );
}
