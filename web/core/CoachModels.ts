// The coach contract of the team backend ("Agent, research and voice" and below in lib/types.ts, see
// docs/FRONTEND_INTEGRATION_CONTRACT.md). Port of SisuCore/CoachModels.swift.
//
// Decoding is lenient on purpose: nullable or optional fields are `?: T | null`, extra keys are ignored, and
// enum-like strings the screen only shows or compares are "open enums" (a string type with named known values
// in a companion object), so a new value from the server never breaks decoding.
// Plain structs are read as-is from JSON (field names are the JSON keys). Types with defaults or a payload by
// kind (`Stage`, `StageData`, `SisuEvent`) have a `decode` in their companion object.
import { type CalcStep, type EvidenceFilter, type BranchId, BranchId as BranchIds, JSONRead, type JSONObject } from "./Models";
import { Visual } from "./PlanModels";
import type { WatchPlan } from "./WatchModels";
import { type HousingIntake, HousingModels, type HousingSearchResult } from "./HousingModels";

// MARK: - Open enums

/** `electricity`, `mobile` or `internet` (any other text is kept as it came). */
export type BillType = "electricity" | "mobile" | "internet" | (string & {});
export const BillType = {
  electricity: "electricity" as BillType,
  mobile: "mobile" as BillType,
  internet: "internet" as BillType,
  allKnown: ["electricity", "mobile", "internet"] as readonly BillType[],
} as const;

/** `running`, `partial`, `done` or `failed`. */
export type ResearchStatus = "running" | "partial" | "done" | "failed" | (string & {});
export const ResearchStatus = { running: "running", partial: "partial", done: "done", failed: "failed" } as const;

/** `switch_contract`, `standing_transfer`, `one_off_transfer`, `property_watch` or `price_watch`. */
export type ActionKind = "switch_contract" | "standing_transfer" | "one_off_transfer" | "property_watch" | "price_watch" | (string & {});
export const ActionKind = {
  switchContract: "switch_contract", standingTransfer: "standing_transfer", oneOffTransfer: "one_off_transfer",
  /** A watch (web/core/WatchModels.ts): approving it really starts Context.dev monitors, so it is not simulated. */
  propertyWatch: "property_watch", priceWatch: "price_watch",
} as const;

/** `awaiting_approval`, `executed_simulated`, `declined` or `expired`. */
export type ActionStatus = "awaiting_approval" | "executed_simulated" | "declined" | "expired" | (string & {});
export const ActionStatus = {
  awaitingApproval: "awaiting_approval", executedSimulated: "executed_simulated", declined: "declined", expired: "expired",
} as const;

/** `bill_name`, `yearly_kwh`, `preference` or `goal`. */
export type MemoryKind = "bill_name" | "yearly_kwh" | "preference" | "goal" | (string & {});
export const MemoryKind = { billName: "bill_name", yearlyKwh: "yearly_kwh", preference: "preference", goal: "goal" } as const;

/** The kind of a `Stage`. */
export type StageKind = "lead" | "evidence" | "research" | "extraction" | "calculation" | "teaching" | "action" | "impact" | "memory" | (string & {});
export const StageKind = {
  lead: "lead", evidence: "evidence", research: "research", extraction: "extraction", calculation: "calculation",
  teaching: "teaching", action: "action", impact: "impact", memory: "memory",
  /** The order an investigation fills its stages in. */
  investigationOrder: ["lead", "research", "extraction", "calculation", "impact", "teaching", "action"] as readonly StageKind[],
} as const;

/** A teaching concept. */
export type ConceptId =
  | "three-baskets" | "safe-to-spend" | "fixed-vs-spot" | "buffer-first" | "compound-growth" | "switching-bills" | "pay-yourself-first" | (string & {});
export const ConceptId = {
  threeBaskets: "three-baskets", safeToSpend: "safe-to-spend", fixedVsSpot: "fixed-vs-spot", bufferFirst: "buffer-first",
  compoundGrowth: "compound-growth", switchingBills: "switching-bills", payYourselfFirst: "pay-yourself-first",
  all: ["three-baskets", "safe-to-spend", "fixed-vs-spot", "buffer-first", "compound-growth", "switching-bills", "pay-yourself-first"] as readonly ConceptId[],
} as const;

/** `comfortable`, `tight` or `not-yet`. */
export type AffordabilityVerdict = "comfortable" | "tight" | "not-yet" | (string & {});
export const AffordabilityVerdict = { comfortable: "comfortable", tight: "tight", notYet: "not-yet" } as const;

// MARK: - Loose JSON

/** Any JSON value (Swift's `JSONValue` enum is plain JSON here). Used for tool arguments. */
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

// MARK: - Research

/** A web page an answer rests on. `retrievedAt` is the ISO time it was fetched. */
export interface Citation {
  title: string;
  url: string;
  retrievedAt: string;
  cacheAgeMs?: number | null;
  /** `context.dev` or `exa`, when it was read for offers. */
  readBy?: string | null;
}

/** One offer read from a provider's page. Every estimate is computed by the server; never recompute it. */
export interface Offer {
  provider: string;
  plan?: string | null;
  contractType?: string | null;
  contractMonths?: number | null;
  monthlyPriceEur?: number | null;
  energyPriceCentsPerKwh?: number | null;
  setupFeeEur?: number | null;
  sourceUrl: string;
  /** False when the price cannot be compared fairly (for example spot contracts). */
  comparable: boolean;
  estimatedMonthlyCostEur?: number | null;
  estimatedYearlySavingEur?: number | null;
  /** Optional, from a backend that applies the user's requirements (contract length, fixed or spot, fees). False:
   *  this offer does not meet them, so it can never be shown as the best offer. `matchesRequirements` is an alias. */
  meetsRequirements?: boolean | null;
  matchesRequirements?: boolean | null;
  /** Optional: why it does not meet them, in words (`Contract is 24 months; you asked for 12 or less`). */
  misses?: string[] | null;
  /** Optional: false when a fee the cost depends on was not stated, so the saving is incomplete. The backend that
   *  shipped (rework/api-answers) sends the opposite flag, `feesUnknown: true`; both are read. */
  feesKnown?: boolean | null;
  feesUnknown?: boolean | null;
  /** Electricity: true when the page says the energy is renewable; null when it does not say. */
  greenEnergy?: boolean | null;
}

/** Offer research for one bill type in one city. `mock` true means example data: label it. */
export interface ResearchResult {
  key: string;
  billType: BillType;
  city: string;
  status: ResearchStatus;
  mock: boolean;
  query: string;
  startedAt: string;
  finishedAt?: string | null;
  tookMs: number;
  pagesDone: number;
  pagesTotal: number;
  baselineMonthlyEur?: number | null;
  assumedYearlyKwh?: number | null;
  /** `stated`, `estimated-from-bill` or `default`. */
  usageSource?: string | null;
  offers: Offer[];
  /** Null when nothing is cheaper today. */
  best?: Offer | null;
  citations: Citation[];
  assumptions: string[];
  errors: string[];
  /** Optional, from a backend that applies the user's requirements: what was asked for (for example
   *  `{ maxContractMonths: 12 }`), how many offers meet it, and true when none does. */
  requirements?: Record<string, unknown> | null;
  matchingCount?: number | null;
  noMatch?: boolean | null;
  /** The requirements in the backend's words ("contract of 12 months or less, fixed price"). */
  requirementsText?: string | null;
}

// MARK: - A turn

/** One earlier line of the conversation. `role` is `user` or `assistant`. */
export interface ChatTurn { role: string; content: string }

/** One tool call of a turn, for the trace drawer. */
export interface ToolTrace {
  id: string;
  name: string;
  args?: JSONValue | null;
  /** `finance`, `exa+context.dev` or `exa`. */
  source: string;
  startedAtMs: number;
  tookMs: number;
  ok: boolean;
  summary: string;
  joinedPrefetch?: boolean | null;
}

export interface TurnTimingsModelStep {
  model: string;
  provider: string;
  /** True when the main model failed and the backup answered: show a small "backup model" tag. */
  usedBackup: boolean;
  firstTokenMs?: number | null;
  totalMs: number;
}

/** Milliseconds for each part of a turn. */
export interface TurnTimings {
  sttMs?: number | null;
  firstTokenMs?: number | null;
  firstSentenceMs?: number | null;
  totalMs: number;
  modelSteps: TurnTimingsModelStep[];
  retries?: string[] | null;
}
export const TurnTimings = {
  /** True when any step of the turn was answered by the backup model. */
  usedBackup: (t: TurnTimings): boolean => t.modelSteps.some((s) => s.usedBackup),
} as const;

// MARK: - Receipts

/** One receipt: a number Sisu is allowed to say, where it came from and how to open the rows behind it. */
export interface Fact {
  id: string;
  label: string;
  value: number;
  /** `EUR`, `EUR/month`, `EUR/year`, `kWh/year`, `c/kWh`, `months`, `count`, `percent`, `years` or `days`. */
  unit: string;
  /** `bank-data`, `exa`, `context.dev`, `assumption`, `customer-stated` or `calculation`. */
  source: string;
  basis: string;
  evidence?: EvidenceFilter | null;
  url?: string | null;
}

export interface NumberCheck { value: number; /** `receipt`, `context`, `trivial` or `unverified`. */ status: string; factId?: string | null }
export interface NumberCorrection { said: number; corrected: number; factId: string }
export interface NameCorrection { said: string; corrected: string }

/** The result of checking every number in the answer against the receipts. */
export interface Grounding {
  ok: boolean;
  checked: number;
  unverified: number[];
  numbers: NumberCheck[];
  corrections: NumberCorrection[];
  nameCorrections?: NameCorrection[] | null;
}

// MARK: - Coach endpoints

/** Something worth looking into, found by code in the customer's own history. */
export interface Pattern {
  id: string;
  /** `bill-opportunity`, `bill-creep`, `overdraft-risk`, `payday-spike`, `category-drift`, `peer-gap`, … */
  kind: string;
  title: string;
  detail: string;
  yearlyImpactEur?: number | null;
  confidence: string;
  billType?: BillType | null;
  evidence: EvidenceFilter;
  facts: Fact[];
  nextSteps: string[];
}

/** Answer of `GET /api/coach/patterns`. */
export interface PatternList { customerId?: string | null; dataTimestamp?: string | null; patterns: Pattern[] }

export interface PayCycle {
  payday: string;
  income: number;
  lowestBalance: number;
  lowestOn: string;
  daysToLowest: number;
  spentInFirstWeek: number;
  spentInCycle: number;
}

export interface CashFlowBillDue { billId: string; label: string; amount: number; expectedOn: string }

/** Answer of `GET /api/coach/cash-flow`. */
export interface CashFlow {
  customerId: string;
  dataTimestamp: string;
  typicalPayday?: number | null;
  nextPayday?: string | null;
  daysToNextPayday?: number | null;
  cycles: PayCycle[];
  averageDailyEverydayEur: number;
  billsDueBeforePayday: CashFlowBillDue[];
  projectedLowPointEur?: number | null;
  firstWeekShare?: number | null;
  negativeMonths: number;
  steps: CalcStep[];
  assumptions: string[];
  /** Newer backends only (lib/finance/budget.ts): the estimated weekly budget the coach's answers use. Read through
   *  `WeeklyBudget.inputs`, which takes its default buffer so Today and Sisu's answers agree; absent on today's hosted one. */
  weeklyBudget?: CashFlowWeeklyBudget | null;
  /** v2 payday (newer backends): where payday and the bills come from, the headline label and the period in words. */
  basis?: CashFlowBasis | null;
  /** v2 payday: one practical cut-back, from the largest flexible everyday category. */
  cutBack?: CashFlowCutBack | null;
}

/** v2 payday: a bill the person added that the history does not show. `dueDate` is YYYY-MM-DD. */
export interface ExtraBill { label: string; amountEur: number; dueDate: string }
/** v2 payday: what the person confirmed for the budget until payday (sent with the cash flow and every question). */
export interface PaydayOverrides { paydayDate?: string; extraBills?: ExtraBill[] }
export interface CashFlowBasis {
  payday?: "history" | "confirmed" | string;
  bills?: "history" | "history+added" | string;
  label?: string;
  /** "until payday on Thu 15 Oct, 15 days" */
  periodText?: string;
  addedBills?: (ExtraBill & { counted?: boolean })[];
}
export interface CashFlowCutBack { category: string; averagePerMonthEur: number; cutPct: number; freesPerMonthEur: number; freesPerYearEur: number; baselineText?: string }

/** `CashFlow.weeklyBudget` (every field optional: decoded defensively, only the buffer is used). */
export interface CashFlowWeeklyBudget {
  perWeekEur?: number;
  bufferEur?: number;
  /** `default` = one week of regular and occasional essentials, an assumption; `customer-stated` = said in the chat. */
  bufferSource?: "default" | "customer-stated" | string;
  assumptions?: string[];
}

/** Answer of `GET /api/coach/affordability`. */
export interface Affordability {
  customerId?: string | null;
  dataTimestamp?: string | null;
  amountEur: number;
  verdict: AffordabilityVerdict;
  balanceAfterEur: number;
  projectedLowPointEur?: number | null;
  bufferMonthsAfter: number;
  monthsToSaveUp?: number | null;
  steps: CalcStep[];
  assumptions: string[];
}

/** A teaching moment built from the customer's own numbers. Ask `question` before showing `reveal`. */
export interface TeachingCard {
  id: string;
  concept: ConceptId;
  title: string;
  explanation: string;
  question: string;
  options: string[];
  correctIndex: number;
  reveal: string;
  facts: Fact[];
}

/** Answer of `GET /api/coach/teaching`. */
export interface TeachingCardList { customerId?: string | null; dataTimestamp?: string | null; cards: TeachingCard[] }

export interface MortgageFee { type: string; amountEur: number; on: string }
export interface MortgageTimelineEntry { on: string; event: string }

/** Answer of `GET /api/coach/mortgage` (only some customers have one; the others get a 404). */
export interface MortgageApplication {
  customerId: string;
  decision: string;
  startedOn: string;
  decidedOn?: string | null;
  propertyType?: string | null;
  propertyPriceEur: number;
  loanEur: number;
  ownMoneyEur: number;
  collateralValueEur: number;
  loanToValuePct: number;
  requiredMonthlyIncomeEur: number;
  monthlyIncomeEur: number;
  incomeMarginEur: number;
  balanceEur: number;
  ownMoneyStillNeededEur: number;
  fees: MortgageFee[];
  timeline: MortgageTimelineEntry[];
  steps: CalcStep[];
  assumptions: string[];
}

// MARK: - Actions

export interface ImpactBranch {
  /** `nothing`, `save` or `invest`. */
  id: string;
  label: string;
  endTotal: number;
  endLow: number;
  endHigh: number;
}
export const ImpactBranch = {
  /** The branch as the futures simulator names it, when it is one of the three known ones. */
  branchId: (b: ImpactBranch): BranchId | null => BranchIds.fromRaw(b.id),
} as const;

/** What an approved action adds up to. */
export interface ActionImpact {
  monthlyEur: number;
  yearlyEur: number;
  horizonYears: number;
  branches: ImpactBranch[];
  /** "Keep the cash" against "change nothing" at the horizon. */
  gainVsNothingEur: number;
  summary: string;
}

/** A prepared action. Nothing happens until the user approves it, and even then it is a simulation. */
export interface AgentAction {
  id: string;
  customerId?: string | null;
  kind: ActionKind;
  status: ActionStatus;
  simulated: boolean;
  title: string;
  summary: string;
  checklist: string[];
  /** Text Sisu drafted for the provider. Never sent. */
  draftMessage?: string | null;
  billType?: BillType | null;
  offer?: Offer | null;
  monthlyAmountEur: number;
  facts: Fact[];
  sources: Citation[];
  assumptions: string[];
  preparedBy?: string | null;
  createdAt?: string | null;
  expiresAt: string;
  decidedAt?: string | null;
  impact?: ActionImpact | null;
  /** Transfers only: `savings` or `investments`. */
  destination?: string | null;
  /** Show this prominently on the card. Never hide it. */
  warning?: string | null;
  /** Filled in when approved: `Done (simulation). Reference SIM-1A2B3C4D.` */
  confirmation?: string | null;
  /** `property_watch` and `price_watch`: what would be watched once approved. Raw from the server: read it with
   *  `WatchPlan.decode` (web/core/WatchModels.ts). */
  watch?: WatchPlan | null;
  /** Filled in when approved on a backend with the demo bank (lib/types.ts `ActionExecution`). Not modelled yet:
   *  read it defensively. */
  execution?: unknown;
}

/** One entry of the tamper-evident audit log. */
export interface AuditEvent {
  seq: number;
  at: string;
  customerId: string;
  type: string;
  actor: string;
  actionId?: string | null;
  detail: string;
  prevHash: string;
  hash: string;
}

/** Answer of `GET /api/actions`: every action of the customer, newest first, with the audit trail. */
export interface ActionList { customerId: string; actions: AgentAction[]; audit: AuditEvent[]; auditChainValid: boolean }
/** Answer of `GET /api/audit`. */
export interface AuditLog { customerId?: string | null; events: AuditEvent[]; chainValid: boolean }
/** The `{ action }` envelope of prepare, approve and decline. */
export interface ActionEnvelope { action: AgentAction }

// MARK: - Memory

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  key: string;
  value: string;
  billType?: BillType | null;
  /** `user-confirmed-in-app` or `user-said-in-chat`. */
  source: string;
  savedAt: string;
}

/** What Sisu remembers about one customer. */
export interface CustomerMemory { customerId: string; consent: boolean; items: MemoryItem[] }
export const CustomerMemory = {
  /** The name the user confirmed for a bill, or null while the name is still Sisu's guess. */
  confirmedBillName: (memory: CustomerMemory, billId: string): string | null =>
    memory.items.find((i) => i.kind === MemoryKind.billName && i.key === billId)?.value ?? null,
} as const;

// MARK: - Stages

export interface StageEvidenceRow { date: string; amount: number; category: string; merchantType?: string | null }
export interface StageEvidence { filter: EvidenceFilter; count: number; totalEur: number; largest: StageEvidenceRow[] }
export interface StageResearch { query: string; searchedWith?: string | null; pages: Citation[]; retrievedAt: string; mock: boolean }
export interface StageExtraction { extractedWith?: string | null; pagesRead: number; pagesTotal: number; offers: Offer[]; problems: string[] }
export interface StageCalculation { steps: CalcStep[]; resultLabel: string; resultValue: number; unit: string; assumptions: string[] }

/** What a stage holds, by kind. The fields are those of the wire; `unknown` keeps the kind it came with. */
export type StageData =
  | { kind: "lead"; patterns: Pattern[] }
  | ({ kind: "evidence" } & StageEvidence)
  | ({ kind: "research" } & StageResearch)
  | ({ kind: "extraction" } & StageExtraction)
  | ({ kind: "calculation" } & StageCalculation)
  | { kind: "teaching"; card: TeachingCard }
  | { kind: "action"; action: AgentAction }
  | { kind: "impact"; impact: ActionImpact }
  | { kind: "memory"; item: MemoryItem }
  /** v2 housing: the intake card, and the results of the search it starts. */
  | { kind: "housing_intake"; intake: HousingIntake }
  | { kind: "housing_results"; result: HousingSearchResult }
  /** A kind this version of the app does not know. Draw the stage's `title` and `summary` only. */
  | { kind: "unknown"; rawKind: string };

export const StageData = {
  decode(json: unknown): StageData {
    const o = JSONRead.object(json);
    const kind = JSONRead.str(o, "kind");
    const need = (keys: string[]) => JSONRead.object(o, keys);
    switch (kind) {
      case "lead": return { kind, patterns: JSONRead.objects<Pattern>(o, "patterns") };
      case "evidence": need(["filter", "count", "totalEur", "largest"]); return o as unknown as StageData;
      case "research": need(["query", "pages", "retrievedAt", "mock"]); return o as unknown as StageData;
      case "extraction": need(["pagesRead", "pagesTotal", "offers", "problems"]); return o as unknown as StageData;
      case "calculation": need(["steps", "resultLabel", "resultValue", "unit", "assumptions"]); return o as unknown as StageData;
      case "teaching": return { kind, card: JSONRead.object(o.card) as unknown as TeachingCard };
      case "action": return { kind, action: JSONRead.object(o.action) as unknown as AgentAction };
      case "impact": return { kind, impact: JSONRead.object(o.impact) as unknown as ActionImpact };
      case "memory": return { kind, item: JSONRead.object(o.item) as unknown as MemoryItem };
      case "housing_intake": {
        const intake = HousingModels.intake(o.intake);
        return intake ? { kind, intake } : { kind: "unknown", rawKind: kind };
      }
      case "housing_results": return { kind, result: HousingModels.result(o.result) };
      default: return { kind: "unknown", rawKind: kind };
    }
  },
} as const;

/** One step of Sisu's work, typed so the screen can draw a card for it. */
export interface Stage {
  id: string;
  kind: StageKind;
  title: string;
  summary: string;
  /** `bank-data`, `exa`, `context.dev`, `calculation`, `assumption`, `customer-stated` or `nemotron`. */
  source: string;
  /** Matches `ToolTrace.id`. */
  toolCallId?: string | null;
  /** Milliseconds since the turn started. */
  atMs: number;
  facts: Fact[];
  data: StageData;
}
export const Stage = {
  /** Missing text is "", a missing time 0, missing facts []; data that does not decode is `unknown`. */
  decode(json: unknown): Stage {
    const o = JSONRead.object(json);
    const kind = JSONRead.str(o, "kind");
    return {
      id: JSONRead.str(o, "id"),
      kind,
      title: JSONRead.optStr(o, "title") ?? "",
      summary: JSONRead.optStr(o, "summary") ?? "",
      source: JSONRead.optStr(o, "source") ?? "",
      toolCallId: JSONRead.optStr(o, "toolCallId"),
      atMs: JSONRead.optNum(o, "atMs") ?? 0,
      facts: JSONRead.optObjects<Fact>(o, "facts"),
      data: JSONRead.attempt(() => StageData.decode(o.data)) ?? { kind: "unknown", rawKind: kind },
    };
  },
} as const;

// MARK: - The event stream

/** One event of the stream of `POST /api/agent/query`, `/api/agent/investigate` and `/api/voice/turn`.
 * `kind` is the Swift case name; `SisuEvent.type(event)` gives the wire `type`.
 * Order in one turn: start, (transcript), (speculation), (filler), then any mix of toolStart, toolEnd, research,
 * stage, teaching, action, memory, delta, sentence, then grounding, then done. Or error at any point. */
export type SisuEvent =
  | { kind: "start"; turnId: string; provider: string; model: string; mock: boolean }
  | { kind: "transcript"; text: string; tookMs: number; language: string | null; languageProbability: number | null }
  | { kind: "speculation"; billType: BillType; reason: string }
  | { kind: "toolStart"; id: string; name: string; args: JSONValue | null; label: string | null }
  | { kind: "toolEnd"; trace: ToolTrace }
  /** A sentence to show and say while research runs. */
  | { kind: "filler"; text: string }
  | { kind: "research"; result: ResearchResult }
  | { kind: "delta"; text: string }
  | { kind: "sentence"; index: number; text: string }
  | { kind: "stage"; stage: Stage }
  | { kind: "action"; action: AgentAction }
  | { kind: "teaching"; card: TeachingCard }
  | { kind: "memory"; item: MemoryItem }
  | { kind: "grounding"; grounding: Grounding; facts: Fact[] }
  | { kind: "visual"; visual: Visual }
  /** The answer so far, after a sentence failed a check: show it instead of the deltas so far. */
  | { kind: "replace"; text: string }
  /** `text` is the checked final answer: use it instead of the collected deltas. */
  | { kind: "done"; text: string; citations: Citation[]; timings: TurnTimings | null }
  | { kind: "error"; message: string }
  /** An event type this version of the app does not know. Ignore it. */
  | { kind: "unknown"; type: string };

const wireTypes: Record<Exclude<SisuEvent["kind"], "unknown">, string> = {
  start: "start", transcript: "transcript", speculation: "speculation", toolStart: "tool_start", toolEnd: "tool_end",
  filler: "filler", research: "research", delta: "delta", sentence: "sentence", stage: "stage", action: "action",
  teaching: "teaching", memory: "memory", grounding: "grounding", visual: "visual", replace: "replace", done: "done", error: "error",
};

function decodeEvent(o: JSONObject): SisuEvent {
  const R = JSONRead;
  const type = R.str(o, "type");
  const text = () => R.optStr(o, "text") ?? "";
  switch (type) {
    case "start":
      return { kind: "start", turnId: R.optStr(o, "turnId") ?? "", provider: R.optStr(o, "provider") ?? "", model: R.optStr(o, "model") ?? "",
        mock: R.optBool(o, "mock") ?? false };
    case "transcript":
      return { kind: "transcript", text: text(), tookMs: R.optNum(o, "tookMs") ?? 0, language: R.optStr(o, "language"),
        languageProbability: R.optNum(o, "languageProbability") };
    case "speculation": return { kind: "speculation", billType: R.str(o, "billType"), reason: R.optStr(o, "reason") ?? "" };
    case "tool_start":
      return { kind: "toolStart", id: R.optStr(o, "id") ?? "", name: R.optStr(o, "name") ?? "", args: (o.args ?? null) as JSONValue | null,
        label: R.optStr(o, "label") };
    case "visual": return { kind: "visual", visual: Visual.decode(o.visual) };
    case "replace": return { kind: "replace", text: text() };
    case "tool_end": return { kind: "toolEnd", trace: R.object(o.trace) as unknown as ToolTrace };
    case "filler": return { kind: "filler", text: text() };
    case "research": return { kind: "research", result: R.object(o.result) as unknown as ResearchResult };
    case "delta": return { kind: "delta", text: text() };
    case "sentence": return { kind: "sentence", index: R.optInt(o, "index") ?? 0, text: text() };
    case "stage": return { kind: "stage", stage: Stage.decode(o.stage) };
    case "action": return { kind: "action", action: R.object(o.action) as unknown as AgentAction };
    case "teaching": return { kind: "teaching", card: R.object(o.card) as unknown as TeachingCard };
    case "memory": return { kind: "memory", item: R.object(o.item) as unknown as MemoryItem };
    case "grounding": return { kind: "grounding", grounding: R.object(o.grounding) as unknown as Grounding, facts: R.optObjects<Fact>(o, "facts") };
    case "done": {
      const citations = R.attempt(() => R.optObjects<Citation>(o, "citations")) ?? [];
      const timings = R.attempt(() => (o.timings == null ? null : (R.object(o.timings, ["totalMs", "modelSteps"]) as unknown as TurnTimings)));
      return { kind: "done", text: text(), citations, timings };
    }
    case "error": return { kind: "error", message: R.optStr(o, "message") ?? "" };
    default: return { kind: "unknown", type };
  }
}

export const SisuEvent = {
  /** The `type` string of the event as the server sends it. */
  type: (event: SisuEvent): string => (event.kind === "unknown" ? event.type : wireTypes[event.kind]),

  /** Decodes the `data` of one server-sent message. Never throws: a known event whose payload does not decode,
   * or an unknown event, is `unknown`; text that is not a JSON object with a `type` gives null. */
  decode(data: string | Uint8Array): SisuEvent | null {
    const json = JSONRead.attempt(() => JSONRead.parse(data));
    if (!JSONRead.isObject(json) || typeof json.type !== "string") return null;
    return JSONRead.attempt(() => decodeEvent(json)) ?? { kind: "unknown", type: json.type };
  },
} as const;

// MARK: - Server information

/** Which model answers and whether it is example data. Show a "Mock data" label when `mock` is true. */
export interface ServerInfo { mock: boolean; provider: string; model: string }

/** Answer of `GET /api/agent/warm`. */
export interface WarmResponse { ok?: boolean | null; provider: string; mock: boolean; model: string; backup?: string | null; tookMs?: number | null }
export const WarmResponse = {
  server: (w: WarmResponse): ServerInfo => ({ mock: w.mock, provider: w.provider, model: w.model }),
} as const;

export interface HealthReportModel { provider: string; name: string; host?: string | null; region?: string | null; reachable?: boolean | null; latencyMs?: number | null }
export interface HealthReportBackup { provider: string; name: string; /** The backup is answering right now. */ inUseNow?: boolean | null }
export interface HealthReportServices { exa?: boolean | null; contextDev?: boolean | null; elevenLabs?: boolean | null }
export interface HealthReportStore { persistent?: boolean | null; path?: string | null }

/** Answer of `GET /api/health`. */
export interface HealthReport {
  ok: boolean;
  mock: boolean;
  model: HealthReportModel;
  backup?: HealthReportBackup | null;
  services?: HealthReportServices | null;
  dataBoundary: string[];
  store?: HealthReportStore | null;
  checkedAt?: string | null;
}

/** Answer of `POST /api/demo/reset`. */
export interface DemoResetResult { ok: boolean; cleared?: { actions?: number | null; memoryItems?: number | null } | null }

// MARK: - Voice

/** Answer of `POST /api/voice/stt`. */
export interface Transcript { text: string; tookMs?: number | null; mock?: boolean | null; language?: string | null; languageProbability?: number | null }

/** A language Sisu hears and speaks. */
export interface VoiceLanguage { code: string; name: string; nativeName: string }
export interface VoiceOptionsVoice { id: string; name: string; accent?: string | null; style?: string | null }
/** Answer of `GET /api/voice/tts`: what the language picker offers. */
export interface VoiceOptions { voices?: VoiceOptionsVoice[] | null; models?: string[] | null; languages: VoiceLanguage[] }

/** Audio from `POST /api/voice/tts`. `contentType`: `audio/mpeg`, `audio/wav`, or raw 24 kHz 16-bit mono for `pcm`. */
export interface SpeechAudio { data: Uint8Array; contentType: string }

// MARK: - Bill photo

/** What the model read from a photo of the customer's own bill. Nothing is saved until the user confirms it. */
export interface BillReading {
  billType?: BillType | null;
  provider?: string | null;
  plan?: string | null;
  contractType?: string | null;
  contractEndsOn?: string | null;
  yearlyKwh?: number | null;
  energyPriceCentsPerKwh?: number | null;
  monthlyFeeEur?: number | null;
  billTotalEur?: number | null;
  mock: boolean;
  readBy?: { provider: string; model: string; tookMs?: number | null } | null;
  problems: string[];
}

/** Answer of `POST /api/agent/bill-photo`. */
export interface BillPhotoResult {
  customerId: string;
  reading: BillReading;
  facts: Fact[];
  comparison?: ResearchResult | null;
  /** The sentence to show the user before saving anything. */
  toConfirm: string;
}

// MARK: - Request bodies (factories apply the Swift initialisers' defaults)

/** Body of `POST /api/agent/query`. `mode` is `voice` or `text`. */
export interface AgentRequest {
  customerId: string;
  text: string;
  mode: string;
  history?: ChatTurn[] | null;
  focusBill?: BillType | null;
  /** ISO 639-1 code, or `auto`. Null lets the server answer in the language of the text. */
  language?: string | null;
  /** v2 payday: the payday and bills the person confirmed in the app, so the chat and Today agree. */
  paydayDate?: string;
  extraBills?: ExtraBill[];
}
export const AgentRequest = {
  make: (r: Omit<AgentRequest, "mode"> & { mode?: string }): AgentRequest => ({ ...r, mode: r.mode ?? "text" }),
} as const;

/** Body of `POST /api/agent/investigate`. `text` is an optional focus, for example `my mobile bill`. */
export interface InvestigateRequest { customerId: string; mode?: string | null; text?: string | null; language?: string | null }
export const InvestigateRequest = {
  make: (r: InvestigateRequest): InvestigateRequest => ({ ...r, mode: r.mode === undefined ? "text" : r.mode }),
} as const;

/** Body of `POST /api/research`. `wait: false` returns at once while offers load in the background. */
export interface ResearchRequest { customerId: string; billType: BillType; wait?: boolean | null; yearlyKwh?: number | null }
/** Body of `POST /api/memory` that saves one item. */
export interface MemorySaveRequest { customerId: string; kind: MemoryKind; key?: string | null; value: string; billType?: BillType | null }
/** Body of `POST /api/memory` that switches remembering on or off (off erases what was stored). */
export interface MemoryConsentRequest { customerId: string; consent: boolean }

/** Body of `POST /api/actions/prepare`. */
export interface PrepareActionRequest {
  customerId: string;
  kind: ActionKind;
  billType?: BillType | null;
  provider?: string | null;
  monthlyAmountEur?: number | null;
  amountEur?: number | null;
  /** Transfers only: `savings` (the default) or `investments`. */
  destination?: string | null;
}

/** Body of `POST /api/actions/:id/approve` (`confirm` is true) and of `/decline` (no `confirm`). */
export interface ActionDecisionRequest { customerId: string; confirm?: boolean | null }

/** Body of `POST /api/voice/tts`. `format` is `mp3` (the default here) or `pcm`. Up to 600 characters. */
export interface SpeechRequest {
  text: string;
  format?: string | null;
  previousText?: string | null;
  model?: string | null;
  voiceId?: string | null;
  language?: string | null;
}
export const SpeechRequest = {
  make: (r: SpeechRequest): SpeechRequest => ({ ...r, format: r.format === undefined ? "mp3" : r.format }),
} as const;
