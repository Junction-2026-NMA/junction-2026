// What a phone notification says: never money, never listing details. Only that a Project has an update, and the
// address that opens the right finding.
import type { ProjectAlert, PropertyWatch } from "@/lib/types";
import type { PushPayload } from "./send";

// A topic in the customer's words can hold a price ("iPhone 15 under 450"); then it is left out of the text.
const subjectOf = (watch: Pick<PropertyWatch, "city" | "topic">): { housing: boolean; name: string | null } =>
  watch.topic ? { housing: false, name: /[\d€$£]/.test(watch.topic) ? null : watch.topic.slice(0, 40) } : { housing: true, name: watch.city ?? null };

export function alertBody(watch: Pick<PropertyWatch, "city" | "topic">, reason: ProjectAlert["reason"]): string {
  const { housing, name } = subjectOf(watch);
  const search = housing ? `${name ? `${name} ` : ""}housing search` : `${name ? `${name} ` : "price "}watch`;
  if (reason === "deadline_nothing" || reason === "deadline") return `Your ${search} has finished. Open Sisu to see the result.`;
  return `Your ${search} has an update.`;
}

export function projectLink(watchId: string, findingId: string | null): string {
  const params = new URLSearchParams({ source: "homescreen", project: watchId, ...(findingId ? { finding: findingId } : {}) });
  return `/app?${params.toString()}`;
}

export const alertPayload = (alert: Pick<ProjectAlert, "watchId" | "findingIds" | "body">): PushPayload => ({ title: "Sisu", body: alert.body, url: projectLink(alert.watchId, alert.findingIds[0] ?? null), tag: alert.watchId });
