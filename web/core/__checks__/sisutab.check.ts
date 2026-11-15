// Checks for the Sisu tab: saved conversations (web/core/ConversationHistory.ts, CoachSession.restore, CoachStore's
// history), the suggested questions (SisuSuggestions), the voice strip's words (VoiceBar), the buffer sent with every
// question, a reply stopped before it began, drafts kept per conversation and the launch restore (no chooser flash).
// Run: npx tsx web/core/__checks__/sisutab.check.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SisuActivity } from "@/web/core/Activity";
import { FixtureAPI } from "@/web/core/API";
import { ConversationFlow } from "@/web/core/AppLogic/Conversation";
import { SisuSuggestions } from "@/web/core/AppLogic/SisuSuggestions";
import { VoiceBar } from "@/web/core/AppLogic/VoiceBar";
import { CoachClient } from "@/web/core/CoachClient";
import { CoachErrors, CoachMessage, CoachSession } from "@/web/core/CoachSession";
import { ConversationHistory, type SavedConversation } from "@/web/core/ConversationHistory";
import type { Overview } from "@/web/core/Models";
import { AppModel } from "@/web/app/AppModel";
import { Keys } from "@/web/app/AppState";
import { memoryDefaults } from "@/web/app/Defaults";
import { LaunchOptions } from "@/web/app/LaunchOptions";

let failures = 0, passes = 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function eq(actual: unknown, expected: unknown, label: string): void {
  if (same(actual, expected)) { passes += 1; return; }
  failures += 1;
  console.error(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
}
const ok = (value: boolean, label: string) => eq(value, true, label);
async function group(name: string, body: () => void | Promise<void>): Promise<void> {
  const before = failures;
  try { await body(); } catch (error) { failures += 1; console.error(`  FAIL ${name} threw`, error); }
  console.log(`${failures === before ? "ok  " : "FAIL"} ${name}`);
}

const publicFixtures = join(process.cwd(), "public/sisu-fixtures");
FixtureAPI.setDefaultSource(async (path) => readFile(join(publicFixtures, path)).then((b) => new Uint8Array(b)).catch(() => null));
const overview = async (id: string) => JSON.parse(await readFile(join(publicFixtures, `overview-${id}.json`), "utf8")) as Overview;
const user = (id: string, text: string, extra: Partial<CoachMessage> = {}) => CoachMessage.make(id, "user", { text, ...extra });
const reply = (id: string, text: string, extra: Partial<CoachMessage> = {}) => CoachMessage.make(id, "assistant", { text, ...extra });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await group("history: titles, model context, storable messages", () => {
    eq(ConversationHistory.title([user("u", "Will my money last until payday?"), reply("a", "Yes.")]), "Will my money last until payday?", "first question");
    eq(ConversationHistory.title([user("u", CoachSession.investigateText)]), "Look into my finances", "investigation");
    eq(ConversationHistory.title([user("u", "(nothing heard)"), user("v", "Could I afford to move to Espoo?")]), "Could I afford to move to Espoo?", "skips an unheard voice question");
    eq(ConversationHistory.title([user("u", "(voice question)")]), "Voice conversation", "only unheard questions");
    const long = ConversationHistory.title([user("u", "I keep running short before payday every single month. What can I spend this week without missing my bills?")]);
    ok(long.length <= 57 && long.endsWith("…") && !long.includes("  "), `a long question is cut at a word (${long})`);
    const messages = [
      user("u1", "How much do I spend on restaurants?"), reply("a1", "About €277 a month."),
      user("u2", "(nothing heard)"), reply("a2", ""),
      user("u3", "And on groceries?"), reply("a3", "", { error: "Sisu could not answer just now." }),
      user("u4", "Could I afford to move to Espoo?", { spoken: true }), reply("a4", "Probably, with a rent under €900."),
    ];
    eq(ConversationHistory.chatTurns(messages), [
      { role: "user", content: "How much do I spend on restaurants?" }, { role: "assistant", content: "About €277 a month." },
      { role: "user", content: "Could I afford to move to Espoo?" }, { role: "assistant", content: "Probably, with a rent under €900." },
    ], "answered turns only, typed and spoken alike");
    const many = Array.from({ length: 10 }, (_, i) => [user(`q${i}`, `q${i}`), reply(`r${i}`, `r${i}`)]).flat();
    eq(ConversationHistory.chatTurns(many).length, 12, "the last 12 entries, as the server keeps");
    const pending = [user("u", "", { pending: true }), reply("a", "", { pending: true }), user("v", "Hi"), reply("b", "Hello", { pending: true, runningTool: "x" })];
    eq(ConversationHistory.storable(pending).map((m) => [m.id, m.pending, m.runningTool]), [["v", false, null], ["b", false, null]], "settled copies, no empty voice question nor its empty reply");
    const stopped = ConversationHistory.storable([user("q", "Will my money last until payday?"), reply("r", "")]);
    eq(stopped.map((m) => [m.id, m.text, m.error]), [["q", "Will my money last until payday?", null], ["r", "", CoachErrors.stopped]], "a blank reply is saved as stopped, never blank");
    eq(CoachErrors.stopped, ConversationHistory.stoppedReply, "one sentence for a stopped reply");
    eq(ConversationHistory.entry("c1", [user("u", "Hi")], {}, null, new Date()), null, "no answer yet: nothing to save");
  });

  await group("history: defensive decoding, newest first, limits", () => {
    const at = "2026-11-15T10:00:00.000Z";
    const good: SavedConversation = { id: "c1", title: "T", startedAt: at, updatedAt: at, messages: [user("u", "Hi"), reply("a", "Hello")], quizChoices: { q1: 1 } };
    const stored = { ...good, quizChoices: { q1: 1, bad: -1, worse: "x" } };
    const archive = ConversationHistory.decodeArchive({ CUST1: [stored, { id: "", messages: [] }, { id: "c2", messages: [{ role: "robot" }] }, "nope"], CUST2: "x" });
    eq(Object.keys(archive), ["CUST1"], "only customers with conversations");
    eq(archive.CUST1.map((c) => [c.id, c.quizChoices]), [["c1", { q1: 1 }]], "broken entries and picks are skipped");
    eq(ConversationHistory.decodeArchive(null), {}, "nothing stored");
    const entry = (id: string): SavedConversation => ({ ...good, id });
    let list: SavedConversation[] = [];
    for (let i = 0; i < 14; i += 1) list = ConversationHistory.upsert(list, entry(`c${i}`));
    eq([list.length, list[0].id], [ConversationHistory.limit, "c13"], "at most ten, newest first");
    eq(ConversationHistory.upsert(list, entry("c5"))[0].id, "c5", "an updated conversation moves to the top");
    eq(ConversationHistory.remove(list, "c13").length, 9, "remove");
    const big = { ...good, messages: [user("u", "x".repeat(2000)), reply("a", "y".repeat(2000))] };
    const fitted = ConversationHistory.store({}, "CUST1", Array.from({ length: 10 }, (_, i) => ({ ...big, id: `b${i}` })), 20_000);
    ok(JSON.stringify(fitted).length <= 20_000 && fitted.CUST1.length >= 1 && fitted.CUST1[0].id === "b0", "trimmed to fit, the newest kept");
    eq(ConversationHistory.store({ CUST1: [good] }, "CUST1", []), {}, "an empty list removes the customer");
    const now = new Date("2026-11-15T12:00:00Z");
    eq(ConversationHistory.dateLabel("2026-11-15T10:05:00Z", now, "UTC"), "Today, 10:05", "today");
    eq(ConversationHistory.dateLabel("2026-11-14T10:05:00Z", now, "UTC"), "Yesterday", "yesterday");
    eq(ConversationHistory.dateLabel("2026-10-02T10:05:00Z", now, "UTC"), "2 Oct", "this year");
    eq(ConversationHistory.dateLabel("nope", now, "UTC"), "", "not a date");
  });

  await group("session: restore brings the messages and the model context back", () => {
    const session = CoachSession.sample("CUST04974", 0);
    session.restore([user("u1", "How much on restaurants?"), reply("a1", "About €277 a month.", { pending: true })]);
    const s = session.getSnapshot();
    eq(s.messages.map((m) => [m.id, m.pending]), [["u1", false], ["a1", false]], "settled messages");
    eq((session as unknown as { history: unknown }).history, [
      { role: "user", content: "How much on restaurants?" }, { role: "assistant", content: "About €277 a month." },
    ], "the next question carries this context");
    eq(s.messages[0].tools, [], "missing fields take their defaults");
  });

  await group("store: a settled conversation is saved, New chat starts afresh, a saved one reopens", async () => {
    const defaults = memoryDefaults();
    const model = new AppModel(LaunchOptions.parse(new URLSearchParams("sample=1&customer=CUST04974"), defaults));
    const store = model.coach;
    await store.configure("CUST04974", null);
    const session = store.session!;
    await session.ask("Will my money last until payday?");
    await wait(20);
    const first = store.getSnapshot().conversationId;
    eq(store.getSnapshot().savedConversations.map((c) => [c.id, c.title]), [[first, "Will my money last until payday?"]], "saved after the answer");
    const stored = ConversationHistory.decodeArchive(defaults.json(Keys.conversations));
    eq(stored.CUST04974?.[0]?.messages.length, 2, "in the app's defaults, per customer");
    store.newConversation();
    eq([session.getSnapshot().messages.length, store.getSnapshot().conversationId !== first], [0, true], "New chat: empty, a new id");
    await session.ask("Can you find me a cheaper electricity deal?");
    await wait(20);
    eq(store.getSnapshot().savedConversations.length, 2, "two conversations");
    ok(store.openConversation(first), "open the first again");
    eq(session.getSnapshot().messages[0].text, "Will my money last until payday?", "its messages are back");
    eq(store.getSnapshot().conversationId, first, "and it is the current one");
    eq(store.getSnapshot().savedConversations.map((c) => c.title), ["Can you find me a cheaper electricity deal?", "Will my money last until payday?"], "reopening saved nothing over the other one");
    ok(!store.openConversation("nope"), "an unknown id opens nothing");
    model.resetDemo();
    eq([defaults.json(Keys.conversations), store.getSnapshot().savedConversations.length], [null, 0], "starting the demo over forgets them");
  });

  await group("suggestions: the four that work today, worded from the data, two from what Sisu noticed", async () => {
    const aino = await overview("CUST04974"), eetu = await overview("CUST04414"), sanna = await overview("CUST02003");
    const a = SisuSuggestions.make(aino, null);
    eq(a.slice(0, 4).map((s) => s.question), [
      "Will my money last until payday?", "What would spending 20% less at restaurants save?", "Could I afford to move to Espoo?", "Find a cheaper plan that meets my needs.",
    ], "Aino (Helsinki, restaurants)");
    eq(a.slice(4).map((s) => [s.question, s.synthetic]), [
      ["Why does my balance go below zero, and how do I stop it?", false],
    ], "Aino: the restaurant comparison is not repeated, the 20% restaurant question covers it");
    const peers = { ...aino, baskets: aino.baskets.map((b) => (b.id !== "everyday" ? b : { ...b, categories: b.categories.filter((c) => c.category !== "Restaurants") })) };
    const comparison = SisuSuggestions.make(peers, null).find((s) => s.synthetic);
    eq(comparison?.question, "Why is my restaurant spending higher than other profiles in the demo data?", "a comparison not covered above says it is with the demo data");
    ok(!SisuSuggestions.make(peers, null).some((s) => /my age|people your age/i.test(s.question)), "no suggestion compares with real people of an age");
    const e = SisuSuggestions.make(eetu, "Electricity");
    eq([e[1].question, e[2].question, e[3].question], [
      "What would spending 20% less on entertainment save?", "Could I afford to move to Helsinki?", "Find a cheaper electricity plan that meets my needs.",
    ], "Eetu (Espoo, entertainment, a confirmed bill)");
    ok(e.length <= 6 && !e.some((s) => /grocer/i.test(s.question)), "never suggests cutting groceries");
    eq(SisuSuggestions.make(sanna, null)[1].question, "What would spending 20% less at restaurants save?", "Sanna: no big everyday choice, the standard wording");
    eq(SisuSuggestions.make(null, null).length, 4, "no overview: the four");
    eq(SisuSuggestions.planQuestion("Mobile plan"), "Find a cheaper mobile plan that meets my needs.", "a name with plan in it");
    eq(SisuSuggestions.planQuestion("Rent or housing payment"), SisuSuggestions.cheaperPlan, "rent is not a plan");
  });

  await group("voice strip: Listening, Hearing you, Thinking, Answering; Stop interrupts only an answer", () => {
    const flow = new ConversationFlow();
    flow.start(0);
    const idle = SisuActivity.idle;
    eq([VoiceBar.state(flow, idle, false).label, VoiceBar.state(flow, idle, false).stop], ["Listening", "end"], "listening");
    flow.phase = "hearing";
    eq(VoiceBar.state(flow, idle, false).label, "Hearing you", "hearing");
    flow.phase = "thinking";
    const searching = SisuActivity.make("searching_web");
    eq([VoiceBar.state(flow, searching, false).label, VoiceBar.state(flow, searching, false).stop], ["Thinking", "interrupt"], "thinking");
    ok(VoiceBar.state(flow, searching, false).detail !== null, "what Sisu is doing, as the detail");
    eq(VoiceBar.state(flow, idle, true).label, "Answering", "the answer is complete, its voice on the way");
    flow.phase = "speaking";
    eq([VoiceBar.state(flow, idle, false).label, VoiceBar.state(flow, idle, false).stopLabel], ["Answering", "Stop Sisu"], "speaking");
    const waiting = new ConversationFlow();
    waiting.start(0, false);
    eq(VoiceBar.state(waiting, SisuActivity.make("thinking"), false).detail, "The microphone opens after this answer.", "a typed answer runs first");
    flow.phase = "speaking";
    eq(VoiceBar.state(flow, idle, false).detail, "Tap Stop to interrupt.", "the answering hint fits at 375 px");
    const asked = new ConversationFlow();
    asked.start(0);
    asked.questions = 1;
    eq(VoiceBar.state(asked, idle, false).detail, "Ask more, or tap End.", "the follow-up hint fits at 375 px");
  });

  await group("buffer: the person's buffer goes with every typed and spoken question (15 Nov QA: Sisu assumed €247)", async () => {
    const bodies: unknown[] = [];
    const recorder = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(init?.body);
      return new Response('data: {"type":"done","text":"About €109 a week.","citations":[]}\n\n', { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }) as typeof fetch;
    const defaults = memoryDefaults();
    const model = new AppModel(LaunchOptions.parse(new URLSearchParams("sample=1&customer=CUST04974"), defaults));
    const session = new CoachSession("CUST04974", CoachClient.live("", recorder));
    (model.coach as unknown as { use(next: CoachSession): void }).use(session);
    await session.ask("What can I spend this week?");
    eq(JSON.parse(String(bodies[0])).bufferEur, undefined, "no buffer set: the field is left out");
    model.setPrefs({ bufferEur: 300 });
    eq(session.bufferEur, 300, "Settings and Today's buffer reach the session at once");
    await session.ask("I keep running short before payday. What can I spend this week without missing my bills?");
    eq(JSON.parse(String(bodies[1])).bufferEur, 300, "typed: bufferEur in the body");
    await session.sendVoice(new Uint8Array([1, 2, 3]), "speech.webm", "audio/webm");
    eq((bodies[2] as FormData).get("bufferEur"), "300", "spoken: bufferEur in the form");
    model.setPrefs({ bufferEur: null });
    await session.ask("And now?");
    eq(JSON.parse(String(bodies[3])).bufferEur, undefined, "cleared: left out again");
    model.setPrefs({ bufferEur: 150 });
    const next = new CoachSession("CUST04974", CoachClient.live("", recorder));
    (model.coach as unknown as { use(next: CoachSession): void }).use(next);
    eq(next.bufferEur, 150, "a new session (another profile) gets the buffer too");
    eq([CoachSession.validBuffer(-5), CoachSession.validBuffer(Number.NaN), CoachSession.validBuffer(0)], [null, null, 0], "only a real amount is sent");
  });

  await group("stop: a reply stopped before anything arrived says so, with Try again, also after reopening (15 Nov QA)", async () => {
    const slow = (async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as typeof fetch;
    const typed = new CoachSession("CUST04974", CoachClient.live("", slow));
    const turn = typed.ask("Will my money last until payday?");
    typed.cancel();
    await turn;
    eq(typed.messages.map((m) => [m.role, m.text, m.pending, m.error]), [
      ["user", "Will my money last until payday?", false, null], ["assistant", "", false, CoachErrors.stopped],
    ], "typed: the empty card becomes a stopped reply");
    // A voice question whose words came back, stopped while Sisu was thinking.
    const voice = new CoachSession("CUST04974", CoachClient.live("", slow));
    const spoken = voice.sendVoice(new Uint8Array([1]), "speech.webm", "audio/webm");
    const [question] = voice.messages;
    (voice as unknown as { patch(id: string, change: (m: CoachMessage) => CoachMessage): void })
      .patch(question.id, (m) => ({ ...m, text: "Will my money last until payday?", pending: false }));
    voice.cancel();
    await spoken;
    eq(voice.messages.map((m) => [m.role, m.error]), [["user", null], ["assistant", CoachErrors.stopped]], "heard voice question: a stopped reply");
    const unheard = new CoachSession("CUST04974", CoachClient.live("", slow));
    const silent = unheard.sendVoice(new Uint8Array([1]), "speech.webm", "audio/webm");
    unheard.cancel();
    await silent;
    eq(unheard.messages.length, 0, "an unheard voice question still leaves nothing");
    const partly = new CoachSession("CUST04974", CoachClient.sample(0));
    partly.restore([user("q", "Hi"), reply("r", "Hello, I was saying", { pending: true })]);
    eq(partly.messages[1].error, null, "a reply that had begun keeps its words, no error");
    const reopened = CoachSession.sample("CUST04974", 0);
    reopened.restore([user("q", "Will my money last until payday?"), reply("r", "")]);
    eq(reopened.messages[1].error, CoachErrors.stopped, "an old blank reply comes back as stopped");
  });

  await group("drafts: the unsent text is kept per conversation and goes on New chat", async () => {
    const model = new AppModel(LaunchOptions.parse(new URLSearchParams("sample=1&customer=CUST04974"), memoryDefaults()));
    const store = model.coach;
    await store.configure("CUST04974", null);
    const first = store.getSnapshot().conversationId;
    store.setDraft("draft about rent");
    eq(store.draft(), "draft about rent", "kept (a tab switch remounts the screen; the store stays)");
    store.setDraft("");
    eq(store.draft(), "", "sent: gone");
    store.setDraft("draft about rent");
    store.newConversation();
    eq([store.draft(), store.draft(first)], ["", ""], "New chat: the new one is empty and the old draft is gone");
  });

  await group("launch: a returning person goes straight to Sisu, never through the chooser (15 Nov QA)", async () => {
    const returning = (customerId: string) => {
      const defaults = memoryDefaults();
      defaults.setJSON(Keys.onboarding, { step: "reading", isComplete: true, firstInsightPending: false });
      defaults.setString(Keys.customer, customerId);
      return defaults;
    };
    const model = new AppModel(LaunchOptions.parse(new URLSearchParams("sample=1"), returning("CUST04974")));
    const route = () => {
      const s = model.getSnapshot();
      return s.onboardingActive ? "onboarding" : s.restoringCustomer ? "restoring" : s.customer !== null ? "main" : "chooser";
    };
    eq(route(), "restoring", "at launch: restoring, not the chooser");
    const seen: string[] = [route()];
    const sessionAtMain: boolean[] = [];
    model.subscribe(() => {
      const now = route();
      if (seen[seen.length - 1] !== now) {
        seen.push(now);
        if (now === "main") sessionAtMain.push(model.coach.session !== null && model.getSnapshot().overview !== null);
      }
    });
    await model.start();
    eq(seen, ["restoring", "main"], "restoring, then the main screen, with no chooser in between");
    eq(sessionAtMain, [true], "the overview and the coach session are there when it shows");
    const fresh = new AppModel(LaunchOptions.parse(new URLSearchParams("sample=1"), memoryDefaults()));
    ok(!fresh.getSnapshot().restoringCustomer, "no stored profile: the chooser (or onboarding) at once");
    const missing = new AppModel(LaunchOptions.parse(new URLSearchParams("sample=1"), returning("CUST00000")));
    eq(missing.getSnapshot().restoringCustomer, true, "a stored profile: restoring until it is looked up");
    await missing.start();
    eq([missing.getSnapshot().restoringCustomer, missing.getSnapshot().customer], [false, null], "a stored profile that is gone: the chooser");
    model.switchCustomer();
    eq(route(), "chooser", "Switch customer shows the chooser");
  });

  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures > 0) process.exitCode = 1;
}

void main();
