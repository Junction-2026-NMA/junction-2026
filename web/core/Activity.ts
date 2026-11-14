// What Sisu is doing right now, as one value, for the mascot and a status line. Port of SisuCore/Activity.swift
// (itself a port of lib/agent/activity.ts): every state is driven by a real event, never by a timer.
import type { SisuEvent } from "./CoachModels";
import type { PlanEvent } from "./PlanModels";

/** The Rive moods of the Liito mascot (`RiveBindings.LiitoMood` in RiveContract.swift). Kept here as a string
 * union so this file does not depend on the Rive contract port; the values are the contract's enum cases. */
export type LiitoMood = "idle" | "cheering" | "proud" | "gliding" | "curious" | "found" | "focused" | "cosy" | "sleepy" | "thinking"
  | "listening" | "writing" | "searching" | "calculating" | "comparing" | "presenting";

/** The eight poses of the brand kit, as the backend names them. */
export type LiitoPose = "sleepy" | "curious" | "focused" | "gliding" | "found-something" | "cheering" | "proud" | "cosy";
export const LiitoPose = {
  sleepy: "sleepy", curious: "curious", focused: "focused", gliding: "gliding", foundSomething: "found-something",
  cheering: "cheering", proud: "proud", cosy: "cosy",
  allCases: ["sleepy", "curious", "focused", "gliding", "found-something", "cheering", "proud", "cosy"] as readonly LiitoPose[],
  /** The Rive mood for the pose (`found-something` is `found`). */
  mood: (pose: LiitoPose): LiitoMood => (pose === "found-something" ? "found" : pose),
} as const;

/** The state's raw values are the backend's. */
export type SisuActivityState =
  | "idle" | "listening" | "thinking" | "reading_account" | "searching_web" | "reading_pages" | "calculating"
  | "found_something" | "setting_up" | "waiting_for_approval" | "speaking" | "approved" | "declined" | "error";

const poses: Record<SisuActivityState, LiitoPose> = {
  idle: "sleepy", listening: "curious", thinking: "curious", speaking: "curious",
  reading_account: "focused", reading_pages: "focused", calculating: "focused", setting_up: "focused",
  searching_web: "gliding", found_something: "found-something", waiting_for_approval: "found-something",
  approved: "cheering", declined: "cosy", error: "cosy",
};

const defaultLabels: Record<SisuActivityState, string> = {
  idle: "Ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  reading_account: "Reading your account",
  searching_web: "Searching the web",
  reading_pages: "Reading the pages",
  calculating: "Doing the sums",
  found_something: "Found something",
  setting_up: "Setting it up for you",
  waiting_for_approval: "Waiting for your approval",
  speaking: "Telling you what I found",
  approved: "Done",
  declined: "Left as it was",
  error: "Something went wrong",
};

export const SisuActivityState = {
  idle: "idle", listening: "listening", thinking: "thinking", readingAccount: "reading_account", searchingWeb: "searching_web",
  readingPages: "reading_pages", calculating: "calculating", foundSomething: "found_something", settingUp: "setting_up",
  waitingForApproval: "waiting_for_approval", speaking: "speaking", approved: "approved", declined: "declined", error: "error",
  allCases: Object.keys(poses) as readonly SisuActivityState[],
  /** The mascot's pose for the state (the table in the backend's frontend handoff). */
  pose: (state: SisuActivityState): LiitoPose => poses[state],
  /** The caption used when the event gives none. */
  defaultLabel: (state: SisuActivityState): string => defaultLabels[state],
} as const;

/** What Sisu is doing right now. Change the mascot only when `state` changes, and show `label` beside it. */
export interface SisuActivity {
  state: SisuActivityState;
  /** The pose the mascot should be in. */
  liito: LiitoPose;
  /** Plain words for a caption: `Searching the web with Exa`. */
  label: string;
  /** For example the search query, the page being read, or an action's warning. */
  detail: string | null;
}

/** An activity with the state's own pose. A null or empty label gives the state's default caption. */
function makeActivity(state: SisuActivityState, label?: string | null, detail?: string | null): SisuActivity {
  return { state, liito: poses[state], label: label ? label : defaultLabels[state], detail: detail ?? null };
}

export const SisuActivity = {
  make: makeActivity,
  idle: makeActivity("idle"),
  /** The Rive mood to show: the pose's mood, except that `thinking` shows `thinking` (the bouncing dots). */
  mood: (a: SisuActivity): LiitoMood => (a.state === "thinking" ? "thinking" : LiitoPose.mood(a.liito)),
  /** The same activity in another pose (a whole plan approved is `proud` instead of `cheering`). */
  posed: (a: SisuActivity, pose: LiitoPose): SisuActivity => ({ ...a, liito: pose }),
  equals: (a: SisuActivity, b: SisuActivity): boolean =>
    a.state === b.state && a.liito === b.liito && a.label === b.label && a.detail === b.detail,
} as const;

export class Activity {
  /** The state a running tool puts Sisu in. An unknown tool is `thinking`. */
  static stateForTool(name: string): SisuActivityState {
    switch (name) {
      case "get_spending": case "list_bills": case "get_cash_flow": case "find_patterns": case "get_mortgage": case "show_chart":
        return "reading_account";
      case "check_affordability": case "run_scenario": case "calculate": return "calculating";
      case "search_offers": case "web_search": return "searching_web";
      case "prepare_action": return "setting_up";
      default: return "thinking";
    }
  }

  /** One turn of conversation: feed every event of the agent's stream through this. */
  static nextActivity(current: SisuActivity, event: SisuEvent): SisuActivity {
    const make = makeActivity;
    switch (event.kind) {
      case "start": case "transcript": return make("thinking");
      case "toolStart": return make(Activity.stateForTool(event.name), event.label);
      case "stage": {
        const stage = event.stage;
        if (stage.kind === "extraction") return make("reading_pages", stage.summary);
        if (stage.kind === "lead") return make("found_something", stage.summary);
        if (stage.kind === "calculation") return make("calculating", stage.title, stage.summary);
        return current;
      }
      case "research": {
        const best = event.result.best;
        return best ? make("found_something", `Best offer: ${best.provider}`) : current;
      }
      case "action": return make("waiting_for_approval", event.action.title, event.action.warning);
      case "sentence": return current.state === "waiting_for_approval" ? current : make("speaking");
      case "error": return make("error", event.message);
      default: return current;
    }
  }

  /** The money plan: feed every `PlanEvent` through this. */
  static nextPlanActivity(current: SisuActivity, event: PlanEvent): SisuActivity {
    const make = makeActivity;
    switch (event.kind) {
      case "planStart": return make("thinking", "Opening your account");
      case "scan": return make("reading_account", `Reading ${event.scan.transactions} transactions`, `${event.scan.months} months`);
      case "finding": return event.finding.role === "bill" ? current : make("found_something", event.finding.title);
      case "searchStart": return make("searching_web", "Searching the web with Exa", event.query);
      case "checkStart": return make("searching_web", "Researching what is worth checking", event.title);
      case "checkDone": return event.check.finding ? make("found_something", event.check.title) : current;
      case "searchPages": return make("reading_pages", "Reading the pages with Context.dev");
      case "pageRead":
        return make("reading_pages", event.page.reader === "exa" ? "Reading the pages with Exa" : "Reading the pages with Context.dev", event.page.host);
      case "offers": {
        const { best, note, billType } = event.offers;
        if (!best || (note != null && note !== "")) return current;
        return make("found_something", `Best ${billType} offer: ${best.provider}`);
      }
      case "calc": return make("calculating", "Adding it up");
      case "action": return make("setting_up", event.action.title);
      case "planDone": {
        const count = event.plan.actions.length;
        return count > 0 ? make("waiting_for_approval", `${count} ${count === 1 ? "thing" : "things"} set up`) : make("speaking");
      }
      case "error": return make("error", event.message);
      default: return current;
    }
  }
}
