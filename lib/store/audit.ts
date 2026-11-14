// The audit log. Each event stores the hash of the event before it, so removing or editing an entry
// breaks the chain and shows up in verifyChain(). That is what "tamper-evident" means here.
import { createHash } from "node:crypto";
import type { AuditEvent, AuditEventType } from "@/lib/types";
import { type SisuState, readState } from "./state";

const GENESIS = "0".repeat(64);

type NewEvent = { customerId: string; type: AuditEventType; actor: AuditEvent["actor"]; actionId?: string | null; detail: string };

function hashOf(event: Omit<AuditEvent, "hash">): string {
  return createHash("sha256")
    .update([event.seq, event.at, event.customerId, event.type, event.actor, event.actionId ?? "", event.detail, event.prevHash].join("|"))
    .digest("hex");
}

// Returns a new state with the event appended. Use inside updateState so the append and the change it records land together.
export function withAudit(state: SisuState, event: NewEvent, now: Date = new Date()): SisuState {
  const previous = state.audit[state.audit.length - 1];
  const base = {
    seq: (previous?.seq ?? 0) + 1,
    at: now.toISOString(),
    customerId: event.customerId,
    type: event.type,
    actor: event.actor,
    actionId: event.actionId ?? null,
    detail: event.detail.slice(0, 400),
    prevHash: previous?.hash ?? GENESIS,
  };
  return { ...state, audit: [...state.audit, { ...base, hash: hashOf(base) }] };
}

// True when no event has been changed, removed or reordered.
export function verifyChain(events: AuditEvent[]): boolean {
  return events.every((event, index) => {
    const { hash, ...rest } = event;
    const expectedPrev = index === 0 ? GENESIS : events[index - 1].hash;
    return event.prevHash === expectedPrev && hashOf(rest) === hash;
  });
}

// One customer's events. The chain is checked over the whole log, because the hashes link every customer's events.
export function auditFor(customerId: string): { events: AuditEvent[]; chainValid: boolean } {
  const all = readState().audit;
  return { events: all.filter((event) => event.customerId === customerId), chainValid: verifyChain(all) };
}
