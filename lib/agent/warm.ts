// The first call to each outside service is slow (new connection, about 0.3 to 0.6 s extra).
// Warming them once, when the app opens, moves that cost away from the user's first question.
import { DEMO_CUSTOMERS } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import { getConfig } from "./config";
import { primeModel } from "./model";
import { getMemory } from "@/lib/memory";
import { buildSystemPrompt } from "./prompt";
import { TOOL_SCHEMAS } from "./tools";
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

// Reads each demo customer's instructions into the model's cache. Cheap to repeat: a cached prompt returns in about 0.2 s.
export async function primeCustomers(): Promise<void> {
  if (getConfig().isMock) return;
  await Promise.all(
    DEMO_CUSTOMERS.flatMap((customer) => {
      const overview = buildOverview(customer.customerId);
      if (!overview) return [];
      // The rules and the customer's numbers come first in the prompt, so one primed copy serves both voice and typed turns.
      const system = buildSystemPrompt({ overview, city: customer.area, mode: "voice", memory: getMemory(customer.customerId) });
      return [primeModel([{ role: "system", content: system }, { role: "user", content: "Hello" }], TOOL_SCHEMAS)];
    }),
  );
}
