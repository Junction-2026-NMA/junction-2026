import { jsonError, parseCustomerId } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { findCustomer } from "@/lib/finance/data";
import type { WatchList } from "@/lib/types";
import { listNotifications, listWatches } from "@/lib/watch";
import { asProject, noteVisitor } from "@/lib/watch/project";
import { listAlerts } from "@/lib/watch/alerts";
import { schedulerInfo, watchScheduler } from "@/lib/watch/scheduler";

export const runtime = "nodejs";

// This visitor's property watches (Projects) and what they have found, newest first. Asks Context.dev nothing.
// To look for changes, call POST /api/watch/check. One Project in detail: GET /api/watch/:id.
// Since 15 Nov each watch carries the Project fields (projectStatus, goal, requirements, lastSuccessAt,
// nextCheckAt...), each notification readAt, and the list says which scheduler runs (scheduler).
// v3: schedulerInfo (what the server can really run: cadence, push) and alerts (phone notifications, newest first;
// the app shows them in place of a phone notification when push is off or not allowed).
export const GET = withVisitor(async function GET(request: Request) {
  const customerId = parseCustomerId(new URL(request.url).searchParams.get("customerId"));
  if (!customerId || !findCustomer(customerId)) return jsonError("Choose a customer first.", 400);
  noteVisitor(customerId);
  const body: WatchList = { customerId, watches: listWatches(customerId).map(asProject), notifications: listNotifications(customerId).map((note) => ({ ...note, readAt: note.readAt ?? null })), scheduler: watchScheduler(), schedulerInfo: schedulerInfo(), alerts: listAlerts(customerId) };
  return Response.json(body);
});
