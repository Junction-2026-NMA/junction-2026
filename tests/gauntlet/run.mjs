// The whole gauntlet, in order. `npm run gauntlet` runs the deterministic tests and then every live script
// against a running server (default http://localhost:3310; set SISU_BASE). `npm run gauntlet -- --quick` stops
// after the deterministic tests, which need no server, keys or network.
// The live part costs about 150 model turns, 10 searches and 3 page reads. It never calls text to speech:
// run tests/gauntlet/voice.mjs by hand for that (it spends about 300 characters of ElevenLabs credit).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { BASE } from "./lib.mjs";

const quick = process.argv.includes("--quick");
const results = "tests/gauntlet/results";
const steps = [
  { name: "Deterministic tests (no network)", command: "npm", args: ["test"], live: false },
  { name: "Live evaluation: 54 checks against the real model", command: "node", args: ["tests/gauntlet/eval.mjs", "--json", `${results}/eval-latest.json`], live: true },
  { name: "Latency: p50 and p95 per question type", command: "node", args: ["tests/gauntlet/latency.mjs", "10", "--json", `${results}/latency-latest.json`], live: true },
  { name: "Stage timings: model, Exa, Context.dev, finance", command: "node", args: ["tests/gauntlet/stages.mjs", "--json", `${results}/stages-latest.json`], live: true },
  { name: "Bill photo: vision on our own GPU", command: "node", args: ["tests/gauntlet/vision.mjs", "--json", `${results}/vision-latest.json`], live: true },
];

const serverUp = quick ? false : await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
if (!quick && !serverUp) console.log(`No server at ${BASE}: running the deterministic tests only. Start one with "npm run dev -- --port 3310".\n`);

const summary = [];
for (const step of steps) {
  if (step.live && !serverUp) {
    summary.push({ name: step.name, status: "skipped" });
    continue;
  }
  console.log(`\n=== ${step.name}`);
  const started = Date.now();
  const run = spawnSync(step.command, step.args, { stdio: "inherit" });
  summary.push({ name: step.name, status: run.status === 0 ? "passed" : "FAILED", seconds: Math.round((Date.now() - started) / 1000) });
}

console.log("\n=== Gauntlet summary");
for (const step of summary) console.log(`${step.status.padEnd(8)} ${step.name}${step.seconds === undefined ? "" : ` (${step.seconds} s)`}`);
writeFileSync(`${results}/summary-latest.json`, JSON.stringify({ at: new Date().toISOString(), base: BASE, steps: summary }, null, 2));
process.exitCode = summary.some((step) => step.status === "FAILED") ? 1 : 0;
