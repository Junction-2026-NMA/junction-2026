// The live API of the team backend (lib/types.ts), plus the bundled-sample implementation. Port of
// SisuCore/API.swift. On the web the base URL defaults to "" (same origin: `/api/customers/demo`).
import { sisuFetch } from "./VisitorSession";
import {
  type BranchId,
  type Branch,
  type BranchPoint,
  type DemoCustomer,
  type EvidenceFilter,
  type Overview,
  type ScenarioInput,
  type TransactionList,
  JSONRead,
  ScenarioResponse,
} from "./Models";

// MARK: - Errors

/** The cases of `SisuError`, as a discriminated union. */
export type SisuErrorInfo =
  /** A scaffold stub that has not been built yet. */
  | { kind: "notImplemented"; what: string }
  /** The API answered with a non-2xx status. `message` is the `error` text of the body when there is one. */
  | { kind: "server"; status: number; message: string }
  /** The request could not reach the server or timed out. */
  | { kind: "offline" }
  /** The body could not be decoded. */
  | { kind: "invalidResponse" }
  /** No such customer in this data source. */
  | { kind: "unknownCustomer"; customerId: string }
  /** A step was attempted out of order. */
  | { kind: "invalidState"; what: string };

/** Errors the app turns into friendly messages. Throwable; switch on `error.info.kind`. */
export class SisuError extends Error {
  readonly info: SisuErrorInfo;

  constructor(info: SisuErrorInfo) {
    super(info.kind === "server" ? `server ${info.status}: ${info.message}` : info.kind);
    this.name = "SisuError";
    this.info = info;
  }

  get kind(): SisuErrorInfo["kind"] {
    return this.info.kind;
  }

  static notImplemented(what: string) { return new SisuError({ kind: "notImplemented", what }); }
  static server(status: number, message: string) { return new SisuError({ kind: "server", status, message }); }
  static offline() { return new SisuError({ kind: "offline" }); }
  static invalidResponse() { return new SisuError({ kind: "invalidResponse" }); }
  static unknownCustomer(customerId: string) { return new SisuError({ kind: "unknownCustomer", customerId }); }
  static invalidState(what: string) { return new SisuError({ kind: "invalidState", what }); }

  /** The server status of a `.server` error, else null. */
  static status(error: unknown): number | null {
    return error instanceof SisuError && error.info.kind === "server" ? error.info.status : null;
  }
}

/** Swift's `CancellationError`: the work was stopped on purpose (an aborted fetch counts too). */
export class CancellationError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancellationError";
  }
}

export function isCancellation(error: unknown): boolean {
  if (error instanceof CancellationError) return true;
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

/** Where the data on screen came from. The UI must label everything that is not `live` as "Sample data". */
export type DataSourceKind = "live" | "bundledSample";
export const DataSourceKind = { live: "live", bundledSample: "bundledSample", allCases: ["live", "bundledSample"] } as const;

/** The endpoints that are live on the team backend. Every number the app shows comes from these payloads. */
export interface SisuAPI {
  readonly kind: DataSourceKind;
  /** `GET /api/customers/demo` */
  demoCustomers(): Promise<DemoCustomer[]>;
  /** `GET /api/customers/:id/overview` */
  overview(customerId: string): Promise<Overview>;
  /** `GET /api/customers/:id/transactions`. A null filter asks for the default window. */
  transactions(customerId: string, filter: EvidenceFilter | null): Promise<TransactionList>;
  /** `POST /api/scenarios` */
  scenario(customerId: string, input: ScenarioInput): Promise<ScenarioResponse>;
}

// MARK: - Requests

/** The web stand-in for `URLRequest`. `timeoutInterval` is in seconds, as in Swift. */
export interface SisuRequest {
  url: string;
  method: "GET" | "POST" | "DELETE";
  headers: Record<string, string>;
  /** JSON text, or a multipart form (fetch sets the multipart Content-Type itself). */
  body?: string | FormData | null;
  timeoutInterval: number;
}

/** `URLRequest`'s default timeout. */
export const defaultTimeoutInterval = 60;

/** Builds the HTTP requests for the live API. Pure, so it can be tested without a network. */
export class Endpoints {
  /** Percent-encodes everything but the RFC 3986 "unreserved" characters. */
  static escape(text: string): string {
    return encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /** `{base}{path}?{query}`: the base keeps its own path prefix, a trailing slash on it is dropped. */
  static url(baseURL: string, path: string, query: ReadonlyArray<readonly [string, string]> = []): string {
    const base = baseURL.replace(/\/+$/, "");
    const tail = query.length ? "?" + query.map(([k, v]) => `${Endpoints.escape(k)}=${Endpoints.escape(v)}`).join("&") : "";
    return base + path + tail;
  }

  static get(url: string): SisuRequest {
    return { url, method: "GET", headers: { Accept: "application/json" }, body: null, timeoutInterval: defaultTimeoutInterval };
  }

  static postJSON(url: string, body: string): SisuRequest {
    return {
      url,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
      timeoutInterval: defaultTimeoutInterval,
    };
  }

  /** JSON with sorted keys and no null or undefined members (Swift's `.sortedKeys`, nil optionals left out). */
  static encode(value: unknown): string {
    const clean = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(clean);
      if (!JSONRead.isObject(v)) return v;
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .filter((k) => v[k] !== undefined && v[k] !== null)
          .map((k) => [k, clean(v[k])]),
      );
    };
    return JSON.stringify(clean(value)) ?? "{}";
  }

  /** `GET {base}/api/customers/demo` */
  static demoCustomers(baseURL: string): SisuRequest {
    return Endpoints.get(Endpoints.url(baseURL, "/api/customers/demo"));
  }

  /** `GET {base}/api/customers/{id}/overview`. The id is percent-encoded as a path segment. */
  static overview(baseURL: string, customerId: string): SisuRequest {
    return Endpoints.get(Endpoints.url(baseURL, `/api/customers/${Endpoints.escape(customerId)}/overview`));
  }

  /** One query item per non-null filter field, in this order: from, to, category, basket, mcc, negativeBalance. */
  static transactions(baseURL: string, customerId: string, filter: EvidenceFilter | null): SisuRequest {
    const query: [string, string][] = [];
    if (filter) {
      query.push(["from", filter.from], ["to", filter.to]);
      if (filter.category != null) query.push(["category", filter.category]);
      if (filter.basket != null) query.push(["basket", filter.basket]);
      if (filter.mcc != null) query.push(["mcc", filter.mcc]);
      if (filter.negativeBalance != null) query.push(["negativeBalance", filter.negativeBalance ? "true" : "false"]);
    }
    return Endpoints.get(Endpoints.url(baseURL, `/api/customers/${Endpoints.escape(customerId)}/transactions`, query));
  }

  /** `POST {base}/api/scenarios` with exactly customerId, billSavingPerMonth, everydayCutPct, years (and oneOffEur
   * only when above zero). */
  static scenario(baseURL: string, customerId: string, input: ScenarioInput): SisuRequest {
    const finite = (x: number) => (Number.isFinite(x) ? x : 0);
    const oneOff = Number.isFinite(input.oneOffEur) && input.oneOffEur > 0 ? input.oneOffEur : null;
    const body = Endpoints.encode({
      customerId,
      billSavingPerMonth: finite(input.billSavingPerMonth),
      everydayCutPct: finite(input.everydayCutPct),
      years: input.years,
      oneOffEur: oneOff,
    });
    return Endpoints.postJSON(Endpoints.url(baseURL, "/api/scenarios"), body);
  }
}

// MARK: - Fetching

/** A fetch with the request's timeout and an optional caller signal. Throws `SisuError.offline` when the
 * server cannot be reached or the timeout passes, `CancellationError` when the caller aborted. `touch()`
 * restarts the timeout (Swift's timeout is the longest wait between two pieces of data). */
export class FetchCall {
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timedOut = false;
  private readonly unlink: () => void;

  constructor(private readonly timeoutSeconds: number, private readonly signal?: AbortSignal | null) {
    const onAbort = () => this.controller.abort();
    if (signal?.aborted) this.controller.abort();
    signal?.addEventListener("abort", onAbort);
    this.unlink = () => signal?.removeEventListener("abort", onAbort);
    this.touch();
  }

  get abortSignal(): AbortSignal { return this.controller.signal; }

  touch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timedOut = true; this.controller.abort(); }, Math.max(this.timeoutSeconds, 0.001) * 1000);
  }

  /** Stops the timer and closes the connection (when it is still open). */
  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.unlink();
    this.controller.abort();
  }

  /** The error to throw for a failure. */
  map(error: unknown): unknown {
    if (error instanceof SisuError) return error;
    if (this.signal?.aborted && !this.timedOut) return new CancellationError();
    return SisuError.offline();
  }

  async start(request: SisuRequest, fetchImpl: typeof fetch): Promise<Response> {
    try {
      return await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" ? undefined : request.body ?? undefined,
        signal: this.controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      this.close();
      throw this.map(error);
    }
  }
}

export function headersOf(response: Response): Record<string, string> {
  const out: Record<string, string> = {};
  response.headers.forEach((value, key) => { out[key] = value; });
  return out;
}

/** The `error` sentence of an error body, or "". */
export function errorMessage(body: Uint8Array | string): string {
  const parsed = JSONRead.attempt(() => JSONRead.parse(body));
  return JSONRead.isObject(parsed) && typeof parsed.error === "string" ? parsed.error : "";
}

/** Status and body in, model or `SisuError` out (the pure half of `LiveAPI.send`). */
export function decodeAnswer<T>(status: number, body: Uint8Array, decode: (json: unknown) => T): T {
  if (status < 200 || status >= 300) throw SisuError.server(status, errorMessage(body));
  try {
    return decode(JSONRead.parse(body));
  } catch {
    throw SisuError.invalidResponse();
  }
}

/** Talks to the team backend over HTTP: 2xx is decoded (`invalidResponse` when it does not), non-2xx throws
 * `server(status, message)`, a transport failure throws `offline`. Every request times out after `timeout`
 * seconds (5). `kind` is `live`. */
export class LiveAPI implements SisuAPI {
  readonly kind: DataSourceKind = "live";
  timeout = 5;

  constructor(readonly baseURL = "", private readonly fetchImpl: typeof fetch = sisuFetch) {}

  async send<T>(request: SisuRequest, decode: (json: unknown) => T): Promise<T> {
    const call = new FetchCall(this.timeout);
    const response = await call.start({ ...request, timeoutInterval: this.timeout }, this.fetchImpl);
    try {
      const body = new Uint8Array(await response.arrayBuffer());
      return decodeAnswer(response.status, body, decode);
    } catch (error) {
      throw call.map(error);
    } finally {
      call.close();
    }
  }

  demoCustomers() { return this.send(Endpoints.demoCustomers(this.baseURL), decodeList<DemoCustomer>); }
  overview(customerId: string) { return this.send(Endpoints.overview(this.baseURL, customerId), decodeOverview); }
  transactions(customerId: string, filter: EvidenceFilter | null) {
    return this.send(Endpoints.transactions(this.baseURL, customerId, filter), decodeTransactionList);
  }
  scenario(customerId: string, input: ScenarioInput) {
    return this.send(Endpoints.scenario(this.baseURL, customerId, input), ScenarioResponse.decode);
  }
}

export const decodeList = <T>(json: unknown): T[] => { JSONRead.array(json).forEach((x) => JSONRead.object(x)); return json as T[]; };
export const decodeOverview = (json: unknown): Overview =>
  JSONRead.object(json, ["customerId", "balance", "baskets", "months", "recurringBills", "safeToSpend"]) as unknown as Overview;
export const decodeTransactionList = (json: unknown): TransactionList =>
  JSONRead.object(json, ["customerId", "count", "total", "transactions"]) as unknown as TransactionList;

// MARK: - Bundled sample

/** Reads one bundled file (a path under public/sisu-fixtures, for example `coach/warm.json`). Null when missing. */
export type FixtureSource = (path: string) => Promise<Uint8Array | null>;

/** Fetches the bundled files from the site (`/sisu-fixtures/...`), once each. */
export function fetchFixtureSource(basePath = "/sisu-fixtures"): FixtureSource {
  const cache = new Map<string, Promise<Uint8Array | null>>();
  return (path) => {
    const hit = cache.get(path);
    if (hit) return hit;
    const load = fetch(`${basePath.replace(/\/+$/, "")}/${path}`)
      .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : null))
      .catch(() => null);
    load.then((bytes) => { if (!bytes) cache.delete(path); });
    cache.set(path, load);
    return load;
  };
}

let defaultFixtureSource: FixtureSource = fetchFixtureSource();

/** Serves the JSON captured from the team backend on 14 Nov 2026 (public/sisu-fixtures). `kind` is `bundledSample`.
 * - `transactions`: a filter with a basket returns that basket's file; anything else returns the default list.
 * - `scenario`: computed by `ScenarioEngine` from the bundled overview, so sliders work offline.
 * - An id that is not one of the three demo customers throws `unknownCustomer(id)`. */
export class FixtureAPI implements SisuAPI {
  readonly kind: DataSourceKind = "bundledSample";
  static readonly customerIds = ["CUST04974", "CUST04414", "CUST02003"];

  constructor(private readonly source: FixtureSource = FixtureAPI.defaultSource) {}

  /** Where every sample reader gets its files unless given another source. */
  static get defaultSource(): FixtureSource { return defaultFixtureSource; }
  static setDefaultSource(source: FixtureSource): void { defaultFixtureSource = source; }

  static async load<T>(name: string, decode: (json: unknown) => T, source: FixtureSource = FixtureAPI.defaultSource): Promise<T> {
    const bytes = await source(`${name}.json`);
    if (!bytes) throw SisuError.invalidResponse();
    try {
      return decode(JSONRead.parse(bytes));
    } catch {
      throw SisuError.invalidResponse();
    }
  }

  private check(customerId: string): void {
    if (!FixtureAPI.customerIds.includes(customerId)) throw SisuError.unknownCustomer(customerId);
  }

  demoCustomers() { return FixtureAPI.load("demo-customers", decodeList<DemoCustomer>, this.source); }

  async overview(customerId: string) {
    this.check(customerId);
    return FixtureAPI.load(`overview-${customerId}`, decodeOverview, this.source);
  }

  async transactions(customerId: string, filter: EvidenceFilter | null) {
    this.check(customerId);
    return FixtureAPI.load(`transactions-${customerId}-${filter?.basket ?? "all"}`, decodeTransactionList, this.source);
  }

  async scenario(customerId: string, input: ScenarioInput) {
    return ScenarioEngine.run(await this.overview(customerId), input);
  }
}

/** A port of `lib/finance/scenario.ts` (`cleanInput` and `runScenario`), used only offline. Online, the futures
 * come from `POST /api/scenarios`. `run` reproduces the server's answer to within 0.01. */
export class ScenarioEngine {
  static readonly returnLow = 0.01;
  static readonly returnMid = 0.05;
  static readonly returnHigh = 0.08;
  static readonly fundFee = 0.002;

  /** Clamps as the server does: bill saving 0...500, cut 0...50 %, 1...10 whole years, lump sum 0...100,000 in cents. */
  static clean(input: ScenarioInput): ScenarioInput {
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(Number.isFinite(v) ? v : lo, lo), hi);
    return {
      billSavingPerMonth: clamp(input.billSavingPerMonth, 0, 500),
      everydayCutPct: clamp(input.everydayCutPct, 0, 50),
      years: Math.round(clamp(input.years, 1, 10)),
      oneOffEur: ScenarioEngine.round2(clamp(input.oneOffEur ?? 0, 0, 100_000)),
    };
  }

  /** JavaScript's `Math.round(x * 100) / 100` (halves go up). */
  static round2(x: number): number {
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
  }

  static label(id: BranchId): string {
    switch (id) {
      case "nothing": return "Change nothing";
      case "save": return "Make the change, keep the cash";
      case "invest": return "Make the change, invest it";
    }
  }

  /** `invested` is money already in investments on day one (a lump sum the customer moves there). */
  static project(id: BranchId, overview: Overview, toCash: number, toInvested: number, months: number, invested = 0): Branch {
    const { round2, fundFee } = ScenarioEngine;
    const grow = (pot: number, yearly: number) => (pot + toInvested) * (1 + (yearly - fundFee) / 12);
    const balance = overview.balance;
    let cash = balance - invested, low = invested, mid = invested, high = invested;
    const points: BranchPoint[] = [{ month: 0, cash, invested, total: balance, totalLow: balance, totalHigh: balance }];
    for (let month = 0; month < Math.max(months, 0); month += 1) {
      cash += toCash;
      low = grow(low, ScenarioEngine.returnLow);
      mid = grow(mid, ScenarioEngine.returnMid);
      high = grow(high, ScenarioEngine.returnHigh);
      points.push({ month: month + 1, cash: round2(cash), invested: round2(mid), total: round2(cash + mid),
        totalLow: round2(cash + low), totalHigh: round2(cash + high) });
    }
    const end = points[points.length - 1];
    const atYear1 = points[Math.min(12, points.length - 1)];
    const runway = overview.monthlyMandatory > 0 ? round2(Math.max(atYear1.cash, 0) / overview.monthlyMandatory) : 0;
    return { id, label: ScenarioEngine.label(id), points, endTotal: end.total, endLow: end.totalLow, endHigh: end.totalHigh,
      runwayMonthsAtYear1: runway };
  }

  /** The number as JavaScript prints it in the assumption sentences: `5`, `0.2`. */
  static percent(fraction: number): string {
    return String(Math.round(fraction * 100 * 1_000_000) / 1_000_000);
  }

  static run(overview: Overview, raw: ScenarioInput): ScenarioResponse {
    const input = ScenarioEngine.clean(raw);
    const { percent, project } = ScenarioEngine;
    const freed = ScenarioEngine.round2(input.billSavingPerMonth + (overview.monthlyEveryday * input.everydayCutPct) / 100);
    const netToCash = overview.monthlyIncome - overview.monthlySpending - overview.monthlySaved;
    const months = input.years * 12;
    const saved = overview.monthlySaved;
    return {
      customerId: overview.customerId, dataTimestamp: overview.dataTimestamp, currency: "EUR", input, freedPerMonth: freed,
      branches: [
        project("nothing", overview, netToCash, saved, months),
        project("save", overview, netToCash + freed, saved, months),
        project("invest", overview, netToCash, saved + freed, months, input.oneOffEur),
      ],
      assumptions: [
        "Income and spending stay at their last-12-month averages. Real life will differ.",
        `Invested money is shown at ${percent(ScenarioEngine.returnMid)}% a year, with a range from ${percent(ScenarioEngine.returnLow)}% to ${percent(ScenarioEngine.returnHigh)}%. These are scenarios, not predictions; investments can lose value.`,
        `A fund fee of ${percent(ScenarioEngine.fundFee)}% a year is taken off. Taxes and inflation are not included.`,
        "Investments already held elsewhere are not visible in the bank data, so the invested pot starts at €0.",
        "Cash in the account earns no interest here.",
        ...(input.oneOffEur !== 0
          ? [`In the "invest it" future, €${Math.round(input.oneOffEur)} is moved from the account into investments on day one. In the other two it stays in the account.`]
          : []),
      ],
    };
  }
}
