// Live offer research: Exa finds the pages, Context.dev reads them in parallel.
// One run per bill type and city is shared by every caller ("single flight"), so speculation,
// the UI's prefetch and the model's tool call can never start duplicate work.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BillType } from "@/lib/types";
import { getConfig } from "../config";
import { mockRawOffers } from "../mock";
import { safeTitle } from "../tools/untrusted";
import { extractOffers } from "./contextdev";
import { exaSearch } from "./exa";
import type { RawResearch } from "./types";

const FRESH_MS = 10 * 60_000; // younger than this: use as is
const STALE_OK_MS = 60 * 60_000; // up to this old: still answer from it at once, and refresh behind the scenes
const PAGES_TO_READ = 3;
const POLL_MS = 50;
const MOCK_DELAY_MS = 900;

const QUERY: Record<BillType, (city: string) => string> = {
  electricity: (city) => `cheapest electricity contract ${city} Finland price comparison`,
  mobile: () => "mobile phone subscription prices Finland comparison",
  internet: (city) => `home broadband prices ${city} Finland comparison`,
};

// Known comparison pages, read only if Exa is down. They are still fetched live.
const FALLBACK_PAGES: Partial<Record<BillType, string[]>> = {
  electricity: [
    "https://www.sopimusvahti.fi/en/sahkosopimus/helsinki",
    "https://oomi.fi/sahko/sahkosopimukset/helsinki/",
    "https://vertaa-kilpailuttajat.fi/halvin-sahkosopimus-helsinki/",
  ],
};

type Entry = { snapshot: RawResearch; lastChangeAt: number };

// Kept on globalThis so the dev server's hot reload does not drop runs that are in flight.
const globalStore = globalThis as unknown as { __sisuResearch?: Map<string, Entry> };
const store: Map<string, Entry> = (globalStore.__sisuResearch ??= new Map());

// Finished live results are also kept on disk, so a server restart does not throw away research that is still
// good. A restored result is served with its real retrieval time and refreshed behind the scenes like any other.
const researchFile = (): string => resolve(/*turbopackIgnore: true*/ process.cwd(), `${process.env.SISU_STATE_FILE?.trim() || ".sisu/state.json"}.research.json`);
const loadedFrom = globalThis as unknown as { __sisuResearchFile?: string };

function restoreSaved(): void {
  const file = researchFile();
  if (loadedFrom.__sisuResearchFile === file) return;
  loadedFrom.__sisuResearchFile = file;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8")) as Record<string, RawResearch>;
    for (const [key, snapshot] of Object.entries(saved)) {
      const fresh = snapshot?.status === "done" && typeof snapshot.finishedAt === "number" && Date.now() - snapshot.finishedAt < STALE_OK_MS;
      if (fresh && !store.has(key)) store.set(key, { snapshot, lastChangeAt: snapshot.finishedAt as number });
    }
  } catch {
    // no saved research yet: the first search will create it
  }
}

function saveFinished(): void {
  const live = Object.fromEntries([...store.entries()].filter(([, entry]) => entry.snapshot.status === "done" && !entry.snapshot.mock).map(([key, entry]) => [key, entry.snapshot]));
  try {
    const file = researchFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify(live));
    renameSync(`${file}.tmp`, file);
  } catch (error) {
    console.error("[agent] could not save research to disk:", (error as Error).message);
  }
}

const keyOf = (billType: BillType, city: string) => `${billType}:${city.toLowerCase()}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function update(entry: Entry, change: Partial<RawResearch>): void {
  entry.snapshot = { ...entry.snapshot, ...change };
  entry.lastChangeAt = Date.now();
}

function distinctHosts(urls: string[], limit: number): string[] {
  const hosts = new Set<string>();
  return urls.filter((url) => {
    const host = new URL(url).hostname;
    if (hosts.has(host) || hosts.size >= limit) return false;
    hosts.add(host);
    return true;
  });
}

async function findPages(entry: Entry): Promise<{ url: string; title: string }[]> {
  try {
    const results = await exaSearch(entry.snapshot.query, { numResults: 8, highlights: false });
    const urls = distinctHosts(results.map((r) => r.url), PAGES_TO_READ);
    if (urls.length) return urls.map((url) => ({ url, title: results.find((r) => r.url === url)?.title ?? url }));
    update(entry, { errors: [...entry.snapshot.errors, "Exa returned no pages for this search."] });
  } catch (error) {
    update(entry, { errors: [...entry.snapshot.errors, (error as Error).message] });
  }
  return (FALLBACK_PAGES[entry.snapshot.billType] ?? []).map((url) => ({ url, title: new URL(url).hostname }));
}

async function run(entry: Entry): Promise<void> {
  if (entry.snapshot.mock) {
    await sleep(MOCK_DELAY_MS);
    update(entry, {
      status: "done",
      finishedAt: Date.now(),
      pagesDone: 1,
      pagesTotal: 1,
      offers: mockRawOffers(entry.snapshot.billType),
      citations: [{ title: "Mock offers (example data)", url: "https://example.com/mock-offers", retrievedAt: new Date().toISOString(), cacheAgeMs: null }],
    });
    return;
  }

  const pages = await findPages(entry);
  update(entry, { pagesTotal: pages.length });

  await Promise.all(
    pages.map(async (page) => {
      try {
        const extraction = await extractOffers(page.url, entry.snapshot.billType);
        update(entry, {
          status: "partial",
          pagesDone: entry.snapshot.pagesDone + 1,
          offers: [...entry.snapshot.offers, ...extraction.offers],
          citations: [...entry.snapshot.citations, { title: safeTitle(page.title, new URL(page.url).hostname), url: page.url, retrievedAt: new Date().toISOString(), cacheAgeMs: extraction.cacheAgeMs }],
          errors: extraction.dropped ? [...entry.snapshot.errors, `${new URL(page.url).hostname}: ${extraction.dropped} offer(s) left out because their text did not read like a provider or plan name`] : entry.snapshot.errors,
        });
      } catch (error) {
        const reason = (error as Error).name === "TimeoutError" ? "took too long to read" : (error as Error).message;
        update(entry, {
          pagesDone: entry.snapshot.pagesDone + 1,
          errors: [...entry.snapshot.errors, `${new URL(page.url).hostname}: ${reason}`],
        });
      }
    }),
  );
  update(entry, { status: entry.snapshot.offers.length ? "done" : "failed", finishedAt: Date.now() });
}

// Runs the research and, when it finishes with offers, keeps a copy on disk.
async function runAndKeep(entry: Entry): Promise<void> {
  await run(entry);
  if (entry.snapshot.status === "done" && !entry.snapshot.mock && store.get(entry.snapshot.key) === entry) saveFinished();
}

function newEntry(billType: BillType, city: string): Entry {
  return {
    lastChangeAt: Date.now(),
    snapshot: {
      key: keyOf(billType, city),
      billType,
      city,
      status: "running",
      mock: getConfig().isMock,
      query: QUERY[billType](city),
      startedAt: Date.now(),
      finishedAt: null,
      pagesDone: 0,
      pagesTotal: 0,
      offers: [],
      citations: [],
      errors: [],
    },
  };
}

const refreshing: Set<string> = ((globalThis as unknown as { __sisuRefreshing?: Set<string> }).__sisuRefreshing ??= new Set());

// Fetches a fresh copy without disturbing the one being served. It replaces the old result only if it succeeds.
function refreshBehindTheScenes(billType: BillType, city: string): void {
  const key = keyOf(billType, city);
  if (refreshing.has(key)) return;
  refreshing.add(key);
  const entry = newEntry(billType, city);
  run(entry)
    .then(() => {
      if (entry.snapshot.status !== "done") return;
      store.set(key, entry);
      saveFinished();
    })
    .catch((error) => console.error("[agent] background refresh failed", error))
    .finally(() => refreshing.delete(key));
}

// Starts research, or joins the run already in flight (or a recent finished one). Never blocks.
// A result up to an hour old is still served at once, with its real retrieval time, while a fresh
// copy is fetched behind the scenes. That keeps the slow step out of the conversation.
export function ensureResearch(billType: BillType, city: string): { key: string; reused: boolean } {
  restoreSaved();
  const key = keyOf(billType, city);
  const existing = store.get(key);
  if (existing) {
    const { status, finishedAt } = existing.snapshot;
    if (status === "running" || status === "partial") return { key, reused: true };
    const age = status === "done" && finishedAt !== null ? Date.now() - finishedAt : Infinity;
    if (age < FRESH_MS) return { key, reused: true };
    if (age < STALE_OK_MS) {
      refreshBehindTheScenes(billType, city);
      return { key, reused: true };
    }
  }

  const entry = newEntry(billType, city);
  store.set(key, entry);
  runAndKeep(entry).catch((error) => {
    console.error("[agent] research run failed", error);
    update(entry, { status: "failed", finishedAt: Date.now(), errors: [...entry.snapshot.errors, "Research stopped unexpectedly."] });
  });
  return { key, reused: false };
}

export function peekResearch(key: string): RawResearch | null {
  restoreSaved();
  return store.get(key)?.snapshot ?? null;
}

// Usable means every page has been read (or failed). Answering from the first page alone gave unstable
// results: with one page the "typical price" shifts and the best offer or the saving can come out differently.
// Waiting costs a few seconds only on a cold search, which the background refresh makes rare.
function isUsable(entry: Entry): boolean {
  const { status } = entry.snapshot;
  return status === "done" || status === "failed";
}

// True when a tool call for this research would return straight away, so no filler line is needed.
export function isResearchReady(key: string): boolean {
  const entry = store.get(key);
  return !!entry && isUsable(entry);
}

// Waits until the research is usable (see context/orchestration.md, rule 5) or the hard limit passes,
// then returns whatever is there. Later pages still land in the store.
export async function waitForUsable(key: string, hardLimitMs: number, signal?: AbortSignal): Promise<RawResearch | null> {
  const deadline = Date.now() + hardLimitMs;
  while (Date.now() < deadline && !signal?.aborted) {
    const entry = store.get(key);
    if (!entry) return null;
    if (isUsable(entry)) return entry.snapshot;
    await sleep(POLL_MS);
  }
  return store.get(key)?.snapshot ?? null;
}
