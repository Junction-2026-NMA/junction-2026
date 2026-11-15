// Work that continues after a route has answered: Next's after() (Vercel keeps the function alive with waitUntil
// until it is done, up to the route's maxDuration). The work runs as the visitor who asked for it: the session is
// opened (fetched from Supabase) before and settled (saved) after, as the scheduled check does (lib/watch/cron.ts).
// Outside a request (tests, scripts) after() is not available: the work runs detached and `settleBackground()` waits for it.
import { after } from "next/server";
import { currentSession, inSession } from "@/lib/store/session";
import { openSession, settleSession } from "@/lib/store/state";

const running = new Set<Promise<void>>();

export async function runAsVisitor<T>(sessionId: string, work: () => Promise<T>): Promise<T> {
  await openSession(sessionId);
  try {
    return await inSession(sessionId, work);
  } finally {
    await settleSession(sessionId);
  }
}

// Runs `work` after the answer has been sent, in the current visitor's session. Errors are logged, never thrown.
export function later(label: string, work: () => Promise<unknown>): void {
  const sessionId = currentSession();
  const task = async () => {
    try {
      await runAsVisitor(sessionId, work);
    } catch (error) {
      console.error(`[background] ${label} failed: ${(error as Error).message}`);
    }
  };
  try {
    after(task);
  } catch {
    const promise = task().finally(() => running.delete(promise));
    running.add(promise);
  }
}

// For tests: waits until every detached task has finished.
export async function settleBackground(): Promise<void> {
  while (running.size) await Promise.all([...running]);
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
