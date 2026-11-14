"use client";
// The path's loading and error states: PathLoading in ios/Sisu/Features/Path/PathScreen.swift and the
// ErrorState it shares with Today (ios/Sisu/Features/Today/TodayScreen.swift), kept local to this folder.
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
