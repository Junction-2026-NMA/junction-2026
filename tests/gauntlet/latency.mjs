// Latency benchmark against a running server: p50 and p95 per kind of question.
// No text to speech here (voice credit is scarce); see voice.mjs for the bounded voice check.
// Usage: node tests/gauntlet/latency.mjs [runsPerScenario] [--json path]
import { writeFileSync } from "node:fs";
import { BASE, CUSTOMERS, getJson, runTurn, summarise, table } from "./lib.mjs";

const RUNS = Number(process.argv[2] ?? 8);
const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

const SCENARIOS = [
  { id: "summary", label: "Answer from the summary (no tool)", mode: "voice", questions: ["How much can I safely spend this week?", "How much do I spend on restaurants in an average month?", "How much do I earn a month?", "How much do I pay for electricity each month?"] },
  { id: "last-month", label: "Last month or payday (in the summary since the latency work)", mode: "voice", questions: ["How much did I spend on restaurants last month?", "Will I make it to payday?", "What did I spend in total last month?", "How many days until payday?"] },
  { id: "finance-tool", label: "One finance tool", mode: "voice", questions: ["How much did I spend on restaurants in June 2026?", "How much did I spend on groceries in August 2026?", "How much did I spend on taxis this year?", "Which month this year was my most expensive for groceries?"] },
  { id: "scenario", label: "Scenario simulation", mode: "voice", questions: ["What if I save fifty euros a month for five years?", "What happens if I cut everyday spending by 10 percent for 3 years?"] },
  { id: "offers-warm", label: "Offer research, already warm", mode: "voice", questions: ["Can you find me a cheaper electricity deal?", "Is there a cheaper electricity contract for me?"] },
  { id: "web", label: "Outside fact (Exa web search)", mode: "voice", questions: ["What is the general housing allowance from Kela?", "What is the current ECB deposit rate?"] },
  { id: "text-summary", label: "Typed question, no tool", mode: "text", questions: ["How much can I safely spend this week?", "Am I spending more than people my age?"] },
];

const warm = await getJson("/api/agent/warm");
console.log(`Server ${BASE}: provider ${warm.body?.provider}, backup ${warm.body?.backup}, warm-up ${warm.body?.tookMs} ms, mock ${warm.body?.mock}`);

// Make sure electricity research is finished before the "warm" scenario runs, so it measures the warm path.
await getJson("/api/research", { method: "POST", body: { customerId: CUSTOMERS.aino, billType: "electricity" } });

const results = [];
for (const scenario of SCENARIOS) {
  const turns = [];
  for (let i = 0; i < RUNS; i++) {
    const text = scenario.questions[i % scenario.questions.length];
    const turn = await runTurn({ customerId: CUSTOMERS.aino, text, mode: scenario.mode });
    turns.push(turn);
    process.stdout.write(turn.error ? "x" : turn.usedBackup ? "b" : ".");
  }
  const ok = turns.filter((t) => !t.error && t.timings);
  results.push({
    id: scenario.id,
    label: scenario.label,
    runs: turns.length,
    errors: turns.length - ok.length,
    usedBackup: ok.filter((t) => t.usedBackup).length,
    tools: [...new Set(ok.flatMap((t) => t.tools.map((tool) => tool.name)))],
    firstToken: summarise(ok.map((t) => t.timings.firstTokenMs)),
    firstSentence: summarise(ok.map((t) => t.timings.firstSentenceMs)),
    firstSpeakableClient: summarise(ok.map((t) => t.clientMs.firstSpeakable)),
    total: summarise(ok.map((t) => t.timings.totalMs)),
    modelStepFirstToken: summarise(ok.flatMap((t) => t.timings.modelSteps.map((s) => s.firstTokenMs))),
    modelStepTotal: summarise(ok.flatMap((t) => t.timings.modelSteps.map((s) => s.totalMs))),
    toolMs: summarise(ok.flatMap((t) => t.tools.map((tool) => tool.tookMs))),
  });
}

const cell = (s) => (s.p50 === null ? "–" : `${s.p50} / ${s.p95}`);
console.log(`\n\nLatency, ${RUNS} runs per row, milliseconds as p50 / p95 (server clock unless noted)\n`);
console.log(
  table([
    ["Question type", "Tools", "First token", "First sentence", "First speakable (client)", "Total", "Errors", "Backup used"],
    ["---", "---", "---", "---", "---", "---", "---", "---"],
    ...results.map((r) => [r.label, r.tools.join(", ") || "none", cell(r.firstToken), cell(r.firstSentence), cell(r.firstSpeakableClient), cell(r.total), `${r.errors}/${r.runs}`, `${r.usedBackup}/${r.runs}`]),
  ]),
);
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ base: BASE, at: new Date().toISOString(), runs: RUNS, provider: warm.body?.provider, results }, null, 2));
