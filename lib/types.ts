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
  modelSteps: { model: string; firstTokenMs: number | null; totalMs: number }[];
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
