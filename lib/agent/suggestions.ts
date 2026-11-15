// The next steps Sisu offers as buttons: under every answer, and on an empty Talk screen.
// Built in code from the customer's own numbers and what happened this turn, so every button leads to something
// Sisu can really do (search, set up a transfer, start a watch, draw a chart) and no figure on a button is invented.
import { findPatterns } from "@/lib/finance/patterns";
import { savingRoom } from "@/lib/finance/saving";
import type { AffordabilityVerdict, AgentAction, BillType, CashFlow, Overview, PropertyWatch, ResearchResult, Suggestion, SuggestionKind } from "@/lib/types";

const FOLLOW_UPS = 3;
const STARTERS = 4;
const CUT_PCT = 20;
const MIN_SAVE_NOW_EUR = 20;
const MIN_SAVE_MONTHLY_EUR = 10;
const RENT_STEP_EUR = 50;

type Lang = "en" | "fi";
type Words = {
  bill: Record<BillType, string>;
  investigate: [string, string];
  cheaper: (bill: string) => [string, string];
  cut: (category: string) => [string, string];
  payday: [string, string];
  saveNow: (eur: number) => [string, string];
  saveMonthly: (eur: number) => [string, string];
  chart: [string, string];
  peers: [string, string];
  rent: (city: string, eur: number) => [string, string];
  future: (eur: number) => [string, string];
  untilAfford: (eur: number) => [string, string];
  setUp: [string, string];
  watchFound: [string, string];
};

// [button label, the question it sends]
const WORDS: Record<Lang, Words> = {
  en: {
    bill: { electricity: "electricity deal", mobile: "mobile plan", internet: "broadband deal" },
    investigate: ["Look into my finances", "Look into my finances"],
    cheaper: (bill) => [`Find a cheaper ${bill}`, `Find me a cheaper ${bill}`],
    cut: (category) => [`${CUT_PCT}% less on ${category}?`, `What if I spend ${CUT_PCT}% less on ${category}?`],
    payday: ["Why do I run short?", "Why do I keep running out of money before payday?"],
    saveNow: (eur) => [`Move €${eur} to savings`, `Move ${eur} euros to my savings now`],
    saveMonthly: (eur) => [`Save €${eur} every month`, `Move ${eur} euros to my savings every month`],
    chart: ["Show it as a chart", "Show where my money goes as a chart"],
    peers: ["Me vs people my age", "Show me against people my age"],
    rent: (city, eur) => [`Watch rents under €${eur}`, `Find me a flat in ${city} under ${eur} euros`],
    future: (eur) => [`What €${eur} a month becomes`, `What does ${eur} euros a month add up to in 5 years?`],
    untilAfford: (eur) => ["When can I afford it?", `How long until I have ${eur} euros?`],
    setUp: ["What have you set up?", "What have you set up for me so far?"],
    watchFound: ["Did my watch find anything?", "Did my watch find anything?"],
  },
  fi: {
    bill: { electricity: "sähkösopimus", mobile: "puhelinliittymä", internet: "laajakaista" },
    investigate: ["Käy raha-asiani läpi", "Käy raha-asiani läpi"],
    cheaper: (bill) => [`Etsi halvempi ${bill}`, `Etsi minulle halvempi ${bill}`],
    cut: (category) => [`${CUT_PCT} % vähemmän: ${category}?`, `Entä jos käytän ${CUT_PCT} % vähemmän kategoriaan ${category}?`],
    payday: ["Miksi rahat loppuvat?", "Miksi rahani loppuvat ennen palkkapäivää?"],
    saveNow: (eur) => [`Siirrä ${eur} € säästöön`, `Siirrä ${eur} euroa säästötililleni nyt`],
    saveMonthly: (eur) => [`Säästä ${eur} € kuussa`, `Siirrä ${eur} euroa säästötililleni joka kuukausi`],
    chart: ["Näytä kaaviona", "Näytä rahojeni käyttö kaaviona"],
    peers: ["Minä vs ikätoverit", "Vertaa minua samanikäisiin"],
    rent: (city, eur) => [`Vahdi alle ${eur} € vuokria`, `Etsi minulle asunto ${city} alle ${eur} euroa`],
    future: (eur) => [`Mitä ${eur} € kuussa tuottaa`, `Paljonko ${eur} euroa kuussa kasvaa 5 vuodessa?`],
    untilAfford: (eur) => ["Milloin minulla on varaa?", `Kauanko kestää, että minulla on ${eur} euroa?`],
    setUp: ["Mitä olet valmistellut?", "Mitä olet valmistellut minulle tähän mennessä?"],
    watchFound: ["Löysikö vahti jotain?", "Löysikö vahtini jotain?"],
  },
};

const KIND_IS_AGENTIC: Record<SuggestionKind, boolean> = { ask: false, show: false, act: true, watch: true, investigate: true };
const make = (id: string, kind: SuggestionKind, [label, prompt]: [string, string]): Suggestion => ({ id, label, prompt, kind, agentic: KIND_IS_AGENTIC[kind] });
const langOf = (language?: string | null): Lang => (language === "fi" ? "fi" : "en");

export type SuggestionState = { overview: Overview; cashFlow: CashFlow; city: string; language?: string | null; actions: AgentAction[]; watches: PropertyWatch[] };

// Every next step that fits this customer, best first. Steps already done (a bill switched, a watch running) are left out.
function candidates({ overview, cashFlow, city, language, actions, watches }: SuggestionState): Suggestion[] {
  const w = WORDS[langOf(language)];
  const patterns = findPatterns(overview, cashFlow);
  const room = savingRoom(overview, cashFlow);
  const switched = new Set(actions.filter((a) => a.kind === "switch_contract" && a.status !== "declined" && a.status !== "expired").map((a) => a.billType));
  const bill = patterns.find((p) => p.billType && !switched.has(p.billType))?.billType ?? null;
  const peerGap = patterns.find((p) => p.kind === "peer-gap" && p.evidence.category)?.evidence.category ?? null;
  const runsShort = patterns.some((p) => p.kind === "overdraft-risk");
  const housing = overview.baskets.flatMap((b) => b.categories).find((c) => c.category === "Housing")?.monthlyAvg ?? 0;
  const rent = Math.floor(housing / RENT_STEP_EUR) * RENT_STEP_EUR;
  const watching = watches.some((watch) => watch.status === "active");
  const list: (Suggestion | null)[] = [
    make("investigate", "investigate", w.investigate),
    bill ? make(`cheaper:${bill}`, "act", w.cheaper(w.bill[bill])) : null,
    // One question about their own money, then the things Sisu does for them, then the rest.
    runsShort ? make("payday", "ask", w.payday) : peerGap ? make(`cut:${peerGap}`, "ask", w.cut(peerGap)) : null,
    room.nowEur >= MIN_SAVE_NOW_EUR ? make("save:now", "act", w.saveNow(room.nowEur)) : null,
    room.perMonthEur >= MIN_SAVE_MONTHLY_EUR ? make("save:monthly", "act", w.saveMonthly(room.perMonthEur)) : null,
    watching ? make("watch:found", "ask", w.watchFound) : rent > 0 ? make("watch:rent", "watch", w.rent(city, rent)) : null,
    runsShort && peerGap ? make(`cut:${peerGap}`, "ask", w.cut(peerGap)) : null,
    actions.some((a) => a.status === "awaiting_approval" || a.status === "executed_simulated") ? make("set-up", "ask", w.setUp) : null,
    make("chart", "show", w.chart),
    make("peers", "show", w.peers),
  ];
  return list.filter((s): s is Suggestion => s !== null);
}

const norm = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function pick(first: Suggestion[], rest: Suggestion[], used: Set<string>, question: string, count: number): Suggestion[] {
  const asked = norm(question);
  const chosen: Suggestion[] = [];
  for (const s of [...first, ...rest]) {
    if (chosen.length >= count) break;
    if (used.has(s.id) || chosen.some((c) => c.id === s.id) || norm(s.prompt) === asked) continue;
    chosen.push(s);
  }
  return chosen;
}

// For an empty Talk screen: one deep "look into" plus three concrete things Sisu can do for this customer.
export function starterSuggestions(state: SuggestionState): Suggestion[] {
  return pick([], candidates(state), new Set(), "", STARTERS);
}

export type TurnSummary = {
  question: string;
  investigate: boolean;
  tools: string[];
  action: AgentAction | null;
  research: ResearchResult | null;
  affordability: { amountEur: number; verdict: AffordabilityVerdict } | null;
};

// For under an answer: what naturally comes next after what Sisu just did, then the customer's best other leads.
export function followUpSuggestions(state: SuggestionState, turn: TurnSummary): Suggestion[] {
  const w = WORDS[langOf(state.language)];
  const used = new Set<string>();
  const first: Suggestion[] = [];
  if (turn.investigate) used.add("investigate");
  if (turn.tools.includes("show_chart")) used.add("chart");
  if (turn.research) used.add(`cheaper:${turn.research.billType}`);
  if (turn.action?.kind === "property_watch" || turn.action?.kind === "price_watch") used.add("watch:rent");

  const monthlySaving = turn.research?.best?.estimatedYearlySavingEur ? Math.round(turn.research.best.estimatedYearlySavingEur / 12) : 0;
  if (monthlySaving >= 1) first.push(make("save:the-saving", "act", w.saveMonthly(monthlySaving)));
  if (turn.affordability && turn.affordability.verdict !== "comfortable") {
    first.push(make("afford:until", "ask", w.untilAfford(Math.round(turn.affordability.amountEur))));
    used.add("save:now"); // moving money out would make the shortfall worse
  }
  const transfer = turn.action && (turn.action.kind === "standing_transfer" || turn.action.kind === "one_off_transfer") ? turn.action : null;
  if (transfer) {
    used.add("save:now").add("save:monthly");
    if (transfer.kind === "standing_transfer") first.push(make("future", "ask", w.future(Math.round(transfer.monthlyAmountEur))));
  }
  if (turn.action) first.push(make("set-up", "ask", w.setUp));
  return pick(first, candidates(state), used, turn.question, FOLLOW_UPS);
}
