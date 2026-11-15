// The HTTP requests of every coach endpoint in the frontend contract. Port of SisuCore/CoachEndpoints.swift.
// Pure functions, so they can be tested without a network. Bodies hold only what the contract names:
// transaction rows are never sent anywhere.
import { Endpoints, type SisuRequest } from "./API";
import type {
  AgentRequest,
  BillType,
  ChatTurn,
  ConceptId,
  InvestigateRequest,
  MemoryConsentRequest,
  MemorySaveRequest,
  PrepareActionRequest,
  ResearchRequest,
  SpeechRequest,
  PaydayOverrides,
} from "./CoachModels";
import { ApproveAllRequest, type PlanRequest } from "./PlanModels";
import type { WatchRequirements } from "./WatchModels";

/** Bytes a form can carry: a recording or photo from the browser (`Blob`) or raw bytes. */
export type FormBytes = Blob | Uint8Array;

/** A `multipart/form-data` body, built on the browser's `FormData` (fetch writes the boundary and the
 * `Content-Type` header itself, so there is no boundary to choose here). */
export class MultipartForm {
  readonly data = new FormData();

  private static clean(text: string): string {
    return text.replace(/["\r\n]/g, "");
  }

  /** Adds a text field. */
  field(name: string, value: string): this {
    this.data.append(MultipartForm.clean(name), value);
    return this;
  }

  /** Adds a file part. */
  file(name: string, fileName: string, mimeType: string, bytes: FormBytes): this {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: MultipartForm.clean(mimeType) });
    this.data.append(MultipartForm.clean(name), blob, MultipartForm.clean(fileName));
    return this;
  }
}

export class CoachEndpoints {
  /** Seconds before each kind of request counts as offline. */
  static readonly quickTimeout = 5;
  static readonly researchTimeout = 15;
  static readonly voiceTimeout = 30;
  static readonly streamTimeout = 90;

  static get(baseURL: string, path: string, query: ReadonlyArray<readonly [string, string]> = [], timeout = CoachEndpoints.quickTimeout): SisuRequest {
    return { ...Endpoints.get(Endpoints.url(baseURL, path, query)), timeoutInterval: timeout };
  }

  static post(baseURL: string, path: string, body: unknown, timeout = CoachEndpoints.quickTimeout): SisuRequest {
    return { ...Endpoints.postJSON(Endpoints.url(baseURL, path), Endpoints.encode(body)), timeoutInterval: timeout };
  }

  static stream(baseURL: string, path: string, body: unknown): SisuRequest {
    const request = CoachEndpoints.post(baseURL, path, body, CoachEndpoints.streamTimeout);
    return { ...request, headers: { ...request.headers, Accept: "text/event-stream" } };
  }

  /** A number as a query value: `200`, `199.5`. */
  static number(value: number): string {
    if (!Number.isFinite(value)) return "0";
    return Number.isInteger(value) && Math.abs(value) < 1e15 ? String(Math.trunc(value) || 0) : String(value);
  }

  // MARK: Server

  /** `GET {base}/api/agent/warm`. Call when the app opens. */
  static warm(baseURL: string) { return CoachEndpoints.get(baseURL, "/api/agent/warm", [], CoachEndpoints.researchTimeout); }

  /** `GET {base}/api/health` */
  static health(baseURL: string) { return CoachEndpoints.get(baseURL, "/api/health"); }

  /** `POST {base}/api/demo/reset`, with the header `x-sisu-reset-token` when a token is given. */
  static demoReset(baseURL: string, token?: string | null): SisuRequest {
    const request = CoachEndpoints.post(baseURL, "/api/demo/reset", {});
    return token ? { ...request, headers: { ...request.headers, "x-sisu-reset-token": token } } : request;
  }

  // MARK: Research

  /** `POST {base}/api/research` with `{ customerId, billType, wait?, yearlyKwh? }`. */
  static research(baseURL: string, body: ResearchRequest) {
    return CoachEndpoints.post(baseURL, "/api/research", body, body.wait === false ? CoachEndpoints.quickTimeout : CoachEndpoints.researchTimeout);
  }

  /** `GET {base}/api/research?customerId=&billType=`: what has been found so far (404 before any research). */
  static researchSnapshot(baseURL: string, customerId: string, billType: BillType) {
    return CoachEndpoints.get(baseURL, "/api/research", [["customerId", customerId], ["billType", billType]]);
  }

  // MARK: Memory

  /** `GET {base}/api/memory?customerId=` */
  static memory(baseURL: string, customerId: string) { return CoachEndpoints.get(baseURL, "/api/memory", [["customerId", customerId]]); }

  /** `POST {base}/api/memory` with `{ customerId, kind, key?, value, billType? }`. */
  static saveMemory(baseURL: string, body: MemorySaveRequest) { return CoachEndpoints.post(baseURL, "/api/memory", body); }

  /** `POST {base}/api/memory` with `{ customerId, consent }`. `consent: false` erases what was stored. */
  static memoryConsent(baseURL: string, body: MemoryConsentRequest) { return CoachEndpoints.post(baseURL, "/api/memory", body); }

  /** `DELETE {base}/api/memory?customerId=&itemId=`. Without an item id everything is forgotten. */
  static forgetMemory(baseURL: string, customerId: string, itemId?: string | null): SisuRequest {
    const query: [string, string][] = [["customerId", customerId]];
    if (itemId != null) query.push(["itemId", itemId]);
    return { ...CoachEndpoints.get(baseURL, "/api/memory", query), method: "DELETE" };
  }

  // MARK: Actions

  /** `POST {base}/api/actions/prepare`. */
  static prepareAction(baseURL: string, body: PrepareActionRequest) { return CoachEndpoints.post(baseURL, "/api/actions/prepare", body); }

  /** `POST {base}/api/actions/{id}/approve` with `{ customerId, confirm: true }`. */
  static approveAction(baseURL: string, customerId: string, actionId: string) {
    return CoachEndpoints.post(baseURL, `/api/actions/${Endpoints.escape(actionId)}/approve`, { customerId, confirm: true });
  }

  /** `POST {base}/api/actions/{id}/decline` with `{ customerId }`. */
  static declineAction(baseURL: string, customerId: string, actionId: string) {
    return CoachEndpoints.post(baseURL, `/api/actions/${Endpoints.escape(actionId)}/decline`, { customerId });
  }

  /** `GET {base}/api/actions?customerId=`: the actions and the audit trail. */
  static actions(baseURL: string, customerId: string) { return CoachEndpoints.get(baseURL, "/api/actions", [["customerId", customerId]]); }

  /** `GET {base}/api/audit?customerId=` */
  static audit(baseURL: string, customerId: string) { return CoachEndpoints.get(baseURL, "/api/audit", [["customerId", customerId]]); }

  // MARK: Coach (no model, instant)

  static patterns(baseURL: string, customerId: string) { return CoachEndpoints.get(baseURL, "/api/coach/patterns", [["customerId", customerId]]); }
  /** v2 payday: `overrides` (the payday and bills the person confirmed) go as `paydayDate` and `extraBills` (JSON). */
  static cashFlow(baseURL: string, customerId: string, overrides: PaydayOverrides | null = null) {
    return CoachEndpoints.get(baseURL, "/api/coach/cash-flow", [["customerId", customerId], ...CoachEndpoints.paydayQuery(overrides)]);
  }

  static paydayQuery(overrides: PaydayOverrides | null): [string, string][] {
    return [
      ...(overrides?.paydayDate ? [["paydayDate", overrides.paydayDate] as [string, string]] : []),
      ...(overrides?.extraBills?.length ? [["extraBills", JSON.stringify(overrides.extraBills)] as [string, string]] : []),
    ];
  }

  static affordability(baseURL: string, customerId: string, amountEur: number) {
    return CoachEndpoints.get(baseURL, "/api/coach/affordability", [["customerId", customerId], ["amountEur", CoachEndpoints.number(amountEur)]]);
  }

  /** Without a concept all seven cards come back. */
  static teaching(baseURL: string, customerId: string, concept?: ConceptId | null) {
    const query: [string, string][] = [["customerId", customerId]];
    if (concept != null) query.push(["concept", concept]);
    return CoachEndpoints.get(baseURL, "/api/coach/teaching", query);
  }

  /** 404 when the customer has none. */
  static mortgage(baseURL: string, customerId: string) { return CoachEndpoints.get(baseURL, "/api/coach/mortgage", [["customerId", customerId]]); }

  // MARK: Agent (event streams)

  /** `POST {base}/api/agent/query` with `{ customerId, text, mode, history?, focusBill?, language? }`. */
  static agentQuery(baseURL: string, body: AgentRequest) { return CoachEndpoints.stream(baseURL, "/api/agent/query", body); }

  /** `POST {base}/api/agent/investigate` with `{ customerId, mode?, text?, language? }`. */
  static agentInvestigate(baseURL: string, body: InvestigateRequest) { return CoachEndpoints.stream(baseURL, "/api/agent/investigate", body); }

  /** `POST {base}/api/agent/bill-photo`: fields `image` (PNG, JPEG or WebP, up to 4 MB) and `customerId`. */
  static billPhoto(baseURL: string, customerId: string, image: FormBytes, fileName = "bill.jpg", mimeType = "image/jpeg"): SisuRequest {
    const form = new MultipartForm().file("image", fileName, mimeType, image).field("customerId", customerId);
    return CoachEndpoints.multipart(baseURL, "/api/agent/bill-photo", form, CoachEndpoints.voiceTimeout);
  }

  /** `POST {base}/api/agent/plan` with `{ customerId, fresh?, language? }`: the money plan as an event stream. */
  static agentPlan(baseURL: string, body: PlanRequest) { return CoachEndpoints.stream(baseURL, "/api/agent/plan", body); }

  /** `GET {base}/api/agent/visuals?customerId=`: every chart for a customer, with no model call. */
  static visuals(baseURL: string, customerId: string) { return CoachEndpoints.get(baseURL, "/api/agent/visuals", [["customerId", customerId]]); }

  /** `POST {base}/api/actions/approve-all` with `{ customerId, actionIds, confirm: true }`. */
  static approveAll(baseURL: string, customerId: string, actionIds: string[]) {
    return CoachEndpoints.post(baseURL, "/api/actions/approve-all", ApproveAllRequest.make(customerId, actionIds));
  }

  // MARK: Watches (Projects)
  // On the hosted backend today: list, check, stop and simulate-drop. Pause, resume, update and read are not there
  // yet: they answer 404, which the client passes on as `SisuError.server(404, …)`.

  /** Seconds a check may take: it can re-read pages fresh at Context.dev (the route allows 60). */
  static readonly watchCheckTimeout = 60;

  private static watchPath(id: string, action = ""): string {
    return `/api/watch/${Endpoints.escape(id)}${action === "" ? "" : `/${action}`}`;
  }

  /** `GET {base}/api/watch?customerId=`: the watches and the findings (reads only, calls nothing outside). */
  static watchList(baseURL: string, customerId: string) { return CoachEndpoints.get(baseURL, "/api/watch", [["customerId", customerId]]); }

  /** `GET {base}/api/watch/{id}?customerId=`: one project, with the listings that fit now (`currentMatches`, each with
   *  its housing effect). Reads only. Not on the hosted backend yet (404). */
  static watchProject(baseURL: string, id: string, customerId: string) {
    return CoachEndpoints.get(baseURL, CoachEndpoints.watchPath(id), [["customerId", customerId]], CoachEndpoints.researchTimeout);
  }

  /** `POST {base}/api/watch/check` with `{ customerId, runNow? }` (`runNow` sent only when true). */
  static watchCheck(baseURL: string, customerId: string, runNow = false) {
    return CoachEndpoints.post(baseURL, "/api/watch/check", { customerId, runNow: runNow ? true : null }, CoachEndpoints.watchCheckTimeout);
  }

  /** `POST {base}/api/watch/{id}/stop` with `{ customerId }`. Idempotent. */
  static watchStop(baseURL: string, id: string, customerId: string) {
    return CoachEndpoints.post(baseURL, CoachEndpoints.watchPath(id, "stop"), { customerId }, CoachEndpoints.researchTimeout);
  }

  /** `POST {base}/api/watch/{id}/pause` with `{ customerId }`. Not on the hosted backend yet (404). */
  static watchPause(baseURL: string, id: string, customerId: string) {
    return CoachEndpoints.post(baseURL, CoachEndpoints.watchPath(id, "pause"), { customerId }, CoachEndpoints.researchTimeout);
  }

  /** `POST {base}/api/watch/{id}/resume` with `{ customerId }`. Not on the hosted backend yet (404). */
  static watchResume(baseURL: string, id: string, customerId: string) {
    return CoachEndpoints.post(baseURL, CoachEndpoints.watchPath(id, "resume"), { customerId }, CoachEndpoints.researchTimeout);
  }

  /** `PATCH {base}/api/watch/{id}` with `{ customerId, requirements }`: only the fields that change. Unlike every
   *  other body here, a null member is kept, because the backend reads it as "clear this field". Not on the hosted
   *  backend yet (404). */
  static watchUpdate(baseURL: string, id: string, customerId: string, requirements: WatchRequirements): SisuRequest {
    // The backend (rework/api-projects) takes the watch's own limits beside the requirements:
    // `{ customerId, budgetEur?, minRooms?, goal?, requirements? }`; a requirement it does not know is refused.
    const { budgetEur, minRooms, goal, ...rest } = requirements;
    const own = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    const body = {
      customerId,
      ...(typeof budgetEur === "number" ? { budgetEur } : {}),
      ...(typeof minRooms === "number" || minRooms === null ? { minRooms } : {}),
      ...(typeof goal === "string" || goal === null ? { goal } : {}),
      ...(Object.keys(own).length > 0 ? { requirements: own } : {}),
    };
    const request = CoachEndpoints.post(baseURL, CoachEndpoints.watchPath(id), body, CoachEndpoints.researchTimeout);
    return { ...request, method: "PATCH", body: CoachEndpoints.encodeKeepingNull(body) };
  }

  /** JSON with sorted keys, like `Endpoints.encode`, but null members stay (undefined ones are left out). */
  static encodeKeepingNull(value: unknown): string {
    const clean = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(clean);
      if (v === null || typeof v !== "object") return v;
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => [k, clean(o[k])]));
    };
    return JSON.stringify(clean(value)) ?? "{}";
  }

  /** `POST {base}/api/watch/{id}/read` with `{ customerId }`: the watch's findings are seen. Not on the hosted
   *  backend yet (404). */
  static watchMarkRead(baseURL: string, id: string, customerId: string) {
    return CoachEndpoints.post(baseURL, CoachEndpoints.watchPath(id, "read"), { customerId });
  }

  /** `POST {base}/api/watch/{id}/simulate-drop` with `{ customerId }`: a made-up price drop, labelled simulated. */
  static simulateDrop(baseURL: string, id: string, customerId: string) {
    return CoachEndpoints.post(baseURL, CoachEndpoints.watchPath(id, "simulate-drop"), { customerId }, CoachEndpoints.researchTimeout);
  }

  // MARK: Voice

  /** `GET {base}/api/voice/tts`: voices, models and the languages for a picker. */
  static voiceOptions(baseURL: string) { return CoachEndpoints.get(baseURL, "/api/voice/tts"); }

  /** `POST {base}/api/voice/tts` with `{ text, format?, previousText?, model?, voiceId?, language? }`. Answers with audio. */
  static textToSpeech(baseURL: string, body: SpeechRequest): SisuRequest {
    const request = CoachEndpoints.post(baseURL, "/api/voice/tts", body, CoachEndpoints.voiceTimeout);
    return { ...request, headers: { ...request.headers, Accept: "audio/*" } };
  }

  /** `POST {base}/api/voice/stt`: fields `audio` and `language` (`auto` or an ISO 639-1 code). */
  static speechToText(baseURL: string, audio: FormBytes, fileName: string, mimeType: string, language = "auto"): SisuRequest {
    const form = new MultipartForm().file("audio", fileName, mimeType, audio).field("language", language);
    return CoachEndpoints.multipart(baseURL, "/api/voice/stt", form, CoachEndpoints.voiceTimeout);
  }

  /** `POST {base}/api/voice/turn`: fields `audio`, `customerId`, `history` (JSON array of `{ role, content }`),
   * `focusBill` (only when set), `language` and `bufferEur` (the person's protected buffer in euros, only when set).
   * Answers with the event stream. */
  static voiceTurn(baseURL: string, customerId: string, audio: FormBytes, fileName: string, mimeType: string,
    history: ChatTurn[] = [], focusBill: BillType | null = null, language = "auto", bufferEur: number | null = null, payday: PaydayOverrides | null = null): SisuRequest {
    const form = new MultipartForm().file("audio", fileName, mimeType, audio).field("customerId", customerId)
      .field("history", Endpoints.encode(history));
    if (focusBill != null) form.field("focusBill", focusBill);
    form.field("language", language);
    if (bufferEur != null && Number.isFinite(bufferEur) && bufferEur >= 0) form.field("bufferEur", CoachEndpoints.number(bufferEur));
    CoachEndpoints.paydayQuery(payday).forEach(([name, value]) => form.field(name, value));
    const request = CoachEndpoints.multipart(baseURL, "/api/voice/turn", form, CoachEndpoints.streamTimeout);
    return { ...request, headers: { ...request.headers, Accept: "text/event-stream" } };
  }

  static multipart(baseURL: string, path: string, form: MultipartForm, timeout: number): SisuRequest {
    return { url: Endpoints.url(baseURL, path), method: "POST", headers: {}, body: form.data, timeoutInterval: timeout };
  }
}
