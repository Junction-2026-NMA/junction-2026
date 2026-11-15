// Work that goes on after the answer has left: the first check of a new Project, a delayed demo change. It runs as
// the same visitor (the session travels with it), fetches that visitor's state fresh, and stores every change
// before it ends, exactly as a streamed answer does (eventStream in lib/agent/http.ts). On Vercel `after` keeps
// the function alive for it (within the route's maxDuration); outside a request (tests, scripts) it simply runs.
// Errors are logged without the session id, which is a capability.
import { after } from "next/server";
import { currentSession, inSession } from "@/lib/store/session";
import { openSession, settleSession } from "@/lib/store/state";

export function inBackground(task: () => Promise<void>): void {
  const sessionId = currentSession();
  const run = async (): Promise<void> => {
    try {
      await openSession(sessionId);
      await inSession(sessionId, task);
    } catch (error) {
      console.error(`[background] a background task failed: ${(error as Error).message}`);
    } finally {
      await settleSession(sessionId).catch((error: Error) => console.error(`[background] could not store the result: ${error.message}`));
    }
  };
  try {
    after(run);
  } catch {
    void run(); // not inside a request: run it now, detached
  }
}

export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
