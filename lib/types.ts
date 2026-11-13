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

export type ApiError = { error: string };
