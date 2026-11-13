import { getConfig } from "@/lib/agent/config";
import { warmUp } from "@/lib/agent/warm";

export const runtime = "nodejs";

// The frontend calls this once when the app opens. It opens connections to the model and voice services
// and reports whether the server is in mock mode, so the UI can show a "mock data" label.
export async function GET() {
  const started = Date.now();
  await warmUp();
  const config = getConfig();
  return Response.json({ ok: true, provider: config.provider, mock: config.isMock, model: config.model.name, backup: config.fallbackModel?.provider ?? null, tookMs: Date.now() - started });
}
