// Stage-by-stage timings from the server's own benchmark route: model (cold, warm, with and without tools),
// finance functions, Exa search and Context.dev extraction. Bounded: about 40 model calls, 8 searches, 3 page reads.
// Usage: node tests/gauntlet/stages.mjs [--json path]
import { writeFileSync } from "node:fs";
import { BASE, CUSTOMERS, getJson, summarise, table } from "./lib.mjs";

const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const bench = async (query) => (await getJson(`/api/dev/bench?${query}`)).body;
const cell = (values) => {
  const s = summarise(values);
  return s.p50 === null ? "–" : `${s.p50} / ${s.p95} (n=${s.n})`;
};

const finance = await bench("part=finance");
const model = await bench("part=model&runs=10");
const sizes = await bench("part=sizes&runs=10");
const search = await bench("part=search&runs=5");
// Read the same three pages the live research uses, so the numbers describe the real flow.
const research = (await getJson("/api/research", { method: "POST", body: { customerId: CUSTOMERS.aino, billType: "electricity" } })).body;
const urls = (research?.citations ?? []).map((c) => c.url).slice(0, 3);
const extract = urls.length ? await bench(`part=extract&urls=${encodeURIComponent(urls.join(","))}`) : { pages: [] };

console.log(`Server ${BASE} · ${model.model} on ${model.provider}\n`);
console.log(
  table([
    ["Stage", "p50 / p95 ms"],
    ["---", "---"],
    ["Model, first token, all 11 tools offered", cell(model.warm.map((s) => s.firstTokenMs))],
    ["Model, first token, same prompt with a unique first line (cache defeated)", cell(model.cold.map((s) => s.firstTokenMs))],
    ["Model, first token, no tools offered", cell(model.warmNoTools.map((s) => s.firstTokenMs))],
    ["Model, short answer complete (no tool)", cell(model.warm.map((s) => s.totalMs))],
    ["Model, tool choice complete (get_spending)", cell(model.toolChoice.map((s) => s.totalMs))],
    ...sizes.results.map((r) => [`Model, first token: ${r.label}`, cell(r.firstTokenMs)]),
    ["Exa search, 8 results, no page text", cell(search.exa.map((s) => s.ms))],
    ["Exa search, 4 results with highlights", cell(search.exaHighlights.map((s) => s.ms))],
    ...extract.pages.map((p) => [`Context.dev extraction: ${p.host}`, p.ok ? `${p.ms} (${p.offers} offers, provider cache age ${p.cacheAgeMs ?? "n/a"} ms)` : `failed after ${p.ms}: ${p.error}`]),
  ]),
);
console.log(`\nModel writing speed: ${model.long.charsPerSecond} characters a second (${model.long.chars} characters in ${model.long.totalMs - model.long.firstTokenMs} ms).`);
console.log(`Tool choice correct in ${model.toolChoice.filter((s) => s.toolCalls === 1).length} of ${model.toolChoice.length} runs. Backup used in ${[...model.warm, ...model.toolChoice].filter((s) => s.usedBackup).length} runs.`);
console.log(`Finance functions (ms per call): overview ${finance.buildOverview}, cash flow ${finance.buildCashFlow}, patterns ${finance.findPatterns}, scenario ${finance.runScenario}.`);
console.log(`Prompt size: ${finance.systemPromptChars} characters of instructions and customer summary, ${finance.toolSchemaChars} characters of tool definitions.`);
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ base: BASE, at: new Date().toISOString(), finance, model, sizes, search, extract }, null, 2));
