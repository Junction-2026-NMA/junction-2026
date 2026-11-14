// Prepared actions and their approval. The rule this file enforces: nothing is carried out without an explicit
// approval from the user, every step is written to the audit log, and an approved action is carried out only in
// the demo bank (lib/actions/bank.ts): no real money moves and no real contract is signed.
// One kind does something real: a property watch. Approving it starts Context.dev monitors (lib/watch), which the
// approve routes do straight after the approval is stored here; it moves no money and contacts no one.
// The agent can PREPARE an action. Only the approve endpoint, called from a button press, can approve one.
import { buildCashFlow } from "@/lib/finance/cashflow";
import { findCustomer } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import { withAudit } from "@/lib/store/audit";
import { type SisuState, readState, settleSession, updateState } from "@/lib/store/state";
import type { AccountsView, ActionExecution, ActionStatus, AgentAction, BillType, Overview } from "@/lib/types";
import { accountsFrom, carryOut } from "./bank";
import { freedByApprovedSwitches } from "./freed";

const TTL_MS = 30 * 60_000; // offers go stale, so an unanswered action expires and must be prepared again
const MAX_OPEN_PER_CUSTOMER = 5;

export type ActionDraft = Omit<AgentAction, "id" | "customerId" | "status" | "simulated" | "createdAt" | "expiresAt" | "decidedAt" | "impact">;
export type ActionResult = { ok: true; action: AgentAction } | { ok: false; status: 400 | 404 | 409 | 410; reason: string };

const isOpen = (action: AgentAction): boolean => action.status === "awaiting_approval";
const sameAction = (a: AgentAction, draft: ActionDraft): boolean =>
  a.kind === draft.kind && a.billType === draft.billType && a.offer?.provider === draft.offer?.provider && a.offer?.plan === draft.offer?.plan && a.monthlyAmountEur === draft.monthlyAmountEur && a.destination === draft.destination && a.watch?.city === draft.watch?.city && a.watch?.topic === draft.watch?.topic && a.watch?.budgetEur === draft.watch?.budgetEur && (a.watch?.minRooms ?? null) === (draft.watch?.minRooms ?? null);

// Marks unanswered actions that have passed their time as expired, and logs it. The change looks again at the state
// it is applied to, so when it is replayed on top of another server instance's save nothing is expired or logged twice.
function expireOld(now: Date): void {
  const overdue = (state: SisuState): AgentAction[] => state.actions.filter((action) => isOpen(action) && action.expiresAt <= now.toISOString());
  if (!overdue(readState()).length) return;
  updateState((state) =>
    overdue(state).reduce(
      (next, old) => withAudit({ ...next, actions: next.actions.map((a) => (a.id === old.id ? { ...a, status: "expired" as ActionStatus, decidedAt: now.toISOString() } : a)) }, { customerId: old.customerId, type: "action_expired", actor: "system", actionId: old.id, detail: `Expired without an answer: ${old.title}` }, now),
      state,
    ),
  );
}

const newestFirst = (a: AgentAction, b: AgentAction): number => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "");
const approvedFor = (customerId: string): AgentAction[] => readState().actions.filter((action) => action.customerId === customerId && action.status === "executed_simulated").sort(newestFirst);

// The switch this customer has already approved for a bill, if there is one. A bill can be switched once:
// a second switch would be measured against the same old bill, and its saving counted on top of the first.
export function approvedSwitch(customerId: string, billType: BillType | null): AgentAction | null {
  if (!billType) return null;
  return approvedFor(customerId).find((action) => action.kind === "switch_contract" && action.billType === billType) ?? null;
}

export function saveDraft(customerId: string, draft: ActionDraft, now: Date = new Date()): ActionResult {
  if (!findCustomer(customerId)) return { ok: false, status: 404, reason: "We could not find that customer." };
  expireOld(now);
  // Already switched: hand back the approved action, whatever today's cheapest offer is. Callers see its status.
  const switched = draft.kind === "switch_contract" ? approvedSwitch(customerId, draft.billType) : null;
  if (switched) return { ok: true, action: switched };
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
    simulated: draft.kind !== "property_watch" && draft.kind !== "price_watch",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    decidedAt: null,
    impact: null,
  };
  updateState((state) => withAudit({ ...state, actions: [...state.actions, action] }, { customerId, type: "action_prepared", actor: draft.preparedBy, actionId: action.id, detail: `Prepared, awaiting approval: ${action.title}` }, now));
  return { ok: true, action };
}

// For work Sisu repeats on its own, like the money plan run a second time: an identical action the customer has
// already approved is handed back as it is, instead of being set up, approved and counted again. A person who asks
// for the same transfer twice still gets two (use saveDraft).
export function saveDraftOnce(customerId: string, draft: ActionDraft, now: Date = new Date()): ActionResult {
  const approved = approvedFor(customerId).find((action) => sameAction(action, draft));
  return approved ? { ok: true, action: approved } : saveDraft(customerId, draft, now);
}

type Decision = { state: SisuState; result: ActionResult };
type Bank = { overview: Overview; nextPayday: string | null } | null;

// Decides one action against the state it is given, and returns the new state with the audit entries. Pure: it reads
// nothing else, so the store can run it again on top of a newer state (lib/store/state.ts replays a change when
// another server instance saved first). Each run checks again that the action is still waiting and that the money
// is still there. An action of someone else looks exactly like a missing one.
function decideOn(state: SisuState, customerId: string, actionId: string, approve: boolean, impactOf: (action: AgentAction) => AgentAction["impact"], bank: Bank, now: Date): Decision {
  const refuse = (status: 404 | 409 | 410, reason: string): Decision => ({ state, result: { ok: false, status, reason } });
  const action = state.actions.find((a) => a.id === actionId && a.customerId === customerId);
  if (!action) return refuse(404, "We could not find that action.");
  if (action.status === "expired") return refuse(410, "This action has expired because prices may have changed. Ask Sisu to prepare it again.");
  if (!isOpen(action)) return refuse(409, `This action was already ${action.status === "declined" ? "declined" : "approved"}.`);

  // Approving carries the action out in the demo bank (lib/actions/bank.ts): money moves between the customer's
  // accounts there, or the bill changes. The bank can refuse, as a real one would when the money is not there.
  // A property watch has nothing to do with the bank: it moves no money, so it is not carried out there.
  const isWatch = action.kind === "property_watch" || action.kind === "price_watch";
  const reference = action.id.slice(0, 8).toUpperCase();
  let execution: ActionExecution | null = null;
  if (approve && !isWatch && bank) {
    const done = carryOut(action, bank.overview, state.actions, bank.nextPayday, now);
    if (!done.ok) return refuse(done.status, done.reason);
    execution = done.execution;
  }
  const decided: AgentAction = approve
    ? { ...action, status: "executed_simulated", decidedAt: now.toISOString(), impact: impactOf(action), confirmation: isWatch ? `Approved. The watch is starting. Reference WATCH-${reference}.` : `Done (simulation). Reference SIM-${reference}.`, execution }
    : { ...action, status: "declined", decidedAt: now.toISOString() };
  const carried = execution ? `Carried out in the demo bank, no real money moved. ${execution.steps.map((step) => step.detail).join(" ")}` : `Simulated only, nothing was sent or changed: ${action.title}`;

  const stored = { ...state, actions: state.actions.map((a) => (a.id === action.id ? decided : a)) };
  const result: ActionResult = { ok: true, action: decided };
  if (!approve) return { state: withAudit(stored, { customerId, type: "action_declined", actor: "user", actionId, detail: `Declined: ${action.title}` }, now), result };
  const approved = withAudit(stored, { customerId, type: "action_approved", actor: "user", actionId, detail: `Approved by the user: ${action.title}` }, now);
  if (isWatch) return { state: approved, result }; // not a simulation: lib/watch writes "watch_started" once the monitors exist
  return { state: withAudit(approved, { customerId, type: "action_executed_simulated", actor: "system", actionId, detail: carried }, now), result };
}

// Makes the decision and hands back a way to read its answer. The answer is the one for the state that was really
// stored: if the store replays the change on top of a newer state, the decision is made again there and the answer
// follows it (a second approval of the same action, or a transfer the first one already spent, is then refused).
function decide(customerId: string, actionId: string, approve: boolean, impactOf: (action: AgentAction) => AgentAction["impact"], now: Date): () => ActionResult {
  expireOld(now);
  const overview = approve ? buildOverview(customerId) : null;
  const bank: Bank = overview ? { overview, nextPayday: buildCashFlow(overview).nextPayday } : null;
  const current = readState();
  const first = decideOn(current, customerId, actionId, approve, impactOf, bank, now);
  if (!first.result.ok) return () => first.result; // refused here already: nothing to store
  let result: ActionResult = first.result;
  updateState((state) => {
    const decision = state === current ? first : decideOn(state, customerId, actionId, approve, impactOf, bank, now);
    result = decision.result;
    return decision.state;
  });
  return () => result;
}

// The decision as this server instance sees it right now. Routes use the *Stored versions below.
export function approveAction(customerId: string, actionId: string, impactOf: (action: AgentAction) => AgentAction["impact"], now: Date = new Date()): ActionResult {
  return decide(customerId, actionId, true, impactOf, now)();
}

export function declineAction(customerId: string, actionId: string, now: Date = new Date()): ActionResult {
  return decide(customerId, actionId, false, () => null, now)();
}

// For routes: decides, waits until the decision is stored, and answers with what was stored. On a hosted site two
// taps (or two phones in one session) can reach two server instances at the same moment; the one that stores second
// has its decision checked again on top of the first, so it is refused instead of spending money that is gone.
export async function approveActionStored(customerId: string, actionId: string, impactOf: (action: AgentAction) => AgentAction["impact"], now: Date = new Date()): Promise<ActionResult> {
  const result = decide(customerId, actionId, true, impactOf, now);
  await settleSession();
  return result();
}

export async function declineActionStored(customerId: string, actionId: string, now: Date = new Date()): Promise<ActionResult> {
  const result = decide(customerId, actionId, false, () => null, now);
  await settleSession();
  return result();
}

// Approve all: each action in order, each checked against the ones approved before it, answered once all are stored.
export async function approveActionsStored(customerId: string, actionIds: string[], impactOf: (action: AgentAction) => AgentAction["impact"], now: Date = new Date()): Promise<ActionResult[]> {
  const results = actionIds.map((actionId) => decide(customerId, actionId, true, impactOf, now));
  await settleSession();
  return results.map((result) => result());
}

export function listActions(customerId: string, now: Date = new Date()): AgentAction[] {
  expireOld(now);
  return readState()
    .actions.filter((action) => action.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Monthly amounts from approved switches. The futures chart and the agent use this as "what has already been freed".
// One switch per bill counts (see ./freed).
// The customer's accounts in the demo bank, as they stand after everything they approved.
export function accountsFor(customerId: string): AccountsView | null {
  const overview = buildOverview(customerId);
  return overview ? accountsFrom(overview, readState().actions) : null;
}

export function approvedMonthlySaving(customerId: string): number {
  return freedByApprovedSwitches(readState().actions.filter((action) => action.customerId === customerId));
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
      watches: (current.watches ?? []).filter((watch) => !customerIds.includes(watch.customerId)),
      notifications: (current.notifications ?? []).filter((note) => !customerIds.includes(note.customerId)),
      audit: [], // a new chain starts here; the reset itself is its first entry
    };
    return withAudit(cleared, { customerId: "ALL-DEMO", type: "demo_reset", actor: "system", detail: `Demo reset: ${actions} actions and ${memoryItems} remembered items cleared for ${customerIds.length} customers.` }, now);
  });
  return { actions, memoryItems };
}
