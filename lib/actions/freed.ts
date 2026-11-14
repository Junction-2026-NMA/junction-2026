// Euros a month freed by approved contract switches: what the futures chart takes as "already saved".
// A bill can be switched once. If a list holds more than one approved switch for the same bill (state written
// before that rule, or two phones), only the newest counts, so the same bill's saving is never counted twice.
// No server imports here: the browser hook and the server use the same sum.
import type { AgentAction } from "@/lib/types";

export function freedByApprovedSwitches(actions: AgentAction[]): number {
  const newest = new Map<string, AgentAction>();
  for (const action of actions) {
    if (action.status !== "executed_simulated" || action.kind !== "switch_contract") continue;
    const key = action.billType ?? action.id;
    const seen = newest.get(key);
    if (!seen || (action.decidedAt ?? "") > (seen.decidedAt ?? "")) newest.set(key, action);
  }
  const total = [...newest.values()].reduce((sum, action) => sum + action.monthlyAmountEur, 0);
  return Math.round(total * 100) / 100;
}
