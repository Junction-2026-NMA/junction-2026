// "Worth checking": things outside the customer's account that their own figures make relevant. A rule that may
// pay them money, what their housing costs elsewhere, what spare cash could earn. Code decides which questions
// fit this customer; Exa researches each across several sources and writes up what it found.
//
// What Sisu does not do here: decide that the customer qualifies for anything, or turn a web finding into a euro
// figure of theirs. It shows the finding, where it came from, and the customer's own figure beside it.
import { fact } from "@/lib/finance/facts";
import type { Citation, Fact, FactUnit, Overview, Pattern, PlanCheck } from "@/lib/types";
import { getConfig } from "./config";
import { checkGrounding } from "./grounding";
import { exaResearch } from "./research/exa";
import { safeExcerpt, safeTitle } from "./tools/untrusted";

export type CheckSpec = { id: string; title: string; query: string; yours: { label: string; value: number; unit: FactUnit } | null };

const MAX_CHECKS = 2;
const ALLOWANCE_INCOME_CEILING_EUR = 2_300; // above this a housing allowance question is not worth the customer's time
const FINDING_CHARS = 420;
const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, "");

// Which questions this customer's own figures make worth asking, most valuable first. Queries carry the city and
// the topic only: never a balance, an income or an ID.
export function checksFor(overview: Overview, patterns: Pattern[], city: string): CheckSpec[] {
  const housing = overview.recurringBills.find((bill) => bill.category === "Housing") ?? null;
  const idle = patterns.find((pattern) => pattern.kind === "idle-cash")?.facts.find((f) => f.id === "idle:above-buffer") ?? null;
  const year = overview.windowTo.slice(0, 4);
  const specs: (CheckSpec | null)[] = [
    housing && overview.monthlyIncome < ALLOWANCE_INCOME_CEILING_EUR
      ? { id: "housing-allowance", title: "Could you get housing allowance from Kela?", query: `Kela general housing allowance ${year}: who can get it and the income limit for one adult renting in ${city}`, yours: { label: "Your income, as it arrives in your account", value: overview.monthlyIncome, unit: "EUR/month" } }
      : null,
    idle ? { id: "savings-rate", title: "What could your spare cash earn?", query: `best savings account and fixed-term deposit interest rates in Finland ${year}`, yours: { label: "Your balance above a six-month buffer", value: idle.value, unit: "EUR" } } : null,
    housing ? { id: "housing-cost", title: `Is your housing cost normal for ${city}?`, query: `typical monthly rent for a one-room apartment in ${city} ${year}`, yours: { label: "Your housing payment", value: housing.monthlyAvg, unit: "EUR/month" } } : null,
  ];
  return specs.filter((spec): spec is CheckSpec => spec !== null).slice(0, MAX_CHECKS);
}

const tidy = (answer: string): string => answer.replace(/\s*\[\d+\]/g, "").replace(/\s+/g, " ").trim();

export async function runCheck(spec: CheckSpec, signal?: AbortSignal): Promise<PlanCheck> {
  const started = Date.now();
  const base = { id: spec.id, title: spec.title, query: spec.query, yours: spec.yours };
  if (getConfig().isMock) {
    return { ...base, ok: true, finding: "Example finding. In mock mode no search is made, so there is nothing real to report here.", figuresConfirmed: false, sources: [{ title: "Mock source (example data)", url: "https://example.com/mock-source", retrievedAt: new Date().toISOString(), cacheAgeMs: null }], tookMs: Date.now() - started, mock: true };
  }
  try {
    const research = await exaResearch(spec.query, signal);
    const retrievedAt = new Date().toISOString();
    const sources: Citation[] = research.sources.map((source) => ({ title: safeTitle(source.title, hostOf(source.url)), url: source.url, retrievedAt, cacheAgeMs: null }));
    // What Exa wrote is text from the web: instruction-like sentences are removed before anyone sees it.
    const finding = safeExcerpt(tidy(research.answer), FINDING_CHARS).text || null;
    // The figures in the write-up are checked against the excerpts Exa returned from the pages themselves.
    const figuresConfirmed = finding !== null && checkGrounding(finding, [], research.excerpts, []).ok;
    return { ...base, ok: finding !== null || sources.length > 0, finding, figuresConfirmed, sources, tookMs: Date.now() - started, mock: false };
  } catch (error) {
    console.error(`[plan] check "${spec.id}" failed:`, (error as Error).message);
    return { ...base, ok: false, finding: null, figuresConfirmed: false, sources: [], tookMs: Date.now() - started, mock: false };
  }
}

// Receipts for the customer's own figures shown beside a finding.
export const checkFacts = (checks: PlanCheck[]): Fact[] => checks.flatMap((check) => (check.yours ? [fact(`check:${check.id}:yours`, check.yours.label, check.yours.value, check.yours.unit, "from your account")] : []));
