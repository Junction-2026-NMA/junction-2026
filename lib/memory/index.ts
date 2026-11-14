// What Sisu remembers about a customer between sessions: confirmed bill names, their yearly kWh, preferences and goals.
// Nothing is saved unless the customer allows it (consent), and every save or removal is written to the audit log.
import { findCustomer } from "@/lib/finance/data";
import { withAudit } from "@/lib/store/audit";
import { readState, updateState } from "@/lib/store/state";
import type { BillType, CustomerMemory, MemoryItem, MemoryKind, Overview, RecurringBill } from "@/lib/types";

const MAX_ITEMS = 40;
const MAX_VALUE_CHARS = 160;
const BILL_TYPES: BillType[] = ["electricity", "mobile", "internet"];
// Sisu's first guess for each kind of bill, used until the customer confirms or corrects it.
export const BILL_GUESS_LABEL: Record<BillType, string> = { electricity: "Electricity", mobile: "Mobile plan", internet: "Home internet" };

// Demo profiles start with remembering switched on. The frontend can turn it off with POST /api/memory { consent: false }.
const emptyMemory = (customerId: string): CustomerMemory => ({ customerId, consent: true, items: [] });

export function getMemory(customerId: string): CustomerMemory {
  return readState().memory[customerId] ?? emptyMemory(customerId);
}

export type RememberInput = { kind: MemoryKind; key: string; value: string; billType?: BillType | null; source: MemoryItem["source"] };
export type RememberResult = { ok: true; item: MemoryItem } | { ok: false; reason: string };

const clean = (text: string): string => text.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_VALUE_CHARS);

export function remember(customerId: string, input: RememberInput, now: Date = new Date()): RememberResult {
  if (!findCustomer(customerId)) return { ok: false, reason: "We could not find that customer." };
  const memory = getMemory(customerId);
  if (!memory.consent) return { ok: false, reason: "Remembering is switched off for this customer, so nothing was saved." };

  const key = clean(input.key).toLowerCase();
  const value = clean(input.value);
  if (!key || !value) return { ok: false, reason: "There was nothing to remember." };
  if (input.kind === "yearly_kwh" && !(Number(value) >= 500 && Number(value) <= 30_000)) {
    return { ok: false, reason: "A yearly electricity use between 500 and 30,000 kWh is needed." };
  }
  const billType = input.kind === "bill_name" && BILL_TYPES.includes(input.billType as BillType) ? (input.billType as BillType) : null;

  const item: MemoryItem = { id: crypto.randomUUID(), kind: input.kind, key, value, billType, source: input.source, savedAt: now.toISOString() };
  // One value per kind and key: a new answer replaces the old one. A bill type can also belong to only one bill.
  const kept = memory.items.filter((existing) => !(existing.kind === item.kind && existing.key === item.key) && !(billType && existing.kind === "bill_name" && existing.billType === billType));
  const items = [...kept, item].slice(-MAX_ITEMS);

  updateState((state) =>
    withAudit(
      { ...state, memory: { ...state.memory, [customerId]: { ...memory, items } } },
      { customerId, type: "memory_saved", actor: input.source === "user-confirmed-in-app" ? "user" : "sisu-agent", detail: `${item.kind}: ${item.key} = ${item.value}` },
      now,
    ),
  );
  return { ok: true, item };
}

export function forget(customerId: string, itemId: string | null, now: Date = new Date()): number {
  const memory = getMemory(customerId);
  const kept = itemId ? memory.items.filter((item) => item.id !== itemId) : [];
  const removed = memory.items.length - kept.length;
  if (!removed) return 0;
  updateState((state) =>
    withAudit(
      { ...state, memory: { ...state.memory, [customerId]: { ...memory, items: kept } } },
      { customerId, type: "memory_forgotten", actor: "user", detail: itemId ? `Removed one remembered item (${itemId}).` : `Removed all ${removed} remembered items.` },
      now,
    ),
  );
  return removed;
}

// Turning consent off also wipes what was stored: "stop remembering" should not leave anything behind.
export function setConsent(customerId: string, consent: boolean, now: Date = new Date()): CustomerMemory {
  const memory = getMemory(customerId);
  const next: CustomerMemory = { ...memory, consent, items: consent ? memory.items : [] };
  updateState((state) =>
    withAudit(
      { ...state, memory: { ...state.memory, [customerId]: next } },
      { customerId, type: "consent_changed", actor: "user", detail: consent ? "Remembering switched on." : `Remembering switched off; ${memory.items.length} remembered items erased.` },
      now,
    ),
  );
  return next;
}

export function statedYearlyKwh(memory: CustomerMemory): number | null {
  const item = memory.items.find((entry) => entry.kind === "yearly_kwh");
  const value = item ? Number(item.value) : NaN;
  return Number.isFinite(value) ? value : null;
}

// Which of the customer's recurring bills is this bill type? A confirmed name wins over Sisu's guess.
export function billFor(overview: Overview, memory: CustomerMemory, billType: BillType): { bill: RecurringBill; confirmed: boolean } | null {
  const confirmed = memory.items.find((item) => item.kind === "bill_name" && item.billType === billType);
  const confirmedBill = confirmed ? overview.recurringBills.find((bill) => bill.id === confirmed.key) : undefined;
  if (confirmedBill) return { bill: confirmedBill, confirmed: true };
  // A bill the customer has renamed to something else is no longer available as a guess.
  const renamed = new Set(memory.items.filter((item) => item.kind === "bill_name").map((item) => item.key));
  const guessed = overview.recurringBills.find((bill) => bill.guessLabel === BILL_GUESS_LABEL[billType] && !renamed.has(bill.id));
  return guessed ? { bill: guessed, confirmed: false } : null;
}

// The name to show for a bill: the confirmed one if there is one, otherwise the guess marked as a guess.
export function billLabel(bill: RecurringBill, memory: CustomerMemory): { label: string; confirmed: boolean } {
  const confirmed = memory.items.find((item) => item.kind === "bill_name" && item.key === bill.id);
  return confirmed ? { label: confirmed.value, confirmed: true } : { label: bill.guessLabel, confirmed: false };
}

// Removes memory for the given customers (demo reset). Returns how many items went.
export function clearMemory(customerIds: string[]): number {
  const state = readState();
  const removed = customerIds.reduce((total, id) => total + (state.memory[id]?.items.length ?? 0), 0);
  updateState((current) => ({ ...current, memory: Object.fromEntries(Object.entries(current.memory).filter(([id]) => !customerIds.includes(id))) }));
  return removed;
}
