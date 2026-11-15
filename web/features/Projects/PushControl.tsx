"use client";
// "Turn on phone notifications": asked only from this tap. Shows whether notifications are on, off or unavailable,
// and "Send a test notification" once they are on. Without the updated server it only says updates show in the app.
import { useState } from "react";
import type { ProjectStore, ProjectsState } from "@/web/app/ProjectStore";
import { PushText } from "@/web/core/Push";

export function PushControl({ store, state }: { store: ProjectStore; state: ProjectsState }) {
  const [busy, setBusy] = useState<"enable" | "test" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (!store.updated) return <p className="sisu-project-muted" data-testid="push.needsServer">{PushText.needsServer}</p>;
  const serverPush = state.schedulerInfo?.push === true;
  const status = serverPush ? state.push : "unavailable";

  const enable = async () => {
    setBusy("enable");
    setNote(null);
    const next = await store.enablePush();
    if (next === "unavailable" && /iPhone|iPad/.test(navigator.userAgent)) setNote(PushText.iosHint);
    setBusy(null);
  };
  const test = async () => {
    setBusy("test");
    const failure = await store.testPush();
    setNote(failure ?? "Sent. It can take a few seconds to arrive.");
    setBusy(null);
  };

  return (
    <div className="sisu-pnotify" data-testid="push.control" data-status={status}>
      <p className="sisu-project-body" role="status">{PushText.status(status)}</p>
      <div className="sisu-project-actions">
        {status === "not-asked" ? (
          <button type="button" className="sisu-project-small" data-kind="primary" disabled={busy !== null} onClick={() => void enable()} data-testid="push.enable">
            {busy === "enable" ? "Asking…" : PushText.turnOn}
          </button>
        ) : null}
        {status === "on" ? (
          <button type="button" className="sisu-project-small" disabled={busy !== null} onClick={() => void test()} data-testid="push.test">
            {busy === "test" ? "Sending…" : PushText.test}
          </button>
        ) : null}
      </div>
      {note ? <p className="sisu-project-muted" role="status">{note}</p> : null}
    </div>
  );
}
