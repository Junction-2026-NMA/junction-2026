// What Sisu is doing right now, as one value. Made for a mascot: the frontend maps `liito` to an animation and
// shows `label` beside it, so Liito is seen doing the thing the agent is really doing at that moment.
// Safe to import in the browser. Every state here is driven by a real event from the agent; none is on a timer.
import type { LiitoPose, PlanEvent, SisuActivity, SisuActivityState, SisuEvent } from "@/lib/types";

// The pose for each state, from the eight poses in the brand kit (brand/08-liito-character-spec.md).
export const LIITO_POSE: Record<SisuActivityState, LiitoPose> = {
  idle: "sleepy",
  listening: "curious",
  thinking: "curious",
  reading_account: "focused",
  searching_web: "gliding",
  reading_pages: "focused",
  calculating: "focused",
  found_something: "found-something",
  setting_up: "focused",
  waiting_for_approval: "found-something",
  speaking: "curious",
  approved: "cheering",
  declined: "cosy",
  error: "cosy",
};

const DEFAULT_LABEL: Record<SisuActivityState, string> = {
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

export const activity = (state: SisuActivityState, label?: string | null, detail: string | null = null): SisuActivity => ({ state, liito: LIITO_POSE[state], label: label || DEFAULT_LABEL[state], detail });
export const IDLE = activity("idle");

const TOOL_STATE: Record<string, SisuActivityState> = {
  get_spending: "reading_account",
  list_bills: "reading_account",
  get_cash_flow: "reading_account",
  find_patterns: "reading_account",
  check_affordability: "calculating",
  get_mortgage: "reading_account",
  show_chart: "reading_account",
  run_scenario: "calculating",
  calculate: "calculating",
  search_offers: "searching_web",
  web_search: "searching_web",
  prepare_action: "setting_up",
  explain_concept: "thinking",
  remember: "thinking",
};

// One turn of conversation: feed every event from the agent's stream through this.
export function nextActivity(current: SisuActivity, event: SisuEvent): SisuActivity {
  switch (event.type) {
    case "start":
    case "transcript":
      return activity("thinking");
    case "tool_start":
      return activity(TOOL_STATE[event.name] ?? "thinking", event.label);
    case "stage":
      if (event.stage.kind === "extraction") return activity("reading_pages", event.stage.summary);
      if (event.stage.kind === "lead") return activity("found_something", event.stage.summary);
      if (event.stage.kind === "calculation") return activity("calculating", event.stage.title, event.stage.summary);
      return current;
    case "research":
      return event.result.best ? activity("found_something", `Best offer: ${event.result.best.provider}`) : current;
    case "action":
      return activity("waiting_for_approval", event.action.title, event.action.warning ?? null);
    case "sentence":
      return current.state === "waiting_for_approval" ? current : activity("speaking");
    case "error":
      return activity("error", event.message);
    default:
      return current;
  }
}

// The money plan (POST /api/agent/plan): feed every PlanEvent through this.
export function nextPlanActivity(current: SisuActivity, event: PlanEvent): SisuActivity {
  switch (event.type) {
    case "plan_start":
      return activity("thinking", "Opening your account");
    case "scan":
      return activity("reading_account", `Reading ${event.transactions} transactions`, `${event.months} months`);
    case "finding":
      return event.role === "bill" ? current : activity("found_something", event.title);
    case "search_start":
      return activity("searching_web", "Searching the web with Exa", event.query);
    case "check_start":
      return activity("searching_web", "Researching what is worth checking", event.title);
    case "check_done":
      return event.check.finding ? activity("found_something", event.check.title) : current;
    case "search_pages":
    case "page_read":
      return activity("reading_pages", event.type === "page_read" && event.reader === "exa" ? "Reading the pages with Exa" : "Reading the pages with Context.dev", event.type === "page_read" ? event.host : null);
    case "offers":
      return event.best && !event.note ? activity("found_something", `Best ${event.billType} offer: ${event.best.provider}`) : current;
    case "calc":
      return activity("calculating", "Adding it up");
    case "action":
      return activity("setting_up", event.action.title);
    case "plan_done":
      return event.plan.actions.length ? activity("waiting_for_approval", `${event.plan.actions.length} ${event.plan.actions.length === 1 ? "thing" : "things"} set up`) : activity("speaking");
    case "error":
      return activity("error", event.message);
    default:
      return current;
  }
}
