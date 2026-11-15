// The scripted stand-in for the model in mock mode (MODEL_PROVIDER=mock). No keys, no network.
// It picks tools by keyword and words its answer from the tool results, so the frontend can build every card
// (stages, offers, teaching, approval, receipts) against the real endpoints. Its answers start with "Mock answer."
import type { ChatMessage, ModelChunk, StreamOptions, ToolCall } from "./model";
import { speculate } from "./speculate";

const WORD_DELAY_MS = 25;
const THINK_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const END = { model: "mock", provider: "mock", usedBackup: false };

async function* speak(text: string): AsyncGenerator<ModelChunk> {
  const started = Date.now();
  let firstTokenMs: number | null = null;
  for (const word of text.split(" ")) {
    await sleep(WORD_DELAY_MS);
    firstTokenMs ??= Date.now() - started;
    yield { type: "delta", text: `${word} ` };
  }
  yield { type: "end", toolCalls: [], ...END, firstTokenMs, totalMs: Date.now() - started };
}

async function* callTool(name: string, args: Record<string, unknown>): AsyncGenerator<ModelChunk> {
  await sleep(THINK_MS);
  const call: ToolCall = { id: `mock_${name}_${Math.random().toString(36).slice(2, 8)}`, type: "function", function: { name, arguments: JSON.stringify(args) } };
  yield { type: "end", toolCalls: [call], ...END, firstTokenMs: THINK_MS, totalMs: THINK_MS };
}

type Json = Record<string, unknown>;
const parse = (text: string): Json => {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return {};
  }
};
const firstNumber = (text: string): number | null => {
  const match = /(\d[\d,.]*)/.exec(text.replace(/(\d)[ ,](\d{3})\b/g, "$1$2"));
  return match ? Number(match[1]) : null;
};

const CATEGORY_WORDS: Record<string, string> = { restaurant: "Restaurants", "eating out": "Restaurants", "dining out": "Restaurants", grocer: "Groceries", transport: "Transportation", entertain: "Entertainment", health: "Health", travel: "Travel" };
const CATEGORY = /(restaurant|eating out|dining out|grocer|transport|entertain|health|travel)/;

// Questions answered in words with no tool: a move or a rent with no figure yet needs its requirements first.
// One clarifying question, as the real model is told to ask, and no proposal.
function clarifyingQuestion(question: string): string | null {
  const q = question.toLowerCase();
  if (/\b(move|moving|relocat(e|ing))\b/.test(q) && firstNumber(q) === null) {
    return "Mock answer. Happy to look into a move. What is the most rent you would pay a month, when would you like to move, and how much do you want to keep as a buffer after moving?";
  }
  return null;
}

// One step: which tool the scripted model would call for this question, or null to answer in words.
function firstTool(question: string): [string, Json] | null {
  const q = question.toLowerCase();
  // "Find me electricity contracts of 12 months or less" names the bill and a contract but no "cheaper": still a search.
  // "Find a cheaper plan that meets my needs" names no bill at all: electricity, the bill the demo researches first.
  const anyPlan = /\b(cheaper|better|lower)\b.*\b(plans?|deals?|contracts?|tariffs?|offers?)\b|\b(plans?|deals?|contracts?|tariffs?)\b.*\bcheaper\b/.test(q);
  const offer = speculate(question) ?? (/\b(contracts?|plans?|tariffs?)\b/.test(q) ? speculate(`cheaper ${question}`) : null) ?? (anyPlan ? { billType: "electricity" as const } : null);
  // "12 months or less": the requirement goes with the search, as the real model is told to pass it.
  const maxMonths = /(\d{1,2})[- ]?months? (or less|max(imum)?|at most)|(at most|max(imum)?|up to) (\d{1,2}) months?/.exec(q);
  if (offer) return ["search_offers", { billType: offer.billType, ...(maxMonths ? { maxContractMonths: Number(maxMonths[1] ?? maxMonths[6]) } : {}) }];
  // A flat within a rent they named, or a price to watch for: the Project flow (search, then a proposal to approve).
  const keepChecking = /keep an eye|keep checking|keep looking|watch|monitor/.test(q);
  if (/\b(flats?|homes?|rentals?)\b/.test(q) && firstNumber(q)) {
    const city = /\bin ([A-ZÅÄÖ][\p{L}-]+)/u.exec(question)?.[1];
    return ["search_flats", { ...(city ? { city } : {}), budgetEur: firstNumber(q), ...(keepChecking ? { watch: true } : {}) }];
  }
  const priced = /tell me when (?:an? |the )?(.+?) (?:is|costs?|drops?) (?:under|below|to) (\d[\d,.]*)/.exec(q);
  if (priced) return ["search_prices", { what: priced[1], maxPriceEur: firstNumber(priced[2]), ...(keepChecking ? { watch: true } : {}) }];
  if (/afford|unexpected|sent me a bill|bill for \d/.test(q) && firstNumber(q)) return ["check_affordability", { amountEur: firstNumber(q), what: "this cost" }];
  if (/remember|kwh/.test(q) && firstNumber(q)) return ["remember", { kind: "yearly_kwh", value: String(firstNumber(q)) }];
  if (/mortgage|apartment|buy a (home|house|flat)/.test(q)) return ["get_mortgage", {}];
  // "Spend 20% less at restaurants": the cut is worked out from the category's 12-month average, by run_scenario.
  // The years go along only when the question names them ("in 3 years"); otherwise it is a per-month answer.
  const cut = /(\d{1,3})\s?(%|percent)\s+(less|fewer|lower)|(cut|cutting|reduce|reducing|lower|lowering)\b.*?\bby\s+(\d{1,3})\s?(%|percent)/.exec(q);
  const cutCategory = CATEGORY.exec(q)?.[1];
  const years = /\b(\d{1,2})\s*years?\b/.exec(q)?.[1];
  if (cut && cutCategory) return ["run_scenario", { category: CATEGORY_WORDS[cutCategory], categoryCutPct: Number(cut[1] ?? cut[5]), ...(years ? { years: Number(years) } : {}) }];
  // Explaining the idea of a weekly budget is a lesson; asking what it is for them is the cash flow.
  const explainsBudget = /\b(explain|teach)\b/.test(q) || /what (is|are) (an?|the) (estimated )?weekly budget/.test(q);
  if (!explainsBudget && /payday|run out|end of the month|short|spend this week|this week|weekly budget|last until|below zero|negative balance/.test(q)) return ["get_cash_flow", {}];
  if (/bills?\b|subscription|gone up/.test(q)) return ["list_bills", {}];
  if (/where (is|does) my money|what should i change|how (can|could) i save|unusual|stands? out/.test(q)) return ["find_patterns", {}];
  if (/what if|if i (save|cut)|years?/.test(q)) return ["run_scenario", { billSavingPerMonth: /save/.test(q) ? (firstNumber(q) ?? 50) : 0, everydayCutPct: /cut/.test(q) ? 10 : 0, years: 5 }];
  if (/explain|teach|what (is|are)|why/.test(q)) return ["explain_concept", { concept: /fixed|spot/.test(q) ? "fixed-vs-spot" : /buffer|emergency/.test(q) ? "buffer-first" : /safe|weekly budget/.test(q) ? "safe-to-spend" : /compound|interest|invest/.test(q) ? "compound-growth" : "three-baskets" }];
  if (/spen[dt]|cost/.test(q) && cutCategory) return ["get_spending", { from: "2026-06-01", to: "2026-09-30", category: CATEGORY_WORDS[cutCategory], groupBy: "month" }];
  return null;
}

const INVESTIGATION = ["find_patterns", "search_offers", "run_scenario", "explain_concept", "prepare_action"];

// Words an answer from what the tools returned. Every number comes straight from a tool result.
function wordAnswer(results: { name: string; body: Json }[], question = ""): string {
  const of = (name: string) => results.find((r) => r.name === name)?.body;
  const offers = of("search_offers");
  const best = offers?.best as Json | undefined;
  const parts: string[] = [];
  const patterns = (of("find_patterns")?.patterns as Json[] | undefined)?.[0];
  if (patterns) parts.push(`The thing that stands out most: ${String(patterns.what)}.`);
  if (best) parts.push(`${String(best.provider)} looks cheapest at about ${best.estimatedMonthlyCostEur} euros a month, saving about ${best.estimatedYearlySavingEur} euros a year against your bill of ${offers?.currentBillMonthlyEur} euros a month. These are example offers, not live prices.`);
  else if (offers && typeof offers.note === "string" && offers.note.includes("No matching options found")) parts.push(`No matching options found for ${String(offers.requirements)}. Want me to widen it, or look further?`);
  else if (offers?.comparisonSupported === false) parts.push(`The example offers are on screen. To calculate a supported comparison, please give ${((offers.stillToConfirm as string[] | undefined) ?? []).join(", ")}.`);
  else if (offers) parts.push("No example offer is cheaper than your current bill.");
  const flats = of("search_flats") ?? of("search_prices");
  if (flats && typeof flats.watch === "string") {
    const fitting = Array.isArray(flats.withinBudget ?? flats.withinPrice) ? ((flats.withinBudget ?? flats.withinPrice) as unknown[]).length : 0;
    const homes = "budgetPerMonthEur" in flats;
    const found = fitting ? `${fitting} of the example ${homes ? "flats" : "offers"} fit.` : `None of the example ${homes ? "flats" : "offers"} is at your price today.`;
    parts.push(flats.watch.startsWith("PREPARED") ? `${found} Would you like me to keep checking for ${homes ? "homes that match these requirements" : "offers at this price"}? One tap on Approve starts it.` : `${found} ${flats.watch}`);
  } else if (flats && Array.isArray(flats.withinBudget ?? flats.withinPrice)) {
    parts.push(`${((flats.withinBudget ?? flats.withinPrice) as unknown[]).length} of the example ${"budgetPerMonthEur" in flats ? "flats" : "offers"} fit. Check each one's own page before you contact anyone.`);
  }
  const scenario = of("run_scenario");
  const categoryCut = scenario?.categoryCut as Json | undefined;
  // A cut of one category is answered per month and per year. The years ahead only when the tool projected them,
  // which it does only when the question asked about them.
  if (categoryCut) {
    parts.push(`Spending ${categoryCut.cutPct}% less on ${String(categoryCut.category).toLowerCase()} would free about ${categoryCut.freesPerMonthEur} euros a month, or ${categoryCut.freesPerYearEur} euros a year, from your 12-month average.`);
    if (typeof scenario?.extraAfterPeriodIfKeptEur === "number") parts.push(`Kept for ${(scenario.input as Json | undefined)?.years} years, that adds up to about ${scenario.extraAfterPeriodIfKeptEur} euros more.`);
  } else if (scenario) parts.push(`Keeping ${scenario.freedPerMonthEur} euros a month adds up to about ${scenario.extraAfterPeriodIfKeptEur} euros over the period.`);
  const afford = of("check_affordability");
  if (afford) parts.push(`That cost is ${String(afford.verdictMeans)}. Your balance straight after would be ${afford.balanceStraightAfterEur} euros.`);
  const cash = of("get_cash_flow");
  const weekly = cash?.estimatedWeeklyBudgetUntilPayday as Json | null | undefined;
  // "Why does my balance go below zero?" hears how often it did before the budget that helps avoid it.
  if (cash && /below zero|negative/i.test(question) && Number(cash.monthsBelowZeroInLast12) > 0) parts.push(`Your balance went below zero in ${cash.monthsBelowZeroInLast12} of the last 12 months.`);
  // A weekly figure far above the usual week is not a budget: the bills are covered, and this much is left after them.
  if (cash && weekly?.billsBeforePaydayCovered === true) parts.push(`Your bills before payday on ${String(cash.nextPaydayExpected)} are covered: about ${weekly.leftForSpendingEur} euros is left after them and a protected buffer of ${weekly.protectedBufferEur} euros.`);
  else if (cash && weekly) parts.push(`Your estimated weekly budget until payday on ${String(cash.nextPaydayExpected)} is about ${weekly.perWeekEur} euros, after your bills and a protected buffer of ${weekly.protectedBufferEur} euros.`);
  else if (cash) parts.push(`Your next payday is expected on ${String(cash.nextPaydayExpected)}, and your balance just before it should be about ${cash.expectedBalanceJustBeforePaydayEur} euros.`);
  const mortgage = of("get_mortgage");
  if (mortgage) parts.push(mortgage.onRecord ? `Your mortgage application was ${String(mortgage.decision)}: a loan of ${mortgage.loanEur} euros on a home priced at ${mortgage.propertyPriceEur} euros.` : "There is no mortgage application on record for you.");
  const bills = of("list_bills");
  if (bills) parts.push(`Your recurring bills add up to ${bills.allBillsYearlyEur} euros a year.`);
  const spending = of("get_spending");
  if (spending) parts.push(`You spent ${spending.totalSpentEur} euros on ${String(spending.filter)} across ${spending.transactions} purchases in that period.`);
  if (of("remember")?.saved) parts.push("I will remember that. You can ask me to forget it at any time.");
  if (of("prepare_action")?.prepared) parts.push("I have prepared it for you to review. Nothing happens until you tap Approve, and even then it is a simulation.");
  const lesson = of("explain_concept");
  if (lesson) {
    const personal = lesson.personalContext as Json | undefined;
    parts.push(`${String(lesson.idea)}${personal ? ` Your essentials average €${personal.essentialsPerMonthEur} a month, so three months is €${personal.threeMonthBufferEur}.` : ""} ${String(lesson.questionToAsk)}`);
  }
  const failed = results.find((r) => typeof r.body.error === "string");
  if (!parts.length && failed) parts.push(`I could not do that: ${String(failed.body.error)}`);
  return `Mock answer. ${parts.join(" ") || "Done."}`;
}

export async function* scriptedMockModel(options: StreamOptions): AsyncGenerator<ModelChunk> {
  const { messages } = options;
  const system = String(messages.find((m) => m.role === "system")?.content ?? "");
  const investigating = system.includes("INVESTIGATION MODE");
  // The real question is the last user message that is not one of the orchestrator's own nudges.
  const userIndex = messages.reduce((last, m, i) => (m.role === "user" && typeof m.content === "string" && !/^(Keep going|Go ahead)/.test(m.content) ? i : last), -1);
  const question = userIndex >= 0 ? String(messages[userIndex].content) : "";
  const after = messages.slice(userIndex + 1);
  const called = after.flatMap((m) => (m.role === "assistant" ? (m.tool_calls ?? []).map((c) => c.function.name) : []));
  const callIds = new Map(after.flatMap((m) => (m.role === "assistant" ? (m.tool_calls ?? []).map((c): [string, string] => [c.id, c.function.name]) : [])));
  const results = after.flatMap((m: ChatMessage) => (m.role === "tool" ? [{ name: callIds.get(m.tool_call_id) ?? "", body: parse(m.content) }] : []));
  const canCallTools = options.tools.length > 0;

  if (investigating && canCallTools) {
    const next = INVESTIGATION.find((name) => !called.includes(name));
    const best = results.find((r) => r.name === "search_offers")?.body.best as Json | undefined;
    if (next === "find_patterns") return yield* callTool(next, {});
    if (next === "search_offers") return yield* callTool(next, { billType: "electricity" });
    if (next === "run_scenario") return yield* callTool(next, { billSavingPerMonth: Number(best?.estimatedMonthlySavingEur ?? 0), everydayCutPct: 0, years: 5 });
    if (next === "explain_concept") return yield* callTool(next, { concept: "switching-bills" });
    if (next === "prepare_action" && best) return yield* callTool(next, { kind: "switch_contract", billType: "electricity" });
  } else if (canCallTools && !called.length) {
    const clarify = clarifyingQuestion(question);
    if (clarify) return yield* speak(clarify);
    const tool = firstTool(question);
    if (tool) return yield* callTool(tool[0], tool[1]);
  } else if (canCallTools && called.length === 1 && called[0] === "search_offers" && (/prepare|switch me|set (it|that) up|go ahead/i.test(question) || results.some(r => r.name === "search_offers" && r.body.comparisonSupported === true && r.body.best))) {
    return yield* callTool("prepare_action", { kind: "switch_contract", billType: "electricity" });
  }

  if (results.length) return yield* speak(wordAnswer(results, question));
  const perWeek = /"estimatedWeeklyBudgetUntilPayday":\{"perWeekEur":\s*([\d.]+)/.exec(system)?.[1];
  const left = /"billsBeforePaydayCovered":true,"leftAfterBillsAndBufferEur":\s*([\d.]+)/.exec(system)?.[1];
  const outlook = left ? `Your bills before payday are covered: about ${left} euros is left after them and the buffer.` : perWeek ? `Your estimated weekly budget until payday is about ${perWeek} euros.` : null;
  yield* speak(outlook ? `Mock answer. ${outlook} Try asking for a cheaper electricity deal, whether you can afford a phone repair, or where your money goes.` : "Mock answer. Try asking for a cheaper electricity deal.");
}
