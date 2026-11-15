import { receiveWebhook } from "@/lib/watch/receive";

export const runtime = "nodejs";
export const maxDuration = 60; // the check runs after the 2xx answer (after()), within this limit
export const dynamic = "force-dynamic";

// Context.dev's webhook for a project's monitors (lib/watch/webhook.ts, lib/watch/receive.ts). Not wrapped in
// withVisitor: the visitor is the one named by the encrypted `ref`, never a header or cookie. The signature is
// checked on the raw body, so the body is read as text before anything parses it.
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 256_000) return Response.json({ error: "Too large." }, { status: 413 });
  const { status, body } = await receiveWebhook({
    ref: new URL(request.url).searchParams.get("ref"),
    signature: request.headers.get("x-context-signature"),
    deliveryId: request.headers.get("x-context-id"),
    event: request.headers.get("x-context-event"),
    rawBody,
  });
  return Response.json(body, { status });
}
