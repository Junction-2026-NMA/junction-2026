// The whole judged journey for each demo customer, against a running server:
// reset → money plan (scan, Exa search, page reads, sums) → invariants on the figures → approve all →
// actions executed as a simulation → audit chain → the same plan run and approved a second time.
// Run: SISU_BASE=http://localhost:3320 node tests/gauntlet/journey.mjs [--cached] [--json file]
// Cost of one run with live keys: 3 plans (about 9 searches, up to 21 page reads, 3 short model calls); the second
// pass reuses the pages. With --cached the first pass reuses earlier research too.
import { writeFileSync } from "node:fs";
import { BASE, CUSTOMERS, nextVisitor, readEvents } from "./lib.mjs";

const cached = process.argv.includes("--cached");
const jsonAt = process.argv.indexOf("--json");
const near = (a, b, tolerance = 0.02) => Math.abs(a - b) <= tolerance;
const post = (path, body) => fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": nextVisitor() }, body: JSON.stringify(body) });
const get = (path) => fetch(`${BASE}${path}`, { headers: { "x-forwarded-for": nextVisitor() } }).then((r) => r.json());

async function runPlan(customerId, fresh) {
  const started = performance.now();
  const response = await post("/api/agent/plan", { customerId, fresh });
  const out = { status: response.status, events: [], plan: null, error: null, ms: {} };
  if (!response.ok) return { ...out, error: `HTTP ${response.status}` };
  for await (const event of readEvents(response)) {
    out.events.push(event);
    out.ms[event.type] ??= Math.round(performance.now() - started);
    if (event.type === "plan_done") out.plan = event.plan;
    if (event.type === "error") out.error = event.message;
  }
  out.ms.total = Math.round(performance.now() - started);
  return out;
}

function checkPlan(name, run, repeat = false) {
  const problems = [];
  const fail = (text) => problems.push(text);
  const plan = run.plan;
  if (run.error) fail(`error event: ${run.error}`);
  if (!plan) return [...problems, "no plan_done event"];
  const types = run.events.map((e) => e.type);
  for (const needed of ["plan_start", "scan", "calc", "summary", "plan_done"]) if (!types.includes(needed)) fail(`missing ${needed} event`);
  if (types.indexOf("scan") > types.indexOf("calc")) fail("calc came before scan");

  // The sums.
  const itemSum = plan.items.reduce((total, item) => total + item.yearlyEur, 0);
  if (!near(itemSum, plan.totalYearlyEur)) fail(`total €${plan.totalYearlyEur} is not the sum of its items €${itemSum.toFixed(2)}`);
  const byNeed = (need) => plan.items.filter((item) => item.needs === need).reduce((total, item) => total + item.yearlyEur, 0);
  if (!near(byNeed("nothing"), plan.effortlessYearlyEur)) fail("effortless part does not match its items");
  if (!near(byNeed("check-plan"), plan.checkPlanYearlyEur)) fail("check-plan part does not match its items");
  for (const item of plan.items) {
    if (!(item.yearlyEur > 0)) fail(`${item.id}: a finding worth €${item.yearlyEur}`);
    if (!near(item.monthlyEur * 12, item.yearlyEur, 0.07)) fail(`${item.id}: monthly × 12 is not the yearly figure`);
    if (!item.facts?.length) fail(`${item.id}: no receipts`);
  }

  // Every switch must rest on a real offer that is cheaper than the bill, with a source and a retrieval time.
  const offers = Object.fromEntries(run.events.filter((e) => e.type === "offers").map((e) => [e.billType, e]));
  for (const item of plan.items.filter((i) => i.kind === "switch")) {
    if (item.title.startsWith("Already approved")) { if (!repeat) fail(`${item.id}: marked approved on a first run`); continue; }
    const billType = item.id.split(":")[1];
    const event = offers[billType];
    if (!event?.best) { fail(`${item.id}: no offer behind it`); continue; }
    const { best, currentMonthlyEur } = event;
    if (!(currentMonthlyEur > 0)) fail(`${item.id}: no current bill to compare with`);
    if (!(best.estimatedMonthlyCostEur < currentMonthlyEur)) fail(`${item.id}: the offer (€${best.estimatedMonthlyCostEur}) is not cheaper than the bill (€${currentMonthlyEur})`);
    if (item.yearlyEur > currentMonthlyEur * 12 + 0.01) fail(`${item.id}: saves more than the whole bill`);
    if (!near((currentMonthlyEur - best.estimatedMonthlyCostEur) * 12, item.yearlyEur, 0.2)) fail(`${item.id}: saving €${item.yearlyEur} is not (bill − offer) × 12 = €${((currentMonthlyEur - best.estimatedMonthlyCostEur) * 12).toFixed(2)}`);
    if (!best.sourceUrl?.startsWith("http")) fail(`${item.id}: offer has no source link`);
    if (!item.sources.length || item.sources.some((s) => !s.retrievedAt)) fail(`${item.id}: a source without a retrieval time`);
    if (!item.actionId) fail(`${item.id}: no action was set up`);
  }
  // A habit and a bill must not count the same euros twice.
  const billCategories = new Set(run.events.filter((e) => e.type === "finding" && e.role === "bill").map((e) => e.title));
  const habitCategories = plan.items.filter((i) => i.kind === "habit").map((i) => i.facts.find((f) => f.evidence?.category)?.evidence.category).filter(Boolean);
  if (new Set(habitCategories).size !== habitCategories.length) fail("two habits count the same category");

  // Nothing is approved by the plan itself: an action is waiting, or was approved by the customer on an earlier run.
  for (const action of plan.actions) {
    if (action.status !== "awaiting_approval" && !(repeat && action.status === "executed_simulated")) fail(`action ${action.title}: status ${action.status} before any approval`);
    if (action.simulated !== true) fail(`action ${action.title}: not marked simulated`);
  }
  // The projection uses what was found.
  if (plan.totalYearlyEur > 0) {
    if (!plan.projection) fail("no projection although something was found");
    else {
      const capped = plan.projection.assumptions.some((a) => a.includes("the most the scenario engine takes"));
      if (!capped && !near(plan.projection.freedPerMonthEur, plan.totalYearlyEur / 12, 0.01)) fail(`projection frees €${plan.projection.freedPerMonthEur} a month, the plan found €${(plan.totalYearlyEur / 12).toFixed(2)}`);
      if (!(plan.projection.keptEur >= plan.projection.nothingEur)) fail("keeping the saving ends lower than doing nothing");
    }
  }
  if (!plan.summary?.trim()) fail("empty summary");
  if (plan.customerId && plan.summary.includes(plan.customerId)) fail("customer ID in the summary");
  return problems.map((p) => `${name}: ${p}`);
}

const report = { at: new Date().toISOString(), base: BASE, cached, customers: {}, problems: [] };
await post("/api/demo/reset", {});
for (const [name, customerId] of Object.entries(CUSTOMERS)) {
  const first = await runPlan(customerId, !cached);
  report.problems.push(...checkPlan(name, first));
  const plan = first.plan;
  const entry = { ms: first.ms, by: plan?.summaryBy, totalYearlyEur: plan?.totalYearlyEur, items: plan?.items.map((i) => ({ id: i.id, yearlyEur: i.yearlyEur, needs: i.needs })), searches: plan?.searches, readers: first.events.filter((e) => e.type === "page_read").map((e) => `${e.reader}:${e.ok ? "ok" : "fail"}`), checks: plan?.checks.map((c) => ({ id: c.id, ok: c.ok, confirmed: c.figuresConfirmed })), summary: plan?.summary };
  report.customers[name] = entry;
  if (!plan?.actions.length) { console.log(`${name}: no actions to approve`); continue; }

  // Approval: refused without confirm, refused for another customer, then one tap.
  const ids = plan.actions.map((a) => a.id);
  const other = Object.values(CUSTOMERS).find((id) => id !== customerId);
  const noConfirm = await post("/api/actions/approve-all", { customerId, actionIds: ids });
  if (noConfirm.status !== 400) report.problems.push(`${name}: approve-all without confirm gave ${noConfirm.status}`);
  const wrongOwner = await post("/api/actions/approve-all", { customerId: other, actionIds: ids, confirm: true });
  if (wrongOwner.status !== 409 || (await wrongOwner.json()).approved?.length) report.problems.push(`${name}: another customer could approve`);
  const approved = await (await post("/api/actions/approve-all", { customerId, actionIds: ids, confirm: true })).json();
  if (approved.approved?.length !== ids.length) report.problems.push(`${name}: ${approved.approved?.length ?? 0} of ${ids.length} approved (${JSON.stringify(approved.failed)})`);
  for (const action of approved.approved ?? []) {
    if (action.status !== "executed_simulated" || !action.confirmation?.includes("simulation")) report.problems.push(`${name}: ${action.title} not executed as a simulation`);
    if (!action.impact) report.problems.push(`${name}: ${action.title} has no impact after approval`);
  }
  const again = await post("/api/actions/approve-all", { customerId, actionIds: ids, confirm: true });
  if (again.status !== 409) report.problems.push(`${name}: approving twice gave ${again.status}`);
  const list = await get(`/api/actions?customerId=${customerId}`);
  if (!list.auditChainValid) report.problems.push(`${name}: audit chain invalid`);
  const freedOnce = list.approvedMonthlySavingEur;
  entry.freedMonthlyEur = freedOnce;
  const switchesMonthly = (approved.approved ?? []).filter((a) => a.kind === "switch_contract").reduce((t, a) => t + a.monthlyAmountEur, 0);
  if (!near(freedOnce, switchesMonthly, 0.02)) report.problems.push(`${name}: freed €${freedOnce} a month, approved switches add up to €${switchesMonthly.toFixed(2)}`);

  // The same plan again (a judge taps twice, or the next visitor arrives before a reset). Nothing may be set up,
  // approved or counted a second time.
  const second = await runPlan(customerId, false);
  report.problems.push(...checkPlan(`${name} (second run)`, second, true));
  entry.secondMs = second.ms.total;
  entry.secondTotalYearlyEur = second.plan?.totalYearlyEur;
  const stillWaiting = (second.plan?.actions ?? []).filter((a) => a.status === "awaiting_approval");
  entry.secondWaiting = stillWaiting.length;
  if (stillWaiting.length) report.problems.push(`${name}: the second run set up ${stillWaiting.length} action(s) again: ${stillWaiting.map((a) => a.title).join("; ")}`);
  const after = await get(`/api/actions?customerId=${customerId}`);
  entry.freedMonthlyEurAfterSecond = after.approvedMonthlySavingEur;
  if (after.approvedMonthlySavingEur > freedOnce + 0.02) report.problems.push(`${name}: "freed" rose from €${freedOnce} to €${after.approvedMonthlySavingEur} a month on the second run`);
  if (after.actions.length !== list.actions.length) report.problems.push(`${name}: ${after.actions.length - list.actions.length} new action(s) stored by the second run`);
  if (!after.auditChainValid) report.problems.push(`${name}: audit chain invalid after the second run`);
  console.log(`${name}: plan ${first.ms.total} ms (first search ${first.ms.search_start ?? "-"} ms, summary by ${plan.summaryBy}), €${plan.totalYearlyEur}/yr in ${plan.items.length} items, ${ids.length} actions; second run ${second.ms.total} ms`);
}
await post("/api/demo/reset", {});
console.log(report.problems.length ? `\n${report.problems.length} problem(s):\n- ${report.problems.join("\n- ")}` : "\nJourney: no problems found.");
if (jsonAt > -1) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(report, null, 2));
process.exitCode = report.problems.length ? 1 : 0;
