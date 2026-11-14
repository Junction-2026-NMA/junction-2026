// The tools the model may call. Each runs our own code; the model only chooses and words the result.
import { BASKET_ORDER, MCC_LABELS } from "@/lib/finance/baskets";
import { DATA_AS_OF } from "@/lib/finance/data";
import { cleanInput, runScenario } from "@/lib/finance/scenario";
import { listTransactions } from "@/lib/finance/transactions";
import type { BasketId, BillType, Citation, Overview, ResearchResult, ToolTrace } from "@/lib/types";
import type { ToolCall, ToolSchema } from "./model";
import { toResult } from "./research/compare";
import { exaSearch } from "./research/exa";
import { ensureResearch, waitForUsable } from "./research";

const RESEARCH_HARD_LIMIT_MS = 8_500; // every page has an 8 s limit of its own
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BILL_TYPES: BillType[] = ["electricity", "mobile", "internet"];
const BILL_GUESS_LABEL: Record<BillType, string> = { electricity: "Electricity", mobile: "Mobile plan", internet: "Home internet" };
const CATEGORIES = ["Housing", "Utilities", "Health", "Home & Tech", "Groceries", "Restaurants", "Transportation", "Entertainment", "Lifestyle", "Travel"];
const MERCHANT_TYPES = [...new Set(Object.values(MCC_LABELS))];

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "get_spending",
      description: "Exact total and count of the customer's spending for a period, optionally narrowed by category, merchant type or basket. Use for questions like 'how much did I spend on taxis last month'.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date, YYYY-MM-DD" },
          to: { type: "string", description: "End date, YYYY-MM-DD" },
          category: { type: "string", enum: CATEGORIES },
          merchantType: { type: "string", enum: MERCHANT_TYPES, description: "Narrower than category, e.g. Taxi, Fast food, Pharmacy" },
          basket: { type: "string", enum: BASKET_ORDER, description: "regular = must pay every month, irregular = must pay now and then, everyday = everyday choices" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_scenario",
      description: "Projects three futures (change nothing, keep the cash, invest it) from the customer's real averages. Use for what-if questions.",
      parameters: {
        type: "object",
        properties: {
          billSavingPerMonth: { type: "number", description: "Euros saved per month by switching a contract, 0 if none" },
          everydayCutPct: { type: "number", description: "Percent of everyday spending trimmed, 0 to 50" },
          years: { type: "number", description: "How many years ahead, 1 to 10" },
        },
        required: ["billSavingPerMonth", "everydayCutPct", "years"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_offers",
      description: "Live search for current Finnish offers for one of the customer's bills, with the yearly saving computed against their real bill.",
      parameters: {
        type: "object",
        properties: {
          billType: { type: "string", enum: BILL_TYPES },
          yearlyKwh: { type: "number", description: "Electricity only: the customer's yearly use in kWh, ONLY if they said it. Never guess." },
        },
        required: ["billType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Live web search for current outside facts (rules, benefits, general prices). Do not include the customer's personal figures in the query.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
];

export type ToolContext = { customerId: string; overview: Overview; city: string; signal?: AbortSignal };

export type ToolOutcome = {
  content: string; // JSON the model reads
  ok: boolean;
  summary: string;
  source: ToolTrace["source"];
  joinedPrefetch: boolean;
  research?: ResearchResult;
  citations: Citation[];
};

const failure = (source: ToolTrace["source"], message: string): ToolOutcome => ({
  content: JSON.stringify({ error: message }),
  ok: false,
  summary: message,
  source,
  joinedPrefetch: false,
  citations: [],
});

export function parseArgs(call: ToolCall): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(call.function.arguments || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function billTypeOf(args: Record<string, unknown>): BillType | null {
  return BILL_TYPES.includes(args.billType as BillType) ? (args.billType as BillType) : null;
}

function getSpending(args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const from = typeof args.from === "string" && DATE_RE.test(args.from) ? args.from : null;
  const to = typeof args.to === "string" && DATE_RE.test(args.to) ? args.to : DATA_AS_OF;
  if (!from || from > to) return failure("finance", "get_spending needs a valid from and to date (YYYY-MM-DD).");

  const category = CATEGORIES.includes(args.category as string) ? (args.category as string) : undefined;
  const basket = BASKET_ORDER.includes(args.basket as BasketId) ? (args.basket as BasketId) : undefined;
  const merchantType = MERCHANT_TYPES.includes(args.merchantType as string) ? (args.merchantType as string) : undefined;
  // One merchant type can cover several merchant codes (for example two fuel codes), so they are summed.
  // With no filter at all, the three baskets together are "all spending" (income and savings are left out).
  const filters = merchantType
    ? Object.keys(MCC_LABELS).filter((code) => MCC_LABELS[code] === merchantType).map((mcc) => ({ category, basket, mcc }))
    : category || basket
      ? [{ category, basket }]
      : BASKET_ORDER.map((id) => ({ basket: id }));

  const lists = filters.map((filter) => listTransactions(ctx.customerId, { from, to, ...filter }));
  const count = lists.reduce((total, list) => total + (list?.count ?? 0), 0);
  const totalEur = Math.round(-lists.reduce((total, list) => total + (list?.total ?? 0), 0) * 100) / 100;
  const what = merchantType ?? category ?? basket ?? "all spending";

  return {
    content: JSON.stringify({ from, to, filter: what, totalSpentEur: totalEur, transactions: count }),
    ok: true,
    summary: `€${totalEur.toFixed(2)} on ${what} across ${count} transactions, ${from} to ${to}`,
    source: "finance",
    joinedPrefetch: false,
    citations: [],
  };
}

function runScenarioTool(args: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const input = cleanInput({
    billSavingPerMonth: Number(args.billSavingPerMonth),
    everydayCutPct: Number(args.everydayCutPct),
    years: Number(args.years),
  });
  if (typeof input === "string") return failure("finance", input);
  const result = runScenario(ctx.overview, input);
  const branches = result.branches.map((b) => ({ future: b.label, endTotalEur: b.endTotal, lowEur: b.endLow, highEur: b.endHigh, monthsOfMustPayCostsCoveredAfterYear1: b.runwayMonthsAtYear1 }));
  return {
    content: JSON.stringify({ input, freedPerMonthEur: result.freedPerMonth, branches, assumptions: result.assumptions }),
    ok: true,
    summary: `€${result.freedPerMonth.toFixed(0)} a month freed, projected over ${input.years} years`,
    source: "finance",
    joinedPrefetch: false,
    citations: [],
  };
}

async function searchOffers(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  const billType = billTypeOf(args);
  if (!billType) return failure("exa+context.dev", "search_offers needs billType: electricity, mobile or internet.");

  // Joins the run speculation or the UI already started, if there is one.
  const { key, reused } = ensureResearch(billType, ctx.city);
  const raw = await waitForUsable(key, RESEARCH_HARD_LIMIT_MS, ctx.signal);
  if (!raw) return failure("exa+context.dev", "Live offer research did not start.");

  const bill = ctx.overview.recurringBills.find((b) => b.guessLabel === BILL_GUESS_LABEL[billType]);
  const stated = typeof args.yearlyKwh === "number" && Number.isFinite(args.yearlyKwh) && args.yearlyKwh > 0 ? args.yearlyKwh : null;
  const research = toResult(raw, bill?.monthlyAvg ?? null, stated);
  const compact = (o: (typeof research.offers)[number]) => ({
    provider: o.provider,
    plan: o.plan,
    contractType: o.contractType,
    contractMonths: o.contractMonths,
    estimatedMonthlyCostEur: o.estimatedMonthlyCostEur,
    estimatedYearlySavingEur: o.estimatedYearlySavingEur,
    comparable: o.comparable,
    source: new URL(o.sourceUrl).hostname,
  });
  const ok = research.offers.length > 0;

  return {
    content: JSON.stringify({
      status: research.status,
      statusNote: research.status === "done" ? undefined : "Not every page had loaded. Say this is from what could be read so far and may change.",
      exampleDataOnly: research.mock,
      currentBillMonthlyEur: research.baselineMonthlyEur,
      yearlyKwhUsed: research.assumedYearlyKwh,
      yearlyKwhIs: research.usageSource === "stated" ? "what the customer told us" : "an estimate, not a meter reading: say so, and invite them to give their real yearly kWh",
      best: research.best ? compact(research.best) : null,
      note: research.best ? undefined : "No comparable offer is cheaper than the current bill. Say so honestly.",
      offers: research.offers.slice(0, 5).map(compact),
      sources: research.citations.map((c) => new URL(c.url).hostname),
      assumptions: research.assumptions,
      problems: research.errors,
    }),
    ok,
    summary: ok
      ? `${research.offers.length} offers from ${research.citations.length} pages in ${(research.tookMs / 1000).toFixed(1)} s${research.best ? `; best saves €${Math.round(research.best.estimatedYearlySavingEur ?? 0)} a year` : ""}`
      : `No offers found (${research.errors[0] ?? "no pages could be read"})`,
    source: "exa+context.dev",
    joinedPrefetch: reused,
    research,
    citations: research.citations,
  };
}

// Removes anything that could identify the customer before a query leaves for the web.
function sanitiseQuery(query: string): string {
  return query
    .replace(/CUST\d+/gi, "")
    .replace(/(€\s?\d[\d.,]*|\d[\d.,]*\s?(€|eur|euros?)\b)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

async function webSearch(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  const query = typeof args.query === "string" ? sanitiseQuery(args.query) : "";
  if (query.length < 3) return failure("exa", "web_search needs a query.");
  try {
    const results = (await exaSearch(query, { numResults: 4, highlights: true, signal: ctx.signal })).slice(0, 4);
    const retrievedAt = new Date().toISOString();
    return {
      content: JSON.stringify({ query, results: results.map((r) => ({ title: r.title, source: new URL(r.url).hostname, excerpt: r.highlights.join(" ").slice(0, 600) })) }),
      ok: results.length > 0,
      summary: `${results.length} results for "${query}"`,
      source: "exa",
      joinedPrefetch: false,
      citations: results.map((r) => ({ title: r.title, url: r.url, retrievedAt, cacheAgeMs: null })),
    };
  } catch (error) {
    return failure("exa", `Live web search is unavailable right now (${(error as Error).message})`);
  }
}

export async function executeTool(call: ToolCall, ctx: ToolContext): Promise<ToolOutcome> {
  const args = parseArgs(call);
  switch (call.function.name) {
    case "get_spending":
      return getSpending(args, ctx);
    case "run_scenario":
      return runScenarioTool(args, ctx);
    case "search_offers":
      return searchOffers(args, ctx);
    case "web_search":
      return webSearch(args, ctx);
    default:
      return failure("finance", `Unknown tool: ${call.function.name}`);
  }
}
