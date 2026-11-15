import { pushConfigured } from "@/lib/watch/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The server's public VAPID key, which a browser needs to subscribe to phone notifications. Null when push is not
// set up on this server: the app then shows notifications inside the app only.
export function GET() {
  const publicKey = pushConfigured() ? (process.env.VAPID_PUBLIC_KEY?.trim() ?? null) : null;
  return Response.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
}
