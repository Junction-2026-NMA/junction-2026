// Prepared actions and their approval. The rule this file enforces: nothing is carried out without an explicit
// approval from the user, every step is written to the audit log, and even an approved action is only simulated.
// The agent can PREPARE an action. Only the approve endpoint, called from a button press, can approve one.
import { findCustomer } from "@/lib/finance/data";
import { withAudit } from "@/lib/store/audit";
import { readState, updateState } from "@/lib/store/state";
import type { ActionStatus, AgentAction } from "@/lib/types";

const TTL_MS = 30 * 60_000; // offers go stale, so an unanswered action expires and must be prepared again
const MAX_OPEN_PER_CUSTOMER = 5;

export type ActionDraft = Omit<AgentAction, "id" | "customerId" | "status" | "simulated" | "createdAt" | "expiresAt" | "decidedAt" | "impact">;
export type ActionResult = { ok: true; action: AgentAction } | { ok: false; status: 400 | 404 | 409 | 410; reason: string };

const isOpen = (action: AgentAction): boolean => action.status === "awaiting_approval";
const sameAction = (a: AgentAction, draft: ActionDraft): boolean =>
  a.kind === draft.kind && a.billType === draft.billType && a.offer?.provider === draft.offer?.provider && a.offer?.plan === draft.offer?.plan && a.monthlyAmountEur === draft.monthlyAmountEur;

// Marks unanswered actions that have passed their time as expired, and logs it.
function expireOld(now: Date): void {
  const overdue = readState().actions.filter((action) => isOpen(action) && action.expiresAt <= now.toISOString());
  if (!overdue.length) return;
  updateState((state) =>
    overdue.reduce(
      (next, old) => withAudit({ ...next, actions: next.actions.map((a) => (a.id === old.id ? { ...a, status: "expired" as ActionStatus, decidedAt: now.toISOString() } : a)) }, { customerId: old.customerId, type: "action_expired", actor: "system", actionId: old.id, detail: `Expired without an answer: ${old.title}` }, now),
      state,
    ),
  );
}

export function saveDraft(customerId: string, draft: ActionDraft, now: Date = new Date()): ActionResult {
  if (!findCustomer(customerId)) return { ok: false, status: 404, reason: "We could not find that customer." };
  expireOld(now);
  const open = readState().actions.filter((action) => action.customerId === customerId && isOpen(action));
  // Asking for the same thing twice returns the action already waiting, so the user never sees duplicates.
  const existing = open.find((action) => sameAction(action, draft));
  if (existing) return { ok: true, action: existing };
  if (open.length >= MAX_OPEN_PER_CUSTOMER) return { ok: false, status: 409, reason: "There are already several actions waiting for your answer. Approve or decline one first." };

  const action: AgentAction = {
    ...draft,
    id: crypto.randomUUID(),
    customerId,
    status: "awaiting_approval",
    simulated: true,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    decidedAt: null,
    impact: null,
  };
  updateState((state) => withAudit({ ...state, actions: [...state.actions, action] }, { customerId, type: "action_prepared", actor: draft.preparedBy, actionId: action.id, detail: `Prepared, awaiting approval: ${action.title}` }, now));
  return { ok: true, action };
}

// Finds an action only if it belongs to this customer. Someone else's action looks exactly like a missing one.
function ownAction(customerId: string, actionId: string): AgentAction | null {
  return readState().actions.find((action) => action.id === actionId && action.customerId === customerId) ?? null;
}

function decide(customerId: string, actionId: string, approve: boolean, impactOf: (action: AgentAction) => AgentAction["impact"], now: Date): ActionResult {
  expireOld(now);
  const action = ownAction(customerId, actionId);
  if (!action) return { ok: false, status: 404, reason: "We could not find that action." };
  if (action.status === "expired") return { ok: false, status: 410, reason: "This action has expired because prices may have changed. Ask Sisu to prepare it again." };
  if (!isOpen(action)) return { ok: false, status: 409, reason: `This action was already ${action.status === "declined" ? "declined" : "approved"}.` };

  const decided: AgentAction = approve
    ? { ...action, status: "executed_simulated", decidedAt: now.toISOString(), impact: impactOf(action) }
    : { ...action, status: "declined", decidedAt: now.toISOString() };

  updateState((state) => {
    const stored = { ...state, actions: state.actions.map((a) => (a.id === action.id ? decided : a)) };
    if (!approve) return withAudit(stored, { customerId, type: "action_declined", actor: "user", actionId, detail: `Declined: ${action.title}` }, now);
    const approved = withAudit(stored, { customerId, type: "action_approved", actor: "user", actionId, detail: `Approved by the user: ${action.title}` }, now);
    return withAudit(approved, { customerId, type: "action_executed_simulated", actor: "system", actionId, detail: `Simulated only, nothing was sent or changed: ${action.title}` }, now);
  });
  return { ok: true, action: decided };
}

export function approveAction(customerId: string, actionId: string, impactOf: (action: AgentAction) => AgentAction["impact"], now: Date = new Date()): ActionResult {
  return decide(customerId, actionId, true, impactOf, now);
}

export function declineAction(customerId: string, actionId: string, now: Date = new Date()): ActionResult {
  return decide(customerId, actionId, false, () => null, now);
}

export function listActions(customerId: string, now: Date = new Date()): AgentAction[] {
  expireOld(now);
  return readState()
    .actions.filter((action) => action.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Monthly amounts from approved switches. The futures chart and the agent use this as "what has already been freed".
export function approvedMonthlySaving(customerId: string): number {
  return readState()
    .actions.filter((action) => action.customerId === customerId && action.status === "executed_simulated" && action.kind === "switch_contract")
    .reduce((total, action) => total + action.monthlyAmountEur, 0);
}

// Booth reset: removes every action, remembered item and audit entry for the given customers, then logs the reset.
export function resetCustomers(customerIds: string[], now: Date = new Date()): { actions: number; memoryItems: number } {
  const state = readState();
  const actions = state.actions.filter((action) => customerIds.includes(action.customerId)).length;
  const memoryItems = customerIds.reduce((total, id) => total + (state.memory[id]?.items.length ?? 0), 0);
  updateState((current) => {
    const cleared = {
      ...current,
      actions: current.actions.filter((action) => !customerIds.includes(action.customerId)),
      memory: Object.fromEntries(Object.entries(current.memory).filter(([id]) => !customerIds.includes(id))),
      audit: [], // a new chain starts here; the reset itself is its first entry
    };
    return withAudit(cleared, { customerId: "ALL-DEMO", type: "demo_reset", actor: "system", detail: `Demo reset: ${actions} actions and ${memoryItems} remembered items cleared for ${customerIds.length} customers.` }, now);
  });
  return { actions, memoryItems };
}
