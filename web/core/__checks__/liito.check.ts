// Checks for Liito's task moods: which events set which task (web/core/LiitoTask.ts), which mood shows, and the
// sequencer that keeps each real task on screen long enough to read (web/core/MoodSequencer.ts). The LiitoTask
// groups were in conversation.check.ts first; they moved here with the 14 Nov animation fixes.
// Run: npx tsx web/core/__checks__/liito.check.ts
import { SisuActivity, type LiitoMood } from "@/web/core/Activity";
import { LiitoTask } from "@/web/core/LiitoTask";
import { MoodSequencer } from "@/web/core/MoodSequencer";
import type { SisuEvent } from "@/web/core/CoachModels";
import type { PlanEvent } from "@/web/core/PlanModels";

// MARK: - A tiny harness

let failures = 0, passes = 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function eq(actual: unknown, expected: unknown, label: string): void {
  if (same(actual, expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
const ok = (value: boolean, label: string) => eq(value, true, label);
function group(name: string, body: () => void): void {
  const before = failures;
  try { body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

const ev = (event: object) => event as SisuEvent;
const plan = (event: object) => event as PlanEvent;
const stage = (kind: string) => ev({ kind: "stage", stage: { kind } });

/** Runs events from a starting task; returns the task after each. */
function tasks(start: LiitoTask | null, events: SisuEvent[]): (LiitoTask | null)[] {
  let task = start;
  return events.map((event) => (task = LiitoTask.next(task, event)));
}

// MARK: - Events to tasks

group("task: follows the agent's live events", () => {
  const steps: [SisuEvent, string | null][] = [
    [ev({ kind: "start", turnId: "t", provider: "mock", model: "m", mock: true }), null],
    [ev({ kind: "toolStart", id: "1", name: "get_spending", args: null, label: "Reading your spending" }), "searching"],
    [ev({ kind: "toolStart", id: "2", name: "check_affordability", args: null, label: null }), "calculating"],
    [ev({ kind: "toolStart", id: "3", name: "mystery_tool", args: null, label: null }), "calculating"],
    [ev({ kind: "toolStart", id: "4", name: "search_offers", args: null, label: null }), "searching"],
    [ev({ kind: "research", result: { offers: [], best: null } }), "comparing"],
    [ev({ kind: "visual", visual: { id: "v", kind: "budget_donut" } }), "presenting"],
    [ev({ kind: "visual", visual: { id: "w", kind: "offer_bars" } }), "comparing"],
    [ev({ kind: "toolStart", id: "5", name: "prepare_action", args: null, label: null }), "writing"],
    [ev({ kind: "action", action: {} }), null],
    [ev({ kind: "delta", text: "You" }), "writing"],
    [ev({ kind: "sentence", index: 0, text: "You spend…" }), "writing"],
    [ev({ kind: "delta", text: " more" }), "writing"],
    [ev({ kind: "done", text: "x", citations: [], timings: null }), "writing"],
  ];
  let task: LiitoTask | null = "listening";
  steps.forEach(([event, expected], index) => {
    task = LiitoTask.next(task, event);
    eq(task, expected, `step ${index} ${event.kind}`);
  });
  eq(LiitoTask.next(null, ev({ kind: "speculation", billType: "electricity", reason: "x" })), "searching", "the early web search");
  eq(LiitoTask.next(null, ev({ kind: "toolStart", id: "6", name: "show_chart", args: null, label: null })), null, "a chart tool waits for its chart");
  eq(LiitoTask.next(null, ev({ kind: "toolStart", id: "7", name: "search_prices", args: null, label: null })), "searching", "price search");
  eq(LiitoTask.next(null, ev({ kind: "toolStart", id: "8", name: "search_flats", args: null, label: null })), "searching", "flat search");
  eq(LiitoTask.next("searching", ev({ kind: "filler", text: "Let me check." })), "searching", "a filler keeps the work");
  eq(LiitoTask.next("calculating", ev({ kind: "sentence", index: 0, text: "x" })), "calculating", "a sentence is not a task");
  eq(LiitoTask.next("writing", ev({ kind: "teaching", card: {} })), "presenting", "a teaching card is presented");
  eq(LiitoTask.next("searching", ev({ kind: "error", message: "x" })), "searching", "an error leaves the task to the turn's end");
});

group("task: stage records only move forward", () => {
  // The live offer search: the tool runs, its result arrives, then the records of what it did, in one burst.
  eq(tasks("searching", [ev({ kind: "research", result: { offers: [], best: null } }), stage("research"), stage("extraction"),
    stage("calculation"), ev({ kind: "visual", visual: { id: "w", kind: "offer_bars" } }), ev({ kind: "delta", text: "I" })]),
  ["comparing", "comparing", "comparing", "comparing", "comparing", "writing"], "offer flow: searching, comparing, writing");
  // An investigation with no task yet: its stages walk it forward.
  eq(tasks(null, [stage("lead"), stage("evidence"), stage("research"), stage("extraction"), stage("calculation"), stage("impact")]),
    [null, null, "searching", "searching", "calculating", "presenting"], "investigation stages");
  eq(LiitoTask.next("writing", stage("calculation")), "writing", "no step back from writing");
  eq(LiitoTask.next("comparing", stage("extraction")), "comparing", "no step back from comparing");
  eq(LiitoTask.next("searching", stage("calculation")), "calculating", "a later step");
  eq(LiitoTask.next(null, stage("lead")), null, "a lead with no task lets the find show");
  eq(LiitoTask.next("writing", stage("teaching")), "writing", "other stages keep the task");
});

group("task: the money plan", () => {
  eq([plan({ kind: "scan" }), plan({ kind: "searchStart" }), plan({ kind: "offers" }), plan({ kind: "calc" }), plan({ kind: "action" }),
    plan({ kind: "planDone" }), plan({ kind: "summary" }), plan({ kind: "error" })].map((e) => LiitoTask.nextPlan("searching", e)),
  ["searching", "searching", "comparing", "calculating", "writing", "presenting", "searching", null], "plan tasks");
});

// MARK: - The mood to show

group("task: the mood to show", () => {
  eq(LiitoTask.mood(SisuActivity.idle, "searching", true), "listening", "the open microphone wins");
  eq(LiitoTask.mood(SisuActivity.make("searching_web"), "searching", false), "searching", "task");
  eq(LiitoTask.mood(SisuActivity.make("thinking"), null, false), "thinking", "plain thinking");
  eq(LiitoTask.mood(SisuActivity.make("searching_web"), null, false), "gliding", "without a task the backend's pose decides");
  eq(LiitoTask.mood(SisuActivity.make("speaking"), null, false), "presenting", "the answer is being said");
  eq(LiitoTask.mood(SisuActivity.make("speaking"), "writing", false), "writing", "a silent typed turn writes (its sentences are not speech)");
  eq(LiitoTask.mood(SisuActivity.make("speaking"), "writing", false, { speaking: true }), "presenting", "real speech presents");
  eq(LiitoTask.mood(SisuActivity.make("speaking"), null, false, { speaking: false }), "writing", "sentences with no voice are written");
  eq(LiitoTask.mood(SisuActivity.make("searching_web"), "searching", false, { speaking: true }), "searching", "work beats a filler sentence");
  eq(LiitoTask.mood(SisuActivity.make("calculating"), "presenting", false, { speaking: false }), "presenting", "a chart is presented");
  eq(LiitoTask.mood(SisuActivity.make("waiting_for_approval"), "writing", false), "found", "waiting keeps its pose");
  eq(LiitoTask.mood(SisuActivity.make("approved"), null, false), "cheering", "approved");
  eq(LiitoTask.mood(SisuActivity.make("error"), "calculating", false), "cosy", "error is calm");
  eq(LiitoTask.mood(SisuActivity.idle, null, false), "idle", "idle rests (not the backend's sleepy pose)");
  eq(LiitoTask.allCases, ["listening", "writing", "searching", "calculating", "comparing", "presenting"], "the six tasks");
});

group("task: Talk while Sisu answers", () => {
  const facts = (over: Partial<Parameters<typeof LiitoTask.answering>[1]>) =>
    ({ phase: "thinking" as const, working: true, task: null, spoke: false, workedThisAnswer: true, ...over });
  eq(LiitoTask.answering("presenting", facts({ phase: "speaking", task: "searching" })), "searching", "a filler over the search");
  eq(LiitoTask.answering("presenting", facts({ phase: "speaking", task: "writing" })), "presenting", "saying the answer");
  eq(LiitoTask.answering("writing", facts({ task: "writing", spoke: true })), "presenting", "a pause between two spoken sentences");
  eq(LiitoTask.answering("writing", facts({ task: "writing" })), "writing", "writing before anything is said");
  eq(LiitoTask.answering("thinking", facts({ working: false })), "presenting", "the answer is done and its speech is coming");
  eq(LiitoTask.answering("thinking", facts({ working: false, workedThisAnswer: false })), "thinking", "just sent: not yet working");
  eq(LiitoTask.answering("found", facts({ phase: "speaking", task: "searching" })), "found", "an action waiting keeps its pose");
  eq(LiitoTask.answering("calculating", facts({ task: "calculating" })), "calculating", "the work itself");
});

// MARK: - The sequencer

/** Pushes `[time, target]` pairs (all not urgent unless marked) and records what shows at each time and after. */
function run(pushes: [number, LiitoMood, boolean?][], until: number, start: LiitoMood = "thinking"): [number, LiitoMood][] {
  const sequencer = new MoodSequencer(start, 0);
  const shown: [number, LiitoMood][] = [[0, start]];
  const note = (time: number) => { if (shown[shown.length - 1][1] !== sequencer.shown) shown.push([time, sequencer.shown]); };
  let index = 0;
  for (let time = 0; time <= until; time += 1) {
    while (index < pushes.length && pushes[index][0] === time) {
      const [, target, urgent] = pushes[index];
      sequencer.push(target, time, urgent ?? false);
      note(time);
      index += 1;
    }
    const due = sequencer.nextChangeAt();
    if (due !== null && time >= due) { sequencer.advance(time); note(time); }
  }
  return shown;
}

group("sequencer: a burst shows every task, in order, each for a second", () => {
  // The live electricity question: searching for 3.7 s, then four changes in 14 ms, then the words.
  const shown = run([[0, "searching"], [3700, "comparing"], [3705, "calculating"], [3710, "comparing"], [3714, "writing"]], 9000);
  eq(shown, [[0, "thinking"], [0, "searching"], [3700, "comparing"], [4700, "writing"]], "keeps the newest two waiting");
  const burst = run([[0, "calculating"], [5, "writing"], [9, "presenting"]], 6000);
  eq(burst, [[0, "thinking"], [0, "calculating"], [1000, "writing"], [2000, "presenting"]], "three tasks, one second each");
  for (let i = 1; i < burst.length - 1; i += 1) ok(burst[i + 1][0] - burst[i][0] >= 1000, `step ${i} held a second`);
});

group("sequencer: duplicates, no lag, no invention", () => {
  eq(run([[0, "writing"], [10, "writing"], [20, "writing"]], 3000), [[0, "thinking"], [0, "writing"]], "the same mood again changes nothing");
  // Many changes while one task is held: only the newest two wait, so it is never more than two seconds behind.
  const long = run([[0, "searching"], [100, "calculating"], [200, "comparing"], [300, "writing"], [400, "presenting"]], 6000);
  eq(long, [[0, "thinking"], [0, "searching"], [1000, "writing"], [2000, "presenting"]], "at most two waiting");
  // The turn ends while two tasks wait: they still show, then Liito rests (a resting mood never pushes a task out).
  eq(run([[0, "searching"], [10, "comparing"], [20, "writing"], [30, "idle"]], 6000),
    [[0, "thinking"], [0, "searching"], [1000, "comparing"], [2000, "writing"], [3000, "idle"]], "rest after the waiting tasks");
  eq(run([[0, "searching"], [10, "thinking"], [20, "writing"]], 3000),
    [[0, "thinking"], [0, "searching"], [1000, "writing"]], "a passing thinking in the middle is skipped");
  const seen = new Set(long.map(([, mood]) => mood));
  ok([...seen].every((mood) => ["thinking", "searching", "writing", "presenting"].includes(mood)), "nothing that was not pushed");
  // Plain thinking and idle are not held: the next task shows at once.
  eq(run([[0, "thinking"], [10, "searching"]], 2000, "idle"), [[0, "idle"], [0, "thinking"], [10, "searching"]], "thinking is not held");
  // A late timer still gives each waiting mood its full second from when it was due.
  const sequencer = new MoodSequencer("searching", 0);
  sequencer.push("comparing", 100);
  sequencer.push("writing", 200);
  sequencer.advance(2500);
  eq([sequencer.shown, sequencer.nextChangeAt()], ["writing", null], "a late call catches up");
});

group("sequencer: what shows at once", () => {
  ok(MoodSequencer.isUrgent("listening", true), "the microphone opening");
  ok(MoodSequencer.isUrgent("found", false) && MoodSequencer.isUrgent("cheering", false) && MoodSequencer.isUrgent("cosy", false), "calm moods after a turn");
  ok(!MoodSequencer.isUrgent("found", true), "a find during the turn waits its turn");
  ok(!MoodSequencer.isUrgent("idle", false), "idle lets the last tasks finish");
  const shown = run([[0, "calculating"], [10, "writing"], [20, "presenting"], [300, "listening", true]], 3000);
  eq(shown, [[0, "thinking"], [0, "calculating"], [300, "listening"]], "listening drops what waited");
  const approval = run([[0, "writing"], [50, "found", true]], 3000);
  eq(approval, [[0, "thinking"], [0, "writing"], [50, "found"]], "an action waiting after the turn shows at once");
  const sequencer = new MoodSequencer("presenting", 0);
  sequencer.push("writing", 100);
  sequencer.push("thinking", 200, true);
  eq([sequencer.shown, sequencer.queue], ["thinking", []], "a new question starts afresh");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
