// What a watch tells the phone, and when. One push per check per project, whatever it found; a finding is pushed
// at most once (pushedAt is claimed in the state before sending). The text names the project only, never a price,
// a budget or anything else financial: "Your Espoo housing search has an update."
import { readState, updateState } from "@/lib/store/state";
import type { PropertyWatch, PushMessage } from "@/lib/types";
import { type PushResult, pushToVisitor } from "./send";

export const projectName = (watch: Pick<PropertyWatch, "city" | "topic">): string => (watch.topic ? "price watch" : `${watch.city ?? "housing"} housing search`);
export const projectUrl = (watch: Pick<PropertyWatch, "id" | "customerId">): string => `/app?source=homescreen&customer=${encodeURIComponent(watch.customerId)}&project=${encodeURIComponent(watch.id)}`;

export function messageFor(watch: Pick<PropertyWatch, "id" | "customerId" | "city" | "topic">, kind: "update" | "initial" | "test"): PushMessage {
  const name = projectName(watch);
  const body = kind === "initial" ? `Your ${name}: first results are ready.` : kind === "test" ? "Notifications are on. This is a test from Sisu." : `Your ${name} has an update.`;
  return { title: "Sisu", body, url: projectUrl(watch), tag: watch.id };
}

// Pushes once for every finding of this watch that has not been pushed yet. Answers how many findings it covered.
export async function pushFindings(watch: PropertyWatch, now: Date = new Date()): Promise<{ findings: number; result: PushResult | null }> {
  const due = (readState().notifications ?? []).filter((note) => note.watchId === watch.id && note.customerId === watch.customerId && !note.pushedAt && !note.readAt).map((note) => note.id);
  if (!due.length) return { findings: 0, result: null };
  const ids = new Set(due);
  const at = now.toISOString();
  // Claimed before sending, so a second check that runs meanwhile finds nothing left to push.
  updateState((state) => ({ ...state, notifications: (state.notifications ?? []).map((note) => (ids.has(note.id) && !note.pushedAt ? { ...note, pushedAt: at } : note)) }));
  return { findings: due.length, result: await pushToVisitor(messageFor(watch, "update")) };
}

export const pushInitial = (watch: PropertyWatch): Promise<PushResult> => pushToVisitor(messageFor(watch, "initial"));
