// The demo's simulated listing change, end to end: it goes through the same path a real change takes (page change →
// requirement verdict → stored finding → the Project's notification rule → phone notification), and every piece is
// labelled "Simulated for demo". With a delay it runs on the server after the answer, so the phone can be locked first.
import { readState, updateState } from "@/lib/store/state";
import type { ProjectAlert } from "@/lib/types";
import { applyNotifyPolicy } from "./alerts";
import { inBackground, wait } from "./background";
import { type SimulationResult, findWatch, replaceWatch, simulatePriceDrop, simulationTarget } from "./index";

export const MAX_DELAY_SECONDS = 60;

export async function simulateAndAlert(customerId: string, watchId: string, now: Date = new Date()): Promise<SimulationResult & { alert?: ProjectAlert | null }> {
  const result = simulatePriceDrop(customerId, watchId, now);
  if (!result.ok) return result;
  const watch = findWatch(customerId, watchId);
  const alert = watch ? await applyNotifyPolicy(customerId, watch, [result.notification], now) : null;
  return { ...result, alert };
}

export type Scheduled = { ok: true; scheduledFor: string } | { ok: false; status: 404 | 409; reason: string };

// Checks now that there is something to simulate (so the app hears at once if not), then runs it after the delay.
export function simulateLater(customerId: string, watchId: string, delaySeconds: number, now: Date = new Date()): Scheduled {
  const watch = findWatch(customerId, watchId);
  if (!watch) return { ok: false, status: 404, reason: "We could not find that watch." };
  if (watch.status !== "active") return { ok: false, status: 409, reason: "This watch is not running." };
  if (!simulationTarget(watch, now)) return { ok: false, status: 409, reason: "No watched listing would meet every requirement of this project after a price drop, so there is nothing to simulate." };
  const scheduledFor = new Date(now.getTime() + delaySeconds * 1000).toISOString();
  inBackground(async () => {
    await wait(delaySeconds * 1000);
    const result = await simulateAndAlert(customerId, watchId, new Date());
    if (result.ok) return;
    // Say why on the Project, unless it was stopped or paused meanwhile (then nothing should happen at all).
    const current = (readState().watches ?? []).find((item) => item.id === watchId && item.customerId === customerId);
    if (current?.status !== "active") return;
    updateState((state) => replaceWatch(state, { ...current, problems: [...current.problems, `Simulated change not made: ${result.reason}`] }));
  });
  return { ok: true, scheduledFor };
}
