// The tools the model may choose from.
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

// Every character here is read by the model on every step (about 10 ms per 1,000 characters on our GPU, measured in
// tests/gauntlet/results), so descriptions say when to use the tool and nothing more.
export const TOOL_SCHEMAS: ToolSchema[] = [
  tool(
    "get_spending",
    "Exact spending total and count for any period, optionally by category, merchant type or basket, optionally split. Also returns the largest purchases.",
    {
      from: { type: "string", description: "YYYY-MM-DD" },
      to: { type: "string", description: "YYYY-MM-DD" },
      category: { type: "string", enum: CATEGORIES },
      merchantType: { type: "string", enum: MERCHANT_TYPES },
      basket: { type: "string", enum: BASKET_ORDER },
      groupBy: { type: "string", enum: GROUPINGS },
    },
    ["from", "to"],
  ),
  tool("list_bills", "Recurring bills: yearly cost, change on a year ago, and whether each name is confirmed.", {}),
  tool("get_cash_flow", "Pay cycles: how fast money goes after payday, lowest balance each cycle, bills due before the next payday.", {}),
  tool("find_patterns", "Scans the history for what stands out, ranked by yearly euros. For open questions: where does my money go, what should I change, how can I save.", {}),
  tool("check_affordability", "Can the customer absorb a one-off or unexpected cost now?", { amountEur: { type: "number" }, what: { type: "string" } }, ["amountEur"]),
  tool(
    "run_scenario",
    "Projects three futures (change nothing, keep the cash, invest it). For what-if questions and what a saving adds up to.",
    { billSavingPerMonth: { type: "number", description: "euros, 0 if none" }, everydayCutPct: { type: "number", description: "0 to 50" }, years: { type: "number", description: "1 to 10" } },
    ["billSavingPerMonth", "everydayCutPct", "years"],
  ),
  tool(
    "search_offers",
    "Live search for current Finnish offers for one bill, with the saving computed against the customer's real bill.",
    { billType: { type: "string", enum: BILL_TYPES }, yearlyKwh: { type: "number", description: "electricity only, ONLY if the customer said it" } },
    ["billType"],
  ),
  tool("web_search", "Live web search for outside facts (rules, benefits, rates). No personal figures in the query.", { query: { type: "string" } }, ["query"]),
  tool("explain_concept", "A short lesson from the customer's own numbers, ending in one question to ask them.", { concept: { type: "string", enum: CONCEPTS } }, ["concept"]),
  tool(
    "prepare_action",
    "Prepares an action for the customer to approve on screen; never carries it out. switch_contract needs search_offers first.",
    {
      kind: { type: "string", enum: ACTION_KINDS },
      billType: { type: "string", enum: BILL_TYPES },
      provider: { type: "string", description: "from search_offers, if the customer chose one" },
      monthlyAmountEur: { type: "number", description: "standing_transfer: the amount the customer said" },
    },
    ["kind"],
  ),
  tool(
    "remember",
    "Saves a lasting fact the customer just told you about themselves.",
    {
      kind: { type: "string", enum: MEMORY_KINDS },
      value: { type: "string", description: "their words; for yearly_kwh the number only" },
      billId: { type: "string", description: "bill_name: e.g. utilities-2" },
      billType: { type: "string", enum: BILL_TYPES },
    },
    ["kind", "value"],
  ),
];
