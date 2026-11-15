"use client";
// The recording control, inside a closed "Demo" section: a simulated listing change processed on Sisu's server in
// 20 s, so the phone can be locked first. It is labelled "Simulated for demo" here, on the finding, on the alert and
// in "How Sisu found this"; the page itself does not change.
import { useState } from "react";
import type { ProjectStore } from "@/web/app/ProjectStore";
import { Disclosure } from "@/web/features/Ask/Disclosure";
import { Chip } from "./ProjectParts";
import { AlertRules } from "./ProjectJourney";

const DELAY_SECONDS = 20;

export function ProjectDemo({ watchId, store }: { watchId: string; store: ProjectStore }) {
  const [state, setState] = useState<"idle" | "sending" | "scheduled">("idle");
  const [error, setError] = useState<string | null>(null);
  const simulate = async () => {
    setState("sending");
    setError(null);
    const failure = await store.simulateChange(watchId, DELAY_SECONDS);
    setState(failure ? "idle" : "scheduled");
    setError(failure);
  };
  return (
    <div className="sisu-pnotify-demo">
      <Disclosure label="Demo" testId="project.demo">
        <Chip tone="simulated">{AlertRules.simulatedLabel}</Chip>
        <p className="sisu-project-muted">Makes up one listing change for the recording. It goes through the same requirement check and notification as a real change.</p>
        <div className="sisu-project-actions">
          <button type="button" className="sisu-project-small" disabled={state === "sending"} onClick={() => void simulate()} data-testid="project.simulate">
            {state === "sending" ? "Scheduling…" : `Simulate a listing change in ${DELAY_SECONDS} s`}
          </button>
        </div>
        {state === "scheduled" ? (
          <p className="sisu-project-body" role="status">Lock your phone now. Sisu processes the simulated change on its server and notifies you.</p>
        ) : null}
        {error ? <p className="sisu-project-error" role="alert">{error}</p> : null}
      </Disclosure>
    </div>
  );
}
