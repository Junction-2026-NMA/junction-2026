// Checks for the hands-free conversation rules (web/core/AppLogic/Conversation.ts) and the Liito task moods
// (web/core/LiitoTask.ts). Ports the intent of AppLogicSpeechEndpointerTests, AppLogicConversationFlowTests and
// AppLogicConversationPresenterTests (ios/SisuCore/Tests/SisuCoreTests in the frontend worktree).
// Run: npx tsx web/core/__checks__/conversation.check.ts
import { SisuActivity } from "@/web/core/Activity";
import { ConversationFlow, ConversationPresenter, SpeechEndpointer, type ConversationCommand } from "@/web/core/AppLogic/Conversation";
import { VoiceText } from "@/web/core/AppLogic/VoiceLogic";
import { LiitoTask } from "@/web/core/LiitoTask";
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
const near = (actual: number, expected: number, label: string, accuracy = 1e-6) => ok(Math.abs(actual - expected) <= accuracy, `${label} (${actual} ≈ ${expected})`);
function group(name: string, body: () => void): void {
  const before = failures;
  try { body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

/** Feeds `level` every 50 ms from `from` for `seconds`; returns each event with its time. */
function feedEndpointer(e: SpeechEndpointer, level: number, from: number, seconds: number): [number, SpeechEndpointer.Event][] {
  const events: [number, SpeechEndpointer.Event][] = [];
  let time = from;
  while (time < from + seconds - 0.0001) {
    const event = e.feed(level, time);
    if (event) events.push([time, event]);
    time += 0.05;
  }
  return events;
}
const kinds = (events: [number, SpeechEndpointer.Event][]) => events.map(([, event]) => event);

/** Feeds `level` every 50 ms and collects the commands. */
function feedFlow(flow: ConversationFlow, level: number, from: number, seconds: number): ConversationCommand[] {
  const commands: ConversationCommand[] = [];
  let time = from;
  while (time < from + seconds - 0.0001) {
    commands.push(...flow.level(level, time));
    time += 0.05;
  }
  return commands;
}
/** A question: quiet, speech, then a pause long enough to end it. */
const ask = (flow: ConversationFlow, from: number) =>
  [...feedFlow(flow, -60, from, 0.5), ...feedFlow(flow, -20, from + 0.5, 1), ...feedFlow(flow, -60, from + 1.5, 1.3)];

// MARK: - SpeechEndpointer

group("endpointer: a question starts and ends after a pause", () => {
  const e = new SpeechEndpointer(undefined, 0);
  eq(feedEndpointer(e, -60, 0, 1).length, 0, "a quiet room is not speech");
  const speech = feedEndpointer(e, -20, 1, 1.5);
  eq(kinds(speech), ["speechStarted"], "speech started");
  near(speech[0]?.[0] ?? 0, 1.15, "after about 0.15 s of sound", 0.06);
  ok(e.isSpeaking, "speaking");
  const pause = feedEndpointer(e, -60, 2.5, 2);
  eq(kinds(pause), ["utteranceEnded"], "ended");
  near(pause[0]?.[0] ?? 0, 3.6, "after a 1.1 s pause", 0.06);
  ok(e.isFinished, "finished");
  eq(e.feed(-20, 5), null, "nothing more until reset");
});

group("endpointer: a short pause inside a sentence does not end it", () => {
  const e = new SpeechEndpointer(undefined, 0);
  feedEndpointer(e, -60, 0, 0.5);
  feedEndpointer(e, -20, 0.5, 1);
  eq(feedEndpointer(e, -60, 1.5, 0.6).length, 0, "a breath is not the end");
  eq(feedEndpointer(e, -22, 2.1, 1).length, 0, "talking on");
  eq(kinds(feedEndpointer(e, -60, 3.1, 1.5)), ["utteranceEnded"], "then it ends");
});

group("endpointer: a click is not speech", () => {
  const e = new SpeechEndpointer(undefined, 0);
  feedEndpointer(e, -60, 0, 0.5);
  eq(feedEndpointer(e, -10, 0.5, 0.1).length, 0, "0.1 s of sound does not start a question");
  eq(feedEndpointer(e, -60, 0.6, 3).length, 0, "quiet after");
  ok(!e.isSpeaking, "not speaking");
});

group("endpointer: too little speech is a false start", () => {
  const e = new SpeechEndpointer(undefined, 0);
  feedEndpointer(e, -60, 0, 0.5);
  eq(kinds(feedEndpointer(e, -20, 0.5, 0.25)), ["speechStarted"], "started");
  eq(kinds(feedEndpointer(e, -60, 0.75, 1.5)), ["falseStart"], "a cough is thrown away");
  ok(!e.isSpeaking && !e.isFinished, "it keeps listening");
});

group("endpointer: the noise floor follows the room", () => {
  const e = new SpeechEndpointer(undefined, 0);
  feedEndpointer(e, -35, 0, 6);
  near(e.noiseFloor, -35, "a steady louder room becomes the floor", 1);
  near(e.threshold, -23, "threshold", 1);
  eq(feedEndpointer(e, -30, 6, 1).length, 0, "the room's own hum is not speech");
  eq(kinds(feedEndpointer(e, -15, 7, 0.5)), ["speechStarted"], "a voice over it is");
});

group("endpointer: a quiet room keeps a minimum threshold", () => {
  const e = new SpeechEndpointer(undefined, 0);
  feedEndpointer(e, -85, 0, 3);
  eq(e.threshold, -48, "very quiet rooms do not turn breathing into speech");
  eq(feedEndpointer(e, -55, 3, 1).length, 0, "breathing");
});

group("endpointer: long silence restarts the recording", () => {
  const e = new SpeechEndpointer(undefined, 0);
  const events = feedEndpointer(e, -60, 0, 21);
  eq(kinds(events), ["restart"], "restart");
  near(events[0]?.[0] ?? 0, 20, "after 20 s", 0.06);
});

group("endpointer: a very long question is sent anyway", () => {
  const e = new SpeechEndpointer(undefined, 0);
  const events = feedEndpointer(e, -60, 0, 0.5);
  let time = 0.5;
  while (time < 52) {
    events.push(...feedEndpointer(e, -20, time, 0.3), ...feedEndpointer(e, -45, time + 0.3, 0.1));
    time += 0.4;
  }
  eq(kinds(events), ["speechStarted", "utteranceEnded"], "started and ended");
  near(events[events.length - 1]?.[0] ?? 0, 50, "at the 50 s limit", 0.06);
});

group("endpointer: starting in a noisy room is not speech", () => {
  const e = new SpeechEndpointer(undefined, 0);
  eq(feedEndpointer(e, -32, 0, 5).length, 0, "the room is measured first");
  near(e.noiseFloor, -32, "floor", 0.5);
  eq(kinds(feedEndpointer(e, -12, 5, 1)), ["speechStarted"], "a voice over it");
});

group("endpointer: a room getting louder does not keep a question open", () => {
  const e = new SpeechEndpointer(undefined, 0);
  feedEndpointer(e, -60, 0, 1);
  eq(kinds(feedEndpointer(e, -20, 1, 1)), ["speechStarted"], "started");
  const events = feedEndpointer(e, -35, 2, 6);
  eq(kinds(events), ["utteranceEnded"], "a fan's hum becomes the floor");
  ok((events[0]?.[0] ?? 99) < 6.5, "the question still ends within a few seconds");
});

group("endpointer: calibrates only once, reset keeps the floor, odd readings are safe", () => {
  const e = new SpeechEndpointer(undefined, 0);
  ok(e.isCalibrating(0.1), "calibrating at first");
  feedEndpointer(e, -60, 0, 1);
  e.reset(1);
  ok(!e.isCalibrating(1.1), "a new recording in the same room listens at once");
  eq(kinds(feedEndpointer(e, -20, 1, 0.3)), ["speechStarted"], "heard at once");
  const r = new SpeechEndpointer(undefined, 0);
  feedEndpointer(r, -40, 0, 6);
  const floor = r.noiseFloor;
  r.reset(6);
  eq([r.noiseFloor, r.isSpeaking, r.isFinished], [floor, false, false], "reset keeps the floor");
  const s = new SpeechEndpointer(undefined, 0);
  eq([s.feed(-Infinity, 0), s.feed(NaN, 0.05)], [null, null], "silence readings");
  ok(s.noiseFloor >= -90, "floor stays sane");
  const copy = s.copy();
  copy.reset(9);
  feedEndpointer(copy, -20, 9, 1);
  ok(!s.isSpeaking && copy.isSpeaking, "a copy is independent");
});

// MARK: - ConversationFlow

group("flow: one full turn", () => {
  const flow = new ConversationFlow();
  eq(flow.phase, "off", "off");
  eq(flow.start(0), ["openMicrophone"], "start opens the microphone");
  eq([flow.phase, flow.micOpen], ["listening", true], "listening");
  eq(feedFlow(flow, -60, 0, 0.5), [], "quiet");
  eq(feedFlow(flow, -20, 0.5, 0.5), [], "speech");
  eq(flow.phase, "hearing", "hearing");
  eq(feedFlow(flow, -60, 1, 1.3), ["sendRecording"], "the pause sends it");
  eq([flow.phase, flow.micOpen, flow.questions], ["thinking", false, 1], "the microphone is closed while Sisu answers");
  eq(flow.level(-20, 2.5), [], "levels are ignored while Sisu answers");
  flow.sisuSpeaking(true);
  eq(flow.phase, "speaking", "speaking");
  flow.sisuSpeaking(false);
  eq(flow.phase, "thinking", "a gap between sentences");
  flow.sisuSpeaking(true);
  eq(flow.replyFinished(6), ["openMicrophone"], "then it listens again");
  eq([flow.phase, flow.micOpen], ["listening", true], "listening again");
});

group("flow: end while listening, end while answering", () => {
  const flow = new ConversationFlow();
  flow.start(10);
  eq(flow.end("byUser", 25), ["discardRecording"], "end closes the microphone");
  eq(flow.phase, "off", "off");
  eq(flow.lastEnded, { questions: 0, seconds: 15, reason: "byUser" }, "summary");
  eq(flow.end("byUser", 26), [], "ending twice does nothing");
  const busy = new ConversationFlow();
  busy.start(0);
  eq(ask(busy, 0), ["sendRecording"], "asked");
  busy.sisuSpeaking(true);
  eq(busy.end("byUser", 5), ["stopSisu"], "end stops Sisu");
  eq(busy.lastEnded?.questions, 1, "one question");
  eq(busy.replyFinished(6), [], "a late end of the answer opens nothing");
});

group("flow: mute", () => {
  const flow = new ConversationFlow();
  flow.start(0);
  feedFlow(flow, -60, 0, 0.5);
  feedFlow(flow, -20, 0.5, 0.5);
  eq(flow.phase, "hearing", "hearing");
  eq(flow.setMicMuted(true, 1.1), ["discardRecording"], "muting throws away what was being said");
  eq([flow.phase, flow.micMuted, flow.canListen], ["listening", true, false], "muted");
  eq(flow.level(-20, 1.2), [], "nothing is heard while muted");
  eq(flow.setMicMuted(false, 2), ["openMicrophone"], "unmute listens again");
  ok(flow.micOpen, "open");
  const answering = new ConversationFlow();
  answering.start(0);
  ask(answering, 0);
  eq(answering.setMicMuted(true, 3), [], "nothing to close while Sisu answers");
  eq(answering.replyFinished(5), [], "Sisu finishes but does not listen while muted");
  eq(answering.phase, "listening", "listening");
  eq(answering.setMicMuted(false, 6), ["openMicrophone"], "unmute");
  const before = new ConversationFlow();
  eq(before.setMicMuted(true, 0), [], "mute before start does nothing");
  before.start(0);
  before.setMicMuted(true, 1);
  before.end("byUser", 2);
  ok(!before.micMuted, "a finished conversation forgets the mute");
  eq(before.start(3), ["openMicrophone"], "a new conversation starts with the microphone on");
});

group("flow: held while away and back", () => {
  const flow = new ConversationFlow();
  eq(flow.setHeld(true, 0), [], "held before a conversation");
  eq(flow.start(1), [], "started while held: the microphone waits");
  eq(flow.setHeld(false, 2), ["openMicrophone"], "back");
  eq(flow.setHeld(true, 3), ["discardRecording"], "away");
  ok(flow.isOn && !flow.micMuted, "held is neither ended nor muted");
  eq(flow.setHeld(false, 4), ["openMicrophone"], "back again");
});

group("flow: false starts, restarts and a quiet minute", () => {
  const flow = new ConversationFlow();
  flow.start(0);
  feedFlow(flow, -60, 0, 0.5);
  const cough = [...feedFlow(flow, -20, 0.5, 0.25), ...feedFlow(flow, -60, 0.75, 1.4)];
  eq(cough, ["discardRecording", "openMicrophone"], "a cough reopens the microphone");
  eq([flow.phase, flow.questions], ["listening", 0], "still listening");
  eq(feedFlow(flow, -60, 2.15, 20.5), ["discardRecording", "openMicrophone"], "a fresh recording after 20 quiet seconds");
  ok(flow.isOn, "on");
  const quiet = new ConversationFlow();
  quiet.start(0);
  const commands = feedFlow(quiet, -60, 0, 61);
  eq(commands[commands.length - 1], "discardRecording", "the quiet minute closes the microphone");
  eq([quiet.phase, quiet.lastEnded?.reason], ["off", "quiet"], "ended as quiet");
  const later = new ConversationFlow();
  later.start(0);
  ask(later, 0);
  later.replyFinished(50);
  feedFlow(later, -60, 50, 40);
  ok(later.isOn, "the quiet minute counts from the last answer");
});

group("flow: interrupt, a new room, nothing to send, microphone failure, copies", () => {
  const flow = new ConversationFlow();
  flow.start(0);
  ask(flow, 0);
  flow.sisuSpeaking(true);
  eq(flow.interrupt(4), ["stopSisu", "openMicrophone"], "interrupt stops Sisu and listens");
  eq(flow.phase, "listening", "listening");
  eq(flow.interrupt(5), [], "nothing to interrupt while listening");
  const room = new ConversationFlow();
  room.start(0);
  feedFlow(room, -60, 0, 2);
  room.end("byUser", 2);
  room.start(10);
  ok(room.endpointer.isCalibrating(10.1), "each conversation measures the room again");
  eq(feedFlow(room, -32, 10, 4), [], "a louder room is measured, not heard as a question");
  const empty = new ConversationFlow();
  empty.start(0);
  ask(empty, 0);
  eq(empty.nothingToSend(3), ["openMicrophone"], "nothing to send listens again");
  eq(empty.questions, 0, "not counted");
  const denied = new ConversationFlow();
  denied.start(0);
  eq(denied.microphoneFailed("microphoneDenied", 1), [], "microphone failure");
  eq([denied.phase, denied.lastEnded?.reason, denied.micOpen], ["off", "microphoneDenied", false], "ended");
  const original = new ConversationFlow();
  original.start(0);
  const copy = original.copy();
  original.setMicMuted(true, 1);
  eq([original.micMuted, copy.micMuted, copy.phase], [true, false, "listening"], "a copy is a value");
});

// MARK: - ConversationPresenter

const listening = (now = 0) => {
  const flow = new ConversationFlow();
  flow.start(now);
  return flow;
};
const thinkingFlow = () => {
  const flow = listening();
  let time = 0;
  while (time < 3) { flow.level(time > 0.5 && time < 1.5 ? -20 : -60, time); time += 0.05; }
  return flow;
};

group("presenter: before the first conversation, the opening line", () => {
  const state = ConversationPresenter.state(new ConversationFlow(), SisuActivity.idle, 0);
  eq([state.title, state.buttonLabel, state.micEnabled, state.statusLine, state.live, state.mood],
    ["Talk to Sisu", "Start talking", false, null, false, "idle"], "idle page");
  const opening = { title: "Liito found something", detail: "Looks like Electricity is your biggest bill after rent: about €79 a month." };
  const shown = ConversationPresenter.state(new ConversationFlow(), SisuActivity.idle, 0, opening);
  eq([shown.title, shown.mood], ["Liito found something", "found"], "opening line");
  eq(ConversationPresenter.state(listening(), SisuActivity.idle, 1, opening).title, "Listening", "it goes once the conversation starts");
});

group("presenter: listening and hearing show Liito listening", () => {
  const flow = listening();
  let state = ConversationPresenter.state(flow, SisuActivity.make("listening"), 42);
  eq([state.title, state.buttonLabel, state.micLabel, state.micEnabled, state.statusLine, state.live, state.mood],
    ["Listening", "End conversation", "Mute microphone", true, "Conversation on · 0:42", true, "listening"], "listening");
  let time = 0;
  while (time < 1) { flow.level(time < 0.5 ? -60 : -20, time); time += 0.05; }
  state = ConversationPresenter.state(flow, SisuActivity.make("listening"), 1);
  eq([state.title, state.mood], ["Hearing you", "listening"], "hearing");
});

group("presenter: thinking shows what Sisu is doing, with the task", () => {
  const flow = thinkingFlow();
  eq(flow.phase, "thinking", "thinking");
  const activity = SisuActivity.make("searching_web", "Searching the web with Exa", "electricity offers Helsinki");
  const searching = ConversationPresenter.state(flow, activity, 3, null, "searching");
  eq([searching.title, searching.detail, searching.mood, searching.canInterrupt],
    ["Searching the web with Exa", "electricity offers Helsinki", "searching", true], "searching");
  eq(ConversationPresenter.state(flow, activity, 3).mood, "gliding", "without a task the backend's pose decides");
  eq(ConversationPresenter.state(flow, SisuActivity.make("calculating", "Doing the sums"), 3, null, "calculating").mood, "calculating", "calculating");
  eq(ConversationPresenter.state(flow, SisuActivity.make("calculating"), 3, null, "writing").mood, "writing", "writing the answer");
  const early = ConversationPresenter.state(flow, SisuActivity.idle, 3);
  eq([early.title, early.mood], ["Thinking", "thinking"], "before the first event");
  flow.sisuSpeaking(true);
  const speaking = ConversationPresenter.state(flow, SisuActivity.make("speaking"), 4, null, "presenting");
  eq([speaking.title, speaking.detail, speaking.mood], ["Sisu is answering", "Tap Liito to interrupt.", "presenting"], "speaking");
  const waiting = ConversationPresenter.state(flow, SisuActivity.make("waiting_for_approval", "Switch electricity"), 4);
  eq(waiting.mood, "found", "a waiting action keeps its pose while Sisu speaks");
});

group("presenter: muted, paused, ended, a fresh page, waiting actions", () => {
  const flow = listening();
  flow.setMicMuted(true, 5);
  let state = ConversationPresenter.state(flow, SisuActivity.idle, 65);
  eq([state.title, state.micLabel, state.statusLine], ["Microphone off", "Turn the microphone on", "Conversation on · 1:05 · microphone off"], "muted");
  flow.setMicMuted(false, 66);
  flow.setHeld(true, 67);
  eq(ConversationPresenter.state(flow, SisuActivity.idle, 67).title, "Paused", "paused");
  const after = thinkingFlow();
  after.replyFinished(10);
  after.end("byUser", 100);
  state = ConversationPresenter.state(after, SisuActivity.idle, 101);
  eq([state.title, state.statusLine, state.buttonLabel, state.live, state.mood],
    ["Conversation ended", "Ended · 1 question · 1:40", "Start talking", false, "proud"], "after");
  const quiet = listening();
  quiet.end("quiet", 60);
  eq(ConversationPresenter.state(quiet, SisuActivity.idle, 60).detail, "It went quiet for a minute, so Sisu stopped listening.", "quiet");
  const denied = listening();
  denied.microphoneFailed("microphoneDenied", 0);
  const deniedState = ConversationPresenter.state(denied, SisuActivity.idle, 0);
  eq([deniedState.detail, deniedState.mood], [VoiceText.microphoneDenied, "cosy"], "calm, never sad");
  const fresh = listening();
  fresh.end("byUser", 30);
  ok(ConversationPresenter.state(fresh, SisuActivity.idle, 31).statusLine !== null, "summary shown");
  fresh.clearSummary();
  const page = ConversationPresenter.state(fresh, SisuActivity.idle, 31);
  eq([page.title, page.statusLine], ["Talk to Sisu", null], "a fresh page");
  const waiting = ConversationPresenter.state(listening(), SisuActivity.make("waiting_for_approval", "Switch electricity"), 1);
  eq([waiting.title, waiting.mood], ["Listening", "found"], "a waiting action shows while listening");
});

group("presenter: clock, counts, ring", () => {
  eq([0, 5.9, 65, 720, 3723, -3].map((s) => ConversationPresenter.clock(s)), ["0:00", "0:05", "1:05", "12:00", "1:02:03", "0:00"], "clock");
  eq([0, 1, 4].map((n) => ConversationPresenter.questions(n)), ["no questions", "1 question", "4 questions"], "counts");
  eq(ConversationPresenter.ringLevel(-50, -50), 0, "floor");
  eq(ConversationPresenter.ringLevel(-5, -50), 1, "loud");
  near(ConversationPresenter.ringLevel(-31, -50), 0.5, "half", 0.001);
  eq(ConversationPresenter.ringLevel(-Infinity, -50), 0, "silence");
});

// MARK: - LiitoTask

const ev = (event: object) => event as SisuEvent;
const plan = (event: object) => event as PlanEvent;

group("task: follows the agent's events", () => {
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
    [ev({ kind: "sentence", index: 0, text: "You spend…" }), "presenting"],
    [ev({ kind: "delta", text: " more" }), "presenting"],
    [ev({ kind: "done", text: "x", citations: [], timings: null }), null],
  ];
  let task: string | null = "listening";
  steps.forEach(([event, expected], index) => {
    task = LiitoTask.next(task as never, event);
    eq(task, expected, `step ${index} ${event.kind}`);
  });
  eq(LiitoTask.next("writing", ev({ kind: "stage", stage: { kind: "calculation" } })), "calculating", "calculation stage");
  eq(LiitoTask.next("writing", ev({ kind: "stage", stage: { kind: "extraction" } })), "searching", "extraction stage");
  eq(LiitoTask.next("writing", ev({ kind: "stage", stage: { kind: "impact" } })), "presenting", "impact stage");
  eq(LiitoTask.next("writing", ev({ kind: "stage", stage: { kind: "lead" } })), null, "a lead is Liito's find");
  eq(LiitoTask.next("writing", ev({ kind: "stage", stage: { kind: "teaching" } })), "writing", "other stages keep the task");
  eq(LiitoTask.next("searching", ev({ kind: "error", message: "x" })), null, "error");
});

group("task: the money plan", () => {
  eq([plan({ kind: "scan" }), plan({ kind: "searchStart" }), plan({ kind: "offers" }), plan({ kind: "calc" }), plan({ kind: "action" }),
    plan({ kind: "planDone" }), plan({ kind: "summary" }), plan({ kind: "error" })].map((e) => LiitoTask.nextPlan("searching", e)),
  ["searching", "searching", "comparing", "calculating", "writing", "presenting", "searching", null], "plan tasks");
});

group("task: the mood to show", () => {
  eq(LiitoTask.mood(SisuActivity.idle, "searching", true), "listening", "the open microphone wins");
  eq(LiitoTask.mood(SisuActivity.make("searching_web"), "searching", false), "searching", "task");
  eq(LiitoTask.mood(SisuActivity.make("thinking"), null, false), "thinking", "plain thinking");
  eq(LiitoTask.mood(SisuActivity.make("speaking"), "writing", false), "presenting", "speaking presents");
  eq(LiitoTask.mood(SisuActivity.make("waiting_for_approval"), "writing", false), "found", "waiting keeps its pose");
  eq(LiitoTask.mood(SisuActivity.make("approved"), null, false), "cheering", "approved");
  eq(LiitoTask.mood(SisuActivity.make("error"), "calculating", false), "cosy", "error is calm");
  eq(LiitoTask.allCases, ["listening", "writing", "searching", "calculating", "comparing", "presenting"], "the six tasks");
});

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
