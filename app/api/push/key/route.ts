import { jsonError } from "@/lib/agent/http";
import { vapidKeys } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The VAPID public key a phone needs to subscribe (PushManager.subscribe applicationServerKey). Public by design.
// 503 when VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set on this server.
export function GET() {
  const keys = vapidKeys();
  if (!keys) return jsonError("Notifications aren't set up on this server.", 503);
  return Response.json({ publicKey: keys.publicKey }, { headers: { "Cache-Control": "no-store" } });
}
