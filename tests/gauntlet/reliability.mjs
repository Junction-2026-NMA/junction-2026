// Things that go wrong at a booth, against a running server: two taps at once, a closed tab mid-plan, a reset
// while a plan runs, three customers at the same moment. Uses research already in memory (fresh: false), so one run
// costs three short model calls per plan and no page reads when the pages are warm.
// Run: SISU_BASE=http://localhost:3320 node tests/gauntlet/reliability.mjs [--json file]
import { writeFileSync } from "node:fs";
import { BASE, CUSTOMERS, nextVisitor, readEvents } from "./lib.mjs";

const jsonAt = process.argv.indexOf("--json");
const post = (path, body, signal) => fetch(`${BASE}${path}`, { method: "POST", signal, headers: { "Content-Type": "application/json", "x-forwarded-for": nextVisitor() }, body: JSON.stringify(body) });
const get = (path) => fetch(`${BASE}${path}`, { headers: { "x-forwarded-for": nextVisitor() } }).then((r) => r.json());
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waiting = (list) => list.actions.filter((a) => a.status === "awaiting_approval");

async function plan(customerId, { abortAfter = null } = {}) {
  const controller = new AbortController();
  const out = { plan: null, types: [], error: null, aborted: false };
  try {
    const response = await post("/api/agent/plan", { customerId, fresh: false }, controller.signal);
    if (!response.ok) return { ...out, error: `HTTP ${response.status}` };
    for await (const event of readEvents(response)) {
      out.types.push(event.type);
      if (event.type === "plan_done") out.plan = event.plan;
      if (event.type === "error") out.error = event.message;
      if (abortAfter && event.type === abortAfter) { controller.abort(); out.aborted = true; break; }
    }
  } catch (error) {
    if (!out.aborted) out.error = String(error.message ?? error);
  }
  return out;
}

const problems = [];
const results = {};
const check = (name, ok, detail) => { results[name] = ok ? "pass" : `FAIL: ${detail}`; if (!ok) problems.push(`${name}: ${detail}`); console.log(`${ok ? "pass" : "FAIL"}  ${name}${ok ? "" : `: ${detail}`}`); };
const { aino, eetu, sanna } = CUSTOMERS;

// Warm the research once, so every scenario below reads the same pages.
await post("/api/demo/reset", {});
const warm = await plan(eetu);
check("a plan completes", !!warm.plan && !warm.error, warm.error ?? "no plan_done");
await post("/api/demo/reset", {});

// 1. Two taps at once: the same customer, two plans in flight. Each action must exist once.
const [a, b] = await Promise.all([plan(eetu), plan(eetu)]);
const afterDouble = await get(`/api/actions?customerId=${eetu}`);
const titles = waiting(afterDouble).map((x) => `${x.kind}|${x.billType}|${x.monthlyAmountEur}`);
check("two plans at once both finish", !!a.plan && !!b.plan, `${a.error ?? ""} ${b.error ?? ""}`);
check("two plans at once set each action up once", new Set(titles).size === titles.length && titles.length === (a.plan?.actions.length ?? -1), `${titles.length} waiting, ${new Set(titles).size} distinct, plan has ${a.plan?.actions.length}`);
check("both plans point at the same actions", JSON.stringify(a.plan?.actions.map((x) => x.id).sort()) === JSON.stringify(b.plan?.actions.map((x) => x.id).sort()), "different action ids");

// 2. Both tabs tap Approve at the same moment: each action is approved exactly once.
const ids = a.plan?.actions.map((x) => x.id) ?? [];
const race = await Promise.all([1, 2, 3].map(() => post("/api/actions/approve-all", { customerId: eetu, actionIds: ids, confirm: true }).then(async (r) => ({ status: r.status, body: await r.json() }))));
const approvedTotal = race.reduce((n, r) => n + (r.body.approved?.length ?? 0), 0);
check("three approvals at once approve each action once", approvedTotal === ids.length, `${approvedTotal} approvals for ${ids.length} actions (${race.map((r) => r.status).join("/")})`);
const afterRace = await get(`/api/actions?customerId=${eetu}`);
check("the audit log is intact after the race", afterRace.auditChainValid === true && afterRace.audit.filter((e) => e.type === "action_approved").length === ids.length, `chain ${afterRace.auditChainValid}, ${afterRace.audit.filter((e) => e.type === "action_approved").length} approvals logged`);

// 3. The tab is closed while Sisu is still reading pages: nothing may be left set up by a plan nobody saw finish.
await post("/api/demo/reset", {});
const cut = await plan(sanna, { abortAfter: "search_start" });
await sleep(4000);
const afterCut = await get(`/api/actions?customerId=${sanna}`);
check("a plan cut off mid-search leaves no action behind", cut.aborted && waiting(afterCut).length === 0, `${waiting(afterCut).length} action(s) waiting after the tab closed: ${waiting(afterCut).map((x) => x.title).join("; ")}`);
const recovered = await plan(sanna);
check("the next plan after a cut-off one completes", !!recovered.plan && !recovered.error, recovered.error ?? "no plan_done");

// 4. A reset lands while a plan is running: the plan still ends cleanly and the log starts a valid new chain.
await post("/api/demo/reset", {});
const running = plan(aino);
await sleep(300);
const reset = await post("/api/demo/reset", {});
const during = await running;
const afterReset = await get(`/api/actions?customerId=${aino}`);
check("a reset during a plan: the plan still ends without an error", reset.ok && !during.error && during.types.at(-1) === "plan_done", during.error ?? during.types.at(-1));
check("a reset during a plan: the audit chain is valid afterwards", afterReset.auditChainValid === true, "chain invalid");

// 5. Three customers at the same moment: each plan is its own customer's.
await post("/api/demo/reset", {});
const trio = await Promise.all([aino, eetu, sanna].map((id) => plan(id)));
check("three customers at once: each gets their own plan", trio.every((t, i) => t.plan?.customerId === [aino, eetu, sanna][i] && t.plan.actions.every((x) => x.customerId === [aino, eetu, sanna][i])), trio.map((t) => t.plan?.customerId ?? t.error).join(", "));
check("three customers at once: three different totals", new Set(trio.map((t) => t.plan?.totalYearlyEur)).size === 3, trio.map((t) => t.plan?.totalYearlyEur).join(", "));

// 6. Bad input gets a sentence, not a stack trace.
const bad = await Promise.all([post("/api/agent/plan", {}), post("/api/agent/plan", { customerId: "CUST99999" }), post("/api/actions/approve-all", { customerId: eetu, actionIds: [], confirm: true }), fetch(`${BASE}/api/agent/plan`, { method: "POST", headers: { "x-forwarded-for": nextVisitor() }, body: "{not json" })]);
const badBodies = await Promise.all(bad.map(async (r) => ({ status: r.status, text: await r.text() })));
check("bad input: readable errors, no 500", badBodies.every((r) => r.status !== 500 && !/at .*\.ts|TypeError|stack/i.test(r.text)), badBodies.map((r) => r.status).join("/"));

await post("/api/demo/reset", {});
console.log(problems.length ? `\n${problems.length} problem(s).` : "\nReliability: no problems found.");
if (jsonAt > -1) writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
process.exitCode = problems.length ? 1 : 0;
