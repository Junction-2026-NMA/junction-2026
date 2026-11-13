// Live offer research: Exa finds the pages, Context.dev reads them in parallel.
// One run per bill type and city is shared by every caller ("single flight"), so speculation,
// the UI's prefetch and the model's tool call can never start duplicate work.
import type { BillType } from "@/lib/types";
import { getConfig } from "../config";
import { mockRawOffers } from "../mock";
import { comparableCount } from "./compare";
import { extractOffers } from "./contextdev";
import { exaSearch } from "./exa";
import type { RawResearch } from "./types";

const RESULT_TTL_MS = 10 * 60_000;
const PAGES_TO_READ = 3;
const POLL_MS = 50;
const QUIET_MS = 600; // once usable, how long to wait for one more page before answering
const MIN_COMPARABLE = 2;
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

const keyOf = (billType: BillType, city: string) => `${billType}:${city.toLowerCase()}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isReusable(entry: Entry): boolean {
  const { status, finishedAt } = entry.snapshot;
  if (status === "running" || status === "partial") return true;
  return status === "done" && finishedAt !== null && Date.now() - finishedAt < RESULT_TTL_MS;
}

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
          citations: [...entry.snapshot.citations, { title: page.title, url: page.url, retrievedAt: new Date().toISOString(), cacheAgeMs: extraction.cacheAgeMs }],
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

// Starts research, or joins the run already in flight (or a recent finished one). Never blocks.
export function ensureResearch(billType: BillType, city: string): { key: string; reused: boolean } {
  const key = keyOf(billType, city);
  const existing = store.get(key);
  if (existing && isReusable(existing)) return { key, reused: true };

  const entry: Entry = {
    lastChangeAt: Date.now(),
    snapshot: {
      key,
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
  store.set(key, entry);
  run(entry).catch((error) => {
    console.error("[agent] research run failed", error);
    update(entry, { status: "failed", finishedAt: Date.now(), errors: [...entry.snapshot.errors, "Research stopped unexpectedly."] });
  });
  return { key, reused: false };
}

export function peekResearch(key: string): RawResearch | null {
  return store.get(key)?.snapshot ?? null;
}

function isUsable(entry: Entry): boolean {
  const { status } = entry.snapshot;
  if (status === "done" || status === "failed") return true;
  return comparableCount(entry.snapshot) >= MIN_COMPARABLE && Date.now() - entry.lastChangeAt >= QUIET_MS;
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
