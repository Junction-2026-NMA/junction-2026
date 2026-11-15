import { TOO_MANY, allowRequest } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { DEMO_CUSTOMERS } from "@/lib/finance/data";
import { listWatches, simulatePriceDrop } from "@/lib/watch";
import { scheduleSimulatedChange } from "@/lib/watch/simulate";

export const runtime = "nodejs";
export const maxDuration = 60;

// For filming and the booth: a link that triggers the simulated price drop for the visitor who opens it.
// A watch belongs to one visitor's session, so the drop has to be asked for from the same browser as the app.
// Open this address there (GET /api/watch/demo-drop), go back to the app, and ask Sisu whether the watch found
// anything. It drops the newest running watch of any demo customer in this session, exactly as the button does
// (POST /api/watch/:id/simulate-drop): the notification and the audit line both say "simulated".
const page = (title: string, detail: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sisu demo</title>` +
      `<body style="font:17px/1.5 system-ui;margin:2rem;max-width:32rem"><h1 style="font-size:1.3rem">${title}</h1><p>${detail}</p><p>Go back to the app and ask Sisu: “Did my watch find anything?”</p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
const escape = (text: string): string => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export const GET = withVisitor(async function GET(request: Request) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const running = DEMO_CUSTOMERS.flatMap((customer) => listWatches(customer.customerId))
    .filter((watch) => watch.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!running.length) return page("No watch is running in this browser", "Start one in the app first (ask Sisu to watch a price and tap Approve), in this same browser.", 404);
  // v2 push: ?delay=30 makes the simulated change on the server 30 s from now and pushes it to the phone.
  const delay = Number(new URL(request.url).searchParams.get("delay"));
  if (Number.isFinite(delay) && delay >= 1 && delay <= 50) {
    for (const watch of running) {
      const scheduled = scheduleSimulatedChange(watch.customerId, watch.id, Math.round(delay));
      if (scheduled.ok) return page("Simulated change scheduled", `In ${Math.round(delay)} seconds Sisu will record a simulated change (labelled as simulated) and send a notification. Lock the phone now.`);
    }
  }
  for (const watch of running) {
    const result = simulatePriceDrop(watch.customerId, watch.id);
    if (result.ok) return page("Simulated price drop sent", `${escape(result.notification.title)}. ${escape(result.notification.summary)}`);
  }
  return page("Nothing to drop", "Nothing being watched is over the limit, so there is no price to drop.", 409);
});
