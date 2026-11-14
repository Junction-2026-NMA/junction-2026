// The network, behind a small interface: `FetchTransport` for live use, `ReplayTransport` for the offline
// sample mode (it answers from the recordings under public/sisu-fixtures/coach), `FallbackTransport` for live
// with a switch to the sample. Port of SisuCore/Transport.swift. Cancel with an `AbortSignal` (Swift cancels
// the task); a stream is closed by stopping its `for await` loop or by aborting the signal.
import { sisuFetch } from "./VisitorSession";
import {
  type DataSourceKind,
  type FixtureSource,
  type SisuRequest,
  FetchCall,
  FixtureAPI,
  ScenarioEngine,
  SisuError,
  decodeOverview,
  headersOf,
} from "./API";
import { BasketId, JSONRead, type JSONObject } from "./Models";
import { ConceptId } from "./CoachModels";
import { CoachEndpoints } from "./CoachEndpoints";

/** A whole HTTP answer. */
export interface TransportResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}
export const TransportResponse = {
  contentType: (r: { headers: Record<string, string> }): string | null =>
    Object.entries(r.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1] ?? null,
} as const;

/** An HTTP answer whose body arrives in pieces (an async iterator of byte chunks). Stop reading to close it. */
export interface TransportStream {
  status: number;
  headers: Record<string, string>;
  chunks: AsyncIterable<Uint8Array>;
}

/** Sends requests. A failure to reach the server is thrown as `SisuError.offline`; an HTTP error status is not a
 * failure here (the caller reads `status`). An aborted signal throws `CancellationError`. */
export interface SisuTransport {
  /** `live` for a real server, `bundledSample` for the recordings. */
  readonly kind: DataSourceKind;
  send(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportResponse>;
  open(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportStream>;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** The live transport (Swift's `URLSessionTransport`): fetch, with the request's timeout between pieces of data. */
export class FetchTransport implements SisuTransport {
  readonly kind: DataSourceKind = "live";

  constructor(private readonly fetchImpl: typeof fetch = sisuFetch) {}

  async send(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportResponse> {
    const call = new FetchCall(request.timeoutInterval, signal);
    const response = await call.start(request, this.fetchImpl);
    try {
      return { status: response.status, headers: headersOf(response), body: new Uint8Array(await response.arrayBuffer()) };
    } catch (error) {
      throw call.map(error);
    } finally {
      call.close();
    }
  }

  async open(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportStream> {
    const call = new FetchCall(request.timeoutInterval, signal);
    const response = await call.start(request, this.fetchImpl);
    async function* chunks(): AsyncGenerator<Uint8Array> {
      const reader = response.body?.getReader();
      try {
        if (!reader) return;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          call.touch();
          if (value && value.length > 0) yield value;
        }
      } catch (error) {
        throw call.map(error);
      } finally {
        call.close();
        reader?.cancel().catch(() => undefined);
      }
    }
    return { status: response.status, headers: headersOf(response), chunks: chunks() };
  }
}

/** The Swift name of the live transport. */
export const URLSessionTransport = FetchTransport;

type Answer =
  | { kind: "body"; status: number; data: Uint8Array; contentType: string }
  | { kind: "stream"; data: Uint8Array };

const lettersAndDigits = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, "");
const lettersOnly = (text: string) => text.replace(/[^\p{L}]/gu, "");
const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);
/** Swift's `Double(text)`: null for anything that is not a plain decimal number. */
const parseDouble = (text: string): number | null =>
  /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text) ? Number(text) : null;

/** Answers every request from the recordings bundled with the app, so the whole app works with no backend.
 * Everything it serves is sample data: label it "Sample data".
 * - A typed question is answered by the recorded turn of the same kind (`recordedTurn`), chosen as the mock
 *   backend chooses.
 * - Streams are replayed message by message with `eventDelay` seconds between them (0 in tests).
 * - It remembers this session, so lists stay consistent: an approved or declined action shows in
 *   `GET /api/actions`, a saved bill name in `GET /api/memory`. `POST /api/demo/reset` clears it.
 * - A request that was not recorded answers 404 with the sentence `notInSample`, never a crash. */
export class ReplayTransport implements SisuTransport {
  static readonly notInSample = "That is not in the sample data. Connect to the server to try it.";
  readonly kind: DataSourceKind = "bundledSample";

  private actionLists = new Map<string, string>();
  private memories = new Map<string, Uint8Array>();
  private decided = new Set<string>();

  constructor(readonly eventDelay = 0.02, private readonly source: FixtureSource = FixtureAPI.defaultSource) {}

  // MARK: Files

  /** The bytes of a bundled recording, for example `fixture("coach/warm.json")`. */
  static fixture(path: string, source: FixtureSource = FixtureAPI.defaultSource): Promise<Uint8Array | null> {
    return source(path);
  }

  private fixture(path: string) { return this.source(path); }

  // MARK: Answers

  static error(status: number, message: string): Answer {
    return { kind: "body", status, data: textEncoder.encode(JSON.stringify({ error: message })), contentType: "application/json" };
  }

  static readonly missing: Answer = ReplayTransport.error(404, ReplayTransport.notInSample);

  private async json(path: string, status = 200): Promise<Answer> {
    const data = await this.fixture(path);
    return data ? { kind: "body", status, data, contentType: "application/json" } : ReplayTransport.missing;
  }

  static object(data: Uint8Array | null | undefined): JSONObject | null {
    if (!data) return null;
    const parsed = JSONRead.attempt(() => JSONRead.parse(data));
    return JSONRead.isObject(parsed) ? parsed : null;
  }

  static encode(object: unknown, status = 200): Answer {
    return { kind: "body", status, data: textEncoder.encode(JSON.stringify(object)), contentType: "application/json" };
  }

  /** The value of a text field of a multipart body (a `FormData`, or multipart text). */
  static multipartField(name: string, body: SisuRequest["body"]): string | null {
    if (body == null) return null;
    if (typeof body !== "string") return asString(body.get(name));
    const start = body.indexOf(`name="${name}"\r\n\r\n`);
    if (start < 0) return null;
    const rest = body.slice(start + `name="${name}"\r\n\r\n`.length);
    const end = rest.indexOf("\r\n");
    return end < 0 ? null : rest.slice(0, end);
  }

  static matches(text: string, pattern: string): boolean {
    return new RegExp(pattern, "i").test(text);
  }

  /** The first number in a question, as the mock backend reads it (`1,500` and `1 500` are 1500). */
  static firstNumber(text: string): number | null {
    const joined = text.replace(/(\d)[ ,](\d{3})\b/g, "$1$2");
    const match = /\d[\d,.]*/.exec(joined);
    if (!match) return null;
    const digits = match[0].replace(/[.,]+$/, "").replace(/,/g, "");
    return parseDouble(digits);
  }

  /** The name of the recorded turn that answers a typed question (`electricity`, `afford`, `remember`, `mortgage`,
   * `payday`, `bills`, `patterns`, `whatif`, `teach`, `category` or `spending`), or null when the question needs
   * an answer that was not recorded. Rules and order are those of the mock backend (lib/agent/mock-model.ts). */
  static recordedTurn(question: string, focusBill: string | null = null): string | null {
    const q = question.toLowerCase();
    const m = (p: string) => ReplayTransport.matches(q, p);
    const intent = String.raw`\b(cheap|cheaper|cheapest|deal|deals|offer|offers|switch|compare|alternative|alternatives|save|saving|better price|too much|overpay\w*)\b|halv|vertaa|tarjou|kilpailu`;
    if (m(intent)) {
      if (m(String.raw`\b(electric|electricity|power bill|energy|kwh)\b|sähkö`)) return "electricity";
      if (m(String.raw`\b(mobile|phone plan|phone bill|sim|data plan)\b|liittymä|puhelin`)) return null;
      if (m(String.raw`\b(internet|broadband|wi-?fi|fib(er|re))\b|laajakaista|netti`)) return null;
      if (focusBill != null && m(String.raw`\b(this|that|it|my) (bill|contract|plan|one)\b|\bthis\b|\bit\b`)) {
        return focusBill === "electricity" ? "electricity" : null;
      }
    }
    const number = ReplayTransport.firstNumber(q);
    if (m(String.raw`afford|unexpected|sent me a bill|bill for \d`) && number !== null) return number === 200 ? "afford" : null;
    if (m("remember|kwh") && number !== null) return number === 3500 ? "remember" : null;
    if (m(String.raw`mortgage|apartment|buy a (home|house|flat)`)) return "mortgage";
    if (m("payday|run out|end of the month|short")) return "payday";
    if (m(String.raw`bills?\b|subscription|gone up`)) return "bills";
    if (m(String.raw`where (is|does) my money|what should i change|how (can|could) i save|unusual|stands? out`)) return "patterns";
    if (m(String.raw`what if|if i (save|cut)|years?`)) {
      return q.includes("save") && !q.includes("cut") && (number === null || number === 50) ? "whatif" : null;
    }
    if (m(String.raw`explain|teach|what (is|are)|why`)) {
      return !m("fixed|spot") && m("buffer|emergency") ? "teach" : null;
    }
    if (m(String.raw`spen[dt]|cost`) && m("restaurant|grocer|transport|entertain|health|travel")) {
      return q.includes("restaurant") ? "category" : null;
    }
    return "spending";
  }

  async answer(request: SisuRequest): Promise<Answer> {
    const url = new URL(request.url, "https://sample.invalid");
    let pathname = url.pathname;
    try { pathname = decodeURIComponent(pathname); } catch { /* keep it encoded */ }
    const apiAt = pathname.indexOf("/api/");
    if (apiAt < 0) return ReplayTransport.missing;
    const path = pathname.slice(apiAt);
    const method = (request.method || "GET").toUpperCase();
    const query = new Map<string, string>();
    url.searchParams.forEach((value, key) => query.set(key, value));
    const body = typeof request.body === "string" ? ReplayTransport.object(textEncoder.encode(request.body)) ?? {} : {};
    const parts = path.split("/").filter((p) => p !== "");
    const customer = lettersAndDigits(query.get("customerId") ?? asString(body.customerId) ?? "");
    const S = ReplayTransport;

    switch (`${method} ${path}`) {
      case "GET /api/customers/demo": return this.json("demo-customers.json");
      case "GET /api/agent/warm": return this.json("coach/warm.json");
      case "GET /api/health": return this.json("coach/health.json");
      case "GET /api/voice/tts": return this.json("coach/voice-options.json");
      case "POST /api/voice/stt": return this.json("coach/voice-stt.json");
      case "POST /api/voice/tts": {
        const data = await this.fixture("coach/voice-tts.wav");
        return data ? { kind: "body", status: 200, data, contentType: "audio/wav" } : S.missing;
      }
      case "GET /api/coach/patterns": return this.json(`coach/patterns-${customer}.json`);
      case "GET /api/coach/cash-flow": return this.json(`coach/cash-flow-${customer}.json`);
      case "GET /api/coach/affordability": {
        const amount = parseDouble(query.get("amountEur") ?? "");
        return this.json(`coach/affordability-${customer}-${amount === null ? "" : CoachEndpoints.number(amount)}.json`);
      }
      case "GET /api/coach/teaching": return this.teaching(customer, query.get("concept") ?? null);
      case "GET /api/coach/mortgage": {
        const path = `coach/mortgage-${customer}.json`;
        const recorded = S.object(await this.fixture(path));
        return this.json(path, recorded?.error == null ? 200 : 404);
      }
      case "GET /api/memory": return this.memory(customer);
      case "POST /api/memory": return this.saveMemory(customer, body);
      case "DELETE /api/memory": return this.forget(customer, query.get("itemId") ?? null);
      case "GET /api/actions": return this.json(`coach/${this.actionList(customer)}.json`);
      case "GET /api/audit": {
        const list = S.object(await this.fixture(`coach/${this.actionList(customer)}.json`));
        if (!list) return S.missing;
        return S.encode({ customerId: customer, events: list.audit ?? [], chainValid: list.auditChainValid ?? true });
      }
      case "GET /api/research": return this.json(`coach/research-${customer}-${lettersOnly(query.get("billType") ?? "")}.json`);
      case "POST /api/research": {
        const billType = lettersOnly(asString(body.billType) ?? "");
        const nowait = `coach/research-${customer}-${billType}-nowait.json`;
        if (body.wait === false && (await this.fixture(nowait))) return this.json(nowait);
        return this.json(`coach/research-${customer}-${billType}.json`);
      }
      case "POST /api/scenarios": return this.scenario(customer, body);
      case "POST /api/demo/reset":
        this.actionLists = new Map();
        this.memories = new Map();
        this.decided = new Set();
        return S.encode({ ok: true, cleared: { actions: 0, memoryItems: 0 } });
      case "POST /api/actions/prepare": return this.prepare(customer, body);
      case "POST /api/agent/plan": {
        if (!(await this.fixture(`coach/stream-plan-${customer}.sse`))) return S.missing;
        this.actionLists.set(customer, `actions-${customer}-plan-pending`);
        return this.stream(`coach/stream-plan-${customer}.sse`);
      }
      case "POST /api/actions/approve-all": {
        const ids = Array.isArray(body.actionIds) && body.actionIds.every((id) => typeof id === "string") ? (body.actionIds as string[]) : [];
        return this.approveAll(customer, ids, body.confirm === true);
      }
      case "GET /api/agent/visuals": return this.json(`coach/visuals-${customer}.json`);
      case "POST /api/agent/query": {
        const kind = S.recordedTurn(asString(body.text) ?? "", asString(body.focusBill));
        if (!kind || !(await this.fixture(`coach/stream-${kind}-${customer}.sse`))) return S.missing;
        if (kind === "remember") {
          const remembered = await this.fixture(`coach/memory-${customer}-remembered.json`);
          if (remembered) this.memories.set(customer, remembered);
        }
        return this.stream(`coach/stream-${kind}-${customer}.sse`);
      }
      case "POST /api/agent/investigate": {
        if (!(await this.fixture(`coach/stream-investigate-${customer}.sse`))) return S.missing;
        this.actionLists.set(customer, `actions-${customer}-investigate-pending`);
        return this.stream(`coach/stream-investigate-${customer}.sse`);
      }
      case "POST /api/agent/bill-photo":
        return this.json(`coach/bill-photo-${lettersAndDigits(S.multipartField("customerId", request.body) ?? "")}.json`);
      case "POST /api/voice/turn":
        return this.stream(`coach/stream-voice-${lettersAndDigits(S.multipartField("customerId", request.body) ?? "")}.sse`);
      default: break;
    }

    if (method === "GET" && parts.length === 4 && parts[1] === "customers") {
      const id = lettersAndDigits(parts[2]);
      if (parts[3] === "overview") return this.json(`overview-${id}.json`);
      if (parts[3] === "transactions") return this.json(`transactions-${id}-${BasketId.fromRaw(query.get("basket")) ?? "all"}.json`);
    }
    if (method === "POST" && parts.length === 4 && parts[1] === "actions" && (parts[3] === "approve" || parts[3] === "decline")) {
      return this.decide(customer, parts[2], parts[3] === "approve", body.confirm === true);
    }
    return S.missing;
  }

  private async stream(path: string): Promise<Answer> {
    const data = await this.fixture(path);
    return data ? { kind: "stream", data } : ReplayTransport.missing;
  }

  private actionList(customer: string): string {
    return this.actionLists.get(customer) ?? `actions-${customer}`;
  }

  private async teaching(customer: string, concept: string | null): Promise<Answer> {
    if (!concept) return this.json(`coach/teaching-${customer}.json`);
    const list = ReplayTransport.object(await this.fixture(`coach/teaching-${customer}.json`));
    if (!list || !Array.isArray(list.cards)) return ReplayTransport.missing;
    const wanted = (list.cards as JSONObject[]).filter((card) => card.concept === concept);
    if (wanted.length === 0) return ReplayTransport.error(400, `Unknown concept. Use one of: ${ConceptId.all.join(", ")}.`);
    return ReplayTransport.encode({ ...list, cards: wanted });
  }

  private async currentMemory(customer: string): Promise<Uint8Array | null> {
    return this.memories.get(customer) ?? (await this.fixture(`coach/memory-${customer}.json`));
  }

  private store(customer: string, memory: Uint8Array | null): Answer {
    if (!memory) return ReplayTransport.missing;
    this.memories.set(customer, memory);
    return { kind: "body", status: 200, data: memory, contentType: "application/json" };
  }

  private async memory(customer: string): Promise<Answer> {
    const data = await this.currentMemory(customer);
    return data ? { kind: "body", status: 200, data, contentType: "application/json" } : ReplayTransport.missing;
  }

  private async saveMemory(customer: string, body: JSONObject): Promise<Answer> {
    const S = ReplayTransport;
    if (typeof body.consent === "boolean") {
      if (!body.consent) return this.store(customer, await this.fixture(`coach/memory-${customer}-consent-off.json`));
      const memory = S.object(await this.currentMemory(customer));
      if (!memory) return S.missing;
      return this.store(customer, textEncoder.encode(JSON.stringify({ ...memory, consent: true })));
    }
    // A saved item is the recorded one with this request's key, value and bill type, so the typed name shows.
    const memory = S.object(await this.currentMemory(customer));
    const recorded = S.object(await this.fixture(`coach/memory-${customer}-saved.json`));
    const first = Array.isArray(recorded?.items) ? (recorded.items[0] as JSONObject | undefined) : undefined;
    const kind = asString(body.kind);
    if (!memory || !first || kind === null) return S.missing;
    const value = asString(body.value) ?? (asNumber(body.value) !== null ? String(body.value) : "");
    if (value.trim() === "") return S.error(400, "Send a kind (bill_name, yearly_kwh, preference or goal) and a value.");
    if (memory.consent === false) return S.missing;
    const key = asString(body.key) ?? (kind === "yearly_kwh" ? "electricity" : value);
    const item = { ...first, kind, key, value, billType: asString(body.billType), id: `sample-${kind}-${key}` };
    const items = ((memory.items as JSONObject[] | undefined) ?? []).filter((i) => !(i.kind === kind && i.key === key));
    return this.store(customer, textEncoder.encode(JSON.stringify({ ...memory, items: [...items, item] })));
  }

  private async forget(customer: string, itemId: string | null): Promise<Answer> {
    if (!itemId) return this.store(customer, await this.fixture(`coach/memory-${customer}-forgotten.json`));
    const memory = ReplayTransport.object(await this.currentMemory(customer));
    if (!memory) return ReplayTransport.missing;
    const items = ((memory.items as JSONObject[] | undefined) ?? []).filter((i) => i.id !== itemId);
    return this.store(customer, textEncoder.encode(JSON.stringify({ ...memory, items })));
  }

  private async scenario(customer: string, body: JSONObject): Promise<Answer> {
    const overview = await FixtureAPI.load(`overview-${customer}`, decodeOverview, this.source).catch(() => null);
    if (!overview) return ReplayTransport.error(404, "We could not find that customer.");
    const bill = asNumber(body.billSavingPerMonth), cut = asNumber(body.everydayCutPct), years = asNumber(body.years);
    if (bill === null || cut === null || years === null || ![bill, cut, years].every(Number.isFinite)) {
      return ReplayTransport.error(400, "Scenario values must be numbers.");
    }
    const oneOff = asNumber(body.oneOffEur) ?? 0;
    const input = { billSavingPerMonth: bill, everydayCutPct: cut, years: Math.round(Math.min(Math.max(years, 1), 10)),
      oneOffEur: Number.isFinite(oneOff) ? oneOff : 0 };
    return ReplayTransport.encode(ScenarioEngine.run(overview, input));
  }

  private async prepare(customer: string, body: JSONObject): Promise<Answer> {
    // Recorded: a 500 euro one-off transfer to savings (it comes with a warning), and an electricity switch.
    if (body.kind === "one_off_transfer") {
      const amount = asNumber(body.amountEur !== undefined ? body.amountEur : body.monthlyAmountEur);
      const destination = asString(body.destination) ?? "savings";
      const path = `coach/action-transfer-${customer}.json`;
      if (amount !== 500 || destination !== "savings" || !(await this.fixture(path))) return ReplayTransport.missing;
      this.actionLists.set(customer, `actions-${customer}-transfer-pending`);
      return this.json(path, 201);
    }
    const path = `coach/action-prepare-${customer}.json`;
    if (body.kind !== "switch_contract" || body.billType !== "electricity" || !(await this.fixture(path))) return ReplayTransport.missing;
    this.actionLists.set(customer, `actions-${customer}-prepare-pending`);
    return this.json(path, 201);
  }

  private async recordedErrors(): Promise<{ already: string; unknown: string }> {
    const already = asString(ReplayTransport.object(await this.fixture("coach/error-409-already-decided.json"))?.error);
    const unknown = asString(ReplayTransport.object(await this.fixture("coach/error-404-unknown-action.json"))?.error);
    return { already: already ?? "This action was already approved.", unknown: unknown ?? "We could not find that action." };
  }

  /** The recorded approve-all of the recorded plan. Each named action is approved once; one already decided,
   * or unknown, is listed in `failed`. */
  private async approveAll(customer: string, ids: string[], confirm: boolean): Promise<Answer> {
    const S = ReplayTransport;
    if (!confirm) return S.error(400, "Approval needs confirm: true. Nothing was done.");
    const unique = ids.filter((id, index) => ids.indexOf(id) === index);
    if (unique.length === 0 || unique.length > 6) return S.error(400, "Name between one and 6 actions to approve. Nothing was done.");
    const recorded = S.object(await this.fixture(`coach/plan-approve-all-${customer}.json`));
    const actions = Array.isArray(recorded?.approved) ? (recorded.approved as JSONObject[]) : null;
    if (!actions) return S.missing;
    const reasons = await this.recordedErrors();
    const approved: JSONObject[] = [];
    const failed: JSONObject[] = [];
    for (const id of unique) {
      const action = actions.find((a) => a.id === id);
      if (!action) failed.push({ actionId: id, reason: reasons.unknown });
      else if (this.decided.has(id)) failed.push({ actionId: id, reason: reasons.already });
      else { this.decided.add(id); approved.push(action); }
    }
    if (approved.length === actions.length) this.actionLists.set(customer, `actions-${customer}-plan-approved`);
    return S.encode({ approved, failed }, approved.length === 0 ? 409 : 200);
  }

  private async decide(customer: string, actionId: string, approve: boolean, confirm: boolean): Promise<Answer> {
    const S = ReplayTransport;
    if (approve && !confirm) return S.error(400, "Approval needs confirm: true. Nothing was done.");
    const verb = approve ? "approve" : "decline";
    if (approve) {
      // One action of the recorded plan, approved on its own.
      const plan = S.object(await this.fixture(`coach/plan-approve-all-${customer}.json`));
      const action = Array.isArray(plan?.approved) ? (plan.approved as JSONObject[]).find((a) => a.id === actionId) : undefined;
      if (action) {
        if (this.decided.has(actionId)) return this.json("coach/error-409-already-decided.json", 409);
        this.decided.add(actionId);
        return S.encode({ action });
      }
    }
    for (const origin of ["investigate", "prepare", "transfer"]) {
      const path = `coach/action-${origin}-${customer}-${verb}.json`;
      const recorded = S.object(await this.fixture(path));
      const action = recorded && JSONRead.isObject(recorded.action) ? recorded.action : null;
      if (!action || action.id !== actionId) continue;
      if (this.decided.has(actionId)) return this.json("coach/error-409-already-decided.json", 409);
      this.decided.add(actionId);
      this.actionLists.set(customer, `actions-${customer}-${origin}-${approve ? "approved" : "declined"}`);
      return this.json(path);
    }
    return this.json("coach/error-404-unknown-action.json", 404);
  }

  // MARK: SisuTransport

  async send(request: SisuRequest): Promise<TransportResponse> {
    const answer = await this.answer(request);
    return answer.kind === "body"
      ? { status: answer.status, headers: { "Content-Type": answer.contentType }, body: answer.data }
      : { status: 200, headers: { "Content-Type": "text/event-stream" }, body: answer.data };
  }

  async open(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportStream> {
    const answer = await this.answer(request);
    if (answer.kind === "body") {
      const data = answer.data;
      return { status: answer.status, headers: { "Content-Type": answer.contentType }, chunks: (async function* () { yield data; })() };
    }
    return { status: 200, headers: { "Content-Type": "text/event-stream" }, chunks: ReplayTransport.replay(answer.data, this.eventDelay, signal) };
  }

  /** The messages of a recorded stream, one chunk each, with `delay` seconds between them. */
  static async *replay(data: Uint8Array, delay: number, signal?: AbortSignal | null): AsyncGenerator<Uint8Array> {
    const messages = textDecoder.decode(data).split("\n\n").filter((m) => m !== "").map((m) => textEncoder.encode(`${m}\n\n`));
    for (const [index, message] of messages.entries()) {
      if (signal?.aborted) return;
      if (index > 0 && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        if (signal?.aborted) return;
      }
      yield message;
    }
  }
}

/** A live transport that falls back to the bundled sample when the server cannot be reached. The first request
 * that fails with `SisuError.offline` switches it, for good, to `ReplayTransport`: that request and every later
 * one is answered from the sample, `kind` becomes `bundledSample`, and `fallenBackAt` holds the moment.
 * Sessions publish a `fallbackNotice` when it happens. An HTTP error is not a reason to fall back. */
export class FallbackTransport implements SisuTransport {
  private fellBackAt: Date | null = null;

  constructor(
    readonly primary: SisuTransport,
    readonly sample: ReplayTransport = new ReplayTransport(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** When the transport switched to the sample. Null while it is live. */
  get fallenBackAt(): Date | null { return this.fellBackAt; }

  get kind(): DataSourceKind { return this.fellBackAt === null ? this.primary.kind : "bundledSample"; }

  private fallBack(): void {
    if (this.fellBackAt === null) this.fellBackAt = this.now();
  }

  private static isOffline(error: unknown): boolean {
    return error instanceof SisuError && error.info.kind === "offline";
  }

  async send(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportResponse> {
    if (this.fellBackAt !== null) return this.sample.send(request);
    try {
      return await this.primary.send(request, signal);
    } catch (error) {
      if (!FallbackTransport.isOffline(error)) throw error;
      this.fallBack();
      return this.sample.send(request);
    }
  }

  async open(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportStream> {
    if (this.fellBackAt !== null) return this.sample.open(request, signal);
    try {
      return await this.primary.open(request, signal);
    } catch (error) {
      if (!FallbackTransport.isOffline(error)) throw error;
      this.fallBack();
      return this.sample.open(request, signal);
    }
  }
}
