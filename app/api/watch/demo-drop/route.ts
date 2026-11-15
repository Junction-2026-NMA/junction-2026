import { TOO_MANY, allowRequest } from "@/lib/agent/http";
import { withVisitor } from "@/lib/agent/visitor";
import { DEMO_CUSTOMERS } from "@/lib/finance/data";
import { listWatches, simulatePriceDrop } from "@/lib/watch";

export const runtime = "nodejs";

// For filming and the booth: a link that triggers the simulated price drop for the visitor who opens it.
// A watch belongs to one visitor's session, so the drop has to be asked for from the same browser as the app.
// Open this address there (GET /api/watch/demo-drop), go back to the app, and ask Sisu whether the watch found
// anything. Without selectors it prefers Aino's newest housing project, then other running watches. Optional
// customerId/watchId selectors target one approved project. The notification and audit line say "simulated".
const page = (title: string, detail: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sisu demo</title>` +
      `<body style="font:17px/1.5 system-ui;margin:2rem;max-width:32rem"><h1 style="font-size:1.3rem">${title}</h1><p>${detail}</p><p>Go back to the app and ask Sisu: “Did my watch find anything?”</p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
const escape = (text: string): string => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export const GET = withVisitor(async function GET(request: Request) {
  if (!allowRequest(request, "actions", 30)) return TOO_MANY();
  const params = new URL(request.url).searchParams;
  const customerId = params.get("customerId");
  const watchId = params.get("watchId");
  const running = DEMO_CUSTOMERS.flatMap((customer) => listWatches(customer.customerId))
    .filter((watch) => watch.status === "active" && (!customerId || watch.customerId === customerId) && (!watchId || watch.id === watchId))
    .sort((a, b) => {
      const preferred = (watch: typeof a) => Number(watch.customerId === "CUST04974" && watch.priceUnit === "EUR/month");
      return preferred(b) - preferred(a) || b.createdAt.localeCompare(a.createdAt);
    });
  if (!running.length) return page("No watch is running in this browser", "Start one in the app first (ask Sisu to watch a price and tap Approve), in this same browser.", 404);
  for (const watch of running) {
    const result = simulatePriceDrop(watch.customerId, watch.id);
    if (result.ok) return page("Simulated monitoring update", `Saved to the approved project. ${escape(result.notification.title)}. ${escape(result.notification.summary)}`);
  }
  return page("Nothing to drop", "Nothing being watched is over the limit, so there is no price to drop.", 409);
});
