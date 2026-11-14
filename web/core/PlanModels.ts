// Charts the agent sends (`Visual`) and the money plan (`PlanEvent`, `MoneyPlan`). Port of
// SisuCore/PlanModels.swift. They mirror lib/types.ts of the team backend.
import { type CalcStep, JSONRead, type JSONObject } from "./Models";
import type { AgentAction, BillType, Citation, Fact, Offer } from "./CoachModels";
import { SSEParser } from "./ServerSentEvents";

// MARK: - Charts

export interface VisualSlice { label: string; value: number; /** 0...100. */ share: number }
export interface VisualPeerRow { label: string; you: number; peers: number }
export interface VisualMonth { month: string; label: string; income: number; spending: number }
export interface VisualFuturePoint { year: number; value: number; low: number; high: number }
export interface VisualFutureSeries { /** `nothing`, `save` or `invest`. */ id: string; label: string; points: VisualFuturePoint[] }
export interface VisualOfferBar { provider: string; plan?: string | null; monthlyEur: number; yearlySavingEur: number; url: string }

/** What the chart holds, by kind (the Swift `Visual.Content`). */
export type VisualContent =
  | { kind: "budgetDonut"; slices: VisualSlice[]; total: number; centerLabel: string }
  | { kind: "peerBars"; peerGroup: string; rows: VisualPeerRow[] }
  | { kind: "monthBars"; months: VisualMonth[] }
  | { kind: "waterfall"; steps: CalcStep[]; resultLabel: string; resultValue: number }
  | { kind: "futuresLines"; years: number; series: VisualFutureSeries[] }
  | { kind: "offerBars"; currentMonthlyEur: number; offers: VisualOfferBar[]; mock: boolean }
  /** A kind this version of the app does not know: show `title`, `caption` and `summary` only. */
  | { kind: "unknown" };

/** A chart built in code on the server. Every number has a receipt in `facts`; `summary` is the accessibility
 * text. On the wire the content fields sit beside `kind`; here they are gathered in `content`. */
export interface Visual {
  id: string;
  /** `budget_donut`, `peer_bars`, `month_bars`, `waterfall`, `futures_lines` or `offer_bars`. */
  kind: string;
  title: string;
  caption: string;
  summary: string;
  source: string;
  facts: Fact[];
  content: VisualContent;
}

function decodeContent(kind: string, o: JSONObject): VisualContent {
  const R = JSONRead;
  switch (kind) {
    case "budget_donut":
      return { kind: "budgetDonut", slices: R.objects(o, "slices"), total: R.num(o, "total"), centerLabel: R.optStr(o, "centerLabel") ?? "" };
    case "peer_bars": return { kind: "peerBars", peerGroup: R.optStr(o, "peerGroup") ?? "", rows: R.objects(o, "rows") };
    case "month_bars": return { kind: "monthBars", months: R.objects(o, "months") };
    case "waterfall":
      return { kind: "waterfall", steps: R.objects(o, "steps"), resultLabel: R.optStr(o, "resultLabel") ?? "", resultValue: R.num(o, "resultValue") };
    case "futures_lines": return { kind: "futuresLines", years: R.optNum(o, "years") ?? 0, series: R.objects(o, "series") };
    case "offer_bars":
      return { kind: "offerBars", currentMonthlyEur: R.num(o, "currentMonthlyEur"), offers: R.objects(o, "offers"), mock: R.optBool(o, "mock") ?? false };
    default: return { kind: "unknown" };
  }
}

export const Visual = {
  /** Throws `DecodingError` without an `id` or `kind`; content that does not decode is `unknown`. */
  decode(json: unknown): Visual {
    const o = JSONRead.object(json);
    const kind = JSONRead.str(o, "kind");
    return {
      id: JSONRead.str(o, "id"),
      kind,
      title: JSONRead.optStr(o, "title") ?? "",
      caption: JSONRead.optStr(o, "caption") ?? "",
      summary: JSONRead.optStr(o, "summary") ?? "",
      source: JSONRead.optStr(o, "source") ?? "",
      facts: JSONRead.attempt(() => JSONRead.optObjects<Fact>(o, "facts")) ?? [],
      content: JSONRead.attempt(() => decodeContent(kind, o)) ?? { kind: "unknown" },
    };
  },
} as const;

/** Answer of `GET /api/agent/visuals`: every chart for a customer, with no model call. */
export interface VisualList { customerId?: string | null; visuals: Visual[] }
export const VisualList = {
  decode(json: unknown): VisualList {
    const o = JSONRead.object(json);
    return { customerId: JSONRead.optStr(o, "customerId"), visuals: JSONRead.array(o.visuals).map(Visual.decode) };
  },
} as const;

// MARK: - The money plan

/** The yearly total, which never travels without its split. Always show the two parts with the total. */
export interface PlanTotals {
  totalYearlyEur: number;
  /** The part that needs nothing from the customer (switches). */
  effortlessYearlyEur: number;
}
export const PlanTotals = {
  decode: (o: JSONObject): PlanTotals => ({ totalYearlyEur: JSONRead.num(o, "totalYearlyEur"), effortlessYearlyEur: JSONRead.num(o, "effortlessYearlyEur") }),
  /** The part that is saved only if the customer really spends less (habits). Never below zero. */
  spendingChangeYearlyEur: (t: PlanTotals): number => Math.max(t.totalYearlyEur - t.effortlessYearlyEur, 0),
} as const;

/** One thing the plan found. */
export interface PlanItem {
  id: string;
  /** `switch` or `habit`. */
  kind: string;
  title: string;
  detail: string;
  yearlyEur: number;
  monthlyEur: number;
  /** `nothing` (a switch saves money as it is) or `spending-change` (saves only if spending comes down). */
  needs: string;
  actionId?: string | null;
  sources: Citation[];
  facts: Fact[];
}
export const PlanItem = {
  /** True when the saving is real only if the customer spends less: say so next to the item. */
  needsSpendingChange: (item: PlanItem): boolean => item.needs !== "nothing",
} as const;

export interface PlanSearch {
  billType: BillType;
  query: string;
  pagesRead: number;
  pagesFound: number;
  offersFound: number;
  tookMs?: number | null;
  retrievedAt?: string | null;
  live?: boolean | null;
  mock: boolean;
}

export interface PlanCheckYours { label: string; value: number; unit: string }

/** Something outside the account that the customer's own figures make worth checking. */
export interface PlanCheck {
  id: string;
  title: string;
  query: string;
  ok: boolean;
  finding?: string | null;
  /** True when every number in the finding also appears in the excerpts taken from the pages. */
  figuresConfirmed: boolean;
  sources: Citation[];
  yours?: PlanCheckYours | null;
  tookMs?: number | null;
  mock: boolean;
}

export interface PlanProjection {
  years: number;
  freedPerMonthEur: number;
  nothingEur: number;
  keptEur: number;
  investedEur: number;
  investedLowEur: number;
  investedHighEur: number;
  gainKeptEur: number;
  assumptions: string[];
}

export interface MoneyPlanScanned { transactions: number; months: number }
export interface MoneyPlanNotice { title: string; detail: string }

/** The finished plan (the `plan_done` event). `totals` is gathered from the flat wire fields. */
export interface MoneyPlan {
  id: string;
  customerId: string;
  createdAt: string;
  scanned: MoneyPlanScanned;
  items: PlanItem[];
  notices: MoneyPlanNotice[];
  checks: PlanCheck[];
  actions: AgentAction[];
  totals: PlanTotals;
  projection?: PlanProjection | null;
  searches: PlanSearch[];
  summary: string;
  /** `nemotron` or `code`. */
  summaryBy: string;
  facts: Fact[];
  tookMs?: number | null;
}
export const MoneyPlan = {
  decode(json: unknown): MoneyPlan {
    const R = JSONRead;
    const o = R.object(json);
    return {
      id: R.str(o, "id"),
      customerId: R.optStr(o, "customerId") ?? "",
      createdAt: R.optStr(o, "createdAt") ?? "",
      scanned: R.object(o.scanned, ["transactions", "months"]) as unknown as MoneyPlanScanned,
      items: R.optObjects(o, "items"),
      notices: R.optObjects(o, "notices"),
      checks: R.optObjects(o, "checks"),
      actions: R.optObjects(o, "actions"),
      totals: PlanTotals.decode(o),
      projection: o.projection == null ? null : (R.object(o.projection) as unknown as PlanProjection),
      searches: R.optObjects(o, "searches"),
      summary: R.optStr(o, "summary") ?? "",
      summaryBy: R.optStr(o, "summaryBy") ?? "code",
      facts: R.optObjects(o, "facts"),
      tookMs: R.optNum(o, "tookMs"),
    };
  },
} as const;

export interface PlanScanRow { date: string; category: string; amount: number }
export interface PlanScanCategory { category: string; monthlyEur: number }
/** The account being read: counts, the rows to run past and the top categories. */
export interface PlanScan {
  transactions: number;
  months: number;
  from: string;
  to: string;
  rows: PlanScanRow[];
  categories: PlanScanCategory[];
  tookMs?: number | null;
}

/** One pattern the plan found. `role` is `habit`, `notice` or `bill` (a search follows; not listed). */
export interface PlanFinding { id: string; role: string; title: string; detail: string; yearlyEur?: number | null }
export interface PlanPage { url: string; host: string; title: string }
export interface PlanPageRead {
  billType: BillType;
  url: string;
  host: string;
  ok: boolean;
  offers: number;
  /** `context.dev` or `exa`. */
  reader: string;
  ageMs?: number | null;
  tookMs?: number | null;
}
export interface PlanOffers {
  billType: BillType;
  ok: boolean;
  best?: Offer | null;
  yearlySavingEur?: number | null;
  currentMonthlyEur?: number | null;
  offersFound: number;
  live?: boolean | null;
  /** Set when nothing is cheaper. */
  note?: string | null;
}

/** One event of `POST /api/agent/plan`, one per real step of the server's work. */
export type PlanEvent =
  | { kind: "planStart"; planId: string; customerName: string; provider: string; model: string; mock: boolean }
  | { kind: "scan"; scan: PlanScan }
  | { kind: "finding"; finding: PlanFinding }
  | { kind: "searchStart"; billType: BillType; query: string; engine: string }
  | { kind: "searchPages"; billType: BillType; pages: PlanPage[] }
  | { kind: "pageRead"; page: PlanPageRead }
  | { kind: "offers"; offers: PlanOffers }
  | { kind: "checkStart"; id: string; title: string; query: string }
  | { kind: "checkDone"; check: PlanCheck }
  /** Everything added up: the steps and the total with its split. */
  | { kind: "calc"; steps: CalcStep[]; totals: PlanTotals }
  | { kind: "action"; action: AgentAction }
  | { kind: "projection"; projection: PlanProjection }
  | { kind: "summary"; text: string; by: string }
  | { kind: "planDone"; plan: MoneyPlan }
  | { kind: "error"; message: string }
  /** An event type this version of the app does not know. Ignore it. */
  | { kind: "unknown"; type: string };

const planWireTypes: Record<Exclude<PlanEvent["kind"], "unknown">, string> = {
  planStart: "plan_start", scan: "scan", finding: "finding", searchStart: "search_start", searchPages: "search_pages",
  pageRead: "page_read", offers: "offers", checkStart: "check_start", checkDone: "check_done", calc: "calc", action: "action",
  projection: "projection", summary: "summary", planDone: "plan_done", error: "error",
};

function decodePlanEvent(o: JSONObject): PlanEvent {
  const R = JSONRead;
  const type = R.str(o, "type");
  switch (type) {
    case "plan_start":
      return { kind: "planStart", planId: R.optStr(o, "planId") ?? "", customerName: R.optStr(o, "customerName") ?? "",
        provider: R.optStr(o, "provider") ?? "", model: R.optStr(o, "model") ?? "", mock: R.optBool(o, "mock") ?? false };
    case "scan": return { kind: "scan", scan: R.object(o, ["transactions", "months", "from", "to", "rows", "categories"]) as unknown as PlanScan };
    case "finding": return { kind: "finding", finding: R.object(o, ["id", "role", "title", "detail"]) as unknown as PlanFinding };
    case "search_start":
      return { kind: "searchStart", billType: R.str(o, "billType"), query: R.optStr(o, "query") ?? "", engine: R.optStr(o, "engine") ?? "exa" };
    case "search_pages": return { kind: "searchPages", billType: R.str(o, "billType"), pages: R.optObjects(o, "pages") };
    case "page_read": return { kind: "pageRead", page: R.object(o, ["billType", "url", "host", "ok", "offers", "reader"]) as unknown as PlanPageRead };
    case "offers": return { kind: "offers", offers: R.object(o, ["billType", "ok", "offersFound"]) as unknown as PlanOffers };
    case "check_start": return { kind: "checkStart", id: R.str(o, "id"), title: R.optStr(o, "title") ?? "", query: R.optStr(o, "query") ?? "" };
    case "check_done": return { kind: "checkDone", check: R.object(o.check, ["id", "title", "query", "ok"]) as unknown as PlanCheck };
    case "calc": return { kind: "calc", steps: R.optObjects(o, "steps"), totals: PlanTotals.decode(o) };
    case "action": return { kind: "action", action: R.object(o.action) as unknown as AgentAction };
    case "projection": return { kind: "projection", projection: R.object(o.projection) as unknown as PlanProjection };
    case "summary": return { kind: "summary", text: R.optStr(o, "text") ?? "", by: R.optStr(o, "by") ?? "code" };
    case "plan_done": return { kind: "planDone", plan: MoneyPlan.decode(o.plan) };
    case "error": return { kind: "error", message: R.optStr(o, "message") ?? "" };
    default: return { kind: "unknown", type };
  }
}

export const PlanEvent = {
  /** The `type` string of the event as the server sends it. */
  type: (event: PlanEvent): string => (event.kind === "unknown" ? event.type : planWireTypes[event.kind]),

  /** Decodes the `data` of one server-sent message. Never throws: a known event whose payload does not decode,
   * or an unknown one, is `unknown`; text that is not an event gives null. */
  decode(data: string | Uint8Array): PlanEvent | null {
    const json = JSONRead.attempt(() => JSONRead.parse(data));
    if (!JSONRead.isObject(json) || typeof json.type !== "string") return null;
    return JSONRead.attempt(() => decodePlanEvent(json)) ?? { kind: "unknown", type: json.type };
  },

  /** Parses a whole recorded plan stream at once. */
  events(data: Uint8Array | string): PlanEvent[] {
    const parser = new SSEParser();
    return [...parser.feed(data), ...parser.finish()].map((m) => PlanEvent.decode(m.data)).filter((e): e is PlanEvent => e !== null);
  },
} as const;

/** Body of `POST /api/agent/plan`. `fresh: false` reuses a recent search instead of searching now. */
export interface PlanRequest { customerId: string; fresh?: boolean | null; language?: string | null }

/** Body of `POST /api/actions/approve-all` (`confirm` is always true; one to six action ids). */
export interface ApproveAllRequest { customerId: string; actionIds: string[]; confirm: boolean }
export const ApproveAllRequest = {
  make: (customerId: string, actionIds: string[]): ApproveAllRequest => ({ customerId, actionIds, confirm: true }),
} as const;

export interface ApproveAllFailure { actionId?: string | null; reason: string }
/** Answer of `POST /api/actions/approve-all`: each action is approved, simulated and logged on its own. */
export interface ApproveAllResult { approved: AgentAction[]; failed: ApproveAllFailure[] }
export const ApproveAllResult = {
  decode(json: unknown): ApproveAllResult {
    const o = JSONRead.object(json);
    const failed = JSONRead.objects<JSONObject>(o, "failed").map((f) => ({ actionId: JSONRead.optStr(f, "actionId"), reason: JSONRead.str(f, "reason") }));
    return { approved: JSONRead.objects<AgentAction>(o, "approved"), failed };
  },
} as const;
