// Builds the content of an action from data the SERVER holds: the finished offer research and the customer's
// own numbers. The model passes only a bill type or an amount, so it cannot invent an offer, a price or a saving.
import { peekResearch } from "@/lib/agent/research";
import { toResult } from "@/lib/agent/research/compare";
import { findCustomer } from "@/lib/finance/data";
import { fact } from "@/lib/finance/facts";
import { round2 } from "@/lib/finance/math";
import { buildOverview } from "@/lib/finance/overview";
import { cleanInput, runScenario } from "@/lib/finance/scenario";
import { billFor, billLabel, getMemory, statedYearlyKwh } from "@/lib/memory";
import type { ActionImpact, AgentAction, BillType, Offer } from "@/lib/types";
import type { ActionDraft } from "./index";

const IMPACT_YEARS = 5;
export const TRANSFER_LIMITS: [number, number] = [5, 2_000];
const BILL_NOUN: Record<BillType, string> = { electricity: "electricity contract", mobile: "mobile plan", internet: "home internet contract" };

export type DraftResult = { ok: true; draft: ActionDraft } | { ok: false; status: 400 | 404 | 409; reason: string };

const CHECKLIST: Record<BillType, (offer: Offer) => string[]> = {
  electricity: (offer) => [
    "Check when your current contract ends. A fixed-term contract usually cannot be ended early without a fee.",
    "Find your metering point number on a recent electricity bill. The new seller needs it.",
    `Order ${offer.plan ?? "the contract"} from ${offer.provider} on their own page, and check the price there first.`,
    "The new seller ends your old sales contract for you. Your grid (distribution) contract stays as it is.",
    "A switch normally takes about two weeks, and an online order can be cancelled within 14 days.",
  ],
  mobile: (offer) => [
    "Check whether your current plan has a fixed term still running.",
    `Order ${offer.plan ?? "the plan"} from ${offer.provider} and ask to keep your number.`,
    "The new operator moves the number and closes the old plan for you.",
    "An online order can be cancelled within 14 days.",
  ],
  internet: (offer) => [
    "Check your current contract's notice period, and whether your building already has a shared connection.",
    `Check that ${offer.provider} delivers ${offer.plan ?? "this connection"} at your address.`,
    "Order the new connection first, then end the old one once the new one works.",
    "An online order can be cancelled within 14 days.",
  ],
};

const draftMessage = (offer: Offer, billType: BillType): string =>
  [
    `Hello ${offer.provider},`,
    "",
    `I would like to order ${offer.plan ?? `your ${BILL_NOUN[billType]}`}${offer.contractMonths ? ` (${offer.contractMonths} months)` : ""} as shown on your page.`,
    billType === "electricity" ? "Metering point number: [from your electricity bill]" : "Current number or address: [fill in]",
    "Please confirm the price and the start date before the contract begins.",
    "",
    "Kind regards,",
    "[your name]",
  ].join("\n");

// A contract switch, built from finished offer research. `provider` picks one offer; without it the best one is used.
export function buildSwitchDraft(customerId: string, billType: BillType, options: { provider?: string; preparedBy: AgentAction["preparedBy"] }): DraftResult {
  const customer = findCustomer(customerId);
  const overview = buildOverview(customerId);
  if (!customer || !overview) return { ok: false, status: 404, reason: "We could not find that customer." };

  const raw = peekResearch(`${billType}:${customer.area.toLowerCase()}`);
  if (!raw || raw.status !== "done") return { ok: false, status: 409, reason: `Look up today's ${billType} offers first (search_offers), then prepare the switch.` };

  const memory = getMemory(customerId);
  const match = billFor(overview, memory, billType);
  const research = toResult(raw, match?.bill.monthlyAvg ?? null, billType === "electricity" ? statedYearlyKwh(memory) : null);
  const wanted = options.provider?.trim().toLowerCase();
  const offer = wanted ? research.offers.find((o) => o.comparable && o.provider.toLowerCase().includes(wanted)) : research.best;
  if (!offer) return { ok: false, status: 409, reason: wanted ? "That provider is not among the comparable offers Sisu found." : "No offer found today is cheaper than the current bill, so there is nothing to switch to." };
  const yearly = offer.estimatedYearlySavingEur ?? 0;
  if (yearly <= 0) return { ok: false, status: 409, reason: `${offer.provider} would not be cheaper than the current bill on these estimates.` };

  const monthly = round2(yearly / 12);
  const source = research.citations.find((c) => c.url === offer.sourceUrl);
  const label = match ? billLabel(match.bill, memory) : null;
  return {
    ok: true,
    draft: {
      kind: "switch_contract",
      title: `Switch ${BILL_NOUN[billType]} to ${offer.provider}${offer.plan ? ` (${offer.plan})` : ""}`,
      summary: `Estimated saving about €${Math.round(yearly)} a year (€${monthly.toFixed(2)} a month) against your current bill of €${(research.baselineMonthlyEur ?? 0).toFixed(2)} a month. Simulation only: Sisu does not contact the provider.`,
      checklist: CHECKLIST[billType](offer),
      draftMessage: draftMessage(offer, billType),
      billType,
      offer,
      monthlyAmountEur: monthly,
      facts: [
        fact("action:current-bill", "Current bill per month", research.baselineMonthlyEur ?? 0, "EUR/month", `average of the last 12 months${label && !label.confirmed ? "; the bill's name is Sisu's guess" : ""}`, match ? { evidence: { from: overview.windowFrom, to: overview.windowTo, category: match.bill.category } } : {}),
        fact("action:offer-monthly", `${offer.provider}, estimated cost per month`, offer.estimatedMonthlyCostEur ?? 0, "EUR/month", "price extracted from the provider's page, applied to your estimated use", { source: "context.dev", url: offer.sourceUrl }),
        fact("action:saving-yearly", "Estimated saving per year", yearly, "EUR/year", "current bill minus the offer's estimated cost, times 12", { source: "calculation" }),
        fact("action:saving-monthly", "Estimated saving per month", monthly, "EUR/month", "yearly saving divided by 12", { source: "calculation" }),
        ...(research.assumedYearlyKwh === null ? [] : [fact("action:kwh", "Yearly electricity use in the estimate", research.assumedYearlyKwh, "kWh/year", research.usageSource === "stated" ? "the figure you gave" : "estimated from your bill", { source: research.usageSource === "stated" ? "customer-stated" : "assumption" })]),
      ],
      sources: source ? [source] : research.citations,
      assumptions: [...research.assumptions, "Switching steps are the usual ones in Finland. The provider's own terms decide."],
      preparedBy: options.preparedBy,
    },
  };
}

// A monthly transfer to savings on payday. The amount is checked against what the customer's own numbers leave over.
export function buildTransferDraft(customerId: string, monthlyAmountEur: number, options: { preparedBy: AgentAction["preparedBy"] }): DraftResult {
  const overview = buildOverview(customerId);
  if (!overview) return { ok: false, status: 404, reason: "We could not find that customer." };
  if (!Number.isFinite(monthlyAmountEur) || monthlyAmountEur < TRANSFER_LIMITS[0] || monthlyAmountEur > TRANSFER_LIMITS[1]) {
    return { ok: false, status: 400, reason: `A monthly transfer must be between €${TRANSFER_LIMITS[0]} and €${TRANSFER_LIMITS[1]}.` };
  }
  const amount = round2(monthlyAmountEur);
  const safe = overview.safeToSpend;
  if (amount > safe.perMonth) return { ok: false, status: 409, reason: `€${amount.toFixed(0)} a month is more than the €${safe.perMonth.toFixed(0)} left after must-pay costs, so it cannot be set aside.` };
  const overRoom = round2(amount - Math.max(safe.gapPerMonth, 0));

  return {
    ok: true,
    draft: {
      kind: "standing_transfer",
      title: `Move €${amount.toFixed(0)} to savings each payday`,
      summary: `A standing transfer of €${amount.toFixed(2)} a month, €${Math.round(amount * 12)} a year. Simulation only: no transfer is created.`,
      checklist: ["Choose the savings account the money goes to.", "Set the transfer for the day after payday, so it leaves before everyday spending starts.", "Review the amount after three months."],
      draftMessage: null,
      billType: null,
      offer: null,
      monthlyAmountEur: amount,
      facts: [
        fact("transfer:monthly", "Transfer per month", amount, "EUR/month", "the amount asked for", { source: "customer-stated" }),
        fact("transfer:yearly", "Set aside per year", amount * 12, "EUR/year", "monthly amount times 12", { source: "calculation" }),
        fact("transfer:room", "Left over in an average month today", safe.gapPerMonth, "EUR/month", "safe to spend minus actual everyday spending", { source: "calculation" }),
      ],
      sources: [],
      assumptions: [
        overRoom > 0 ? `This is €${overRoom.toFixed(0)} a month more than is left over today, so everyday spending would need to fall by that much.` : "This fits inside what is left over in an average month today.",
        "Income and spending are taken at their 12-month averages.",
      ],
      preparedBy: options.preparedBy,
    },
  };
}

// What approving the action would do to the customer's future, from the same scenario engine as the futures chart.
export function impactOf(action: AgentAction): ActionImpact | null {
  const overview = buildOverview(action.customerId);
  if (!overview) return null;
  const monthly = action.monthlyAmountEur;
  if (action.kind === "standing_transfer") {
    return { monthlyEur: monthly, yearlyEur: round2(monthly * 12), horizonYears: IMPACT_YEARS, branches: [], gainVsNothingEur: 0, summary: `€${Math.round(monthly * 12 * IMPACT_YEARS)} set aside over ${IMPACT_YEARS} years. This moves your own money; it does not create new money.` };
  }
  const input = cleanInput({ billSavingPerMonth: monthly, everydayCutPct: 0, years: IMPACT_YEARS });
  if (typeof input === "string") return null;
  const result = runScenario(overview, input);
  const end = (id: string) => result.branches.find((branch) => branch.id === id)?.endTotal ?? 0;
  const gain = round2(end("save") - end("nothing"));
  return {
    monthlyEur: monthly,
    yearlyEur: round2(monthly * 12),
    horizonYears: IMPACT_YEARS,
    branches: result.branches.map((b) => ({ id: b.id, label: b.label, endTotal: b.endTotal, endLow: b.endLow, endHigh: b.endHigh })),
    gainVsNothingEur: gain,
    summary: `About €${Math.round(gain)} more after ${IMPACT_YEARS} years if the saving is simply kept.`,
  };
}
