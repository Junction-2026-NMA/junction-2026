"use client";
// The path's loading and error states: PathLoading in ios/Sisu/Features/Path/PathScreen.swift and the
// ErrorState it shares with Today (ios/Sisu/Features/Today/TodayScreen.swift), kept local to this folder.
import { useEffect } from "react";
import { SisuButton } from "@/web/shared/SisuStyle";

export function PathLoading() {
  return (
    <div className="sisu-path-fill" role="status">
      <span className="sisu-path-spinner" aria-hidden="true" />
      <p className="sisu-path-loading-text">Building lessons from your numbers</p>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="sisu-path-fill sisu-path-error">
      <p className="sisu-path-error-text">{message}</p>
      <SisuButton label="Try again" style="secondary" action={retry} />
    </div>
  );
}

/** Why a locked lesson did not open, for a few seconds above the tab bar (a polite live region). */
export function LockedNotice({ notice, onDone }: { notice: { text: string; token: number } | null; onDone: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(timer);
    // A new token restarts the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.token]);
  return (
    <div className="sisu-path-locked-region" role="status" aria-live="polite">
      {notice ? (
        <button key={notice.token} type="button" className="sisu-path-locked" data-testid="path.locked" onClick={onDone}>
          <LockGlyph />
          <span>{notice.text}</span>
        </button>
      ) : null}
    </div>
  );
}

export function LockGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2.5" y="6" width="9" height="6.5" rx="1.8" fill="currentColor" />
      <path d="M4.6 6V4.6a2.4 2.4 0 0 1 4.8 0V6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
