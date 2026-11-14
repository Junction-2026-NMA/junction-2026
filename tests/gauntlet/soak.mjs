// Unexpected "judge at the booth" questions, for reading by a person. It checks only the mechanical things
// (no error, every number sourced, a sensible length for voice) and prints each answer so the wording can be judged.
// Usage: node tests/gauntlet/soak.mjs [--json path]
import { writeFileSync } from "node:fs";
import { CUSTOMERS, getJson, runTurn } from "./lib.mjs";

const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const Q = [
  ["aino", "voice", "How much money do I have?"],
  ["aino", "voice", "What's my biggest expense?"],
  ["aino", "voice", "Am I saving enough?"],
  ["eetu", "voice", "How do I compare to other people my age?"],
  ["aino", "voice", "Why did my balance go negative?"],
  ["aino", "voice", "What can I cut back on?"],
  ["sanna", "voice", "How long until I have fifty thousand euros?"],
  ["eetu", "voice", "Is my electricity bill normal?"],
  ["aino", "voice", "When do I get paid?"],
  ["aino", "voice", "How much do I spend on food per day?"],
  ["sanna", "text", "What should I do with all the cash sitting in my account?"],
  ["aino", "text", "Should I get a credit card?"],
  ["aino", "text", "Can you cancel my Netflix subscription?"],
  ["eetu", "text", "What happens if I lose my job?"],
  ["aino", "text", "Help me budget for a 600 euro trip to Lapland in February."],
  ["aino", "text", "What is a good emergency fund for me?"],
  ["eetu", "text", "Explain inflation to me like I'm twelve."],
  ["aino", "voice", "Tell me a joke."],
  ["aino", "voice", "What's two plus two?"],
  ["sanna", "text", "Am I ready to buy an apartment?"],
  ["aino", "text", "How much rent do I pay, and is that a lot?"],
  ["eetu", "text", "I spent a lot on entertainment. What exactly did I spend it on?"],
  ["aino", "text", "Mikä on suurin menoni?"],
  ["aino", "voice", "Transfer 200 euros to my friend Mikko right now."],
  ["eetu", "text", "What's the cheapest way to heat my flat this winter?"],
  ["aino", "text", "Give me three concrete things to do this month, with numbers."],
];

await getJson("/api/demo/reset", { method: "POST", body: {} });
const results = [];
for (const [who, mode, text] of Q) {
  const turn = await runTurn({ customerId: CUSTOMERS[who], text, mode });
  const grounding = turn.events.find((e) => e.type === "grounding")?.grounding;
  const flags = [turn.error ? `ERROR ${turn.error}` : null, grounding && !grounding.ok ? `UNSOURCED ${grounding.unverified.join(",")}` : null, mode === "voice" && turn.sentences.length > 3 ? `LONG ${turn.sentences.length} sentences` : null, turn.usedBackup ? "backup" : null].filter(Boolean);
  results.push({ who, mode, text, answer: turn.text, tools: turn.tools.map((t) => `${t.name}${t.ok ? "" : "(failed)"}`), totalMs: turn.timings?.totalMs ?? null, flags, action: turn.action?.status ?? null });
  console.log(`\n[${who}/${mode}] ${text}\n  tools: ${results.at(-1).tools.join(", ") || "none"} · ${results.at(-1).totalMs} ms${flags.length ? ` · FLAGS: ${flags.join("; ")}` : ""}\n  ${turn.text}`);
}
const executed = (await Promise.all(Object.values(CUSTOMERS).map((id) => getJson(`/api/actions?customerId=${id}`)))).flatMap((r) => r.body.actions).filter((a) => a.status === "executed_simulated").length;
console.log(`\n${results.length} questions · ${results.filter((r) => r.flags.some((f) => f.startsWith("ERROR"))).length} errors · ${results.filter((r) => r.flags.some((f) => f.startsWith("UNSOURCED"))).length} with an unsourced number · ${executed} actions executed without approval`);
await getJson("/api/demo/reset", { method: "POST", body: {} });
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
