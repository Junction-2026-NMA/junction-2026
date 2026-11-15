// Checks for web/core part A, ported from the intent of the SisuCore Swift tests (ServerSentEventsTests,
// ModelsDecodingTests, ScenarioEngineTests, CoachClientTests, CoachSessionTests, PlanSessionTests).
// Run from the repo root: npx tsx web/core/__checks__/core-a.check.ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Endpoints, FixtureAPI, ScenarioEngine, SisuError, type FixtureSource } from "../API";
import { CoachClient } from "../CoachClient";
import { CoachEndpoints } from "../CoachEndpoints";
import { SisuEvent, StageKind } from "../CoachModels";
import { CoachErrors, CoachSession } from "../CoachSession";
import type { ScenarioResponse } from "../Models";
import { PlanEvent } from "../PlanModels";
import { PlanSession, PlanView } from "../PlanSession";
import { SSEParser, SisuEventStreamParser, type ServerSentEvent } from "../ServerSentEvents";
import { ReplayTransport } from "../Transport";

const root = join(process.cwd(), "public", "sisu-fixtures");
const fsSource: FixtureSource = async (path) => {
  try { return new Uint8Array(await readFile(join(root, path))); } catch { return null; }
};
FixtureAPI.setDefaultSource(fsSource);

const aino = "CUST04974";
let passed = 0;
async function check(name: string, body: () => void | Promise<void>) {
  try {
    await body();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const enc = new TextEncoder();
function feedInChunks(text: string, chunk: number): ServerSentEvent[] {
  const bytes = enc.encode(text);
  const parser = new SSEParser();
  const out: ServerSentEvent[] = [];
  for (let i = 0; i < bytes.length; i += chunk) out.push(...parser.feed(bytes.slice(i, i + chunk)));
  return [...out, ...parser.finish()];
}

async function main() {
  await check("SSE: every chunk size gives the same messages", () => {
    const text = ": keep-alive\r\ndata: first line\r\ndata: second line\r\n\r\nevent: note\nid: 7\ndata:no space\n\n:\n\ndata: päivää €5\n\nretry: 100\n\n";
    const expected = [
      { data: "first line\nsecond line", event: null, id: null },
      { data: "no space", event: "note", id: "7" },
      { data: "päivää €5", event: null, id: "7" },
    ];
    for (let size = 1; size <= enc.encode(text).length; size += 1) assert.deepEqual(feedInChunks(text, size), expected, `chunk ${size}`);
  });

  await check("SSE: partial lines, CR/LF split across chunks, whole lines", () => {
    const p = new SSEParser();
    assert.deepEqual(p.feed('data: {"type":"de'), []);
    assert.deepEqual(p.feed('lta"}\n'), []);
    assert.deepEqual(p.feed("\ndata: next").map((m) => m.data), ['{"type":"delta"}']);
    assert.deepEqual(p.finish().map((m) => m.data), ["next"]);
    assert.deepEqual(p.finish(), []);
    const q = new SSEParser();
    assert.deepEqual(q.feed("data: a\r"), []);
    assert.deepEqual(q.feed("\n\r").map((m) => m.data), ["a"]);
    assert.deepEqual(q.feed("\ndata: b\r\r").map((m) => m.data), ["b"]);
    assert.deepEqual(feedInChunks(": ping\n\n: ping\n\n\n\nevent: only\n\n", 3), []);
    const r = new SSEParser();
    assert.equal(r.feedLine("data: x"), null);
    assert.equal(r.feedLine(": comment"), null);
    assert.equal(r.feedLine("")?.data, "x");
    assert.equal(r.feedLine(""), null);
  });

  await check("SSE: a recorded stream parses the same in awkward chunks", async () => {
    const data = (await fsSource("coach/stream-electricity-CUST04974.sse"))!;
    const whole = SisuEventStreamParser.events(data);
    assert.ok(whole.length > 40);
    assert.equal(whole.filter((e) => SisuEvent.type(e) === "visual").length, 1);
    assert.ok(!whole.some((e) => e.kind === "unknown"), "every recorded event decodes");
    for (const size of [1, 7, 64, 1021]) {
      const parser = new SisuEventStreamParser();
      const events = [];
      for (let i = 0; i < data.length; i += size) events.push(...parser.feed(data.slice(i, i + size)));
      events.push(...parser.finish());
      assert.deepEqual(events, whole, `chunk ${size}`);
    }
  });

  await check("events: unknown types and bad payloads never throw", () => {
    assert.deepEqual(SisuEvent.decode('{"type":"hologram","x":1}'), { kind: "unknown", type: "hologram" });
    assert.deepEqual(SisuEvent.decode('{"type":"research","result":3}'), { kind: "unknown", type: "research" });
    assert.equal(SisuEvent.decode("not json"), null);
    const stage = SisuEvent.decode('{"type":"stage","stage":{"id":"t:9","kind":"hologram","title":"New","summary":"Soon","source":"x","toolCallId":null,"atMs":4,"facts":[],"data":{"kind":"hologram","depth":3}}}');
    assert.ok(stage?.kind === "stage" && stage.stage.data.kind === "unknown" && stage.stage.data.rawKind === "hologram");
  });

  await check("fixtures: every recorded stream holds only known events, investigations fill every stage", async () => {
    for (const id of FixtureAPI.customerIds) {
      const events = SisuEventStreamParser.events((await fsSource(`coach/stream-investigate-${id}.sse`))!);
      const stages = events.flatMap((e) => (e.kind === "stage" ? [e.stage] : []));
      assert.deepEqual(stages.map((s) => s.kind), StageKind.investigationOrder, id);
      stages.forEach((s) => assert.equal(s.data.kind, s.kind, `${id} ${s.kind}`));
      const plan = PlanEvent.events((await fsSource(`coach/stream-plan-${id}.sse`))!);
      assert.ok(!plan.some((e) => e.kind === "unknown"), `${id} plan`);
      assert.equal(plan[plan.length - 1].kind, "planDone");
    }
  });

  await check("fixture API: customers, overview, transactions and the offline scenario engine", async () => {
    const api = new FixtureAPI();
    const customers = await api.demoCustomers();
    assert.deepEqual(customers.map((c) => c.customerId).sort(), [...FixtureAPI.customerIds].sort());
    await assert.rejects(api.overview("CUST00000"), (e) => e instanceof SisuError && e.info.kind === "unknownCustomer");
    for (const id of FixtureAPI.customerIds) {
      const overview = await api.overview(id);
      assert.equal(overview.customerId, id);
      assert.ok((await api.transactions(id, { from: "2025-10-01", to: "2026-09-30", basket: "everyday" })).transactions.length > 0);
      for (const name of ["default", "nothing"]) {
        const recorded = (await FixtureAPI.load(`scenario-${id}-${name}`, (j) => j)) as ScenarioResponse;
        const ours = ScenarioEngine.run(overview, { ...recorded.input, oneOffEur: recorded.input.oneOffEur ?? 0 });
        assert.equal(ours.freedPerMonth, recorded.freedPerMonth);
        assert.deepEqual(ours.assumptions, recorded.assumptions);
        assert.deepEqual(ours.branches.map((b) => [b.id, b.label]), recorded.branches.map((b) => [b.id, b.label]));
        ours.branches.forEach((b, i) => b.points.forEach((p, j) => {
          const r = recorded.branches[i].points[j];
          for (const k of ["cash", "invested", "total", "totalLow", "totalHigh"] as const) assert.ok(Math.abs(p[k] - r[k]) <= 0.01, `${id} ${name} ${b.id} ${j} ${k}`);
        }));
      }
    }
  });

  await check("endpoints: escaping, query order, sorted scenario body, numbers", () => {
    assert.equal(Endpoints.overview("", "A B/c").url, "/api/customers/A%20B%2Fc/overview");
    assert.equal(Endpoints.transactions("http://x/", "C1", { from: "a", to: "b", basket: "regular", negativeBalance: false }).url,
      "http://x/api/customers/C1/transactions?from=a&to=b&basket=regular&negativeBalance=false");
    assert.equal(Endpoints.scenario("", "C1", { billSavingPerMonth: 15, everydayCutPct: 10, years: 5, oneOffEur: 0 }).body,
      '{"billSavingPerMonth":15,"customerId":"C1","everydayCutPct":10,"years":5}');
    assert.equal(CoachEndpoints.number(200), "200");
    assert.equal(CoachEndpoints.number(199.5), "199.5");
    assert.equal(CoachEndpoints.number(Number.NaN), "0");
    const turn = CoachEndpoints.voiceTurn("", aino, new Uint8Array([1, 2]), "a.m4a", "audio/mp4", [{ role: "user", content: "hi" }], "electricity");
    const form = turn.body as FormData;
    assert.equal(form.get("history"), '[{"content":"hi","role":"user"}]');
    assert.equal(form.get("focusBill"), "electricity");
    assert.equal(turn.headers.Accept, "text/event-stream");
  });

  await check("replay: a typed question gets the recorded turn of its kind", () => {
    const expected: [string, string | null][] = [
      ["Can you find me a cheaper electricity deal?", "electricity"], ["Onko halvempaa sähköä?", "electricity"],
      ["Is there a cheaper mobile plan?", null], ["Can I afford a 200 euro bike?", "afford"], ["Can I afford a 1,500 euro trip?", null],
      ["Remember that my electricity use is 3500 kWh a year", "remember"], ["Remember that I use 2000 kWh", null],
      ["How is my mortgage application going?", "mortgage"], ["Will I run out of money before payday?", "payday"],
      ["Which of my bills have gone up?", "bills"], ["Where does my money go?", "patterns"], ["What if I save 50 euros a month?", "whatif"],
      ["What if I cut my spending?", null], ["Explain why a buffer comes first", "teach"], ["Explain fixed and spot prices", null],
      ["How much do I spend on restaurants?", "category"], ["How much do I spend on groceries?", null],
      ["How much can I safely spend this week?", "spending"], ["Hello there", "spending"],
    ];
    for (const [question, turn] of expected) assert.equal(ReplayTransport.recordedTurn(question), turn, question);
    assert.equal(ReplayTransport.recordedTurn("Is there a better deal for this?", "electricity"), "electricity");
    assert.equal(ReplayTransport.recordedTurn("Is there a better deal for this?", "mobile"), null);
    assert.equal(ReplayTransport.firstNumber("a 1,500 euro trip"), 1500);
    assert.equal(ReplayTransport.firstNumber("about 12.5 percent."), 12.5);
    assert.equal(ReplayTransport.firstNumber("no number"), null);
  });

  await check("sample client: memory, research, mortgage, charts, errors", async () => {
    const client = CoachClient.sample(0);
    assert.equal(client.kind, "bundledSample");
    assert.equal((await client.warm()).mock, true);
    const saved = await client.confirmBill(aino, "bill-1", "My power", "electricity");
    assert.ok(saved.items.some((i) => i.key === "bill-1" && i.value === "My power"));
    assert.ok((await client.memory(aino)).items.some((i) => i.value === "My power"));
    assert.ok((await client.research(aino, "electricity")).offers.length > 0);
    assert.ok((await client.visuals(aino)).every((v) => v.content.kind !== "unknown"));
    assert.ok((await client.teachingCards(aino, "buffer-first")).length === 1);
    await client.mortgage(aino);
    await assert.rejects(client.overview("CUST00000"), (e) => e instanceof SisuError && e.info.kind === "unknownCustomer");
    await assert.rejects(client.affordability(aino, 7), (e) => CoachErrors.sentence(e) === ReplayTransport.notInSample);
    assert.equal(CoachErrors.sentence(SisuError.server(410, "x")), CoachErrors.expired);
    assert.equal(CoachErrors.sentence(SisuError.server(409, "")), CoachErrors.alreadyDecided);
  });

  await check("coach session: a typed question, an investigation, approve and approve again", async () => {
    const session = CoachSession.sample(aino, 0);
    const changes: number[] = [];
    session.subscribe(() => changes.push(1));
    const task = session.ask("  How much can I safely spend this week?  ");
    assert.equal(session.status, "thinking");
    assert.deepEqual(session.messages.map((m) => m.pending), [false, true]);
    await task;
    const reply = session.messages[1];
    assert.equal(session.messages[0].text, "How much can I safely spend this week?");
    assert.ok(reply.text.length > 0 && !reply.pending && reply.error === null && reply.grounding?.ok === true);
    assert.equal(session.status, "idle");
    assert.equal(session.dataLabel, "sample");
    assert.equal(session.ask("   "), null);
    assert.ok(changes.length > 10);

    await session.investigate();
    const investigation = session.messages[3];
    assert.deepEqual(investigation.stages.map((s) => s.kind), StageKind.investigationOrder);
    assert.equal(investigation.action?.status, "awaiting_approval");
    assert.equal(session.activity.state, "waiting_for_approval");
    const approved = await session.approve(investigation.action!.id);
    assert.equal(approved?.status, "executed_simulated");
    assert.ok(session.approvedMonthlySaving > 0);
    const last = session.messages[3].stages[session.messages[3].stages.length - 1];
    assert.ok(last.data.kind === "action" && last.data.action.status === "executed_simulated");
    assert.equal(await session.approve(investigation.action!.id), null);
    assert.equal(session.getSnapshot().notice, "This action was already approved.");
  });

  await check("plan session: a whole plan, then approve all", async () => {
    const pauses: number[] = [];
    const plan = new PlanSession(aino, CoachClient.sample(0), async (s) => { pauses.push(s); });
    assert.deepEqual(plan.view, PlanView.empty);
    const task = plan.start();
    assert.equal(plan.view.phase, "running");
    await task;
    const view = plan.view;
    assert.equal(view.phase, "done");
    assert.equal(view.customerName, "Aino");
    assert.equal(view.scan?.transactions, 172);
    assert.equal(view.findings.length, 4);
    assert.deepEqual(view.lanes.map((l) => l.billType).sort(), ["electricity", "internet", "mobile"]);
    assert.equal(view.calc?.totals.totalYearlyEur, 1770.96);
    assert.equal(view.actions.length, 4);
    assert.deepEqual(view.activity.label, "4 things set up");
    assert.ok(pauses.includes(2.7) && pauses.every((p) => p > 0 && p <= 2.7));
    const approved = await plan.approveAll();
    assert.equal(approved.length, 4);
    assert.equal(plan.view.activity.liito, "proud");
    assert.deepEqual(await plan.approveAll(), []);
  });

  await check("live client over fetch: a chunked stream, an HTTP error, offline and the fallback", async () => {
    const recorded = (await fsSource(`coach/stream-spending-${aino}.sse`))!;
    const seen: { url: string; init?: RequestInit }[] = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      if (String(url).includes("/api/coach/patterns")) return new Response('{"error":"Nope."}', { status: 429 });
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < recorded.length; i += 333) controller.enqueue(recorded.slice(i, i + 333));
          controller.close();
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }) as typeof fetch;
    const client = CoachClient.live("", fakeFetch);
    const events = [];
    for await (const event of client.ask({ customerId: aino, text: "hi", mode: "text" })) events.push(event);
    assert.deepEqual(events, SisuEventStreamParser.events(recorded));
    assert.equal(seen[0].url, "/api/agent/query");
    assert.equal(seen[0].init?.method, "POST");
    assert.equal(seen[0].init?.body, '{"customerId":"' + aino + '","mode":"text","text":"hi"}');
    await assert.rejects(client.patterns(aino), (e) => e instanceof SisuError && e.info.kind === "server" && e.info.status === 429 && e.info.message === "Nope.");

    const down = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
    await assert.rejects(CoachClient.live("", down).warm(), (e) => e instanceof SisuError && e.info.kind === "offline");
    const fallback = CoachClient.liveWithSampleFallback("", { fetchImpl: down, eventDelay: 0 });
    assert.equal(fallback.fallbackNotice, null);
    assert.equal((await fallback.warm()).mock, true);
    assert.equal(fallback.kind, "bundledSample");
    assert.equal(fallback.fallbackNotice, CoachClient.fallbackSentence);

    const session = new CoachSession(aino, CoachClient.sample(0.01));
    const turn = session.ask("Where does my money go?");
    session.cancel();
    await turn;
    assert.equal(session.status, "idle");
    assert.ok(session.messages.every((m) => !m.pending));
  });

  await check("agent turns never fall back to the sample once live; a voice question stopped early leaves nothing (14 Nov QA)", async () => {
    const recorded = (await fsSource(`coach/stream-spending-${aino}.sse`))!;
    let online = true;
    const urls: string[] = [];
    const flaky = (async (url: string | URL | Request) => {
      urls.push(String(url));
      if (!online) throw new TypeError("Failed to fetch");
      if (String(url).includes("/api/agent/warm")) return new Response('{"provider":"verda","mock":false,"model":"nemotron"}', { status: 200 });
      return new Response(new Blob([recorded.slice().buffer as ArrayBuffer]), { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }) as typeof fetch;
    const client = CoachClient.liveWithSampleFallback("", { fetchImpl: flaky, eventDelay: 0 });
    assert.equal((await client.warm()).mock, false);
    const session = new CoachSession(aino, client);
    online = false;
    await session.ask("Where does my money go?");
    const failed = session.messages[session.messages.length - 1];
    assert.ok(failed.error && failed.error !== "", "the turn fails with a sentence");
    assert.equal(client.kind, "live", "still live: no switch to the sample");
    assert.equal(client.fallbackNotice, null);
    assert.equal(session.getSnapshot().fallbackNotice, null);
    online = true;
    await session.ask("Where does my money go?");
    const answered = session.messages[session.messages.length - 1];
    assert.ok(answered.error === null && answered.text.length > 0, "back online: the same live server answers");
    assert.ok(urls.filter((u) => u.includes("/api/agent/query")).length >= 2, "both questions went to the server");

    // The server was unreachable from the start: turns answer from the recordings, as before.
    const down = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
    const fallback = CoachClient.liveWithSampleFallback("", { fetchImpl: down, eventDelay: 0 });
    await fallback.warm();
    const sampled = new CoachSession(aino, fallback);
    await sampled.ask("Where does my money go?");
    assert.equal(fallback.kind, "bundledSample");
    assert.ok(sampled.messages[1].text.length > 0 && sampled.messages[1].error === null, "the sample answers");

    // A voice question stopped before its words came back: no empty bubble, no empty answer.
    const slow = (async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as typeof fetch;
    const voice = new CoachSession(aino, CoachClient.live("", slow));
    const turn = voice.sendVoice(new Uint8Array([1, 2, 3]), "speech.webm", "audio/webm");
    assert.equal(voice.messages.length, 2, "a pending question and its reply");
    voice.cancel();
    await turn;
    assert.equal(voice.messages.length, 0, "both gone");
    // A voice question that failed before its words came back says so instead of an empty bubble.
    const broken = new CoachSession(aino, CoachClient.live("", down));
    await broken.sendVoice(new Uint8Array([1, 2, 3]), "speech.webm", "audio/webm");
    assert.equal(broken.messages[0].text, CoachSession.unheardText);
    assert.ok(broken.messages[1].error);
    assert.deepEqual(["", " (nothing heard) ", CoachSession.unheardText, "Where does my money go?"].map(CoachSession.isUnheard), [true, true, true, false]);
  });

  await check("answered, then offline → throws, kind stays live: one dropped project check is not a switch to the sample (15 Nov QA)", async () => {
    const recorded = (await fsSource(`coach/stream-spending-${aino}.sse`))!;
    let online = true;
    let slow = false;
    const urls: string[] = [];
    const flaky = (async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url));
      if (!online) throw new TypeError("Failed to fetch");
      if (slow) return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
      if (String(url).includes("/api/agent/warm")) return new Response('{"provider":"verda","mock":false,"model":"nemotron"}', { status: 200 });
      if (String(url).includes("/api/watch/check")) return new Response('{"customerId":"' + aino + '","notifications":[],"problems":[]}', { status: 200 });
      return new Response(new Blob([recorded.slice().buffer as ArrayBuffer]), { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }) as typeof fetch;
    const client = CoachClient.liveWithSampleFallback("", { fetchImpl: flaky, eventDelay: 0 });
    assert.equal((await client.warm()).mock, false);
    online = false;
    await assert.rejects(client.watchCheck(aino), (e) => e instanceof SisuError && e.info.kind === "offline", "the check fails for its caller");
    assert.equal(client.kind, "live", "kind stays live");
    assert.equal(client.fallbackNotice, null, "no sample banner");
    assert.equal(client.fallenBackAt, null);
    online = true;
    assert.deepEqual((await client.watchCheck(aino)).notifications, [], "the next check reaches the server");
    const session = new CoachSession(aino, client);
    await session.ask("What would spending 20% less at restaurants save?");
    assert.ok(urls.some((u) => u.includes("/api/agent/query")), "the typed question goes to the server");
    assert.equal(session.messages[session.messages.length - 1].error, null);
    // A timeout counts as offline: it is also only an error once the server has answered.
    slow = true;
    const quick = { ...CoachEndpoints.watchList("", aino), timeoutInterval: 0.01 };
    await assert.rejects(client.call(quick, (json) => json), (e) => e instanceof SisuError && e.info.kind === "offline", "a timeout fails for its caller");
    assert.equal(client.kind, "live", "still live after a timeout");

    // An agent turn that answered also counts: a later dropped request is still only an error.
    online = true; slow = false;
    const turnsFirst = CoachClient.liveWithSampleFallback("", { fetchImpl: flaky, eventDelay: 0 });
    await new CoachSession(aino, turnsFirst).ask("Where does my money go?");
    online = false;
    await assert.rejects(turnsFirst.watchCheck(aino));
    assert.equal(turnsFirst.kind, "live");
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
