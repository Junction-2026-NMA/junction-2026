// The tools the model may choose from. Descriptions are written for the model: when to use each, and what not to do.
import { BASKET_ORDER, MCC_LABELS } from "@/lib/finance/baskets";
import { CONCEPTS } from "@/lib/finance/teaching";
import type { BillType } from "@/lib/types";
import type { ToolSchema } from "../model";

export const BILL_TYPES: BillType[] = ["electricity", "mobile", "internet"];
export const CATEGORIES = ["Housing", "Utilities", "Health", "Home & Tech", "Groceries", "Restaurants", "Transportation", "Entertainment", "Lifestyle", "Travel"];
export const MERCHANT_TYPES = [...new Set(Object.values(MCC_LABELS))];
export const GROUPINGS = ["month", "category", "merchantType"];
export const MEMORY_KINDS = ["yearly_kwh", "bill_name", "preference", "goal"];
export const ACTION_KINDS = ["switch_contract", "standing_transfer"];

const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolSchema => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOL_SCHEMAS: ToolSchema[] = [
  tool(
    "get_spending",
    "Exact total and count of the customer's spending for a period, optionally narrowed by category, merchant type or basket, and optionally split by month, category or merchant type. Use for 'how much did I spend on taxis last month', 'which month was most expensive', 'what was my biggest purchase'.",
    {
      from: { type: "string", description: "Start date, YYYY-MM-DD" },
      to: { type: "string", description: "End date, YYYY-MM-DD" },
      category: { type: "string", enum: CATEGORIES },
      merchantType: { type: "string", enum: MERCHANT_TYPES, description: "Narrower than category, e.g. Taxi, Fast food, Pharmacy" },
      basket: { type: "string", enum: BASKET_ORDER, description: "regular = must pay every month, irregular = must pay now and then, everyday = everyday choices" },
      groupBy: { type: "string", enum: GROUPINGS, description: "Optional: split the total this way" },
    },
    ["from", "to"],
  ),
  tool("list_bills", "The customer's recurring bills with yearly cost, how much each has changed against a year ago, and whether its name is confirmed or still a guess. Use for questions about bills, subscriptions or fixed costs.", {}),
  tool("get_cash_flow", "Pay-cycle view: payday, how fast money goes after it, the lowest balance each cycle, bills due before the next payday and the balance expected just before it. Use for 'will I make it to payday', 'when do I run low', 'why am I short at the end of the month'.", {}),
  tool("find_patterns", "Scans the customer's own history for things worth attention (a bill that crept up, a category growing fast, spending above peers, going below zero, small purchases adding up, idle cash), ranked by yearly euros. Use for open questions: 'where does my money go', 'what should I change', 'anything unusual', 'how can I save'.", {}),
  tool(
    "check_affordability",
    "Works out whether the customer can absorb a one-off cost now, from their balance, the bills due before payday and their usual spending. Use for 'can I afford X' and for unexpected expenses.",
    { amountEur: { type: "number", description: "The cost in euros, as the customer said it" }, what: { type: "string", description: "What it is for, a few words" } },
    ["amountEur"],
  ),
  tool(
    "run_scenario",
    "Projects three futures (change nothing, keep the cash, invest it) from the customer's real averages. Use for what-if questions.",
    {
      billSavingPerMonth: { type: "number", description: "Euros saved per month by switching a contract, 0 if none" },
      everydayCutPct: { type: "number", description: "Percent of everyday spending trimmed, 0 to 50" },
      years: { type: "number", description: "How many years ahead, 1 to 10" },
    },
    ["billSavingPerMonth", "everydayCutPct", "years"],
  ),
  tool(
    "search_offers",
    "Live search for current Finnish offers for one of the customer's bills, with the yearly saving computed against their real bill.",
    { billType: { type: "string", enum: BILL_TYPES }, yearlyKwh: { type: "number", description: "Electricity only: the customer's yearly use in kWh, ONLY if they said it. Never guess." } },
    ["billType"],
  ),
  tool("web_search", "Live web search for current outside facts (rules, benefits, rates, general prices). Do not include the customer's personal figures in the query.", { query: { type: "string" } }, ["query"]),
  tool("explain_concept", "A short lesson built from the customer's own numbers, with one question to ask them before revealing the answer. Use when they ask what something means or why it matters, and to teach after showing a result.", { concept: { type: "string", enum: CONCEPTS } }, ["concept"]),
  tool(
    "prepare_action",
    "Prepares an action for the customer to approve on screen. It never carries anything out. switch_contract needs a search_offers result first; standing_transfer needs the monthly amount the customer asked for. Use when they say 'do it', 'switch me', 'set that up'.",
    {
      kind: { type: "string", enum: ACTION_KINDS },
      billType: { type: "string", enum: BILL_TYPES, description: "switch_contract only" },
      provider: { type: "string", description: "switch_contract only: a provider from the search_offers result, if the customer chose one" },
      monthlyAmountEur: { type: "number", description: "standing_transfer only: euros per month, as the customer said" },
    },
    ["kind"],
  ),
  tool(
    "remember",
    "Saves a lasting fact the customer has just told you about themselves, so Sisu knows it next time: their yearly kWh, which bill is which, a preference, a goal. Only use for something the customer said in this conversation.",
    {
      kind: { type: "string", enum: MEMORY_KINDS },
      value: { type: "string", description: "The fact, in the customer's words. For yearly_kwh, the number only." },
      billId: { type: "string", description: "bill_name only: the bill's id from list_bills, e.g. utilities-2" },
      billType: { type: "string", enum: BILL_TYPES, description: "bill_name only: which kind of bill it is, if it is one of these" },
    },
    ["kind", "value"],
  ),
];
