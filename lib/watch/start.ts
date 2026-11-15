// Starting a watch from an approval (v3): the schedule comes from the request (only "as soon as a match is found"
// is accepted; nothing means that default), and a watch that was just started gets its first check on the server
// right after the answer leaves, so findings and the phone notification arrive while the app is closed.
import type { AgentAction, PropertyWatch } from "@/lib/types";
import { inBackground } from "./background";
import { runInitialResearch } from "./create";
import { listWatches, startWatch } from "./index";
import { type ScheduleCheck, validateSchedule } from "./scheduler";

export const readSchedule = (body: Record<string, unknown>, now: Date = new Date()): ScheduleCheck => validateSchedule(body.schedule, undefined, now);

export async function startApprovedWatch(customerId: string, action: AgentAction, schedule: PropertyWatch["schedule"], now: Date = new Date()): Promise<PropertyWatch | null> {
  const existed = listWatches(customerId).some((watch) => watch.actionId === action.id);
  const watch = await startWatch(customerId, action, now, { schedule, initialResearch: existed ? undefined : "running" });
  if (!watch || existed) return watch;
  inBackground(async () => {
    await runInitialResearch(customerId, watch.id, { search: false });
  });
  return watch;
}
