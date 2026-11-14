// The money plan: `PlanView` (what the screen shows) and `PlanSession`. Port of SisuCore/PlanSession.swift
// (itself the port of the web hook `usePlan`). The server sends one event per real step; a small "director"
// plays them one after another with a short pause each. It never invents a step. `PlanSession` is a store:
// `subscribe(listener)` + `getSnapshot()` gives `{ view, fallbackNotice }`.
import { SisuError } from "./API";
import { Activity, SisuActivity } from "./Activity";
import { LiitoTask } from "./LiitoTask";
import { CoachClient } from "./CoachClient";
import type { CoachDataLabel } from "./CoachSession";
import { Store } from "./CoachSession";
import { type AgentAction, type BillType, type Offer, ActionStatus } from "./CoachModels";
import type { CalcStep } from "./Models";
import type { MoneyPlan, PlanCheck, PlanEvent, PlanFinding, PlanProjection, PlanScan, PlanTotals } from "./PlanModels";

/** One web page of a search lane. `id` is its url. */
export interface PlanPageState {
  url: string;
  host: string;
  title: string;
  state: "reading" | "read" | "failed";
  /** Offers found on the page. */
  offers: number;
  ageMs: number | null;
  /** `context.dev` or `exa`, once the page has been read. */
  reader: string | null;
}

export interface PlanLaneResult { best: Offer | null; yearlySavingEur: number | null; note: string | null; offersFound: number }

/** One bill being searched: the query, the pages found and read, and what came of it. `id` is the bill type. */
export interface PlanLane { billType: BillType; query: string; pages: PlanPageState[]; result: PlanLaneResult | null }

/** A rule or price outside the account that Exa is researching. `check` is null while it runs. */
export interface PlanCheckLane { id: string; title: string; query: string; check: PlanCheck | null }

export interface PlanCalc { steps: CalcStep[]; totals: PlanTotals }
export interface PlanSummary { text: string; /** `nemotron` or `code`. */ by: string }

/** What the plan screen shows, built from the events played so far. */
export interface PlanView {
  phase: "idle" | "running" | "done" | "error";
  /** The three acts of the stage: the account (`scan`), the web (`web`) and the sums (`sums`). */
  act: "idle" | "scan" | "web" | "sums";
  customerName: string | null;
  model: string | null;
  /** True when the server says the plan is example data: show "Mock data". */
  mock: boolean;
  scan: PlanScan | null;
  /** Habits and notices, in the order found (bills are not listed: a search follows for them). */
  findings: PlanFinding[];
  lanes: PlanLane[];
  checks: PlanCheckLane[];
  /** The totals, always with their split. Null until the sums act. */
  calc: PlanCalc | null;
  actions: AgentAction[];
  projection: PlanProjection | null;
  summary: PlanSummary | null;
  plan: MoneyPlan | null;
  error: string | null;
  approval: "none" | "sending" | "done" | "declined";
  approvalError: string | null;
  /** What Sisu is doing right now: drive the mascot from this. */
  activity: SisuActivity;
  /** What Liito is visibly doing (LiitoTask.nextPlan over the events): mascot mood `LiitoTask.mood(activity, task, false)`. */
  task: LiitoTask | null;
}

/** A change to the view: an event from the server, or something the customer did. */
export type PlanViewChange =
  | { kind: "event"; event: PlanEvent }
  | { kind: "reset" }
  | { kind: "approving" }
  | { kind: "approved"; actions: AgentAction[]; error: string | null }
  | { kind: "declined" };

const clampCount = (value: number) => (Number.isFinite(value) ? Math.trunc(Math.min(Math.max(value, 0), 10_000)) : 0);

function makeView(): PlanView {
  return { phase: "idle", act: "idle", customerName: null, model: null, mock: false, scan: null, findings: [], lanes: [], checks: [],
    calc: null, actions: [], projection: null, summary: null, plan: null, error: null, approval: "none", approvalError: null,
    activity: SisuActivity.idle, task: null };
}

function withLane(lanes: PlanLane[], billType: BillType, change: (lane: PlanLane) => PlanLane): PlanLane[] {
  return lanes.map((lane) => (lane.billType === billType ? change(lane) : lane));
}

function stepEvent(view: PlanView, event: PlanEvent): PlanView {
  switch (event.kind) {
    case "planStart": return { ...view, customerName: event.customerName, model: event.model, mock: event.mock };
    case "scan": return { ...view, act: "scan", scan: event.scan };
    case "finding": return event.finding.role !== "bill" ? { ...view, findings: [...view.findings, event.finding] } : view;
    case "searchStart": return { ...view, act: "web", lanes: [...view.lanes, { billType: event.billType, query: event.query, pages: [], result: null }] };
    case "searchPages":
      return { ...view, lanes: withLane(view.lanes, event.billType, (lane) => ({ ...lane,
        pages: event.pages.map((p) => ({ url: p.url, host: p.host, title: p.title, state: "reading", offers: 0, ageMs: null, reader: null })) })) };
    case "pageRead": {
      const read = event.page;
      return { ...view, lanes: withLane(view.lanes, read.billType, (lane) => ({ ...lane,
        pages: lane.pages.map((page) => (page.url !== read.url ? page
          : { ...page, state: read.ok ? "read" : "failed", offers: clampCount(read.offers), ageMs: read.ageMs ?? null, reader: read.reader })) })) };
    }
    case "offers": {
      const o = event.offers;
      return { ...view, lanes: withLane(view.lanes, o.billType, (lane) => ({ ...lane,
        result: { best: o.best ?? null, yearlySavingEur: o.yearlySavingEur ?? null, note: o.note ?? null, offersFound: clampCount(o.offersFound) } })) };
    }
    case "checkStart": return { ...view, act: "web", checks: [...view.checks, { id: event.id, title: event.title, query: event.query, check: null }] };
    case "checkDone": return { ...view, checks: view.checks.map((lane) => (lane.id === event.check.id ? { ...lane, check: event.check } : lane)) };
    case "calc": return { ...view, act: "sums", calc: { steps: event.steps, totals: event.totals } };
    case "action": return { ...view, actions: [...view.actions, event.action] };
    case "projection": return { ...view, projection: event.projection };
    case "summary": return { ...view, summary: { text: event.text, by: event.by } };
    case "planDone": return { ...view, phase: "done", plan: event.plan, actions: event.plan.actions };
    case "error": return { ...view, phase: "error", error: event.message === "" ? PlanSession.couldNotStart : event.message };
    default: return view;
  }
}

function stepped(view: PlanView, change: PlanViewChange): PlanView {
  switch (change.kind) {
    case "reset": return { ...makeView(), phase: "running" };
    case "approving": return { ...view, approval: "sending", approvalError: null };
    case "approved":
      return { ...view, approval: change.actions.length === 0 ? "none" : "done", approvalError: change.error,
        actions: view.actions.map((action) => change.actions.find((a) => a.id === action.id) ?? action) };
    case "declined": return { ...view, approval: "declined" };
    case "event": return stepEvent(view, change.event);
  }
}

export const PlanView = {
  make: makeView,
  empty: makeView(),
  /** The actions still waiting for approval: what "Approve all" would approve. */
  waitingActions: (view: PlanView): AgentAction[] => view.actions.filter((a) => a.status === ActionStatus.awaitingApproval),

  /** The view after a change. Pure: the same reducer as the web hook. */
  applying(view: PlanView, change: PlanViewChange): PlanView {
    const next = stepped(view, change);
    switch (change.kind) {
      case "reset": return { ...next, activity: SisuActivity.make("thinking", "Opening your account"), task: null };
      case "approving": return next;
      case "approved": {
        if (change.actions.length === 0) return next;
        // A whole plan approved is `proud`; a part of it is `cheering` (the backend's handoff table).
        const whole = change.error === null && PlanView.waitingActions(next).length === 0;
        return { ...next, activity: SisuActivity.posed(SisuActivity.make("approved", `${change.actions.length} approved, as a simulation`), whole ? "proud" : "cheering"), task: null };
      }
      case "declined": return { ...next, activity: SisuActivity.make("declined"), task: null };
      case "event": return { ...next, activity: Activity.nextPlanActivity(view.activity, change.event), task: LiitoTask.nextPlan(view.task, change.event) };
    }
  },
};

export interface PlanSessionState {
  /** Everything the plan screen shows. */
  view: PlanView;
  /** Set once, when a live plan was answered from the bundled sample instead. Show it, then dismiss it. */
  fallbackNotice: string | null;
}

const sleep = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(seconds, 0) * 1000));

/** Runs the money plan for one customer and turns its real events into `view`. Events can arrive in a burst,
 * so they are played one after another with a short pause each (`dwell`); when events pile up the pauses
 * shrink. The pause is injected: tests pass one that returns at once. Nothing here throws. */
export class PlanSession extends Store<PlanSessionState> {
  static readonly couldNotStart = "Sisu could not start. Try again in a moment.";
  static readonly connectionDropped = "The connection to Sisu dropped. Try again.";
  static readonly approvalNotSent = "The approval did not reach Sisu. Nothing was done.";

  private queue: PlanEvent[] = [];
  private player: Promise<void> | null = null;
  private reader: AbortController | null = null;
  private run = 0;
  private announcedFallback = false;

  /** @param pause waits the given number of seconds between two played events. */
  constructor(readonly customerId: string, readonly client: CoachClient, private readonly pause: (seconds: number) => Promise<void> = sleep) {
    super({ view: makeView(), fallbackNotice: null });
  }

  static live(customerId: string, baseURL = "") { return new PlanSession(customerId, CoachClient.live(baseURL)); }
  static sample(customerId: string) { return new PlanSession(customerId, CoachClient.sample(0)); }

  get view(): PlanView { return this.state.view; }

  /** `sample` for the bundled recordings, `mock` when the server said `mock: true`, otherwise `live`. */
  get dataLabel(): CoachDataLabel {
    if (this.client.kind === "bundledSample") return "sample";
    return this.state.view.mock ? "mock" : "live";
  }

  dismissFallbackNotice(): void { this.update({ fallbackNotice: null }); }

  private noteFallback(): void {
    const notice = this.client.fallbackNotice;
    if (this.state.fallbackNotice === null && notice !== null && !this.announcedFallback) {
      this.announcedFallback = true;
      this.update({ fallbackNotice: notice });
    }
  }

  private setView(view: PlanView): void { this.update({ view }); }

  /** Seconds each kind of event stays on screen before the next one plays, as on the web. */
  static dwell(event: PlanEvent): number {
    switch (event.kind) {
      case "scan": return 1.5;
      case "finding": return event.finding.role === "bill" ? 0 : 0.32;
      case "searchStart": case "checkStart": return 0.26;
      case "checkDone": case "offers": return 0.42;
      case "searchPages": return 0.32;
      case "pageRead": return 0.24;
      case "calc": return 2.7;
      default: return 0;
    }
  }

  /** The pause after an event when `queued` more are waiting: full length up to three, 0.7 of it up to eight,
   * 0.45 beyond. The total (`calc`) always gets its full time: it is the moment the run builds to. */
  static pauseAfter(event: PlanEvent, queued: number): number {
    if (event.kind === "calc") return PlanSession.dwell(event);
    const speed = queued > 8 ? 0.45 : queued > 3 ? 0.7 : 1;
    return PlanSession.dwell(event) * speed;
  }

  /** Starts the plan (and stops one that is running). `view` then fills in. The promise ends when the last event
   * has been played. `fresh: false` reuses a recent search instead of searching now. */
  start(language: string | null = null, fresh: boolean | null = null): Promise<void> {
    this.stop();
    this.run += 1;
    const runId = this.run;
    this.setView(PlanView.applying(this.state.view, { kind: "reset" }));
    const controller = new AbortController();
    this.reader = controller;
    const stream = this.client.plan(this.customerId, fresh, language, controller.signal);
    const live = () => this.run === runId && !controller.signal.aborted;
    return (async () => {
      try {
        for await (const event of stream) {
          if (!live()) return;
          this.queue.push(event);
          this.play(runId);
        }
      } catch (error) {
        if (!live()) return;
        const sentence = error instanceof SisuError && error.info.kind === "server"
          ? (error.info.message === "" ? PlanSession.couldNotStart : error.info.message)
          : PlanSession.connectionDropped;
        this.queue.push({ kind: "error", message: sentence });
        this.play(runId);
      }
      if (this.player) await this.player;
      // A stream that ended without `plan_done` or `error` was cut off: say so instead of running forever.
      if (this.run === runId && this.state.view.phase === "running") {
        this.setView(PlanView.applying(this.state.view, { kind: "event", event: { kind: "error", message: PlanSession.connectionDropped } }));
      }
    })();
  }

  private play(runId: number): void {
    if (this.player) return;
    this.player = this.playLoop(runId);
  }

  private async playLoop(runId: number): Promise<void> {
    await Promise.resolve(); // like a Swift Task, start after `player` is set
    while (this.run === runId && this.queue.length > 0) {
      const event = this.queue.shift() as PlanEvent;
      this.setView(PlanView.applying(this.state.view, { kind: "event", event }));
      this.noteFallback();
      const wait = PlanSession.pauseAfter(event, this.queue.length);
      if (wait > 0) await this.pause(wait);
    }
    if (this.run === runId) this.player = null;
  }

  private stop(): void {
    this.run += 1;
    this.reader?.abort();
    this.reader = null;
    this.player = null;
    this.queue = [];
  }

  /** Stops a running plan. What has been shown stays on screen. */
  cancel(): void {
    this.stop();
    if (this.state.view.phase === "running") this.setView({ ...this.state.view, phase: "idle", activity: SisuActivity.idle, task: null });
  }

  /** Stops and clears everything. */
  reset(): void {
    this.stop();
    this.setView(makeView());
  }

  /** One tap approves everything the plan set up and is still waiting. Returns the approved actions; what could
   * not be approved is a sentence in `view.approvalError`. */
  async approveAll(): Promise<AgentAction[]> {
    const ids = PlanView.waitingActions(this.state.view).map((a) => a.id);
    if (ids.length === 0) return [];
    this.setView(PlanView.applying(this.state.view, { kind: "approving" }));
    try {
      const result = await this.client.approveAll(this.customerId, ids.slice(0, 6));
      const failed = result.failed[0] ? `${result.failed.length} could not be approved: ${result.failed[0].reason}` : null;
      this.setView(PlanView.applying(this.state.view, { kind: "approved", actions: result.approved, error: failed }));
      return result.approved;
    } catch (error) {
      const sentence = error instanceof SisuError && error.info.kind === "server" && error.info.message !== "" ? error.info.message : PlanSession.approvalNotSent;
      this.setView(PlanView.applying(this.state.view, { kind: "approved", actions: [], error: sentence }));
      return [];
    }
  }

  /** The customer said "not now": nothing is sent, the actions simply stay waiting until they expire. */
  decline(): void {
    this.setView(PlanView.applying(this.state.view, { kind: "declined" }));
  }
}
