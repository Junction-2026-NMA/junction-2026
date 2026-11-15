"use client";
// v2 push: what the project's background work is doing, said plainly. Initial research (Researching… -> First
// results ready, "Initial research finished HH:MM") is told apart from ongoing monitoring ("last successful check
// HH:MM · next check HH:MM"); failed checks show with when they are retried. Then the phone's notification status
// and, for the demo, "Simulate a listing change (demo)" (the server waits 30 s, so the phone can be locked).
// Pause, resume and stop stay in the project's Controls card.
import { useState } from "react";
import type { ProjectStore } from "@/web/app/ProjectStore";
import { scheduleSimulatedChange } from "@/web/app/Push";
import { type PropertyWatch, projectStatusOf } from "@/web/core/WatchModels";
import { SisuCard } from "@/web/shared/SisuStyle";
import { PushControls } from "./PushControls";
import "./ProjectMonitoringStatus.css";

type Tone = "good" | "busy" | "attention" | "plain";
const DEMO_DELAY_S = 30;

export const MonitoringText = {
  hhmm(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return null;
    return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  },
  status(watch: PropertyWatch): { label: string; tone: Tone } {
    const status = projectStatusOf(watch);
    if (status === "stopped") return { label: "Stopped", tone: "plain" };
    if (status === "paused") return { label: "Paused", tone: "plain" };
    if (status === "failing" || (watch.failedChecks ?? 0) > 0) return { label: "Failing", tone: "attention" };
    if (watch.phase === "researching") return { label: "Researching…", tone: "busy" };
    if (watch.phase === "initial_ready") return { label: "First results ready", tone: "good" };
    return { label: "Monitoring", tone: "good" };
  },
  lines(watch: PropertyWatch): string[] {
    const t = MonitoringText.hhmm;
    const status = projectStatusOf(watch);
    if (status === "stopped") return ["Monitoring has stopped. Nothing is checked any more."];
    if (status === "paused") return [`Paused${t(watch.pausedAt) ? ` at ${t(watch.pausedAt)}` : ""}. No checks run until you resume.`];
    if (watch.phase === "researching") return ["Sisu is reading the pages and setting up the checks on its server. You can lock the phone: a notification comes when the first results are ready."];
    const lines: string[] = [];
    if (t(watch.initialReadyAt)) lines.push(`Initial research finished ${t(watch.initialReadyAt)}`);
    const last = t(watch.lastSuccessAt);
    const next = t(watch.nextReviewAt ?? watch.nextCheckAt);
    if (watch.phase === "monitoring" || last || next) lines.push(`Monitoring: last successful check ${last ?? "not yet"}${next ? ` · next check ${next}` : ""}`);
    if (watch.webhooks === false) lines.push("Context.dev re-checks the pages every 15 minutes; Sisu reviews them when the app is open or on its scheduled run.");
    else if (watch.webhooks) lines.push("Context.dev re-checks the pages every 15 minutes and tells Sisu after each run, also while the phone is locked.");
    return lines;
  },
  failure(watch: PropertyWatch): string | null {
    const failed = watch.failedChecks ?? 0;
    if (failed <= 0 || projectStatusOf(watch) === "stopped" || projectStatusOf(watch) === "paused") return null;
    const retry = MonitoringText.hhmm(watch.retryAt);
    return `${failed} failed check${failed === 1 ? "" : "s"} in a row${watch.lastFailure?.message ? `: ${watch.lastFailure.message}` : ""}.${retry ? ` Retrying at ${retry}.` : ""}`;
  },
} as const;

export function ProjectMonitoringStatus({ watch, store }: { watch: PropertyWatch; store: ProjectStore }) {
  const [demo, setDemo] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });
  const status = MonitoringText.status(watch);
  const failure = MonitoringText.failure(watch);
  const active = projectStatusOf(watch) !== "stopped" && projectStatusOf(watch) !== "paused";
  const customerId = store.getSnapshot().customerId;
  const simulate = async () => {
    setDemo({ busy: true, message: null });
    const message = await scheduleSimulatedChange(store.client.baseURL, watch.id, customerId, DEMO_DELAY_S);
    setDemo({ busy: false, message });
    setTimeout(() => void store.load(), (DEMO_DELAY_S + 5) * 1_000);
  };
  return (
    <SisuCard className="sisu-monitor-card" testId="project.monitoring">
      <div className="sisu-monitor-head">
        <h2 className="sisu-monitor-title">Background research</h2>
        <span className="sisu-monitor-chip" data-tone={status.tone} data-testid="project.monitoring.status">{status.label}</span>
      </div>
      {MonitoringText.lines(watch).map((line) => <p key={line} className="sisu-monitor-text">{line}</p>)}
      {failure ? <p className="sisu-monitor-failure" role="status">{failure}</p> : null}
      <PushControls baseURL={store.client.baseURL} customerId={customerId} projectId={watch.id} />
      {active && store.isLive ? (
        <div className="sisu-monitor-demo">
          <button type="button" className="sisu-monitor-button" disabled={demo.busy} onClick={() => void simulate()} data-testid="project.simulateChange">
            {demo.busy ? "Scheduling…" : "Simulate a listing change (demo)"}
          </button>
          <p className="sisu-monitor-muted">{demo.message ?? `Made up for the demo and labelled simulated: in ${DEMO_DELAY_S} s the server records it and sends a notification.`}</p>
        </div>
      ) : null}
    </SisuCard>
  );
}
