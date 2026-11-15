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

// One step: which tool the scripted model would call for this question, or null to answer in words.
function firstTool(question: string): [string, Json] | null {
  const q = question.toLowerCase();
  // "Find me electricity contracts of 12 months or less" names the bill and a contract but no "cheaper": still a search.
  const offer = speculate(question) ?? (/\b(contracts?|plans?|tariffs?)\b/.test(q) ? speculate(`cheaper ${question}`) : null);
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
  if (/payday|run out|end of the month|short/.test(q)) return ["get_cash_flow", {}];
  if (/bills?\b|subscription|gone up/.test(q)) return ["list_bills", {}];
  if (/where (is|does) my money|what should i change|how (can|could) i save|unusual|stands? out/.test(q)) return ["find_patterns", {}];
  if (/what if|if i (save|cut)|years?/.test(q)) return ["run_scenario", { billSavingPerMonth: /save/.test(q) ? (firstNumber(q) ?? 50) : 0, everydayCutPct: /cut/.test(q) ? 10 : 0, years: 5 }];
  if (/explain|teach|what (is|are)|why/.test(q)) return ["explain_concept", { concept: /fixed|spot/.test(q) ? "fixed-vs-spot" : /buffer|emergency/.test(q) ? "buffer-first" : /safe|weekly budget/.test(q) ? "safe-to-spend" : /compound|interest|invest/.test(q) ? "compound-growth" : "three-baskets" }];
  if (/spen[dt]|cost/.test(q) && /(restaurant|grocer|transport|entertain|health|travel)/.test(q)) {
    const category = { restaurant: "Restaurants", grocer: "Groceries", transport: "Transportation", entertain: "Entertainment", health: "Health", travel: "Travel" }[/(restaurant|grocer|transport|entertain|health|travel)/.exec(q)![1]];
    return ["get_spending", { from: "2026-06-01", to: "2026-09-30", category, groupBy: "month" }];
  }
  return null;
}

const INVESTIGATION = ["find_patterns", "search_offers", "run_scenario", "explain_concept", "prepare_action"];

// Words an answer from what the tools returned. Every number comes straight from a tool result.
function wordAnswer(results: { name: string; body: Json }[]): string {
  const of = (name: string) => results.find((r) => r.name === name)?.body;
  const offers = of("search_offers");
  const best = offers?.best as Json | undefined;
  const parts: string[] = [];
  const patterns = (of("find_patterns")?.patterns as Json[] | undefined)?.[0];
  if (patterns) parts.push(`The thing that stands out most: ${String(patterns.what)}.`);
  if (best) parts.push(`${String(best.provider)} looks cheapest at about ${best.estimatedMonthlyCostEur} euros a month, saving about ${best.estimatedYearlySavingEur} euros a year against your bill of ${offers?.currentBillMonthlyEur} euros a month. These are example offers, not live prices.`);
  else if (offers && typeof offers.note === "string" && offers.note.includes("No matching options found")) parts.push(`No matching options found for ${String(offers.requirements)}. Want me to widen it, or look further?`);
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
  if (scenario) parts.push(`Keeping ${scenario.freedPerMonthEur} euros a month adds up to about ${scenario.extraAfterPeriodIfKeptEur} euros over the period.`);
  const afford = of("check_affordability");
  if (afford) parts.push(`That cost is ${String(afford.verdictMeans)}. Your balance straight after would be ${afford.balanceStraightAfterEur} euros.`);
  const cash = of("get_cash_flow");
  const weekly = cash?.estimatedWeeklyBudgetUntilPayday as Json | null | undefined;
  if (cash && weekly) parts.push(`Your estimated weekly budget until payday on ${String(cash.nextPaydayExpected)} is about ${weekly.perWeekEur} euros, after your bills and a small buffer.`);
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
  if (lesson) parts.push(`${String(lesson.idea)} ${String(lesson.questionToAsk)}`);
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
    const tool = firstTool(question);
    if (tool) return yield* callTool(tool[0], tool[1]);
  } else if (canCallTools && called.length === 1 && called[0] === "search_offers" && /prepare|switch me|set (it|that) up|go ahead/i.test(question)) {
    return yield* callTool("prepare_action", { kind: "switch_contract", billType: "electricity" });
  }

  if (results.length) return yield* speak(wordAnswer(results));
  const perWeek = /"estimatedWeeklyBudgetUntilPayday":\{"perWeekEur":\s*([\d.]+)/.exec(system)?.[1];
  yield* speak(perWeek ? `Mock answer. Your estimated weekly budget until payday is about ${perWeek} euros. Try asking for a cheaper electricity deal, whether you can afford a phone repair, or where your money goes.` : "Mock answer. Try asking for a cheaper electricity deal.");
}
