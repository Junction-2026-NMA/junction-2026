// v2 push: the demo's "Simulate a listing change" with a delay, so the phone can be locked first. It runs on the
// server after the answer (after()), as the visitor who asked: after the delay it makes the same labelled,
// simulated finding as the immediate button, then pushes "Your … has an update." (nothing financial in it).
// A project paused or stopped meanwhile gets nothing: the finding is only made for an active watch.
import { later, sleep } from "@/lib/background";
import { pushFindings } from "@/lib/push/notify";
import { canSimulate, findWatch, simulatePriceDrop } from "./index";

export type Scheduled = { ok: true; at: string } | { ok: false; status: 404 | 409; reason: string };

// For tests: how long a second really lasts (0 makes the delay instant).
let msPerSecond = 1_000;
export const setSimulationClock = (ms: number): void => {
  msPerSecond = ms;
};

export function scheduleSimulatedChange(customerId: string, watchId: string, delaySeconds: number, now: Date = new Date()): Scheduled {
  const allowed = canSimulate(customerId, watchId);
  if (!allowed.ok) return allowed;
  later("simulated change", async () => {
    await sleep(delaySeconds * msPerSecond);
    const result = simulatePriceDrop(customerId, watchId, new Date(), { fresh: true });
    const watch = findWatch(customerId, watchId);
    if (!result.ok || !watch || watch.status !== "active") return;
    await pushFindings(watch);
  });
  return { ok: true, at: new Date(now.getTime() + delaySeconds * 1_000).toISOString() };
}
