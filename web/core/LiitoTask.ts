// What Liito is visibly doing: one of the six task animations of the Rive mascot (listening, writing, searching,
// calculating, comparing, presenting), driven by the agent's real events, never by a timer. A web addition (no
// Swift counterpart yet): SisuActivity says what Sisu is doing in words; the task says which prop Liito holds.
//
//   task = LiitoTask.next(task, event)          for every SisuEvent of a turn (CoachSession keeps it)
//   task = LiitoTask.nextPlan(task, event)      for every PlanEvent of the money plan (PlanSession keeps it)
//   mood = LiitoTask.mood(activity, task, rec)  the Rive LiitoMood to show
import { SisuActivity, type LiitoMood } from "./Activity";
import type { SisuEvent } from "./CoachModels";
import type { PlanEvent } from "./PlanModels";

/** The task moods of the Rive `LiitoMood` enum (the last six values). */
export type LiitoTask = "listening" | "writing" | "searching" | "calculating" | "comparing" | "presenting";

const toolTasks: Record<string, LiitoTask> = {
  // Looking through the customer's own transactions.
  get_spending: "searching", list_bills: "searching", get_cash_flow: "searching", find_patterns: "searching", get_mortgage: "searching",
  // Looking on the web (Exa).
  search_offers: "searching", web_search: "searching",
  // The sums, all done in code on the server.
  check_affordability: "calculating", run_scenario: "calculating", calculate: "calculating",
  // Showing something: a chart or a concept.
  show_chart: "presenting", explain_concept: "presenting",
  // Writing something down: the switch form, a memory.
  prepare_action: "writing", remember: "writing",
};

export const LiitoTask = {
  allCases: ["listening", "writing", "searching", "calculating", "comparing", "presenting"] as readonly LiitoTask[],

  /** The task a running tool gives Liito. An unknown tool keeps the current task (null: unchanged). */
  forTool(name: string): LiitoTask | null {
    return toolTasks[name] ?? null;
  },

  /** One event of a turn. */
  next(task: LiitoTask | null, event: SisuEvent): LiitoTask | null {
    switch (event.kind) {
      case "start": case "transcript": return null;
      case "toolStart": return LiitoTask.forTool(event.name) ?? task;
      case "stage": {
        const kind = String(event.stage.kind);
        if (kind === "extraction" || kind === "research") return "searching";
        if (kind === "calculation") return "calculating";
        if (kind === "impact") return "presenting";
        if (kind === "lead") return null;
        return task;
      }
      case "research": return "comparing";
      case "visual": return event.visual.kind === "offer_bars" || event.visual.kind === "peer_bars" ? "comparing" : "presenting";
      // Once Sisu has started saying the answer, more words of it do not send Liito back to the notepad, so the
      // spoken turn (deltas and sentences interleaved) shows one steady "presenting" instead of a flicker.
      case "delta": return task === "presenting" ? task : "writing";
      case "sentence": return "presenting";
      case "action": return null;
      case "done": case "error": return null;
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
   */
  mood(activity: SisuActivity, task: LiitoTask | null, recording: boolean): LiitoMood {
    if (recording) return "listening";
    switch (activity.state) {
      case "waiting_for_approval": case "approved": case "declined": case "error": case "idle":
        return SisuActivity.mood(activity);
      case "listening": return "listening";
      case "speaking": return "presenting";
      default: return task ?? SisuActivity.mood(activity);
    }
  },
} as const;
