// `CoachSession`: port of SisuCore/CoachSession.swift (itself the port of the web hook `useSisu`). One per
// customer. Swift's `ObservableObject` becomes a store: `subscribe(listener)` + `getSnapshot()` (an immutable
// `CoachSessionState`, replaced on every change), ready for React's `useSyncExternalStore`.
import { type FixtureSource, FixtureAPI, SisuError, isCancellation } from "./API";
import { Activity, SisuActivity, type LiitoMood } from "./Activity";
import { LiitoTask } from "./LiitoTask";
import { CoachClient } from "./CoachClient";
import {
  type AgentAction,
  type BillType,
  type ChatTurn,
  type Citation,
  type CustomerMemory,
  type Fact,
  type Grounding,
  type MemoryItem,
  type ResearchResult,
  type ServerInfo,
  type Stage,
  type TeachingCard,
  type ToolTrace,
  type TurnTimings,
  type ActionList,
  type ActionEnvelope,
  type TeachingCardList,
  ActionKind,
  ActionStatus,
  AgentRequest,
  InvestigateRequest,
  SisuEvent,
  WarmResponse,
} from "./CoachModels";
import type { FormBytes } from "./CoachEndpoints";
import type { Visual } from "./PlanModels";
import { SisuEventStreamParser } from "./ServerSentEvents";
import { ReplayTransport } from "./Transport";
import { JSONRead } from "./Models";
import { ConversationHistory } from "./ConversationHistory";
import { SpokenText } from "./SpokenText";
import type { HousingBudget, HousingSearchRequest } from "./HousingModels";

/** Plays Sisu's voice. The app implements it (web/voice); this package has no audio code. */
export interface SpeechOutput {
  /** Queue one sentence. `order` counts up from 0 within a turn: play in that order, one after the other. */
  speak(text: string, order: number): void;
  /** Drop everything queued and stop the sound now. Called when the user interrupts or asks again. */
  stop(): void;
}

/** What the talk button shows. */
export type CoachStatus = "idle" | "recording" | "thinking" | "speaking";

/** Which label the screen owes the user: none (`live`), "Mock data" (`mock`) or "Sample data" (`sample`). */
export type CoachDataLabel = "live" | "mock" | "sample";

/** One thing Sisu did (or is doing right now) in a turn. The label is written by code on the server. */
export interface CoachStep {
  id: string;
  label: string;
  /** False while it runs: show a spinner. */
  done: boolean;
  /** False if it failed. */
  ok: boolean;
  tookMs: number | null;
  /** One line on what came back. */
  result: string | null;
}
export const CoachStep = {
  make: (id: string, label: string): CoachStep => ({ id, label, done: false, ok: true, tookMs: null, result: null }),
} as const;

/** One line of the conversation. An assistant message fills in while `pending` is true. */
export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  /** The question, or the answer growing word by word. After `done` it is the server's checked text. */
  text: string;
  pending: boolean;
  /** The "let me check" line, shown while research runs. */
  filler: string | null;
  /** Set when the server began research before the model asked for it. */
  startedEarly: BillType | null;
  /** The tool running right now, for a progress line. Null between tools. */
  runningTool: string | null;
  /** The trace drawer: one row per finished tool call. */
  tools: ToolTrace[];
  research: ResearchResult | null;
  citations: Citation[];
  timings: TurnTimings | null;
  /** A sentence to show instead of (or under) the answer. */
  error: string | null;
  /** One card per step of Sisu's work. */
  stages: Stage[];
  /** An action awaiting approval: show Approve and Decline. */
  action: AgentAction | null;
  teaching: TeachingCard | null;
  /** Things Sisu saved this turn ("Sisu will remember…"). */
  remembered: MemoryItem[];
  grounding: Grounding | null;
  facts: Fact[];
  visuals: Visual[];
  /** What Sisu is doing, one line per tool call, in order ("What Sisu is doing" / "What Sisu did"). */
  steps: CoachStep[];
  /** A question asked out loud in the hands-free conversation. Absent on typed questions and on answers. */
  spoken?: boolean;
}

export const CoachMessage = {
  make: (id: string, role: CoachMessage["role"], fields: Partial<Omit<CoachMessage, "id" | "role">> = {}): CoachMessage => ({
    id, role, text: "", pending: false, filler: null, startedEarly: null, runningTool: null, tools: [], research: null, citations: [],
    timings: null, error: null, stages: [], action: null, teaching: null, remembered: [], grounding: null, facts: [], visuals: [], steps: [],
    ...fields,
  }),

  /** Folds one stream event into an assistant message (pure; `start`, `transcript` and `sentence` change nothing). */
  apply(m: CoachMessage, event: SisuEvent): CoachMessage {
    switch (event.kind) {
      case "speculation": return { ...m, startedEarly: event.billType };
      case "filler": return { ...m, filler: event.text };
      case "delta": return { ...m, text: m.text + event.text };
      case "toolStart": return { ...m, runningTool: event.name, steps: [...m.steps, CoachStep.make(event.id, event.label ? event.label : event.name)] };
      case "replace": return { ...m, text: event.text };
      case "visual": return { ...m, visuals: [...m.visuals.filter((v) => v.id !== event.visual.id), event.visual] };
      case "toolEnd": {
        const trace = event.trace;
        const index = m.steps.findIndex((s) => s.id === trace.id);
        const steps = m.steps.map((s, i) => (i === index ? { ...s, done: true, ok: trace.ok, tookMs: trace.tookMs, result: trace.summary } : s));
        return { ...m, tools: [...m.tools, trace], runningTool: null, steps };
      }
      case "research": return { ...m, research: event.result };
      case "stage": return { ...m, stages: [...m.stages, event.stage] };
      case "action": return { ...m, action: event.action };
      case "teaching": return { ...m, teaching: event.card };
      case "memory": return { ...m, remembered: [...m.remembered, event.item] };
      case "grounding": return { ...m, grounding: event.grounding, facts: event.facts };
      case "done": return { ...m, text: event.text !== "" ? event.text : m.text, pending: false, runningTool: null, citations: event.citations, timings: event.timings };
      case "error": return { ...m, pending: false, runningTool: null, error: event.message === "" ? CoachErrors.generic : event.message };
      default: return m;
    }
  },
} as const;

/** Recorded payloads for previews and screens built before a backend is there (mock backend, 14 Nov 2026):
 * label them "Sample data". Async on the web: the recordings are fetched from /sisu-fixtures. */
export class CoachSamples {
  static readonly turns = ["spending", "electricity", "investigate", "voice", "afford", "mortgage", "payday", "bills", "patterns", "whatif",
    "teach", "category", "remember"];

  /** The events of one recorded turn, in order. Empty for a name or customer that was not recorded. */
  static async events(turn: string, customerId = "CUST04974", source: FixtureSource = FixtureAPI.defaultSource): Promise<SisuEvent[]> {
    const data = await ReplayTransport.fixture(`coach/stream-${turn}-${customerId}.sse`, source);
    return SisuEventStreamParser.events(data ?? new Uint8Array());
  }

  /** The finished assistant message of one recorded turn (all its stages, cards and receipts). */
  static async reply(turn: string, customerId = "CUST04974", source?: FixtureSource): Promise<CoachMessage> {
    const events = await CoachSamples.events(turn, customerId, source);
    const filled = events.reduce(CoachMessage.apply, CoachMessage.make(`sample-${turn}-${customerId}`, "assistant", { pending: true }));
    return { ...filled, pending: false };
  }

  static async load<T>(name: string, source: FixtureSource = FixtureAPI.defaultSource): Promise<T | null> {
    const data = await ReplayTransport.fixture(`coach/${name}`, source);
    return data ? (JSONRead.attempt(() => JSONRead.parse(data)) as T | null) : null;
  }

  /** Recorded offer research (`electricity`, `mobile` or `internet`). */
  static research(customerId = "CUST04974", billType: BillType = "electricity", source?: FixtureSource) {
    return CoachSamples.load<ResearchResult>(`research-${customerId}-${billType}.json`, source);
  }

  /** The action an investigation prepared: awaiting approval, or as it came back approved (with `impact`). */
  static async action(customerId = "CUST04974", approved = false, source?: FixtureSource): Promise<AgentAction | null> {
    return approved
      ? (await CoachSamples.load<ActionEnvelope>(`action-investigate-${customerId}-approve.json`, source))?.action ?? null
      : (await CoachSamples.load<ActionList>(`actions-${customerId}-investigate-pending.json`, source))?.actions[0] ?? null;
  }

  /** All seven teaching cards of a customer. */
  static async teachingCards(customerId = "CUST04974", source?: FixtureSource): Promise<TeachingCard[]> {
    return (await CoachSamples.load<TeachingCardList>(`teaching-${customerId}.json`, source))?.cards ?? [];
  }
}

/** A tiny observable store: the stand-in for `@Published`. */
export class Store<S extends object> {
  private listeners = new Set<() => void>();
  constructor(protected state: S) {}

  /** Subscribe to changes; returns the unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** The current state (a new object after every change). */
  getSnapshot = (): S => this.state;

  protected update(change: Partial<S>): void {
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
}

/** Everything a coach screen observes. `working` and `moment` feed `activity` (private in Swift). */
export interface CoachSessionState {
  /** The conversation, oldest first. */
  messages: CoachMessage[];
  /** Which model answers. Null until `warm()` or the first turn has answered. */
  server: ServerInfo | null;
  /** Every action of this customer, newest first. */
  actions: AgentAction[];
  memory: CustomerMemory | null;
  isThinking: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  /** The language of the last spoken question (`fi`, `de`…), when it was recognised. */
  heardLanguage: string | null;
  /** The sentence of the last failed approve, decline, confirmBill, setRemembering or forget. */
  notice: string | null;
  /** Set once, when this session started answering from the bundled sample. Show it, then dismiss it. */
  fallbackNotice: string | null;
  working: SisuActivity;
  moment: SisuActivity | null;
  /** What Liito is visibly doing in the running turn (LiitoTask.next over its events). Null between turns. */
  task: LiitoTask | null;
}

let idCounter = 0;
/** `UUID().uuidString`, with a fallback where `crypto.randomUUID` is missing (plain-http pages). */
export function makeUUID(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  idCounter += 1;
  return `id-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

type TurnInput =
  | { kind: "typed"; text: string }
  | { kind: "investigate"; focus: string | null }
  | { kind: "voice"; audio: FormBytes; fileName: string; mimeType: string; language: string };

export interface CoachSessionOptions {
  speech?: SpeechOutput | null;
  /** Defaults to true when a `speech` output is given. */
  speakReplies?: boolean;
  language?: string;
  focusBill?: BillType | null;
  /** The protected buffer the person set (AppPrefs.bufferEur), in euros. Null: none said, the server assumes one. */
  bufferEur?: number | null;
  /** Makes message ids. Inject a counter in tests. */
  makeId?: () => string;
}

/** The conversation with Sisu for one customer. `ask`, `investigate` and `sendVoice` return the running turn
 * (a promise tests can await); the reply fills in as events arrive. A new question, `cancel()` or `reset()`
 * aborts the running turn and stops speech; late events from an older turn change nothing. Errors become a
 * sentence on the reply (`error`) or in `notice`; nothing here throws. */
export class CoachSession extends Store<CoachSessionState> {
  static readonly investigateText = "Look into my finances and find the best thing I can do.";
  /** The question bubble of a voice turn whose recording had no words in it. */
  static readonly nothingHeardText = "(nothing heard)";
  /** The question bubble of a voice turn that failed before its words came back. */
  static readonly unheardText = "(voice question)";

  /** True for the stand-in text of a voice question that was never heard: never send it as a typed question. */
  static isUnheard(text: string): boolean {
    const trimmed = text.trim();
    return trimmed === "" || trimmed === CoachSession.nothingHeardText || trimmed === CoachSession.unheardText;
  }

  focusBill: BillType | null;
  speakReplies: boolean;
  /** `auto` (answer in the language asked in) or an ISO 639-1 code such as `fi`. */
  language: string;
  /** The person's protected buffer in euros (AppPrefs.bufferEur), sent with every typed and spoken question so the
   *  answer keeps the same buffer as Today. Null when none was set (the field is left out). */
  bufferEur: number | null;
  speech: SpeechOutput | null;

  private history: ChatTurn[] = [];
  private turnTask: Promise<void> | null = null;
  private turnAbort: AbortController | null = null;
  private turnToken = 0;
  private announcedFallback = false;
  private readonly makeId: () => string;

  constructor(readonly customerId: string, readonly client: CoachClient, options: CoachSessionOptions = {}) {
    super({ messages: [], server: null, actions: [], memory: null, isThinking: false, isRecording: false, isSpeaking: false,
      heardLanguage: null, notice: null, fallbackNotice: null, working: SisuActivity.idle, moment: null, task: null });
    this.speech = options.speech ?? null;
    this.speakReplies = options.speakReplies ?? this.speech !== null;
    this.language = options.language ?? "auto";
    this.focusBill = options.focusBill ?? null;
    this.bufferEur = CoachSession.validBuffer(options.bufferEur ?? null);
    this.makeId = options.makeId ?? makeUUID;
  }

  static live(customerId: string, baseURL = "", speech: SpeechOutput | null = null) {
    return new CoachSession(customerId, CoachClient.live(baseURL), { speech });
  }

  static liveWithSampleFallback(customerId: string, baseURL = "", speech: SpeechOutput | null = null) {
    return new CoachSession(customerId, CoachClient.liveWithSampleFallback(baseURL), { speech });
  }

  static sample(customerId: string, eventDelay = 0.02, speech: SpeechOutput | null = null) {
    return new CoachSession(customerId, CoachClient.sample(eventDelay), { speech });
  }

  dismissFallbackNotice(): void { this.update({ fallbackNotice: null }); }

  private noteFallback(): void {
    const notice = this.client.fallbackNotice;
    if (this.announcedFallback || notice === null) return;
    this.announcedFallback = true;
    this.update({ fallbackNotice: notice });
  }

  // MARK: Derived state

  get messages() { return this.state.messages; }
  get actions() { return this.state.actions; }

  /** `recording` wins over `thinking`, which wins over `speaking`. */
  get status(): CoachStatus {
    const s = this.state;
    return s.isRecording ? "recording" : s.isThinking ? "thinking" : s.isSpeaking ? "speaking" : "idle";
  }

  /** What Sisu is doing right now: drive the mascot from `SisuActivity.mood(activity)`, show its label. */
  get activity(): SisuActivity {
    const s = this.state;
    if (s.isRecording) return SisuActivity.make("listening");
    if (s.isThinking) return s.working;
    if (s.isSpeaking) return SisuActivity.make("speaking");
    if (s.moment) return s.moment;
    const waiting = s.actions.find((a) => a.status === ActionStatus.awaitingApproval);
    return waiting ? SisuActivity.make("waiting_for_approval", waiting.title, waiting.warning) : SisuActivity.idle;
  }

  /** The Rive mood for what Sisu is doing right now, with the task animations (LiitoTask.mood). */
  get liitoMood(): LiitoMood {
    return LiitoTask.mood(this.activity, this.state.task, this.state.isRecording);
  }

  /** Euros a month freed by approved switches. Feed it to the futures chart as the monthly bill saving. */
  get approvedMonthlySaving(): number {
    return this.state.actions
      .filter((a) => a.status === ActionStatus.executedSimulated && a.kind === ActionKind.switchContract)
      .reduce((sum, a) => sum + a.monthlyAmountEur, 0);
  }

  get dataLabel(): CoachDataLabel {
    if (this.client.kind === "bundledSample") return "sample";
    return this.state.server?.mock === true ? "mock" : "live";
  }

  get isSample(): boolean { return this.client.kind === "bundledSample"; }

  // MARK: Turns

  /** Sends a typed question. Blank text does nothing (and returns null). */
  ask(text: string): Promise<void> | null {
    const question = text.trim();
    return question === "" ? null : this.runTurn({ kind: "typed", text: question });
  }

  /** Sisu works through a whole case on its own: watch `stages` on the reply fill in. */
  investigate(focus: string | null = null): Promise<void> {
    const trimmed = focus?.trim();
    return this.runTurn({ kind: "investigate", focus: trimmed ? trimmed : null });
  }

  /** Sends a recording to `/api/voice/turn` (up to 5 MB). The stream starts with what was heard. */
  sendVoice(audio: FormBytes, fileName = "speech.m4a", mimeType = "audio/mp4", language: string | null = null): Promise<void> {
    return this.runTurn({ kind: "voice", audio, fileName, mimeType, language: language ?? this.language });
  }

  /** A buffer worth sending: a finite number of euros from 0 to 100,000 (the server refuses anything else, which
   *  would fail every question). Anything else is null (none said), so a value stored before the limit existed
   *  never blocks the conversation. */
  static validBuffer(value: number | null | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100_000 ? value : null;
  }

  /** Stops whatever Sisu is doing: aborts the stream, stops speech, and leaves what has arrived on screen. A voice
   *  question stopped before its words came back leaves nothing: no empty bubble, no empty answer. A question that
   *  was asked but stopped before any of its answer arrived keeps a "stopped" reply with Try again. */
  cancel(): void {
    this.turnToken += 1;
    this.turnAbort?.abort();
    this.turnAbort = null;
    this.turnTask = null;
    this.speech?.stop();
    const s = this.state;
    if (s.isThinking || s.messages.some((m) => m.pending)) {
      this.update({ isThinking: false, task: null, messages: CoachSession.settled(s.messages) });
    } else if (s.task !== null) {
      this.update({ task: null });
    }
  }

  /** The messages with nothing pending: an unheard voice question (still waiting for its words) goes, with its reply
   *  when nothing has arrived in it yet. Any other reply in which nothing arrived says it was stopped (the answer card
   *  then offers Try again), so no empty card is left on screen or saved. */
  private static settled(messages: CoachMessage[]): CoachMessage[] {
    const unheard = new Set(messages.filter((m) => m.role === "user" && m.pending && m.text === "").map((m) => m.id));
    return messages.flatMap((m, index) => {
      if (unheard.has(m.id)) return [];
      const question = index > 0 ? messages[index - 1] : null;
      if (m.role === "assistant" && ConversationHistory.isBlank(m)) {
        if (question && unheard.has(question.id)) return [];
        return [{ ...m, pending: false, runningTool: null, error: CoachErrors.stopped }];
      }
      return [m.pending ? { ...m, pending: false } : m];
    });
  }

  /** Clears the conversation. Actions and memory belong to the customer and stay. */
  reset(): void {
    this.cancel();
    this.history = [];
    this.update({ messages: [] });
  }

  /** Puts a stored conversation back (the chat history drawer): its messages, settled, and the model history rebuilt
   *  from its questions and answers, so the next question, typed or spoken, keeps that context. */
  restore(messages: readonly CoachMessage[]): void {
    this.cancel();
    const restored = CoachSession.settled(messages.map((m) => CoachMessage.make(m.id, m.role, m)));
    this.history = ConversationHistory.chatTurns(restored);
    this.update({ messages: restored });
  }

  /** v2 housing: the intake card's Search. Adds the confirmed requirements as a question and the results as Sisu's
   *  answer (a `housing_results` stage, plus the Project proposal as the message's action), so the conversation
   *  keeps them and the history drawer restores them. Errors become the reply's sentence; nothing throws. */
  async housingSearch(request: HousingSearchRequest, summary: string): Promise<void> {
    this.cancel();
    const userId = this.makeId();
    const replyId = this.makeId();
    const stepId = `${replyId}-search`;
    const label = `Searching listings in ${request.city} with Exa, reading them with Context.dev`;
    this.update({
      messages: [...this.state.messages, CoachMessage.make(userId, "user", { text: summary }),
        CoachMessage.make(replyId, "assistant", { pending: true, filler: "Searching for homes and checking each one against your requirements…", steps: [CoachStep.make(stepId, label)] })],
      isThinking: true, working: SisuActivity.make("searching_web"), moment: null,
    });
    const started = Date.now();
    try {
      const result = await this.client.housingSearch(request);
      const stage: Stage = { id: `${replyId}:housing`, kind: "housing_results", title: "Homes checked against your requirements", summary: result.verdict, source: "calculation", toolCallId: null, atMs: Date.now() - started, facts: result.facts, data: { kind: "housing_results", result } };
      const read = result.research.read.length;
      const step = { ...CoachStep.make(stepId, label), done: true, ok: true, tookMs: Date.now() - started, result: `${result.research.sources.length} pages found, ${read} read` };
      // The card says the verdict; the answer's own line says what was done. The model history keeps the verdict.
      const checked = result.fitting.length + result.needsChecking.length + result.excluded.length;
      const lead = checked ? `I checked ${checked} listing${checked === 1 ? "" : "s"} in ${request.city} against your requirements.` : `I could not read any listings in ${request.city} just now.`;
      const text = result.actionProblem ? `${result.verdict} ${result.actionProblem}` : result.verdict;
      this.patch(replyId, (m) => ({ ...m, pending: false, filler: null, text: lead, stages: [stage], action: result.action ?? null, facts: result.facts, steps: [step] }));
      if (result.action) this.update({ actions: [result.action as unknown as AgentAction, ...this.state.actions.filter((a) => a.id !== result.action?.id)] });
      this.history = [...this.history, { role: "user" as const, content: summary }, { role: "assistant" as const, content: text }].slice(-12);
      this.update({ isThinking: false, working: SisuActivity.idle });
    } catch (error) {
      this.patch(replyId, (m) => ({ ...m, pending: false, filler: null, error: CoachErrors.sentence(error), steps: m.steps.map((s) => ({ ...s, done: true, ok: false })) }));
      this.update({ isThinking: false, working: SisuActivity.idle });
    }
  }

  /** v2 housing: the rent Sisu suggests for a monthly savings goal, or null when it cannot be worked out now. */
  housingBudget(savingsGoalEurPerMonth: number): Promise<HousingBudget | null> {
    return this.client.housingBudget(this.customerId, savingsGoalEurPerMonth).catch(() => null);
  }

  /** Call when the microphone opens and closes. Opening it interrupts Sisu. */
  setRecording(recording: boolean): void {
    if (recording) this.cancel();
    if (this.state.isRecording !== recording) this.update({ isRecording: recording });
  }

  /** Call from the `SpeechOutput` when sound starts and stops. */
  setSpeaking(speaking: boolean): void {
    if (this.state.isSpeaking !== speaking) this.update({ isSpeaking: speaking });
  }

  private runTurn(input: TurnInput): Promise<void> {
    this.cancel();
    this.turnToken += 1;
    const token = this.turnToken;
    const spoken = this.speakReplies;
    const mode = spoken ? "voice" : "text";
    const chosen = this.language === "auto" || this.language === "" ? null : this.language;
    const controller = new AbortController();
    this.turnAbort = controller;
    const { customerId, client, history, focusBill } = this;
    const bufferEur = CoachSession.validBuffer(this.bufferEur);

    const userText = input.kind === "typed" ? input.text : input.kind === "investigate" ? CoachSession.investigateText : "";
    const stream =
      input.kind === "typed"
        ? client.ask({ ...AgentRequest.make({ customerId, text: input.text, mode, history, focusBill, language: chosen }), ...(bufferEur === null ? {} : { bufferEur }) }, controller.signal)
        : input.kind === "investigate"
          ? client.investigate(InvestigateRequest.make({ customerId, mode, text: input.focus, language: chosen }), controller.signal)
          : client.voiceTurn(customerId, input.audio, input.fileName, input.mimeType, history, focusBill, input.language === "" ? "auto" : input.language, controller.signal, bufferEur);

    const userId = this.makeId();
    const replyId = this.makeId();
    this.update({
      messages: [...this.state.messages, CoachMessage.make(userId, "user", { text: userText, pending: userText === "", ...(input.kind === "voice" ? { spoken: true } : {}) }), CoachMessage.make(replyId, "assistant", { pending: true })],
      moment: null,
      working: SisuActivity.make("thinking"),
      task: null,
      isThinking: true,
    });

    const live = () => this.turnToken === token && !controller.signal.aborted;
    const task = (async () => {
      const turn = { question: userText, spokenOrder: 0 };
      try {
        for await (const event of stream) {
          if (!live()) return;
          this.apply(event, userId, replyId, spoken, turn);
        }
      } catch (error) {
        if (!live()) return;
        this.patch(userId, CoachSession.settledQuestion);
        this.patch(replyId, (m) => ({ ...m, pending: false, error: CoachErrors.sentence(error) }));
      }
      if (this.turnToken !== token) return;
      this.turnTask = null;
      this.turnAbort = null;
      // A stream that closed with nothing in it (no words, no done, no error, for example a crashed route) leaves
      // no empty card: the reply says it stopped, and the card offers Try again.
      this.update({ isThinking: false, task: null, messages: this.state.messages.map((m) => {
        if (!m.pending) return m;
        if (m.id === userId) return CoachSession.settledQuestion(m);
        return ConversationHistory.isBlank(m) ? { ...m, pending: false, runningTool: null, error: CoachErrors.stopped } : { ...m, pending: false };
      }) });
    })();
    this.turnTask = task;
    return task;
  }

  /** The question of a turn that ended: no longer pending; a voice question whose words never came back says so. */
  private static settledQuestion(m: CoachMessage): CoachMessage {
    return { ...m, pending: false, text: m.text === "" ? CoachSession.unheardText : m.text };
  }

  private patch(id: string, change: (m: CoachMessage) => CoachMessage): void {
    const messages = this.state.messages;
    const index = messages.findIndex((m) => m.id === id);
    if (index < 0) return;
    const next = change(messages[index]);
    if (next !== messages[index]) this.update({ messages: messages.map((m, i) => (i === index ? next : m)) });
  }

  /** Speaks one sentence, worded for the ear (SpokenText: "15 October", not "2026-10-15"). */
  private say(text: string, spoken: boolean, turn: { spokenOrder: number }): void {
    if (!spoken || !this.speech || text === "") return;
    const language = this.language === "auto" || this.language === "" ? this.state.heardLanguage : this.language;
    const words = SpokenText.format(text, language);
    if (words === "") return;
    this.speech.speak(words, turn.spokenOrder);
    turn.spokenOrder += 1;
  }

  private apply(event: SisuEvent, userId: string, replyId: string, spoken: boolean, turn: { question: string; spokenOrder: number }): void {
    // What only concerns the reply message.
    this.patch(replyId, (m) => CoachMessage.apply(m, event));
    const next = Activity.nextActivity(this.state.working, event);
    if (!SisuActivity.equals(next, this.state.working)) this.update({ working: next });
    const task = LiitoTask.next(this.state.task, event);
    if (task !== this.state.task) this.update({ task });
    this.noteFallback();
    // What concerns the session.
    switch (event.kind) {
      case "start": {
        const info = { mock: event.mock, provider: event.provider, model: event.model };
        const now = this.state.server;
        if (!now || now.mock !== info.mock || now.provider !== info.provider || now.model !== info.model) this.update({ server: info });
        break;
      }
      case "transcript":
        turn.question = event.text;
        this.patch(userId, (m) => ({ ...m, text: event.text === "" ? CoachSession.nothingHeardText : event.text, pending: false }));
        if (event.language) this.update({ heardLanguage: event.language });
        break;
      case "filler": case "sentence": this.say(event.text, spoken, turn); break;
      case "action": this.update({ actions: [event.action, ...this.state.actions.filter((a) => a.id !== event.action.id)] }); break;
      case "memory": void this.refresh(); break;
      case "done":
        this.history = [...this.history, { role: "user", content: turn.question }, { role: "assistant", content: event.text }].slice(-12);
        break;
      case "error": this.patch(userId, CoachSession.settledQuestion); break;
      default: break;
    }
  }

  // MARK: Actions

  /** The Approve button. Approval is the only thing that carries an action out, and it is a simulation.
   * Returns the action with `impact` filled in, or null when it failed (the sentence is in `notice`). */
  async approve(actionId: string): Promise<AgentAction | null> {
    const action = await this.decide((c, id) => c.approveAction(id, actionId));
    if (action) this.update({ moment: SisuActivity.make("approved", action.confirmation ?? "Done, as a simulation") });
    return action;
  }

  /** The Decline button. Returns the updated action, or null when it failed. */
  async decline(actionId: string): Promise<AgentAction | null> {
    const action = await this.decide((c, id) => c.declineAction(id, actionId));
    if (action) this.update({ moment: SisuActivity.make("declined") });
    return action;
  }

  /** Prepares a transfer within the customer's own accounts: once (`oneOff`) or each payday. Show its `warning`. */
  prepareTransfer(amountEur: number, oneOff = true, destination = "savings"): Promise<AgentAction | null> {
    return this.decide((c, id) => c.prepareAction({ customerId: id, kind: oneOff ? ActionKind.oneOffTransfer : ActionKind.standingTransfer, amountEur, destination }));
  }

  /** Prepares a contract switch from a button. Null when it failed (for example offers not looked up yet). */
  prepareSwitch(billType: BillType, provider: string | null = null): Promise<AgentAction | null> {
    return this.decide((c, id) => c.prepareAction({ customerId: id, kind: ActionKind.switchContract, billType, provider }));
  }

  private async decide(call: (client: CoachClient, customerId: string) => Promise<AgentAction>): Promise<AgentAction | null> {
    try {
      const action = await call(this.client, this.customerId);
      this.noteFallback();
      this.put(action);
      this.update({ notice: null });
      return action;
    } catch (error) {
      this.update({ notice: CoachErrors.sentence(error) });
      // Already decided or expired: the server knows the real state.
      const status = SisuError.status(error);
      if (status === 409 || status === 410) await this.refresh();
      return null;
    }
  }

  private put(action: AgentAction): void {
    this.update({ actions: [action, ...this.state.actions.filter((a) => a.id !== action.id)] });
    this.sync([action]);
  }

  /** Keeps the copies of an action inside messages (the card and its stage) equal to the newest one. */
  private sync(fresh: AgentAction[]): void {
    const byId = new Map<string, AgentAction>();
    fresh.forEach((a) => { if (!byId.has(a.id)) byId.set(a.id, a); });
    let changed = false;
    const messages = this.state.messages.map((m) => {
      const action = m.action ? byId.get(m.action.id) ?? m.action : null;
      const stages = m.stages.map((s) => {
        const newer = s.data.kind === "action" ? byId.get(s.data.action.id) : undefined;
        return newer && newer !== (s.data as { action: AgentAction }).action ? { ...s, data: { kind: "action" as const, action: newer } } : s;
      });
      if (action === m.action && stages.every((s, i) => s === m.stages[i])) return m;
      changed = true;
      return { ...m, action, stages };
    });
    if (changed) this.update({ messages });
  }

  // MARK: Memory and loading

  /** The user confirms or corrects a bill's name: saves it, then starts offer research for that kind of bill
   * (without waiting for it), so offers are ready before the user asks. */
  async confirmBill(billId: string, name: string, billType: BillType | null = null): Promise<void> {
    try {
      this.update({ memory: await this.client.confirmBill(this.customerId, billId, name, billType), notice: null });
    } catch (error) {
      this.update({ notice: CoachErrors.sentence(error) });
      return;
    }
    if (billType) await this.client.research(this.customerId, billType, false).catch(() => null);
  }

  /** Switches remembering on or off. Off erases what was stored. */
  async setRemembering(on: boolean): Promise<void> {
    try {
      this.update({ memory: await this.client.setMemoryConsent(this.customerId, on), notice: null });
    } catch (error) {
      this.update({ notice: CoachErrors.sentence(error) });
    }
  }

  /** Forgets one remembered item, or everything when `itemId` is null. */
  async forget(itemId: string | null = null): Promise<void> {
    try {
      this.update({ memory: await this.client.forgetMemory(this.customerId, itemId), notice: null });
    } catch (error) {
      this.update({ notice: CoachErrors.sentence(error) });
    }
  }

  /** Reloads `actions` and `memory` from the server. A failed half keeps what was there. */
  async refresh(): Promise<void> {
    const [list, remembered] = await Promise.all([
      this.client.actions(this.customerId).catch(() => null),
      this.client.memory(this.customerId).catch(() => null),
    ]);
    if (list) {
      if (JSON.stringify(list.actions) !== JSON.stringify(this.state.actions)) this.update({ actions: list.actions });
      this.sync(list.actions);
    }
    if (remembered && JSON.stringify(remembered) !== JSON.stringify(this.state.memory)) this.update({ memory: remembered });
    this.noteFallback();
  }

  /** Call when the app opens: opens the server's connections and learns whether it is in mock mode.
   * Returns null when the server could not be reached. */
  async warm(): Promise<ServerInfo | null> {
    const answer = await this.client.warm().catch(() => null);
    if (!answer) return null;
    this.noteFallback();
    const server = WarmResponse.server(answer);
    if (JSON.stringify(server) !== JSON.stringify(this.state.server)) this.update({ server });
    return server;
  }

  /** `warm()` and `refresh()` together: call it once when the customer's screen opens. */
  async open(): Promise<void> {
    await this.warm();
    await this.refresh();
  }
}

/** Friendly sentences for errors: calm, one next step, no blame. */
export class CoachErrors {
  static readonly generic = "Sisu could not answer just now. Please try again.";
  /** A reply stopped (Stop, or a new question) before any of it arrived. */
  static readonly stopped = ConversationHistory.stoppedReply;
  static readonly offline = "The connection dropped. Please try again.";
  static readonly expired = "Prices may have changed. Ask Sisu to prepare it again.";
  static readonly alreadyDecided = "That has already been decided.";
  static readonly tooMany = "Sisu is getting a lot of questions. Please wait a moment and try again.";
  static readonly unreadable = "Sisu sent an answer the app could not read. Please try again.";
  static readonly unknownCustomer = "We could not find that customer.";

  /** The sentence for an error from `CoachClient` or a `SisuAPI`. A server error shows the server's own sentence
   * when it sent one, except 410 (always `expired`). Without one: 409 `alreadyDecided`, 429 `tooMany`, else `generic`. */
  static sentence(error: unknown): string {
    if (!(error instanceof SisuError)) return isCancellation(error) ? "" : CoachErrors.generic;
    const info = error.info;
    switch (info.kind) {
      case "server":
        if (info.status === 410) return CoachErrors.expired;
        if (info.message !== "") return info.message;
        if (info.status === 409) return CoachErrors.alreadyDecided;
        if (info.status === 429) return CoachErrors.tooMany;
        return CoachErrors.generic;
      case "offline": return CoachErrors.offline;
      case "invalidResponse": return CoachErrors.unreadable;
      case "unknownCustomer": return CoachErrors.unknownCustomer;
      default: return CoachErrors.generic;
    }
  }
}
