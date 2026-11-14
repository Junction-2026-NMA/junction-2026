// The money plan: one request, and Sisu goes through the customer's last twelve months, searches today's offers
// for every bill it can compare, works out what each finding is worth in a year, sets up the actions that would
// capture it, and says what it found. Every step is real work and is reported as it happens, so a screen can show
// Sisu working: what it scanned, what it searched for, each page as it is read, each sum.
//
// Who does what: code finds the patterns and does every sum, Exa searches, Context.dev reads the pages, and
// Nemotron words the summary. The summary's numbers are checked against the receipts like any other answer; if
// one does not match, a sentence written by code is used instead. Nothing is approved here: actions wait.
import { saveDraft } from "@/lib/actions";
import { buildSwitchDraft, buildTransferDraft } from "@/lib/actions/drafts";
import { buildCashFlow } from "@/lib/finance/cashflow";
import { findCustomer, transactionsFor } from "@/lib/finance/data";
import { fact } from "@/lib/finance/facts";
import { groupBy, round2, sum } from "@/lib/finance/math";
import { buildOverview } from "@/lib/finance/overview";
import { findPatterns } from "@/lib/finance/patterns";
import { LIMITS, cleanInput, runScenario } from "@/lib/finance/scenario";
import { getMemory } from "@/lib/memory";
import type { AgentAction, BillType, CalcStep, CashFlow, Fact, MoneyPlan, Pattern, PlanEvent, PlanItem, PlanProjection, PlanSearch, ResearchResult } from "@/lib/types";
import { getConfig } from "./config";
import { checkGrounding } from "./grounding";
import { findLanguage } from "./languages";
import { streamChat } from "./model";
import { ensureResearch, startWatchedResearch, waitForUsable } from "./research";
import type { RawResearch } from "./research/types";
import { type ToolContext } from "./tools";
import { searchOffers } from "./tools/web";

const HABIT_KINDS: Pattern["kind"][] = ["peer-gap", "category-drift", "small-purchases"];
const NOTICE_KINDS: Pattern["kind"][] = ["overdraft-risk", "idle-cash", "payday-spike"];
const MAX_HABITS = 2;
const MAX_NOTICES = 2;
const MAX_BILLS = 3;
const MIN_SWITCH_SAVING_EUR = 5; // a switch worth less than this a year is not worth the customer's time
const RESEARCH_LIMIT_MS = 16_000;
const POLL_MS = 60;
const ROWS_SHOWN = 48;
const PROJECTION_YEARS = 5;
const SUMMARY_MAX_TOKENS = 140;
// Context.dev allows 10 page reads a minute on our key, so one plan stays under that: 3 + 2 + 2.
const PAGES_PER_BILL: Record<BillType, number> = { electricity: 3, internet: 2, mobile: 2 };
const BILL_NOUN: Record<BillType, string> = { electricity: "electricity", internet: "home internet", mobile: "mobile plan" };

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const euros = (value: number): string => Math.round(value).toLocaleString("en-US");

export type PlanOptions = { fresh?: boolean; language?: string };

// One habit per category, and the smaller figure when two patterns describe the same spending (above peers, and up
// on last year): counting both would count the same euros twice.
export function pickHabits(patterns: Pattern[]): Pattern[] {
  const byCategory = new Map<string, Pattern>();
  for (const pattern of patterns) {
    if (!HABIT_KINDS.includes(pattern.kind) || (pattern.yearlyImpactEur ?? 0) <= 0) continue;
    const key = pattern.evidence.category ?? pattern.id;
    const seen = byCategory.get(key);
    if (!seen || (pattern.yearlyImpactEur ?? 0) < (seen.yearlyImpactEur ?? 0)) byCategory.set(key, pattern);
  }
  return [...byCategory.values()].sort((a, b) => (b.yearlyImpactEur ?? 0) - (a.yearlyImpactEur ?? 0)).slice(0, MAX_HABITS);
}

// Reports what changed in a running search since the last look: the pages found, then each page as it is read.
function* progress(billType: BillType, now: RawResearch, seen: { found: boolean; read: Set<string> }, startedAt: number): Generator<PlanEvent> {
  const tookMs = Date.now() - startedAt;
  if (!seen.found && now.found?.length) {
    seen.found = true;
    yield { type: "search_pages", billType, pages: now.found.map((page) => ({ url: page.url, host: hostOf(page.url), title: page.title })), tookMs };
  }
  for (const citation of now.citations) {
    if (seen.read.has(citation.url)) continue;
    seen.read.add(citation.url);
    yield { type: "page_read", billType, url: citation.url, host: hostOf(citation.url), ok: true, offers: now.offers.filter((offer) => offer.sourceUrl === citation.url).length, reader: "context.dev", ageMs: citation.cacheAgeMs, tookMs };
  }
  if (now.status === "done" || now.status === "failed") {
    for (const page of now.found ?? []) {
      if (seen.read.has(page.url)) continue;
      seen.read.add(page.url);
      yield { type: "page_read", billType, url: page.url, host: hostOf(page.url), ok: false, offers: 0, reader: "context.dev", ageMs: null, tookMs };
    }
  }
}

function switchItem(billType: BillType, research: ResearchResult, action: AgentAction | null, facts: Fact[]): PlanItem | null {
  const best = research.best;
  const yearly = best?.estimatedYearlySavingEur ?? 0;
  if (!best || yearly < MIN_SWITCH_SAVING_EUR) return null;
  return {
    id: `switch:${billType}`,
    kind: "switch",
    title: `Switch ${BILL_NOUN[billType]} to ${best.provider}`,
    // For electricity the offer is priced at the customer's own estimated use. For internet and mobile Sisu cannot
    // see the speed or data the customer has now, so the cheapest plan may be a smaller one. That is said.
    detail: `${best.plan ? `${best.plan}. ` : ""}About €${(best.estimatedMonthlyCostEur ?? 0).toFixed(2)} a month against €${(research.baselineMonthlyEur ?? 0).toFixed(2)} now. An estimate from today's prices.${billType === "electricity" ? "" : " It is the cheapest plan found and may be slower or smaller than the one you have: check before switching."}`,
    yearlyEur: round2(yearly),
    monthlyEur: round2(yearly / 12),
    needs: "nothing",
    actionId: action?.id ?? null,
    sources: research.citations.filter((citation) => citation.url === best.sourceUrl).concat(research.citations.filter((citation) => citation.url !== best.sourceUrl)).slice(0, 3),
    facts,
  };
}

function habitItem(pattern: Pattern, actionId: string | null): PlanItem {
  const yearly = round2(pattern.yearlyImpactEur ?? 0);
  return { id: `habit:${pattern.id}`, kind: "habit", title: pattern.title, detail: pattern.detail, yearlyEur: yearly, monthlyEur: round2(yearly / 12), needs: "spending-change", actionId, sources: [], facts: pattern.facts };
}

function project(overview: NonNullable<ReturnType<typeof buildOverview>>, totalYearlyEur: number): PlanProjection | null {
  const freed = Math.min(LIMITS.billSavingPerMonth[1], round2(totalYearlyEur / 12));
  if (freed <= 0) return null;
  const input = cleanInput({ billSavingPerMonth: freed, everydayCutPct: 0, years: PROJECTION_YEARS });
  if (typeof input === "string") return null;
  const result = runScenario(overview, input);
  const branch = (id: string) => result.branches.find((b) => b.id === id);
  const nothing = branch("nothing")?.endTotal ?? 0;
  const kept = branch("save")?.endTotal ?? 0;
  const invested = branch("invest");
  return {
    years: PROJECTION_YEARS,
    freedPerMonthEur: result.freedPerMonth,
    nothingEur: nothing,
    keptEur: kept,
    investedEur: invested?.endTotal ?? kept,
    investedLowEur: invested?.endLow ?? kept,
    investedHighEur: invested?.endHigh ?? kept,
    gainKeptEur: round2(kept - nothing),
    assumptions: [...result.assumptions, ...(freed < round2(totalYearlyEur / 12) ? [`The projection uses €${freed} a month, the most the scenario engine takes.`] : [])],
  };
}

const codeSummary = (plan: Pick<MoneyPlan, "totalYearlyEur" | "effortlessYearlyEur" | "actions">): string => {
  if (plan.totalYearlyEur <= 0) return "I went through your last twelve months and today's offers, and found nothing that would clearly save you money. Nothing was set up.";
  const rest = round2(plan.totalYearlyEur - plan.effortlessYearlyEur);
  const split = plan.effortlessYearlyEur > 0 && rest > 0 ? ` About €${euros(plan.effortlessYearlyEur)} of it needs nothing from you; the other €${euros(rest)} needs the spending to come down.` : rest > 0 ? " It needs the spending to come down." : " It needs nothing from you.";
  const waiting = plan.actions.length ? ` ${plan.actions.length === 1 ? "One thing is" : `${plan.actions.length} things are`} set up and waiting for your approval.` : "";
  return `I found about €${euros(plan.totalYearlyEur)} a year.${split}${waiting}`;
};

// Nemotron words the result in the customer's language. Its figures are checked against the plan's receipts.
async function modelSummary(plan: Pick<MoneyPlan, "totalYearlyEur" | "effortlessYearlyEur" | "actions" | "items">, facts: Fact[], language: string | undefined, signal?: AbortSignal): Promise<string | null> {
  if (plan.totalYearlyEur <= 0) return null;
  const spoken = findLanguage(language)?.name ?? "English";
  const figures = {
    foundPerYearEur: Math.round(plan.totalYearlyEur),
    needsNothingFromCustomerPerYearEur: Math.round(plan.effortlessYearlyEur),
    needsSpendingToComeDownPerYearEur: Math.round(plan.totalYearlyEur - plan.effortlessYearlyEur),
    thingsSetUpAndWaitingForApproval: plan.actions.length,
    findings: plan.items.map((item) => ({ what: item.title, perYearEur: Math.round(item.yearlyEur) })),
  };
  let text = "";
  try {
    const chunks = streamChat({
      messages: [
        { role: "system", content: `You are Sisu, the money coach in the S-Pankki app. You have just gone through this customer's last twelve months and today's offers. Tell them what you found in two or three short sentences, to be spoken aloud, in ${spoken}. Use only the figures given, copied exactly, and no other numbers. Say the yearly total first, then how much of it needs nothing from them and how much needs their spending to come down, then that everything is set up and waits for their approval. No lists, no greeting.` },
        { role: "user", content: JSON.stringify(figures) },
      ],
      tools: [],
      maxTokens: SUMMARY_MAX_TOKENS,
      signal,
    });
    for await (const chunk of chunks) if (chunk.type === "delta") text += chunk.text;
  } catch (error) {
    console.error("[plan] the model could not word the summary:", (error as Error).message);
    return null;
  }
  const clean = text.split("<|")[0].trim();
  if (!clean) return null;
  const check = checkGrounding(clean, facts, [JSON.stringify(figures)], []);
  if (!check.ok) console.error(`[plan] the model's summary had unsourced numbers (${check.unverified.join(", ")}); using the code-written one`);
  return check.ok ? clean : null;
}

export async function* runPlan(customerId: string, options: PlanOptions = {}, signal?: AbortSignal): AsyncGenerator<PlanEvent> {
  const startedAt = Date.now();
  const config = getConfig();
  const customer = findCustomer(customerId);
  const overview = buildOverview(customerId);
  if (!customer || !overview) {
    yield { type: "error", message: "We could not find that customer." };
    return;
  }
  const planId = crypto.randomUUID();
  yield { type: "plan_start", planId, customerName: overview.displayName, provider: config.provider, model: config.model.name, mock: config.isMock };

  // 1. The customer's own data: every transaction in the last twelve months, and what stands out in them.
  const cashFlow: CashFlow = buildCashFlow(overview);
  const rows = transactionsFor(customerId).filter((row) => row.date >= overview.windowFrom && row.date <= overview.windowTo);
  const spending = rows.filter((row) => row.amount < 0);
  const categories = Object.entries(groupBy(spending, (row) => row.category))
    .map(([category, list]) => ({ category, monthlyEur: round2(-sum(list.map((row) => row.amount)) / overview.windowMonths) }))
    .sort((a, b) => b.monthlyEur - a.monthlyEur)
    .slice(0, 6);
  const patterns = findPatterns(overview, cashFlow);
  yield {
    type: "scan",
    transactions: rows.length,
    months: overview.windowMonths,
    from: overview.windowFrom,
    to: overview.windowTo,
    rows: spending.slice(-ROWS_SHOWN).map((row) => ({ date: row.date, category: row.category, amount: row.amount })),
    categories,
    tookMs: Date.now() - startedAt,
  };

  const habits = pickHabits(patterns);
  const notices = patterns.filter((pattern) => NOTICE_KINDS.includes(pattern.kind)).slice(0, MAX_NOTICES);
  const billTypes = [...new Set(patterns.filter((pattern) => pattern.kind === "bill-opportunity" && pattern.billType).map((pattern) => pattern.billType as BillType))].slice(0, MAX_BILLS);
  for (const habit of habits) yield { type: "finding", id: habit.id, role: "habit", title: habit.title, detail: habit.detail, yearlyEur: habit.yearlyImpactEur };
  for (const notice of notices) yield { type: "finding", id: notice.id, role: "notice", title: notice.title, detail: notice.detail, yearlyEur: null };
  for (const pattern of patterns.filter((p) => p.kind === "bill-opportunity" && p.billType && billTypes.includes(p.billType))) yield { type: "finding", id: pattern.id, role: "bill", title: pattern.title, detail: pattern.detail, yearlyEur: null };

  // 2. The web: one live search per bill, all at once. Each page is reported as it is found and as it is read.
  const live = options.fresh !== false;
  const searchStartedAt = Date.now();
  const watched = billTypes.map((billType) => {
    const run = live ? startWatchedResearch(billType, customer.area, PAGES_PER_BILL[billType]) : null;
    const key = run ? run.peek().key : ensureResearch(billType, customer.area).key;
    return { billType, run, key, seen: { found: false, read: new Set<string>() }, raw: null as RawResearch | null };
  });
  for (const search of watched) {
    const query = search.run?.peek().query ?? (await waitForUsable(search.key, 1, signal))?.query ?? `${BILL_NOUN[search.billType]} offers`;
    yield { type: "search_start", billType: search.billType, query, engine: "exa" };
  }
  const pending = new Set(watched);
  for (const search of watched) {
    const finished = search.run ? search.run.finished : waitForUsable(search.key, RESEARCH_LIMIT_MS, signal);
    void finished.then((raw) => {
      search.raw = raw;
      pending.delete(search);
    });
  }
  while (pending.size && Date.now() - searchStartedAt < RESEARCH_LIMIT_MS && !signal?.aborted) {
    for (const search of watched) if (search.run) yield* progress(search.billType, search.run.peek(), search.seen, searchStartedAt);
    await sleep(POLL_MS);
  }
  for (const search of watched) {
    const last = search.raw ?? search.run?.peek() ?? null;
    if (last) yield* progress(search.billType, last, search.seen, searchStartedAt);
  }

  // 3. The sums: each offer against the customer's own bill, in code.
  const context: ToolContext = { customerId, overview, city: customer.area, memory: getMemory(customerId), cashFlow: () => cashFlow, userTexts: [], sisuTexts: [], signal };
  const items: PlanItem[] = [];
  const actions: AgentAction[] = [];
  const searches: PlanSearch[] = [];
  const facts: Fact[] = [];
  for (const search of watched) {
    const outcome = await searchOffers({ billType: search.billType }, context);
    const research = outcome.research ?? null;
    const best = research?.best ?? null;
    const saving = best?.estimatedYearlySavingEur ?? null;
    const usedLive = live && search.raw?.status === "done";
    searches.push({ billType: search.billType, query: research?.query ?? "", pagesRead: research?.citations.length ?? 0, pagesFound: research?.pagesTotal ?? 0, offersFound: research?.offers.length ?? 0, tookMs: research?.tookMs ?? 0, retrievedAt: research?.finishedAt ?? null, live: usedLive, mock: research?.mock ?? config.isMock });
    let action: AgentAction | null = null;
    if (research && best && (saving ?? 0) >= MIN_SWITCH_SAVING_EUR) {
      const draft = buildSwitchDraft(customerId, search.billType, { preparedBy: "sisu-agent" });
      const saved = draft.ok ? saveDraft(customerId, draft.draft) : null;
      action = saved?.ok ? saved.action : null;
      const item = switchItem(search.billType, research, action, outcome.facts);
      if (item) items.push(item);
      if (action) actions.push(action);
    }
    const note = !outcome.ok ? "No offers could be read for this bill today." : !best ? "No comparable offer is cheaper than what you pay now." : (saving ?? 0) < MIN_SWITCH_SAVING_EUR ? "The cheapest offer saves too little to be worth a switch." : null;
    yield { type: "offers", billType: search.billType, ok: outcome.ok, best, yearlySavingEur: saving, currentMonthlyEur: research?.baselineMonthlyEur ?? null, offersFound: research?.offers.length ?? 0, live: usedLive, note };
  }

  // A habit only saves money if the spending really comes down. The action for it moves that amount to savings the
  // day after payday, so it is set aside before it can be spent. The transfer carries its own warning if it is tight.
  const habitMonthly = Math.floor(sum(habits.map((habit) => (habit.yearlyImpactEur ?? 0) / 12)));
  let habitAction: AgentAction | null = null;
  if (habitMonthly >= 5) {
    const draft = buildTransferDraft(customerId, habitMonthly, { preparedBy: "sisu-agent" });
    const saved = draft.ok ? saveDraft(customerId, draft.draft) : null;
    habitAction = saved?.ok ? saved.action : null;
    if (habitAction) actions.push(habitAction);
  }
  items.unshift(...habits.map((habit) => habitItem(habit, habitAction?.id ?? null)));

  const totalYearlyEur = round2(sum(items.map((item) => item.yearlyEur)));
  const effortlessYearlyEur = round2(sum(items.filter((item) => item.needs === "nothing").map((item) => item.yearlyEur)));
  const steps: CalcStep[] = items.map((item) => ({ label: item.title, amount: item.yearlyEur, basis: item.needs === "nothing" ? "today's best offer against your bill, times 12" : "your own spending, twelve months" }));
  facts.push(
    ...items.flatMap((item) => [fact(`plan:${item.id}`, item.title, item.yearlyEur, "EUR/year", item.kind === "switch" ? "estimated saving from the offer research" : "from the pattern in your transactions", { source: "calculation" }), ...item.facts]),
    fact("plan:total", "Found per year", totalYearlyEur, "EUR/year", "the sum of the findings", { source: "calculation" }),
    fact("plan:effortless", "Needs nothing from you, per year", effortlessYearlyEur, "EUR/year", "the contract switches", { source: "calculation" }),
    fact("plan:effort", "Needs spending to come down, per year", round2(totalYearlyEur - effortlessYearlyEur), "EUR/year", "the spending habits", { source: "calculation" }),
    fact("plan:actions", "Things set up", actions.length, "count", "actions waiting for approval", { source: "calculation" }),
  );
  yield { type: "calc", steps, totalYearlyEur, effortlessYearlyEur };
  for (const action of actions) yield { type: "action", action };

  const projection = project(overview, totalYearlyEur);
  if (projection) yield { type: "projection", projection };

  // 4. The words. Nemotron says it; code checks every figure it used.
  const draft = { totalYearlyEur, effortlessYearlyEur, actions, items };
  const summaryStartedAt = Date.now();
  const fromModel = config.isMock ? null : await modelSummary(draft, facts, options.language, signal);
  const summary = fromModel ?? codeSummary(draft);
  yield { type: "summary", text: summary, by: fromModel ? "nemotron" : "code", tookMs: Date.now() - summaryStartedAt };

  const plan: MoneyPlan = {
    id: planId,
    customerId,
    createdAt: new Date().toISOString(),
    scanned: { transactions: rows.length, months: overview.windowMonths },
    items,
    notices: notices.map((notice) => ({ title: notice.title, detail: notice.detail })),
    actions,
    totalYearlyEur,
    effortlessYearlyEur,
    projection,
    searches,
    summary,
    summaryBy: fromModel ? "nemotron" : "code",
    facts,
    tookMs: Date.now() - startedAt,
  };
  yield { type: "plan_done", plan };
}
