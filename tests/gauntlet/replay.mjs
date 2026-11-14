// Replays a real conversation, turn by turn with its history, and prints what Sisu did and said.
// The script below is the conversation Nicholas had on 14 Nov that exposed the agent refusing instead of acting.
// Usage: node tests/gauntlet/replay.mjs [--json path]
import { writeFileSync } from "node:fs";
import { CUSTOMERS, getJson, runTurn } from "./lib.mjs";

const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
// `want`: what a good turn must do. tools = at least one of these was called; say / never = checks on the answer.
const TURNS = [
  { text: "How much can I safely spend this week?", want: { say: /164/ } },
  { text: "Can you explain how you worked that out?", want: { say: /1,?783|756|757|315|316|711/ } },
  { text: "Uh, yes, please. But also, uh, are you able to make, uh, like saving transfers for me?", want: { never: /cannot carry|can only prepare/i } },
  { text: "Uh, can you invest my 1,000 that I got for Christmas?", want: { tools: ["prepare_action", "run_scenario"], never: /^I cannot give/i } },
  { text: "Okay, but it's important that you are able to give me advice on what I have to do with my money based on all of my data.", want: { say: /\d/, never: /I cannot give/i } }, // the summary or find_patterns are both fine, as long as it gives a concrete, sourced recommendation
  { text: "Would you show me how cutting restaurant spending back to what people my age spend would add up over time?", want: { tools: ["run_scenario"], args: (t) => t.name !== "run_scenario" || (Number(t.args.everydayCutPct ?? 0) === 0 && Number(t.args.freedPerMonthEur) > 50 && Number(t.args.freedPerMonthEur) < 80) } },
  { text: "Yeah, I mean, you're integrated in my S Bank app, right? So you basically have access to all my accounts. Would you be able to transfer some money from those accounts to maybe, um, being able to earn interest on that money?", want: { never: /I cannot move money|can only see the accounts/i } },
  { text: "Yes. So I will need to transfer 500 euros to my savings account.", want: { tools: ["prepare_action"], args: (t) => t.name !== "prepare_action" || (t.args.kind === "one_off_transfer" && t.args.amountEur === 500), action: true } },
  { text: "Can you explain how, um, the backend layer works, like what you're doing? Because I don't really understand each, uh, process. Like, after I ask a question, what is the process you go through?", want: { say: /Nemotron|Finland/i } },
  { text: "Um, other than this, can you also tell me, because I think I spend quite a lot of money, like, on, on water, you know? I use a lot of warm water in my showers. So how much could I save if I, like, cut my shower time by 3 minutes?", want: { tools: ["web_search"], never: /^I cannot see your water/i } },
  { text: "Um, can you, can you, can you compare my, my rental data with other, um, with other apartments around me?", want: { tools: ["web_search"], say: /66[12]/ } },
  { text: "Bro, what is this? But you should use Exa, and you should, uh, look at the internet now.", want: { never: /I cannot use/i } },
];

await getJson("/api/demo/reset", { method: "POST", body: {} });
await getJson("/api/research", { method: "POST", body: { customerId: CUSTOMERS.aino, billType: "electricity" } });
let history = [];
const results = [];
for (const [index, turn] of TURNS.entries()) {
  const run = await runTurn({ customerId: CUSTOMERS.aino, text: turn.text, mode: "voice", history });
  const grounding = run.events.find((e) => e.type === "grounding")?.grounding;
  const steps = run.events.filter((e) => e.type === "tool_start").map((e) => e.label);
  const called = run.tools.map((t) => t.name);
  const problems = [
    run.error ? `error: ${run.error}` : null,
    turn.want.tools && !turn.want.tools.some((name) => called.includes(name)) ? `called none of ${turn.want.tools.join(" / ")} (called ${called.join(", ") || "nothing"})` : null,
    turn.want.args && !run.tools.every(turn.want.args) ? `wrong arguments: ${JSON.stringify(run.tools.map((t) => [t.name, t.args]))}` : null,
    turn.want.say && !turn.want.say.test(run.text) ? `answer lacks ${turn.want.say}` : null,
    turn.want.never && turn.want.never.test(run.text) ? `answer contains ${turn.want.never}` : null,
    turn.want.action && !run.action ? "no action was set up" : null,
    grounding && !grounding.ok ? `unsourced numbers: ${grounding.unverified.join(", ")}` : null,
    run.tools.some((t) => !t.ok) ? `a tool failed: ${run.tools.filter((t) => !t.ok).map((t) => `${t.name}: ${t.summary}`).join("; ")}` : null,
  ].filter(Boolean);
  results.push({ text: turn.text, answer: run.text, steps, called, problems, totalMs: run.timings?.totalMs ?? null, action: run.action ? { title: run.action.title, warning: run.action.warning ?? null } : null });
  console.log(`\n${index + 1}. YOU: ${turn.text}\n${steps.map((s) => `   · ${s}`).join("\n")}${steps.length ? "\n" : ""}   SISU: ${run.text}${run.action ? `\n   ACTION: ${run.action.title}${run.action.warning ? ` — WARNING: ${run.action.warning}` : ""}` : ""}\n   ${run.timings?.totalMs} ms${problems.length ? ` · PROBLEMS: ${problems.join("; ")}` : " · ok"}`);
  history = [...history, { role: "user", content: turn.text }, { role: "assistant", content: run.text }].slice(-12);
}
console.log(`\n${results.filter((r) => !r.problems.length).length} of ${results.length} turns did what was asked.`);
await getJson("/api/demo/reset", { method: "POST", body: {} });
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exitCode = results.every((r) => !r.problems.length) ? 0 : 1;
