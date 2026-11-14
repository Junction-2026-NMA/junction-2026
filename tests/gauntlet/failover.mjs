// Provider failover, live. Run against a server whose main model address is deliberately broken, so every model
// step must be answered by the backup. Two variants (see docs/GAUNTLET_RESULTS.md for how to start them):
//   refused: VERDA_BASE_URL points at a closed port  -> the switch is immediate
//   stall:   VERDA_BASE_URL points at an address that never answers -> the switch happens at the stall limit
// Usage: SISU_BASE=http://localhost:3312 node tests/gauntlet/failover.mjs <label> [--json path]
import { writeFileSync } from "node:fs";
import { BASE, CUSTOMERS, getJson, runTurn, summarise, table } from "./lib.mjs";

const label = process.argv[2] ?? "refused";
const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const QUESTIONS = ["How much can I safely spend this week?", "How much did I spend on groceries in August 2026?", "How much do I earn a month?", "What if I save fifty euros a month for five years?", "How much do I pay for electricity each month?", "How much did I spend on taxis this year?"];

const health = (await getJson("/api/health")).body;
console.log(`Server ${BASE} · main model ${health.model.provider} reachable: ${health.model.reachable} · backup ${health.backup?.provider}`);

const turns = [];
for (const text of QUESTIONS) {
  const turn = await runTurn({ customerId: CUSTOMERS.aino, text, mode: "voice" });
  turns.push({ text, error: turn.error, answer: turn.text, usedBackup: turn.usedBackup, steps: turn.timings?.modelSteps ?? [], firstSentenceMs: turn.timings?.firstSentenceMs ?? null, totalMs: turn.timings?.totalMs ?? null, grounded: turn.events.find((e) => e.type === "grounding")?.grounding.ok ?? null });
  process.stdout.write(turn.error ? "x" : turn.usedBackup ? "b" : ".");
}

const ok = turns.filter((t) => !t.error);
const steps = ok.flatMap((t) => t.steps);
const result = {
  label,
  base: BASE,
  at: new Date().toISOString(),
  mainReachable: health.model.reachable,
  turns: turns.length,
  answered: ok.length,
  answeredByBackup: ok.filter((t) => t.usedBackup).length,
  everyStepOnBackup: steps.length > 0 && steps.every((s) => s.usedBackup && s.provider === health.backup?.provider),
  grounded: ok.filter((t) => t.grounded).length,
  firstSentence: summarise(ok.map((t) => t.firstSentenceMs)),
  total: summarise(ok.map((t) => t.totalMs)),
  backupStepFirstToken: summarise(steps.map((s) => s.firstTokenMs)),
  details: turns,
};
console.log(`\n\n${table([["Check", "Result"], ["---", "---"], ["Main model reachable", String(result.mainReachable)], ["Turns answered", `${result.answered} of ${result.turns}`], ["Answered by the backup", `${result.answeredByBackup} of ${result.answered}`], ["Every model step served by the backup", String(result.everyStepOnBackup)], ["Answers with all numbers sourced", `${result.grounded} of ${result.answered}`], ["First sentence, p50 / p95 ms", `${result.firstSentence.p50} / ${result.firstSentence.p95}`], ["Whole turn, p50 / p95 ms", `${result.total.p50} / ${result.total.p95}`], ["Backup's own first token, p50 / p95 ms", `${result.backupStepFirstToken.p50} / ${result.backupStepFirstToken.p95}`]])}`);
if (jsonPath) writeFileSync(jsonPath, JSON.stringify(result, null, 2));
process.exitCode = result.answered === result.turns && result.everyStepOnBackup ? 0 : 1;
