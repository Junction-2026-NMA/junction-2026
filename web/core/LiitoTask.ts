// What Liito is visibly doing: one of the six task animations of the Rive mascot (listening, writing, searching,
// calculating, comparing, presenting), driven by the agent's real events, never by a timer. A web addition (no
// Swift counterpart yet): SisuActivity says what Sisu is doing in words; the task says which prop Liito holds.
//
//   task = LiitoTask.next(task, event)          for every SisuEvent of a turn (CoachSession keeps it)
//   task = LiitoTask.nextPlan(task, event)      for every PlanEvent of the money plan (PlanSession keeps it)
//   mood = LiitoTask.mood(activity, task, rec)  the Rive LiitoMood to show (pass { speaking } when known)
//   mood = LiitoTask.answering(mood, facts)     Talk while Sisu answers: the presenter's mood, corrected
//
// Which events count. Live signals set the task: a tool starting (`toolStart`), the early web search
// (`speculation`), offers in hand (`research`), a chart (`visual`), a teaching card, the answer's words (`delta`).
// Stage records describe work already done and arrive in a burst after a tool's result (research, extraction and
// calculation records all within a few milliseconds), so they may only move the task forward along
// searching → calculating → comparing → presenting / writing, never back. A spoken `sentence` is not a task: the
// server sends sentences in silent typed turns too; Liito presents when Sisu really speaks (the session's
// speaking flag) or shows a chart.
import { SisuActivity, type LiitoMood } from "./Activity";
import type { SisuEvent } from "./CoachModels";
import type { PlanEvent } from "./PlanModels";

/** The task moods of the Rive `LiitoMood` enum (the last six values). */
export type LiitoTask = "listening" | "writing" | "searching" | "calculating" | "comparing" | "presenting";

const toolTasks: Record<string, LiitoTask> = {
  // Looking through the customer's own transactions.
  get_spending: "searching", list_bills: "searching", get_cash_flow: "searching", find_patterns: "searching", get_mortgage: "searching",
  // Looking on the web (Exa).
  search_offers: "searching", web_search: "searching", search_prices: "searching", search_flats: "searching",
  // The sums, all done in code on the server.
  check_affordability: "calculating", run_scenario: "calculating", calculate: "calculating",
  // Explaining a concept. (`show_chart` sets nothing: the chart's own `visual` event says whether it compares.)
  explain_concept: "presenting",
  // Writing something down: the switch form, a memory.
  prepare_action: "writing", remember: "writing",
};

/** What a stage record of finished work points at. Other stages (lead, evidence, teaching, action, memory) keep
 *  the task: a lead with no task yet lets the backend's "found something" pose show. */
const stageTasks: Record<string, LiitoTask> = { research: "searching", extraction: "searching", calculation: "calculating", impact: "presenting" };

/** The order of the work in a turn. A stage record moves the task only to a later step. */
const rank: Record<LiitoTask, number> = { listening: 0, searching: 1, calculating: 2, comparing: 3, presenting: 4, writing: 4 };

/** Real work on the server: shown even while Sisu says a filler sentence ("Let me check today's offers"). */
const work: ReadonlySet<LiitoTask> = new Set<LiitoTask>(["searching", "calculating", "comparing"]);

/** Moods the Talk presenter decides by itself (approval moments, a find, listening): kept as they are. */
const presenterOwn: ReadonlySet<LiitoMood> = new Set<LiitoMood>(["found", "cheering", "cosy", "proud", "listening"]);

function forward(current: LiitoTask | null, next: LiitoTask): LiitoTask {
  return current === null || rank[next] > rank[current] ? next : current;
}

export const LiitoTask = {
  allCases: ["listening", "writing", "searching", "calculating", "comparing", "presenting"] as readonly LiitoTask[],

  /** The task a running tool gives Liito. An unknown tool keeps the current task (null: unchanged). */
  forTool(name: string): LiitoTask | null {
    return toolTasks[name] ?? null;
  },

  /** True for searching, calculating and comparing: work that is shown even while a filler sentence is said. */
  isWork(task: LiitoTask | null): boolean {
    return task !== null && work.has(task);
  },

  /** One event of a turn. */
  next(task: LiitoTask | null, event: SisuEvent): LiitoTask | null {
    switch (event.kind) {
      case "start": case "transcript": return null;
      // The server starts a web search before the model asks for it.
      case "speculation": return "searching";
      case "toolStart": return LiitoTask.forTool(event.name) ?? task;
      case "stage": {
        const next = stageTasks[String(event.stage.kind)];
        return next ? forward(task, next) : task;
      }
      case "research": return "comparing";
      case "visual": return event.visual.kind === "offer_bars" || event.visual.kind === "peer_bars" ? "comparing" : "presenting";
      case "teaching": return "presenting";
      case "delta": return "writing";
      case "action": return null;
      // The turn's end clears the task (CoachSession resets it with isThinking). Keeping it until then avoids a
      // one-render flash between the last event and the end of the turn.
      case "done": case "error": return task;
      // sentence, filler, toolEnd, grounding, memory, replace: not a task of their own.
      default: return task;
    }
  },

  /** One event of the money plan. */
  nextPlan(task: LiitoTask | null, event: PlanEvent): LiitoTask | null {
    switch (event.kind) {
      case "scan": case "searchStart": case "searchPages": case "pageRead": case "checkStart": return "searching";
      case "offers": return "comparing";
      case "calc": return "calculating";
      case "action": return "writing";
      case "planDone": return "presenting";
      case "error": return null;
      default: return task;
    }
  },

  /**
   * The Rive mood for what Sisu is doing.
   * @param activity CoachSession.activity (or PlanView.activity).
   * @param task the task the events gave, or null.
   * @param recording the microphone is open.
   * @param now `speaking`: Sisu's voice is playing right now (CoachSession's isSpeaking). Without it, a speaking
   *   activity with no task counts as speaking (the turn is over and the answer is being said).
   */
  mood(activity: SisuActivity, task: LiitoTask | null, recording: boolean, now?: { speaking?: boolean }): LiitoMood {
    if (recording) return "listening";
    switch (activity.state) {
      case "waiting_for_approval": case "approved": case "declined": case "error":
        return SisuActivity.mood(activity);
      case "idle": return "idle";
      case "listening": return "listening";
      default: break;
    }
    const speaking = now?.speaking ?? (activity.state === "speaking" && task === null);
    // Real work beats a filler sentence said over it.
    if (task !== null && work.has(task)) return task;
    if (speaking) return "presenting";
    if (task !== null) return task;
    if (activity.state === "speaking") return now?.speaking === false ? "writing" : "presenting";
    return SisuActivity.mood(activity);
  },

  /**
   * Talk while Sisu answers (the conversation's thinking and speaking phases): the presenter's mood, corrected with
   * what the session really does. Real work beats a filler sentence; once Sisu has started saying the answer it
   * stays presenting through the pauses between sentences; an answer that is complete and waits for its speech is
   * presented, not thought about. Approval moments and the presenter's own moods are kept.
   */
  answering(presenterMood: LiitoMood, facts: {
    /** The conversation's phase: speaking while Sisu's voice plays. */
    phase: "thinking" | "speaking";
    /** The session is still working on the turn (isThinking). */
    working: boolean;
    task: LiitoTask | null;
    /** Sisu has already said part of this answer (not counting a filler said over real work). */
    spoke: boolean;
    /** The session worked on this answer at some point (so a finished turn is this answer's, not the last one's). */
    workedThisAnswer: boolean;
  }): LiitoMood {
    if (presenterOwn.has(presenterMood)) return presenterMood;
    if (facts.working && LiitoTask.isWork(facts.task)) return facts.task as LiitoTask;
    if (facts.phase === "speaking" || facts.spoke) return "presenting";
    if (!facts.working && facts.workedThisAnswer) return "presenting";
    return presenterMood;
  },
} as const;
