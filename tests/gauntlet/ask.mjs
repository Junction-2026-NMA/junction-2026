// Ask one question (or run an investigation) and print what happened, compactly.
// node tests/gauntlet/ask.mjs "question" [customer] [mode]   |   node tests/gauntlet/ask.mjs --investigate [customer]
import { CUSTOMERS, runTurn } from "./lib.mjs";
const investigate = process.argv[2] === "--investigate";
const customerId = CUSTOMERS[process.argv[3]] ?? process.argv[3] ?? CUSTOMERS.aino;
const turn = await runTurn({ customerId, text: investigate ? "" : process.argv[2], mode: process.argv[4] ?? "text" }, { path: investigate ? "/api/agent/investigate" : "/api/agent/query" });
if (turn.error) console.log("ERROR:", turn.error);
for (const tool of turn.tools) console.log(`tool ${tool.name} ${JSON.stringify(tool.args)} -> ${tool.ok ? "ok" : "FAILED"} ${tool.tookMs}ms · ${tool.summary}`);
for (const stage of turn.stages) console.log(`stage ${stage.kind} @${stage.atMs}ms · ${stage.title} · ${stage.summary}`);
for (const event of turn.events.filter((e) => e.type === "visual")) console.log(`visual ${event.visual.kind} · ${event.visual.title}`);
if (turn.action) console.log(`action ${turn.action.status} · ${turn.action.title} · ${turn.action.summary}`);
const grounding = turn.events.find((e) => e.type === "grounding");
console.log(`\nANSWER: ${turn.text}\n`);
if (grounding) console.log(`grounding ok=${grounding.grounding.ok} checked=${grounding.grounding.checked} unverified=${JSON.stringify(grounding.grounding.unverified)} · ${grounding.grounding.numbers.map((n) => `${n.value}:${n.status}`).join(" ")}`);
if (turn.timings) console.log(`timings firstToken=${turn.timings.firstTokenMs} firstSentence=${turn.timings.firstSentenceMs} total=${turn.timings.totalMs} steps=${turn.timings.modelSteps.map((s) => `${s.provider}${s.usedBackup ? "(backup)" : ""}:${s.firstTokenMs}/${s.totalMs}`).join(",")} citations=${turn.citations.length}`);
