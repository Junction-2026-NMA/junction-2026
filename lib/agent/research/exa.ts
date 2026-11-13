import { getConfig, missingKey } from "../config";

export type ExaResult = { title: string; url: string; highlights: string[] };

const EXA_TIMEOUT_MS = 4_000;

type ExaResponse = { results?: { title?: string; url?: string; highlights?: string[] }[] };

// Exa "lite" search: about 0.2 s without page contents, about 0.5 s with highlights.
export async function exaSearch(
  query: string,
  options: { numResults: number; highlights: boolean; signal?: AbortSignal },
): Promise<ExaResult[]> {
  const { exa } = getConfig();
  if (!exa.apiKey) throw missingKey("Exa search", "EXA_API_KEY");

  const timeout = AbortSignal.timeout(EXA_TIMEOUT_MS);
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    headers: { "x-api-key": exa.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      type: exa.searchType,
      numResults: options.numResults,
      ...(options.highlights ? { contents: { highlights: true } } : {}),
    }),
  });
  if (!response.ok) {
    console.error(`[agent] Exa returned ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
    throw new Error(`Exa search failed (${response.status}).`);
  }
  const body = (await response.json()) as ExaResponse;
  return (body.results ?? [])
    .filter((r): r is { title?: string; url: string; highlights?: string[] } => typeof r.url === "string")
    .map((r) => ({ title: r.title ?? r.url, url: r.url, highlights: r.highlights ?? [] }));
}
