// Opening and closing a watch's Context.dev monitors: one page monitor per watched page, plus a search monitor for
// flats. Used when a watch starts, when it is paused (closed) and when it is resumed (opened again).
// Pausing deletes the monitors and resuming creates new ones: Context.dev's own pause call is not verified, and a
// deleted monitor costs nothing while the Project waits.
import { getConfig } from "@/lib/agent/config";
import { FLAT_PAGE_INSTRUCTIONS, PRICE_PAGE_INSTRUCTIONS, createPageMonitor, createSearchMonitor, deleteMonitor } from "@/lib/agent/research/monitors";
import type { PropertyWatch } from "@/lib/types";

export type Opened = { monitorIds: (string | null)[]; errors: (string | null)[]; searchMonitorId: string | null; problems: string[]; mode: PropertyWatch["mode"] };

export async function openMonitors(watch: Pick<PropertyWatch, "city" | "topic">, urls: string[]): Promise<Opened> {
  const mock = getConfig().isMock;
  const name = watch.topic ? `Sisu price watch: ${watch.topic}` : `Sisu flat watch: ${watch.city}`;
  const monitors = mock ? [] : await Promise.allSettled(urls.map((url) => createPageMonitor(url, name, watch.topic ? PRICE_PAGE_INSTRUCTIONS : FLAT_PAGE_INSTRUCTIONS)));
  // Listings that appear on other sites are looked for by a search monitor. Flats only: the pages it finds are
  // read only if they are on a known rental site, and there is no such list for "anything with a price".
  const search = mock || !watch.city || watch.topic ? null : await createSearchMonitor(watch.city).catch((error: Error) => error);
  const monitorIds = urls.map((_, index) => (monitors[index]?.status === "fulfilled" ? (monitors[index] as PromiseFulfilledResult<{ id: string }>).value.id : null));
  const errors = urls.map((_, index) => (monitors[index]?.status === "rejected" ? ((monitors[index] as PromiseRejectedResult).reason as Error).message : null));
  const monitored = monitorIds.filter(Boolean).length;
  return {
    monitorIds,
    errors,
    searchMonitorId: search && !(search instanceof Error) ? search.id : null,
    mode: monitored > 0 ? "monitor" : "reread",
    problems: [
      ...(mock ? ["Example data: no key is set, so nothing is being watched on the web."] : []),
      ...(!mock && monitored < urls.length ? [`Context.dev could not start a monitor for ${urls.length - monitored} of ${urls.length} pages; those are re-read on a timer instead, at most every 30 minutes and only when Sisu checks.`] : []),
      ...(search instanceof Error ? [`No search monitor for new listings (${search.message})`] : []),
    ],
  };
}

export const monitorIdsOf = (watch: PropertyWatch): string[] => [...watch.pages.flatMap((page) => (page.monitorId ? [page.monitorId] : [])), ...(watch.searchMonitorId ? [watch.searchMonitorId] : [])];

// Deletes every monitor of the watch. Answers how many were removed and how many could not be.
export async function closeMonitors(watch: PropertyWatch): Promise<{ removed: number; failed: number }> {
  const ids = monitorIdsOf(watch);
  const results = await Promise.allSettled(ids.map((id) => deleteMonitor(id)));
  const failed = results.filter((result) => result.status === "rejected").length;
  return { removed: ids.length - failed, failed };
}
