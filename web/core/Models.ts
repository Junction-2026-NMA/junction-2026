// Models that mirror `lib/types.ts`, the team's API contract. Port of SisuCore/Models.swift.
// Swift optionals are `field?: T | null` (the server sends null; a missing key counts the same).
// The small JSON readers at the bottom are the TypeScript stand-in for Swift's `Decodable`: they throw a
// `DecodingError` where `JSONDecoder` would, and callers turn that into `SisuError.invalidResponse`.

/** The three spending baskets from the S-Pankki brief. regular = "Fixed", irregular = "Curveballs", everyday = "Leaks". */
export type BasketId = "regular" | "irregular" | "everyday";
export const BasketId = {
  regular: "regular",
  irregular: "irregular",
  everyday: "everyday",
  allCases: ["regular", "irregular", "everyday"] as readonly BasketId[],
  /** `BasketId(rawValue:)`: the basket, or null for any other text. */
  fromRaw(raw: string | null | undefined): BasketId | null {
    return raw === "regular" || raw === "irregular" || raw === "everyday" ? raw : null;
  },
} as const;

export type Confidence = "high" | "medium" | "low";
export const Confidence = { allCases: ["high", "medium", "low"] as readonly Confidence[] } as const;

/** The three futures the simulator compares. */
export type BranchId = "nothing" | "save" | "invest";
export const BranchId = {
  allCases: ["nothing", "save", "invest"] as readonly BranchId[],
  fromRaw(raw: string | null | undefined): BranchId | null {
    return raw === "nothing" || raw === "save" || raw === "invest" ? raw : null;
  },
} as const;

/** One bank transaction row. */
export interface Transaction {
  customerId: string;
  date: string;
  time: string;
  category: string;
  amount: number;
  balanceAfter: number;
  type: string;
  merchantId?: string | null;
  mcc?: string | null;
}

/** A demo profile. Names are invented; the dataset has none. */
export interface DemoCustomer {
  customerId: string;
  displayName: string;
  age: number;
  postalCode: string;
  area: string;
}

/** Spending in one category, with the basket it sits in and why. */
export interface CategoryTotal {
  category: string;
  basket: BasketId;
  reason: string;
  monthlyAvg: number;
  count: number;
  peerMonthlyAvg?: number | null;
}

/** One of the three spending baskets. */
export interface BasketSummary {
  id: BasketId;
  label: string;
  description: string;
  monthlyAvg: number;
  share: number;
  categories: CategoryTotal[];
}

/** One month of cash flow. */
export interface MonthPoint {
  month: string;
  income: number;
  regular: number;
  irregular: number;
  everyday: number;
  saved: number;
  endBalance: number;
}

/** A recurring bill Sisu detected. `guessLabel` is a guess the user confirms. */
export interface RecurringBill {
  id: string;
  category: string;
  guessLabel: string;
  monthlyAvg: number;
  min: number;
  max: number;
  typicalDay: number;
  monthsSeen: number;
  windowMonths: number;
  confidence: Confidence;
  basis: string;
}

/** One line of the safe-to-spend maths. */
export interface CalcStep {
  label: string;
  amount: number;
  basis: string;
}

/** Safe-to-spend figures. `gapPerMonth` > 0 means room left, < 0 means overspending. */
export interface SafeToSpend {
  perWeek: number;
  perMonth: number;
  steps: CalcStep[];
  actualEverydayPerMonth: number;
  gapPerMonth: number;
}

/** Selects the transactions behind a figure. */
export interface EvidenceFilter {
  from: string;
  to: string;
  category?: string | null;
  basket?: BasketId | null;
  mcc?: string | null;
  negativeBalance?: boolean | null;
}

/** A finding with the filter that shows its transactions. */
export interface Insight {
  id: string;
  title: string;
  body: string;
  evidence: EvidenceFilter;
}

/** Everything the X-ray screen shows for one customer. Every number is computed by the server. */
export interface Overview {
  customerId: string;
  displayName: string;
  age: number;
  postalCode: string;
  ageBand: string;
  peerCount: number;
  dataTimestamp: string;
  currency: string;
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
}

/** The rows behind a figure (newest 300). */
export interface TransactionList {
  customerId: string;
  dataTimestamp: string;
  currency: string;
  count: number;
  total: number;
  truncated: boolean;
  transactions: Transaction[];
}

/** What the user changes in the futures simulator. */
export interface ScenarioInput {
  /** Euros freed per month by any change: a cheaper contract, spending less on a category. */
  billSavingPerMonth: number;
  everydayCutPct: number;
  years: number;
  /** A lump sum the "invest" future moves into investments on day one. 0 when none. */
  oneOffEur: number;
}
export const ScenarioInput = {
  make(billSavingPerMonth: number, everydayCutPct: number, years: number, oneOffEur = 0): ScenarioInput {
    return { billSavingPerMonth, everydayCutPct, years, oneOffEur };
  },
  /** Decodes the `input` of a scenario answer; a missing `oneOffEur` is 0. */
  decode(json: unknown): ScenarioInput {
    const o = JSONRead.object(json);
    return {
      billSavingPerMonth: JSONRead.num(o, "billSavingPerMonth"),
      everydayCutPct: JSONRead.num(o, "everydayCutPct"),
      years: JSONRead.int(o, "years"),
      oneOffEur: JSONRead.optNum(o, "oneOffEur") ?? 0,
    };
  },
} as const;

/** One month of one future. */
export interface BranchPoint {
  month: number;
  cash: number;
  invested: number;
  total: number;
  totalLow: number;
  totalHigh: number;
}

/** One of the three futures. */
export interface Branch {
  id: BranchId;
  label: string;
  points: BranchPoint[];
  endTotal: number;
  endLow: number;
  endHigh: number;
  runwayMonthsAtYear1: number;
}

/** Answer of `POST /api/scenarios`. */
export interface ScenarioResponse {
  customerId: string;
  dataTimestamp: string;
  currency: string;
  input: ScenarioInput;
  freedPerMonth: number;
  branches: Branch[];
  assumptions: string[];
}
export const ScenarioResponse = {
  decode(json: unknown): ScenarioResponse {
    const o = JSONRead.object(json, ["customerId", "dataTimestamp", "currency", "freedPerMonth", "branches", "assumptions"]);
    return { ...(o as unknown as ScenarioResponse), input: ScenarioInput.decode(o.input) };
  },
} as const;

/** Error body the API returns with a 4xx status. */
export interface ApiError {
  error: string;
}

// MARK: - JSON reading (the Decodable stand-in)

/** What `JSONDecoder` throws: a missing key or a value of the wrong type. */
export class DecodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecodingError";
  }
}

export type JSONObject = Record<string, unknown>;

/** Readers for one key of a JSON object. `opt*` accept a missing key or null (Swift `decodeIfPresent`), but a
 * value of the wrong type throws, as in Swift. */
export class JSONRead {
  static isObject(value: unknown): value is JSONObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /** The value as an object; with `keys`, each of them must be present and not null. */
  static object(value: unknown, keys: readonly string[] = []): JSONObject {
    if (!JSONRead.isObject(value)) throw new DecodingError("Expected an object.");
    const missing = keys.find((key) => value[key] === undefined || value[key] === null);
    if (missing) throw new DecodingError(`Missing key ${missing}.`);
    return value;
  }

  static array(value: unknown): unknown[] {
    if (!Array.isArray(value)) throw new DecodingError("Expected an array.");
    return value;
  }

  /** Parses text or UTF-8 bytes as JSON; throws `DecodingError` when it is not JSON. */
  static parse(input: string | Uint8Array): unknown {
    const text = typeof input === "string" ? input : new TextDecoder().decode(input);
    try {
      return JSON.parse(text);
    } catch {
      throw new DecodingError("Not JSON.");
    }
  }

  static str(o: JSONObject, key: string): string {
    const value = o[key];
    if (typeof value !== "string") throw new DecodingError(`${key} is not text.`);
    return value;
  }

  static optStr(o: JSONObject, key: string): string | null {
    const value = o[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") throw new DecodingError(`${key} is not text.`);
    return value;
  }

  static num(o: JSONObject, key: string): number {
    const value = o[key];
    if (typeof value !== "number") throw new DecodingError(`${key} is not a number.`);
    return value;
  }

  static optNum(o: JSONObject, key: string): number | null {
    const value = o[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== "number") throw new DecodingError(`${key} is not a number.`);
    return value;
  }

  static int(o: JSONObject, key: string): number {
    const value = JSONRead.num(o, key);
    if (!Number.isInteger(value)) throw new DecodingError(`${key} is not a whole number.`);
    return value;
  }

  static optInt(o: JSONObject, key: string): number | null {
    const value = JSONRead.optNum(o, key);
    if (value !== null && !Number.isInteger(value)) throw new DecodingError(`${key} is not a whole number.`);
    return value;
  }

  static optBool(o: JSONObject, key: string): boolean | null {
    const value = o[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== "boolean") throw new DecodingError(`${key} is not true or false.`);
    return value;
  }

  /** A required array of objects (each element only checked to be an object). */
  static objects<T>(o: JSONObject, key: string): T[] {
    const list = JSONRead.array(o[key]);
    list.forEach((item) => JSONRead.object(item));
    return list as T[];
  }

  /** An optional array of objects: missing or null gives []. */
  static optObjects<T>(o: JSONObject, key: string): T[] {
    const value = o[key];
    if (value === undefined || value === null) return [];
    return JSONRead.objects<T>(o, key);
  }

  /** Runs a decode and gives null when it throws (Swift `try?`). */
  static attempt<T>(work: () => T): T | null {
    try {
      return work();
    } catch {
      return null;
    }
  }
}
