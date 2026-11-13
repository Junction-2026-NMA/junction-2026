// The first call to each outside service is slow (new connection, about 0.3 to 0.6 s extra).
// Warming them once, when the app opens, moves that cost away from the user's first question.
import { getConfig } from "./config";
import { synthesize } from "./speech";

const FILLERS = ["Let me check today's electricity deals in Helsinki.", "Let me check today's electricity deals in Espoo.", "Let me check today's mobile plans."];

const globalStore = globalThis as unknown as { __sisuWarm?: Promise<void> };

async function warm(): Promise<void> {
  const config = getConfig();
  if (config.isMock) return;
  const quiet = (label: string) => (error: unknown) => console.error(`[agent] warm-up of ${label} failed`, (error as Error).message);

  await Promise.all([
    // Opens the connection to the model host. Listing models costs nothing.
    fetch(`${config.model.baseUrl}/models`, { headers: { Authorization: `Bearer ${config.model.apiKey}` }, signal: AbortSignal.timeout(5_000) })
      .then((response) => response.arrayBuffer())
      .catch(quiet("the model")),
    // Pre-generates the filler lines, so they play from the cache with no delay at all.
    ...FILLERS.map((text) =>
      synthesize(text)
        .then((speech) => new Response(speech.body).arrayBuffer())
        .catch(quiet("speech")),
    ),
  ]).then(() => undefined);
}

// Safe to call on every request: the work happens once per server process.
export function warmUp(): Promise<void> {
  return (globalStore.__sisuWarm ??= warm());
}
