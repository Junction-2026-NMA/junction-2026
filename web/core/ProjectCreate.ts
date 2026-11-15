// v3 calls of the Projects journey that only the updated backend has (lib/types.ts "v3"): start a project from an
// approved summary, a delayed simulated listing change for the recording, and the phone-notification routes.
// Callers use these only when GET /api/watch carried `schedulerInfo` (the updated backend), so today's hosted
// backend is never probed with them (no 404s in the console).
import type { CoachClient } from "./CoachClient";
import { CoachEndpoints } from "./CoachEndpoints";
import { JSONRead } from "./Models";
import { WatchProject } from "./WatchProject";
import type { WatchRequirements } from "./WatchModels";

/** POST /api/watch/create: the customer approved the summary ("Approve" is the approval click). */
export interface ProjectCreateBody {
  customerId: string;
  confirm: true;
  goal: string;
  city: string;
  budgetEur: number;
  minRooms: number | null;
  minAreaM2: number | null;
  requirements: WatchRequirements;
  schedule: { notify: "on_match"; monitorUntil: string };
  fromActionId: string | null;
  fromConversation: boolean;
}

/** How long a project started from the conversation keeps checking (the server stops it after this). */
export const PROJECT_DAYS = 14;

export function monitorUntil(now: Date = new Date(), days = PROJECT_DAYS): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

export interface PushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string } }

const ok = (json: unknown): unknown => json;
const publicKeyOf = (json: unknown): string | null =>
  JSONRead.isObject(json) && typeof json.publicKey === "string" && json.publicKey !== "" ? json.publicKey : null;

export const ProjectCalls = {
  /** Answers at once (201) with the project, `initialResearch: "running"`: the search, the first check and the
   *  notification then run on Sisu's server, also when the app is closed. */
  create(client: CoachClient, body: ProjectCreateBody): Promise<WatchProject> {
    return client.call(CoachEndpoints.post(client.baseURL, "/api/watch/create", body, CoachEndpoints.researchTimeout), WatchProject.decode);
  },

  /** A labelled simulated listing change, processed on the server `delaySeconds` from now (0 to 60). */
  simulateChange(client: CoachClient, watchId: string, customerId: string, delaySeconds: number): Promise<unknown> {
    const path = `/api/watch/${encodeURIComponent(watchId)}/simulate-drop`;
    return client.call(CoachEndpoints.post(client.baseURL, path, { customerId, delaySeconds }, CoachEndpoints.researchTimeout), ok);
  },

  /** The server's VAPID public key, or null when phone notifications are not set up there. */
  pushKey(client: CoachClient): Promise<string | null> {
    return client.call(CoachEndpoints.get(client.baseURL, "/api/push/key"), publicKeyOf);
  },

  pushSubscribe(client: CoachClient, customerId: string, subscription: PushSubscriptionJSON): Promise<unknown> {
    return client.call(CoachEndpoints.post(client.baseURL, "/api/push/subscribe", { customerId, subscription }), ok);
  },

  pushTest(client: CoachClient, customerId: string): Promise<unknown> {
    return client.call(CoachEndpoints.post(client.baseURL, "/api/push/test", { customerId }), ok);
  },
} as const;
