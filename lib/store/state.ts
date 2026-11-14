// Sisu's small persistent state: remembered preferences, prepared actions and the audit log.
// One JSON file, written atomically. Reads and writes are synchronous, so within one server process an
// update can never interleave with another (no lost writes under concurrent requests).
// On a read-only host (for example a serverless function) it falls back to memory and says so in /api/health.
// The build plan names Postgres for this; the three functions below are the whole surface to swap.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AgentAction, AuditEvent, CustomerMemory } from "@/lib/types";

export type SisuState = {
  version: 1;
  memory: Record<string, CustomerMemory>;
  actions: AgentAction[];
  audit: AuditEvent[];
};

const EMPTY: SisuState = { version: 1, memory: {}, actions: [], audit: [] };
const DEFAULT_FILE = ".sisu/state.json";

type Holder = { state: SisuState | null; file: string | null; persistent: boolean };
const globalStore = globalThis as unknown as { __sisuState?: Holder };
const holder: Holder = (globalStore.__sisuState ??= { state: null, file: null, persistent: true });

// The path is only known at run time, so the bundler is told not to trace it.
const statePath = (): string => resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.SISU_STATE_FILE?.trim() || DEFAULT_FILE);

function isState(value: unknown): value is SisuState {
  const candidate = value as SisuState | null;
  return !!candidate && candidate.version === 1 && typeof candidate.memory === "object" && Array.isArray(candidate.actions) && Array.isArray(candidate.audit);
}

function load(): SisuState {
  const file = statePath();
  if (holder.state && holder.file === file) return holder.state;
  holder.file = file;
  holder.persistent = true;
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    holder.state = isState(parsed) ? parsed : EMPTY;
    if (!isState(parsed)) console.error("[store] state file had an unexpected shape; starting empty");
  } catch (error) {
    // A missing file is the normal first run. Anything else is worth a log line.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[store] could not read state; starting empty:", (error as Error).message);
    holder.state = EMPTY;
  }
  return holder.state;
}

function save(state: SisuState): void {
  const file = statePath();
  try {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2));
    renameSync(temporary, file); // atomic on one filesystem: readers see the old file or the new one, never half
    holder.persistent = true;
  } catch (error) {
    if (holder.persistent) console.error("[store] cannot write state to disk; keeping it in memory only:", (error as Error).message);
    holder.persistent = false;
  }
}

export function readState(): SisuState {
  return load();
}

// Applies a change and saves it. `change` must return a new object, never edit the one it was given.
export function updateState(change: (state: SisuState) => SisuState): SisuState {
  const next = change(load());
  holder.state = next;
  save(next);
  return next;
}

export function storeInfo(): { persistent: boolean; path: string | null } {
  load();
  return { persistent: holder.persistent, path: holder.persistent ? process.env.SISU_STATE_FILE?.trim() || DEFAULT_FILE : null };
}
