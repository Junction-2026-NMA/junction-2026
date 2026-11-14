// Shared API contract. Change it on main only, and tell the team when you do.

export type Transaction = {
  customerId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  category: string;
  amount: number; // negative = money out
  balanceAfter: number;
  type: string;
  merchantId: string | null;
  mcc: string | null;
};

export type BasketId = "regular" | "irregular" | "everyday";

export type DemoCustomer = {
  customerId: string;
  displayName: string; // invented label; the dataset has no names
  age: number;
  postalCode: string;
  area: string;
};

export type CategoryTotal = {
  category: string;
  basket: BasketId;
  reason: string; // why this category sits in this basket
  monthlyAvg: number;
  count: number;
  peerMonthlyAvg: number | null;
};

export type BasketSummary = {
  id: BasketId;
  label: string;
  description: string;
  monthlyAvg: number;
  share: number; // 0..1 of total spending
  categories: CategoryTotal[];
};

export type MonthPoint = {
  month: string; // YYYY-MM
  income: number;
  regular: number;
  irregular: number;
  everyday: number;
  saved: number;
  endBalance: number;
};

export type Confidence = "high" | "medium" | "low";

export type RecurringBill = {
  id: string;
  category: string;
  guessLabel: string; // Sisu's guess; the user can correct it
  monthlyAvg: number;
  min: number;
  max: number;
  typicalDay: number;
  monthsSeen: number;
  windowMonths: number;
  confidence: Confidence;
  basis: string;
};

export type CalcStep = { label: string; amount: number; basis: string };

export type SafeToSpend = {
  perWeek: number;
  perMonth: number;
  steps: CalcStep[];
  actualEverydayPerMonth: number;
  gapPerMonth: number; // positive = room left, negative = overspending
};

export type EvidenceFilter = {
  from: string;
  to: string;
  category?: string;
  basket?: BasketId;
  mcc?: string;
  negativeBalance?: boolean;
};

export type Insight = {
  id: string;
  title: string;
  body: string;
  evidence: EvidenceFilter;
};

export type Overview = {
  customerId: string;
  displayName: string;
  age: number;
  postalCode: string;
  ageBand: string;
  peerCount: number;
  dataTimestamp: string;
  currency: "EUR";
  windowMonths: number;
  windowFrom: string;
  windowTo: string;
  balance: number;
  monthlyIncome: number;
  monthlySpending: number;
  monthlySaved: number;
  monthlyMandatory: number;
  monthlyEveryday: number;
  runwayMonths: number;
  baskets: BasketSummary[];
  months: MonthPoint[];
  recurringBills: RecurringBill[];
  safeToSpend: SafeToSpend;
  insights: Insight[];
  assumptions: string[];
};

export type TransactionList = {
  customerId: string;
  dataTimestamp: string;
  currency: "EUR";
  count: number;
  total: number;
  truncated: boolean;
  transactions: Transaction[];
};

// --- Financial futures ---

export type ScenarioBase = {
  balance: number;
  monthlyIncome: number;
  monthlySpending: number;
  monthlySaved: number; // deposits to investments the customer already makes
  monthlyMandatory: number;
  monthlyEveryday: number;
};

export type ScenarioInput = {
  billSavingPerMonth: number; // from switching a contract
  everydayCutPct: number; // 0..50, share of everyday spending trimmed
  years: number; // 1..10
};

export type BranchId = "nothing" | "save" | "invest";

export type BranchPoint = { month: number; cash: number; invested: number; total: number; totalLow: number; totalHigh: number };

export type Branch = {
  id: BranchId;
  label: string;
  points: BranchPoint[];
  endTotal: number;
  endLow: number;
  endHigh: number;
  runwayMonthsAtYear1: number; // months of must-pay costs covered by cash alone after 12 months
};

export type ScenarioResult = {
  freedPerMonth: number;
  branches: Branch[];
  assumptions: string[];
};

// --- Agent, research and voice (lane C). See context/orchestration.md ---

export type BillType = "electricity" | "mobile" | "internet";

export type Citation = {
  title: string;
  url: string;
  retrievedAt: string; // ISO time we fetched it
  cacheAgeMs: number | null; // how old the provider's cached copy was, if it said
};

export type Offer = {
  provider: string;
  plan: string | null;
  contractType: string | null; // e.g. fixed, spot
  contractMonths: number | null;
  monthlyPriceEur: number | null; // fixed monthly price or base fee
  energyPriceCentsPerKwh: number | null; // electricity only
  setupFeeEur: number | null;
  sourceUrl: string;
  comparable: boolean; // false when the price cannot be compared fairly (e.g. spot contracts)
  estimatedMonthlyCostEur: number | null; // computed in code
  estimatedYearlySavingEur: number | null; // computed in code, against the customer's current bill
};

export type ResearchStatus = "running" | "partial" | "done" | "failed";

export type ResearchResult = {
  key: string;
  billType: BillType;
  city: string;
  status: ResearchStatus;
  mock: boolean; // true = example data, not a live call. The UI must label it.
  query: string;
  startedAt: string;
  finishedAt: string | null;
  tookMs: number;
  pagesDone: number;
  pagesTotal: number;
  baselineMonthlyEur: number | null; // the customer's current bill, from the finance engine
  assumedYearlyKwh: number | null; // electricity only: the use the comparison is based on
  usageSource: "stated" | "estimated-from-bill" | "default" | null; // where that figure came from
  offers: Offer[];
  best: Offer | null;
  citations: Citation[];
  assumptions: string[];
  errors: string[];
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AgentRequest = {
  customerId: string;
  text: string;
  mode: "voice" | "text";
  history?: ChatTurn[];
  focusBill?: BillType; // the bill the user has open on screen, if any
  investigate?: boolean; // true = Sisu works through a whole investigation on its own (see POST /api/agent/investigate)
};

export type ToolTrace = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  source: "finance" | "exa+context.dev" | "exa";
  startedAtMs: number; // since the turn started
  tookMs: number;
  ok: boolean;
  summary: string; // one line a person can read
  joinedPrefetch: boolean; // true when research was already running or cached
};

export type TurnTimings = {
  sttMs: number | null;
  firstTokenMs: number | null; // since the turn started
  firstSentenceMs: number | null;
  totalMs: number;
  modelSteps: { model: string; provider: string; usedBackup: boolean; firstTokenMs: number | null; totalMs: number }[];
};

export type AgentEvent =
  | { type: "start"; turnId: string; provider: string; model: string; mock: boolean }
  | { type: "transcript"; text: string; tookMs: number }
  | { type: "speculation"; billType: BillType; reason: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_end"; trace: ToolTrace }
  | { type: "filler"; text: string }
  | { type: "research"; result: ResearchResult }
  | { type: "delta"; text: string }
  | { type: "sentence"; index: number; text: string }
  | { type: "done"; text: string; citations: Citation[]; timings: TurnTimings }
  | { type: "error"; message: string };

export type ApiError = { error: string };

// --- Receipts, investigation stages, teaching, actions and memory (added 14 Nov on overnight/fable-lead) ---
// Everything below is ADDITIVE: no existing type changed shape. See docs/FRONTEND_INTEGRATION_CONTRACT.md.

// Where a number came from. The UI can colour or label each figure by this.
export type SourceKind = "bank-data" | "exa" | "context.dev" | "assumption" | "customer-stated" | "calculation";

export type FactUnit = "EUR" | "EUR/month" | "EUR/year" | "kWh/year" | "c/kWh" | "months" | "count" | "percent" | "years" | "days";

// One receipt: a number Sisu is allowed to say, with where it came from and how to open the rows behind it.
export type Fact = {
  id: string;
  label: string;
  value: number;
  unit: FactUnit;
  source: SourceKind;
  basis: string; // one line a person can read: how it was worked out
  evidence?: EvidenceFilter; // pass to GET /api/customers/:id/transactions to show the rows
  url?: string; // for web facts
};

export type NumberCheck = {
  value: number; // the number as it appears in the final answer
  status: "receipt" | "context" | "trivial" | "unverified";
  factId: string | null; // set when status is "receipt"
};

// The model copied a figure almost right (a slipped digit). Sisu replaced it with the receipt's value before showing or speaking it.
export type NumberCorrection = { said: number; corrected: number; factId: string };

// Result of checking every number in the answer against the receipts. `ok` is false if any number has no source.
export type Grounding = { ok: boolean; checked: number; unverified: number[]; numbers: NumberCheck[]; corrections: NumberCorrection[] };

export type PatternKind = "bill-opportunity" | "bill-creep" | "overdraft-risk" | "payday-spike" | "category-drift" | "peer-gap" | "small-purchases" | "lumpy-costs" | "idle-cash";

// Something worth looking into, found by code in the customer's own history.
export type Pattern = {
  id: string;
  kind: PatternKind;
  title: string;
  detail: string;
  yearlyImpactEur: number | null; // null when no honest euro figure exists
  confidence: Confidence;
  billType: BillType | null; // set when live offer research can follow
  evidence: EvidenceFilter;
  facts: Fact[];
  nextSteps: string[]; // tool names that would take this further
};

export type PayCycle = { payday: string; income: number; lowestBalance: number; lowestOn: string; daysToLowest: number; spentInFirstWeek: number; spentInCycle: number };

export type CashFlow = {
  customerId: string;
  dataTimestamp: string;
  typicalPayday: number | null; // day of the month
  nextPayday: string | null; // first expected payday after the data ends
  daysToNextPayday: number | null;
  cycles: PayCycle[]; // most recent last
  averageDailyEverydayEur: number;
  billsDueBeforePayday: { billId: string; label: string; amount: number; expectedOn: string }[];
  projectedLowPointEur: number | null; // balance expected just before the next payday
  firstWeekShare: number | null; // share of a cycle's everyday spending that happens in the 7 days after payday
  negativeMonths: number;
  steps: CalcStep[];
  assumptions: string[];
};

export type AffordabilityVerdict = "comfortable" | "tight" | "not-yet";

export type Affordability = {
  amountEur: number;
  verdict: AffordabilityVerdict;
  balanceAfterEur: number;
  projectedLowPointEur: number | null;
  bufferMonthsAfter: number; // months of must-pay costs still covered by the balance afterwards
  monthsToSaveUp: number | null; // if not affordable now: months of current surplus needed
  steps: CalcStep[];
  assumptions: string[];
};

export type ConceptId = "three-baskets" | "safe-to-spend" | "fixed-vs-spot" | "buffer-first" | "compound-growth" | "switching-bills" | "pay-yourself-first";

// A teaching moment built from the customer's own numbers. Ask `question` BEFORE showing `reveal`.
export type TeachingCard = {
  id: string;
  concept: ConceptId;
  title: string;
  explanation: string;
  question: string;
  options: string[];
  correctIndex: number;
  reveal: string;
  facts: Fact[];
};

export type ActionKind = "switch_contract" | "standing_transfer";
export type ActionStatus = "awaiting_approval" | "executed_simulated" | "declined" | "expired";

export type ActionImpact = {
  monthlyEur: number;
  yearlyEur: number;
  horizonYears: number;
  branches: { id: BranchId; label: string; endTotal: number; endLow: number; endHigh: number }[];
  gainVsNothingEur: number; // "keep the cash" branch against "change nothing" at the horizon
  summary: string;
};

// A prepared action. Nothing happens until the user approves it, and even then it is a simulation.
export type AgentAction = {
  id: string;
  customerId: string;
  kind: ActionKind;
  status: ActionStatus;
  simulated: true;
  title: string;
  summary: string;
  checklist: string[]; // the steps a real switch would take
  draftMessage: string | null; // text Sisu drafted for the provider; never sent
  billType: BillType | null;
  offer: Offer | null;
  monthlyAmountEur: number;
  facts: Fact[];
  sources: Citation[];
  assumptions: string[];
  preparedBy: "sisu-agent" | "user";
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
  impact: ActionImpact | null; // filled in when approved
};

export type AuditEventType = "action_prepared" | "action_approved" | "action_executed_simulated" | "action_declined" | "action_expired" | "memory_saved" | "memory_forgotten" | "consent_changed" | "demo_reset";

// Tamper-evident log: each event carries the hash of the one before it.
export type AuditEvent = {
  seq: number;
  at: string;
  customerId: string;
  type: AuditEventType;
  actor: "user" | "sisu-agent" | "system";
  actionId: string | null;
  detail: string;
  prevHash: string;
  hash: string;
};

export type MemoryKind = "bill_name" | "yearly_kwh" | "preference" | "goal";

export type MemoryItem = {
  id: string;
  kind: MemoryKind;
  key: string; // bill id for bill_name, otherwise a short label
  value: string;
  billType: BillType | null; // bill_name only: which kind of bill the user says it is
  source: "user-confirmed-in-app" | "user-said-in-chat";
  savedAt: string;
};

export type CustomerMemory = { customerId: string; consent: boolean; items: MemoryItem[] };

export type StageKind = "lead" | "evidence" | "research" | "extraction" | "calculation" | "teaching" | "action" | "impact" | "memory";

// One step of Sisu's work, typed so the UI can draw a card for it. A whole turn (or investigation) is a sequence of these.
export type Stage = {
  id: string;
  kind: StageKind;
  title: string;
  summary: string;
  source: SourceKind | "nemotron";
  toolCallId: string | null; // the tool call that produced it; matches ToolTrace.id
  atMs: number; // since the turn started
  facts: Fact[];
  data:
    | { kind: "lead"; patterns: Pattern[] }
    | { kind: "evidence"; filter: EvidenceFilter; count: number; totalEur: number; largest: { date: string; amount: number; category: string; merchantType: string | null }[] }
    | { kind: "research"; query: string; searchedWith: "exa"; pages: Citation[]; retrievedAt: string; mock: boolean }
    | { kind: "extraction"; extractedWith: "context.dev"; pagesRead: number; pagesTotal: number; offers: Offer[]; problems: string[] }
    | { kind: "calculation"; steps: CalcStep[]; resultLabel: string; resultValue: number; unit: FactUnit; assumptions: string[] }
    | { kind: "teaching"; card: TeachingCard }
    | { kind: "action"; action: AgentAction }
    | { kind: "impact"; impact: ActionImpact }
    | { kind: "memory"; item: MemoryItem };
};

// Extra events on the agent stream. Older clients can ignore them.
export type AgentExtraEvent =
  | { type: "stage"; stage: Stage }
  | { type: "action"; action: AgentAction } // show the approval card; approve with POST /api/actions/:id/approve
  | { type: "teaching"; card: TeachingCard }
  | { type: "memory"; item: MemoryItem }
  | { type: "grounding"; grounding: Grounding; facts: Fact[] }; // sent just before "done"

export type SisuEvent = AgentEvent | AgentExtraEvent;

export type InvestigateRequest = { customerId: string; mode?: "voice" | "text"; focus?: PatternKind | BillType };

export type ActionList = { customerId: string; actions: AgentAction[]; audit: AuditEvent[]; auditChainValid: boolean };

export type HealthReport = {
  ok: boolean;
  mock: boolean;
  model: { provider: string; name: string; host: string; region: string | null; reachable: boolean | null; latencyMs: number | null };
  backup: { provider: string; name: string; inUseNow: boolean } | null; // inUseNow: the main model failed recently, so the backup is answering
  services: { exa: boolean; contextDev: boolean; elevenLabs: boolean };
  dataBoundary: string[];
  store: { persistent: boolean; path: string | null };
  checkedAt: string;
};
