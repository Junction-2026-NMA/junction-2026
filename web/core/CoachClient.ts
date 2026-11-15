// The typed client of every endpoint in the frontend contract, on top of a `SisuTransport`. Port of
// SisuCore/CoachClient.swift. The streams are async generators: `for await (const event of client.ask(...))`.
// Stop the loop (break) or abort the signal you pass to end the turn; the connection closes with it.
import {
  type DataSourceKind,
  type FixtureSource,
  type SisuAPI,
  type SisuRequest,
  Endpoints,
  FixtureAPI,
  SisuError,
  decodeAnswer,
  decodeList,
  decodeOverview,
  decodeTransactionList,
  errorMessage,
} from "./API";
import { type DemoCustomer, type EvidenceFilter, type Overview, type ScenarioInput, JSONRead, ScenarioResponse } from "./Models";
import {
  type ActionList,
  type AgentAction,
  type AgentRequest,
  type AuditLog,
  type BillPhotoResult,
  type BillType,
  type CashFlow,
  type ChatTurn,
  type ConceptId,
  type CustomerMemory,
  type DemoResetResult,
  type HealthReport,
  type InvestigateRequest,
  type MemorySaveRequest,
  type MortgageApplication,
  type Pattern,
  type PrepareActionRequest,
  type ResearchResult,
  type SpeechAudio,
  type SpeechRequest,
  type TeachingCard,
  type Transcript,
  type VoiceOptions,
  type WarmResponse,
  type Affordability,
  MemoryKind,
  SisuEvent,
} from "./CoachModels";
import { CoachEndpoints, type FormBytes } from "./CoachEndpoints";
import { ApproveAllResult, PlanEvent, type Visual, VisualList } from "./PlanModels";
import { SSEParser } from "./ServerSentEvents";
import { SimulatedDrop, WatchChange, WatchCheck, WatchList, WatchReadResult, type WatchRequirements } from "./WatchModels";
import { WatchProject } from "./WatchProject";
import { type HousingBudget, HousingModels, type HousingSearchRequest, type HousingSearchResult } from "./HousingModels";
import { FallbackTransport, FetchTransport, ReplayTransport, type SisuTransport, TransportResponse } from "./Transport";

const object = <T>(keys: string[] = []) => (json: unknown): T => JSONRead.object(json, keys) as unknown as T;
const field = <T>(key: string) => (json: unknown): T => JSONRead.array(JSONRead.object(json)[key]) as unknown as T;

/** Calls the team backend (or the bundled recordings) and decodes the answers. Errors, for every call:
 * - a non-2xx answer throws `SisuError.server(status, message)`, `message` being the body's `error` sentence.
 *   Keep the status: 409 means "offers not looked up yet" or "already decided", 410 expired, 429 too many.
 * - a body that does not decode throws `SisuError.invalidResponse`.
 * - a failure to reach the server throws `SisuError.offline`. */
export class CoachClient implements SisuAPI {
  static readonly fallbackSentence = "The server could not be reached. Showing sample data recorded on 14 Nov 2026.";
  /** The placeholder address of the sample client. Nothing is ever sent to it. */
  static readonly sampleBaseURL = "https://sample.invalid";

  constructor(readonly baseURL: string, readonly transport: SisuTransport) {}

  /** A client of the real server. On the web the default base is "" (this site's own `/api/...`). */
  static live(baseURL = "", fetchImpl?: typeof fetch): CoachClient {
    return new CoachClient(baseURL, new FetchTransport(fetchImpl));
  }

  /** A client of the recordings bundled with the app: no server, everything is sample data.
   * @param eventDelay seconds between two replayed stream messages (0 in tests). */
  static sample(eventDelay = 0.02, fixtures: FixtureSource = FixtureAPI.defaultSource): CoachClient {
    return new CoachClient(CoachClient.sampleBaseURL, new ReplayTransport(eventDelay, fixtures));
  }

  /** A client of the real server that switches to the bundled sample, for good, when the server cannot be reached
   * before it has ever answered. Once it has answered, a dropped request or a timeout is an error for the caller
   * (15 Nov QA: one failed background project check switched the whole app to the sample). Sessions built on it
   * publish `fallbackNotice` when the switch happens. Agent turns (`ask`, `investigate`,
   * `voiceTurn`, `plan`) never cause the switch: once the server has answered, a dropped connection during a turn is
   * an error with "Try again", because a recorded answer to another question would be wrong (14 Nov QA: one network
   * failure turned every later spoken question into the sample's electricity question). They use the sample only
   * when the client had already fallen back, the server being unreachable from the start. */
  static liveWithSampleFallback(baseURL = "", options: { fetchImpl?: typeof fetch; eventDelay?: number; now?: () => Date; fixtures?: FixtureSource } = {}): CoachClient {
    const sample = new ReplayTransport(options.eventDelay ?? 0.02, options.fixtures ?? FixtureAPI.defaultSource);
    return new CoachClient(baseURL, new FallbackTransport(new FetchTransport(options.fetchImpl), sample, options.now));
  }

  /** The sentence to show once when this client has fallen back to the sample; null while it is live. */
  get fallbackNotice(): string | null {
    return this.transport instanceof FallbackTransport && this.transport.fallenBackAt !== null ? CoachClient.fallbackSentence : null;
  }

  /** When this client fell back to the sample, for the freshness line in Settings. Null while it is live. */
  get fallenBackAt(): Date | null {
    return this.transport instanceof FallbackTransport ? this.transport.fallenBackAt : null;
  }

  /** `live` for a real server, `bundledSample` for the recordings ("Sample data"). */
  get kind(): DataSourceKind { return this.transport.kind; }

  /** Where agent turns go: past the fallback while it is live (see `liveWithSampleFallback`). */
  private get turnTransport(): SisuTransport {
    const transport = this.transport;
    return transport instanceof FallbackTransport && transport.fallenBackAt === null ? transport.direct : transport;
  }

  // MARK: Plumbing

  async response(request: SisuRequest, signal?: AbortSignal | null): Promise<TransportResponse> {
    const response = await this.transport.send(request, signal);
    if (response.status < 200 || response.status >= 300) throw SisuError.server(response.status, errorMessage(response.body));
    return response;
  }

  async call<T>(request: SisuRequest, decode: (json: unknown) => T, signal?: AbortSignal | null): Promise<T> {
    const response = await this.transport.send(request, signal);
    return decodeAnswer(response.status, response.body, decode);
  }

  /** Opens an agent stream and gives its events as they arrive. An HTTP error or a dropped connection ends the
   * stream by throwing (`SisuError.server` or `.offline`). */
  events(request: SisuRequest, signal?: AbortSignal | null): AsyncGenerator<SisuEvent> {
    return this.messages(request, (data) => SisuEvent.decode(data), signal);
  }

  /** Opens the money plan's stream and gives its events as they arrive. Errors as for `events`. */
  planEvents(request: SisuRequest, signal?: AbortSignal | null): AsyncGenerator<PlanEvent> {
    return this.messages(request, (data) => PlanEvent.decode(data), signal);
  }

  async *messages<Event>(request: SisuRequest, decode: (data: string) => Event | null, signal?: AbortSignal | null): AsyncGenerator<Event> {
    const local = new AbortController();
    const onAbort = () => local.abort();
    if (signal?.aborted) local.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const stream = await this.turnTransport.open(request, local.signal);
      if (stream.status < 200 || stream.status >= 300) {
        const parts: Uint8Array[] = [];
        for await (const chunk of stream.chunks) parts.push(chunk);
        const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        parts.reduce((at, p) => { body.set(p, at); return at + p.length; }, 0);
        throw SisuError.server(stream.status, errorMessage(body));
      }
      const parser = new SSEParser();
      for await (const chunk of stream.chunks) {
        for (const message of parser.feed(chunk)) {
          const event = decode(message.data);
          if (event !== null) yield event;
        }
      }
      for (const message of parser.finish()) {
        const event = decode(message.data);
        if (event !== null) yield event;
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
      local.abort();
    }
  }

  // MARK: Server

  /** `GET /api/agent/warm`: opens the server's connections and says whether it is in mock mode. */
  warm() { return this.call(CoachEndpoints.warm(this.baseURL), object<WarmResponse>(["provider", "mock", "model"])); }

  /** `GET /api/health` */
  health() { return this.call(CoachEndpoints.health(this.baseURL), object<HealthReport>(["ok", "mock", "model"])); }

  /** `POST /api/demo/reset`: clears actions, memory and the audit log of the three demo customers. */
  resetDemo(token?: string | null) { return this.call(CoachEndpoints.demoReset(this.baseURL, token), object<DemoResetResult>(["ok"])); }

  // MARK: Research

  /** `POST /api/research`. With `wait: false` it returns at once (often `running`) while offers load. */
  research(customerId: string, billType: BillType, wait = true, yearlyKwh: number | null = null): Promise<ResearchResult> {
    const body = { customerId, billType, wait: wait ? null : false, yearlyKwh };
    return this.call(CoachEndpoints.research(this.baseURL, body), object<ResearchResult>(["key", "billType", "offers"]));
  }

  /** `GET /api/research`: what has been found so far. Throws `server(404, …)` before any research. */
  researchSnapshot(customerId: string, billType: BillType) {
    return this.call(CoachEndpoints.researchSnapshot(this.baseURL, customerId, billType), object<ResearchResult>(["key", "billType", "offers"]));
  }

  // MARK: Memory

  private static memoryDecode = object<CustomerMemory>(["customerId", "consent", "items"]);

  /** `GET /api/memory` */
  memory(customerId: string) { return this.call(CoachEndpoints.memory(this.baseURL, customerId), CoachClient.memoryDecode); }

  /** `POST /api/memory`: saves one item and returns the whole memory. */
  saveMemory(body: MemorySaveRequest) { return this.call(CoachEndpoints.saveMemory(this.baseURL, body), CoachClient.memoryDecode); }

  /** Saves the name the user confirmed for a bill. With a bill type the server also starts offer research. */
  confirmBill(customerId: string, billId: string, name: string, billType: BillType | null = null) {
    return this.saveMemory({ customerId, kind: MemoryKind.billName, key: billId, value: name, billType });
  }

  /** Saves the yearly electricity use the user stated or confirmed from a bill. */
  rememberKwh(customerId: string, yearlyKwh: number) {
    return this.saveMemory({ customerId, kind: MemoryKind.yearlyKwh, value: CoachEndpoints.number(yearlyKwh) });
  }

  /** `POST /api/memory` with `consent`. `false` switches remembering off and erases what was stored. */
  setMemoryConsent(customerId: string, consent: boolean) {
    return this.call(CoachEndpoints.memoryConsent(this.baseURL, { customerId, consent }), CoachClient.memoryDecode);
  }

  /** `DELETE /api/memory`: forgets one item, or everything when `itemId` is null. */
  forgetMemory(customerId: string, itemId: string | null = null) {
    return this.call(CoachEndpoints.forgetMemory(this.baseURL, customerId, itemId), CoachClient.memoryDecode);
  }

  // MARK: Actions

  private static actionDecode = (json: unknown): AgentAction => JSONRead.object(JSONRead.object(json).action, ["id", "kind", "status"]) as unknown as AgentAction;

  /** `POST /api/actions/prepare`. Throws `server(409, …)` when offers were not looked up yet or none is cheaper. */
  prepareAction(body: PrepareActionRequest) { return this.call(CoachEndpoints.prepareAction(this.baseURL, body), CoachClient.actionDecode); }

  /** `POST /api/actions/:id/approve` with `confirm: true`. The answer has `impact` filled in. */
  approveAction(customerId: string, actionId: string) {
    return this.call(CoachEndpoints.approveAction(this.baseURL, customerId, actionId), CoachClient.actionDecode);
  }

  /** `POST /api/actions/:id/decline`. Errors as for `approveAction`. */
  declineAction(customerId: string, actionId: string) {
    return this.call(CoachEndpoints.declineAction(this.baseURL, customerId, actionId), CoachClient.actionDecode);
  }

  /** `GET /api/actions`: every action of the customer, newest first, with the audit trail. */
  actions(customerId: string) {
    return this.call(CoachEndpoints.actions(this.baseURL, customerId), object<ActionList>(["customerId", "actions", "audit", "auditChainValid"]));
  }

  /** `GET /api/audit` */
  audit(customerId: string) { return this.call(CoachEndpoints.audit(this.baseURL, customerId), object<AuditLog>(["events", "chainValid"])); }

  // MARK: Coach (no model, instant)

  /** `GET /api/coach/patterns`: what stands out, ranked by yearly euros. */
  patterns(customerId: string) { return this.call(CoachEndpoints.patterns(this.baseURL, customerId), field<Pattern[]>("patterns")); }

  /** `GET /api/coach/cash-flow` */
  cashFlow(customerId: string) { return this.call(CoachEndpoints.cashFlow(this.baseURL, customerId), object<CashFlow>(["customerId", "cycles", "steps"])); }

  /** `GET /api/coach/affordability` */
  affordability(customerId: string, amountEur: number) {
    return this.call(CoachEndpoints.affordability(this.baseURL, customerId, amountEur), object<Affordability>(["amountEur", "verdict", "steps"]));
  }

  /** `GET /api/coach/teaching`: one card for a concept, or all seven when `concept` is null. */
  teachingCards(customerId: string, concept: ConceptId | null = null) {
    return this.call(CoachEndpoints.teaching(this.baseURL, customerId, concept), field<TeachingCard[]>("cards"));
  }

  /** `GET /api/coach/mortgage`. Null when the customer has no application on record (the server's 404). */
  async mortgage(customerId: string): Promise<MortgageApplication | null> {
    try {
      return await this.call(CoachEndpoints.mortgage(this.baseURL, customerId), object<MortgageApplication>(["customerId", "decision"]));
    } catch (error) {
      if (error instanceof SisuError && error.info.kind === "server" && error.info.status === 404 && error.info.message !== ReplayTransport.notInSample) return null;
      throw error;
    }
  }

  // MARK: Agent

  /** `POST /api/agent/query` as a stream of events. */
  ask(body: AgentRequest, signal?: AbortSignal | null) { return this.events(CoachEndpoints.agentQuery(this.baseURL, body), signal); }

  /** `POST /api/agent/investigate` as a stream of events. */
  investigate(body: InvestigateRequest, signal?: AbortSignal | null) { return this.events(CoachEndpoints.agentInvestigate(this.baseURL, body), signal); }

  /** `POST /api/agent/bill-photo`: the figures printed on a photographed bill. Nothing is saved: show `toConfirm`,
   * and when the user agrees call `rememberKwh` with `reading.yearlyKwh`. */
  readBillPhoto(customerId: string, image: FormBytes, fileName = "bill.jpg", mimeType = "image/jpeg") {
    return this.call(CoachEndpoints.billPhoto(this.baseURL, customerId, image, fileName, mimeType), object<BillPhotoResult>(["customerId", "reading", "toConfirm"]));
  }

  // MARK: The money plan and charts

  /** `POST /api/agent/plan` as a stream of events, one per real step. `fresh: false` reuses a recent search. */
  plan(customerId: string, fresh: boolean | null = null, language: string | null = null, signal?: AbortSignal | null) {
    return this.planEvents(CoachEndpoints.agentPlan(this.baseURL, { customerId, fresh, language }), signal);
  }

  /** `POST /api/actions/approve-all`: one tap approves everything the plan set up (one to six actions). The 409
   * when none could be approved still comes back here, with the reasons in `failed`. */
  async approveAll(customerId: string, actionIds: string[]): Promise<ApproveAllResult> {
    const response = await this.transport.send(CoachEndpoints.approveAll(this.baseURL, customerId, actionIds));
    const result = JSONRead.attempt(() => ApproveAllResult.decode(JSONRead.parse(response.body)));
    if (result) return result;
    if (response.status < 200 || response.status >= 300) throw SisuError.server(response.status, errorMessage(response.body));
    throw SisuError.invalidResponse();
  }

  /** `GET /api/agent/visuals`: every chart for a customer at once, with no model call. */
  async visuals(customerId: string): Promise<Visual[]> {
    return (await this.call(CoachEndpoints.visuals(this.baseURL, customerId), VisualList.decode)).visuals;
  }

  // MARK: Watches (Projects)
  // Live only. The bundled sample has no watches: `watchList` answers an empty list and the rest throw
  // `SisuError.notImplemented`. Routes the hosted backend does not have yet (pause, resume, update, read) throw
  // `SisuError.server(404, …)` like any other error, so a screen can hide the control or say it is not available.

  /** `GET /api/watch`: every watch of the customer and its findings, newest first. */
  watchList(customerId: string): Promise<WatchList> {
    if (this.kind === "bundledSample") return Promise.resolve(WatchList.empty(customerId));
    return this.call(CoachEndpoints.watchList(this.baseURL, customerId), WatchList.decode);
  }

  /** `GET /api/watch/:id?customerId=`: one project with the listings that fit now (`currentMatches`). Not on the
   *  hosted backend yet: 404. */
  watchProject(id: string, customerId: string): Promise<WatchProject> {
    return this.watchCall("Reading a project", CoachEndpoints.watchProject(this.baseURL, id, customerId), WatchProject.decode);
  }

  /** `POST /api/watch/check`: turns Context.dev's changes into findings. `runNow` also asks Context.dev to run the
   *  monitors now (their result shows up on a later check). */
  watchCheck(customerId: string, runNow = false): Promise<WatchCheck> {
    return this.watchCall("Checking watches", CoachEndpoints.watchCheck(this.baseURL, customerId, runNow), WatchCheck.decode);
  }

  /** `POST /api/watch/:id/stop`: stops the watch and deletes its monitors. 404 when there is no such watch. */
  watchStop(id: string, customerId: string): Promise<WatchChange> {
    return this.watchCall("Stopping a watch", CoachEndpoints.watchStop(this.baseURL, id, customerId), WatchChange.decode);
  }

  /** `POST /api/watch/:id/pause`. Not on the hosted backend yet: 404. */
  watchPause(id: string, customerId: string): Promise<WatchChange> {
    return this.watchCall("Pausing a watch", CoachEndpoints.watchPause(this.baseURL, id, customerId), WatchChange.decode);
  }

  /** `POST /api/watch/:id/resume`. Not on the hosted backend yet: 404. */
  watchResume(id: string, customerId: string): Promise<WatchChange> {
    return this.watchCall("Resuming a watch", CoachEndpoints.watchResume(this.baseURL, id, customerId), WatchChange.decode);
  }

  /** `PATCH /api/watch/:id` with the edited requirements. Not on the hosted backend yet: 404. */
  watchUpdate(id: string, customerId: string, requirements: WatchRequirements): Promise<WatchChange> {
    return this.watchCall("Changing a watch", CoachEndpoints.watchUpdate(this.baseURL, id, customerId, requirements), WatchChange.decode);
  }

  /** `POST /api/watch/:id/read`: the watch's findings are seen. Not on the hosted backend yet: 404. */
  watchMarkRead(id: string, customerId: string): Promise<WatchReadResult> {
    return this.watchCall("Marking findings read", CoachEndpoints.watchMarkRead(this.baseURL, id, customerId), WatchReadResult.decode);
  }

  /** `POST /api/watch/:id/simulate-drop`: a made-up price drop for the demo, labelled simulated. 404 or 409 with the
   *  server's sentence when there is no watch or nothing to drop. */
  simulateDrop(id: string, customerId: string): Promise<SimulatedDrop> {
    return this.watchCall("Simulating a price drop", CoachEndpoints.simulateDrop(this.baseURL, id, customerId), SimulatedDrop.decode);
  }

  /** v2 housing: the intake card's search. Refused on the sample. */
  housingSearch(body: HousingSearchRequest): Promise<HousingSearchResult> {
    return this.watchCall("Searching for homes", CoachEndpoints.housingSearch(this.baseURL, body), HousingModels.result);
  }

  /** v2 housing: the rent Sisu suggests for a monthly savings goal. Refused on the sample. */
  housingBudget(customerId: string, savingsGoalEurPerMonth: number): Promise<HousingBudget | null> {
    return this.watchCall("Working out a budget", CoachEndpoints.housingBudget(this.baseURL, customerId, savingsGoalEurPerMonth), HousingModels.budget);
  }

  /** A watch call: refused on the sample (also when the client fell back to it during the call). */
  private async watchCall<T>(what: string, request: SisuRequest, decode: (json: unknown) => T): Promise<T> {
    if (this.kind === "bundledSample") throw SisuError.notImplemented(`${what} needs the live server`);
    try {
      return await this.call(request, decode);
    } catch (error) {
      const notInSample = error instanceof SisuError && error.info.kind === "server" && error.info.status === 404 && error.info.message === ReplayTransport.notInSample;
      if (notInSample) throw SisuError.notImplemented(`${what} needs the live server`);
      throw error;
    }
  }

  // MARK: Voice

  /** `GET /api/voice/tts`: the languages for a picker. */
  voiceOptions() { return this.call(CoachEndpoints.voiceOptions(this.baseURL), object<VoiceOptions>(["languages"])); }

  /** `POST /api/voice/stt`: the words of a recording. */
  transcribe(audio: FormBytes, fileName: string, mimeType: string, language = "auto") {
    return this.call(CoachEndpoints.speechToText(this.baseURL, audio, fileName, mimeType, language), object<Transcript>(["text"]));
  }

  /** `POST /api/voice/tts`: the audio of one sentence. Play by the answer's `contentType`. */
  async speech(body: SpeechRequest, signal?: AbortSignal | null): Promise<SpeechAudio> {
    const response = await this.response(CoachEndpoints.textToSpeech(this.baseURL, body), signal);
    return { data: response.body, contentType: TransportResponse.contentType(response) ?? "application/octet-stream" };
  }

  /** `POST /api/voice/turn` as a stream of events. It starts with `transcript` (what was heard). `bufferEur` is the
   *  person's protected buffer (left out when null). */
  voiceTurn(customerId: string, audio: FormBytes, fileName: string, mimeType: string, history: ChatTurn[] = [],
    focusBill: BillType | null = null, language = "auto", signal?: AbortSignal | null, bufferEur: number | null = null) {
    return this.events(CoachEndpoints.voiceTurn(this.baseURL, customerId, audio, fileName, mimeType, history, focusBill, language, bufferEur), signal);
  }

  // MARK: SisuAPI (the four data routes through the same transport)

  demoCustomers(): Promise<DemoCustomer[]> {
    return this.call(CoachClient.timed(Endpoints.demoCustomers(this.baseURL)), decodeList<DemoCustomer>);
  }

  overview(customerId: string): Promise<Overview> {
    return this.mapUnknown(customerId, () => this.call(CoachClient.timed(Endpoints.overview(this.baseURL, customerId)), decodeOverview));
  }

  transactions(customerId: string, filter: EvidenceFilter | null) {
    return this.mapUnknown(customerId, () =>
      this.call(CoachClient.timed(Endpoints.transactions(this.baseURL, customerId, filter)), decodeTransactionList));
  }

  scenario(customerId: string, input: ScenarioInput) {
    return this.call(CoachClient.timed(Endpoints.scenario(this.baseURL, customerId, input)), ScenarioResponse.decode);
  }

  private static timed(request: SisuRequest): SisuRequest {
    return { ...request, timeoutInterval: CoachEndpoints.quickTimeout };
  }

  /** In sample mode a customer outside the recordings is `unknownCustomer`, as with `FixtureAPI`. */
  private async mapUnknown<T>(customerId: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof SisuError && error.info.kind === "server" && error.info.status === 404 && error.info.message === ReplayTransport.notInSample) {
        throw SisuError.unknownCustomer(customerId);
      }
      throw error;
    }
  }
}
