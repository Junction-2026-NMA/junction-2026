// v2 push: the monitoring status fields of a watch (lib/types.ts "v2 push"), decoded tolerantly like the rest of
// WatchModels.ts, which spreads these into its PropertyWatch and WatchedPage decoders. Older backends send none of
// them: every field is then absent and the screens say nothing they cannot back.
import { JSONRead } from "./Models";

export type WatchPhase = "researching" | "initial_ready" | "monitoring";
export interface PageChange { title: string; summary: string; detectedAt: string | null; simulated: boolean }

declare module "./WatchModels" {
  interface PropertyWatch {
    phase?: WatchPhase | null;
    initialReadyAt?: string | null;
    nextReviewAt?: string | null;
    failedChecks?: number | null;
    lastFailure?: { at: string | null; message: string } | null;
    retryAt?: string | null;
    webhooks?: boolean | null;
    pausedAt?: string | null;
    stoppedAt?: string | null;
  }
  interface WatchedPage {
    lastChange?: PageChange | null;
  }
}

type O = Record<string, unknown>;
const text = (o: O, key: string): string | null => (typeof o[key] === "string" ? (o[key] as string) : null);
const PHASES: readonly string[] = ["researching", "initial_ready", "monitoring"];

export const WatchMonitoring = {
  watch(o: O) {
    const failure = JSONRead.isObject(o.lastFailure) && typeof o.lastFailure.message === "string" ? { at: text(o.lastFailure, "at"), message: o.lastFailure.message } : null;
    const phase = text(o, "phase");
    return {
      phase: phase && PHASES.includes(phase) ? (phase as WatchPhase) : null,
      initialReadyAt: text(o, "initialReadyAt"), nextReviewAt: text(o, "nextReviewAt"), retryAt: text(o, "retryAt"),
      failedChecks: typeof o.failedChecks === "number" ? o.failedChecks : null, lastFailure: failure,
      webhooks: typeof o.webhooks === "boolean" ? o.webhooks : null, pausedAt: text(o, "pausedAt"), stoppedAt: text(o, "stoppedAt"),
    };
  },
  page(o: O) {
    const c = o.lastChange;
    const lastChange = JSONRead.isObject(c) && typeof c.title === "string"
      ? { title: c.title, summary: typeof c.summary === "string" ? c.summary : "", detectedAt: text(c, "detectedAt"), simulated: c.simulated === true }
      : null;
    return { lastChange };
  },
} as const;
