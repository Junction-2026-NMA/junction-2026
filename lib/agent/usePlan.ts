"use client";

// Runs the money plan and turns its real events into what the screen shows.
// The server sends an event for each real step (scan, each search, each page read, each sum). Events can arrive
// in a burst, so a small "director" plays them one after another with a short pause each, fast enough to feel
// quick and slow enough to follow. It never invents a step: everything shown came from the server.
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { AgentAction, BillType, CalcStep, MoneyPlan, Offer, PlanCheck, PlanEvent, PlanProjection, SisuActivity } from "@/lib/types";
import { IDLE, activity, nextPlanActivity } from "./activity";

export type Act = "idle" | "scan" | "web" | "sums";
export type PageState = { url: string; host: string; title: string; state: "reading" | "read" | "failed"; offers: number; ageMs: number | null; reader: "context.dev" | "exa" | null };
export type CheckLane = { id: string; title: string; query: string; check: PlanCheck | null };
export type Lane = {
  billType: BillType;
  query: string;
  pages: PageState[];
  result: null | { best: Offer | null; yearlySavingEur: number | null; note: string | null; offersFound: number };
};
export type Finding = { id: string; role: "habit" | "bill" | "notice"; title: string; detail: string; yearlyEur: number | null };
type Scan = Extract<PlanEvent, { type: "scan" }>;

export type PlanView = {
  phase: "idle" | "running" | "done" | "error";
  act: Act;
  customerName: string | null;
  model: string | null;
  mock: boolean;
  scan: Scan | null;
  findings: Finding[];
  lanes: Lane[];
  checks: CheckLane[]; // rules and prices outside the account that Exa is researching
  calc: { steps: CalcStep[]; totalYearlyEur: number; effortlessYearlyEur: number; checkPlanYearlyEur: number } | null;
  actions: AgentAction[];
  projection: PlanProjection | null;
  summary: { text: string; by: "nemotron" | "code" } | null;
  plan: MoneyPlan | null;
  error: string | null;
  approval: "none" | "sending" | "done" | "declined";
  approvalError: string | null;
  activity: SisuActivity; // what Sisu is doing right now: drive the mascot from this
};

const EMPTY: PlanView = { phase: "idle", act: "idle", customerName: null, model: null, mock: false, scan: null, findings: [], lanes: [], checks: [], calc: null, actions: [], projection: null, summary: null, plan: null, error: null, approval: "none", approvalError: null, activity: IDLE };

type Change = PlanEvent | { type: "reset" } | { type: "approving" } | { type: "approved"; actions: AgentAction[]; error: string | null } | { type: "declined" };

const withLane = (lanes: Lane[], billType: BillType, change: (lane: Lane) => Lane): Lane[] => lanes.map((lane) => (lane.billType === billType ? change(lane) : lane));

function reduce(view: PlanView, event: Change): PlanView {
  const next = step(view, event);
  if (event.type === "reset") return { ...next, activity: activity("thinking", "Opening your account") };
  if (event.type === "approving") return next;
  if (event.type === "approved") return { ...next, activity: event.actions.length ? activity("approved", `${event.actions.length} approved, as a simulation`) : next.activity };
  if (event.type === "declined") return { ...next, activity: activity("declined") };
  return { ...next, activity: nextPlanActivity(view.activity, event) };
}

function step(view: PlanView, event: Change): PlanView {
  switch (event.type) {
    case "reset":
      return { ...EMPTY, phase: "running" };
    case "plan_start":
      return { ...view, customerName: event.customerName, model: event.model, mock: event.mock };
    case "scan":
      return { ...view, act: "scan", scan: event };
    case "finding":
      return event.role === "bill" ? view : { ...view, findings: [...view.findings, event] };
    case "search_start":
      return { ...view, act: "web", lanes: [...view.lanes, { billType: event.billType, query: event.query, pages: [], result: null }] };
    case "search_pages":
      return { ...view, lanes: withLane(view.lanes, event.billType, (lane) => ({ ...lane, pages: event.pages.map((page) => ({ ...page, state: "reading", offers: 0, ageMs: null, reader: null })) })) };
    case "page_read":
      return {
        ...view,
        lanes: withLane(view.lanes, event.billType, (lane) => ({
          ...lane,
          pages: lane.pages.map((page) => (page.url === event.url ? { ...page, state: event.ok ? "read" : "failed", offers: event.offers, ageMs: event.ageMs, reader: event.reader } : page)),
        })),
      };
    case "offers":
      return { ...view, lanes: withLane(view.lanes, event.billType, (lane) => ({ ...lane, result: { best: event.best, yearlySavingEur: event.yearlySavingEur, note: event.note, offersFound: event.offersFound } })) };
    case "check_start":
      return { ...view, act: "web", checks: [...view.checks, { id: event.id, title: event.title, query: event.query, check: null }] };
    case "check_done":
      return { ...view, checks: view.checks.map((lane) => (lane.id === event.check.id ? { ...lane, check: event.check } : lane)) };
    case "calc":
      return { ...view, act: "sums", calc: event };
    case "action":
      return { ...view, actions: [...view.actions, event.action] };
    case "projection":
      return { ...view, projection: event.projection };
    case "summary":
      return { ...view, summary: { text: event.text, by: event.by } };
    case "plan_done":
      return { ...view, phase: "done", plan: event.plan, actions: event.plan.actions };
    case "error":
      return { ...view, phase: "error", error: event.message };
    case "approving":
      return { ...view, approval: "sending", approvalError: null };
    case "approved":
      return { ...view, approval: event.actions.length ? "done" : "none", approvalError: event.error, actions: view.actions.map((action) => event.actions.find((done) => done.id === action.id) ?? action) };
    case "declined":
      return { ...view, approval: "declined" };
  }
}

// How long each step stays on screen before the next one plays, in milliseconds.
const DWELL: Record<PlanEvent["type"], number> = { plan_start: 0, scan: 1500, finding: 320, search_start: 260, check_start: 260, check_done: 420, search_pages: 320, page_read: 240, offers: 420, calc: 2700, action: 0, projection: 0, summary: 0, plan_done: 0, error: 0 };
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function usePlan() {
  const [view, dispatch] = useReducer(reduce, EMPTY);
  const queue = useRef<PlanEvent[]>([]);
  const playing = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const run = useRef(0);

  const play = useCallback(async (runId: number) => {
    if (playing.current) return;
    playing.current = true;
    while (queue.current.length && run.current === runId) {
      const event = queue.current.shift() as PlanEvent;
      dispatch(event);
      // When events have piled up, play faster, so the screen never lags far behind the real work.
      const speed = queue.current.length > 8 ? 0.45 : queue.current.length > 3 ? 0.7 : 1;
      // The total is the moment the whole run builds to, so it always gets its full time.
      const wait = event.type === "finding" && event.role === "bill" ? 0 : event.type === "calc" ? DWELL.calc : DWELL[event.type] * speed;
      if (wait) await pause(wait);
    }
    playing.current = false;
  }, []);

  const start = useCallback(
    async (customerId: string, language?: string) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      const runId = ++run.current;
      queue.current = [];
      playing.current = false;
      dispatch({ type: "reset" });
      try {
        const response = await fetch("/api/agent/plan", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, language }) });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          dispatch({ type: "error", message: body?.error ?? "Sisu could not start. Try again in a moment." });
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";
          for (const message of messages) if (message.startsWith("data: ")) queue.current.push(JSON.parse(message.slice(6)) as PlanEvent);
          void play(runId);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") dispatch({ type: "error", message: "The connection to Sisu dropped. Try again." });
      }
    },
    [play],
  );

  const approveAll = useCallback(async (customerId: string, actionIds: string[]) => {
    dispatch({ type: "approving" });
    try {
      const response = await fetch("/api/actions/approve-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, actionIds, confirm: true }) });
      const body = (await response.json().catch(() => null)) as { approved?: AgentAction[]; failed?: { reason: string }[]; error?: string } | null;
      const failed = body?.failed?.length ? `${body.failed.length} could not be approved: ${body.failed[0].reason}` : null;
      dispatch({ type: "approved", actions: body?.approved ?? [], error: body?.error ?? failed });
    } catch {
      dispatch({ type: "approved", actions: [], error: "The approval did not reach Sisu. Nothing was done." });
    }
  }, []);

  const decline = useCallback(() => dispatch({ type: "declined" }), []);

  useEffect(() => () => abort.current?.abort(), []);

  return { view, start, approveAll, decline };
}
