// One isolated visitor, end to end, against a hosted Sisu (per-visitor sessions): the other gauntlet scripts send no
// session, so on a hosted site every request of theirs is a new visitor and an approval never finds its action.
// reset -> financial question -> calculation -> live research -> a transfer drafted -> Approve -> balance moved ->
// audit log; then a second visitor checks it sees none of it. Optional: --voice (one TTS + one spoken turn, macOS
// ffmpeg), --abort (a request cut off mid-stream, then the next one still works).
// Run: SISU_BASE=https://sisu-api.vercel.app node tests/gauntlet/hosted-e2e.mjs [--voice] [--abort]
// Cost with live keys: about 5 model turns, 1-2 Exa searches, up to 3 page reads, and with --voice ~200 TTS chars.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEvents } from "./lib.mjs";

const BASE = process.env.SISU_BASE ?? "https://sisu-api.vercel.app";
const CUSTOMER = process.env.SISU_CUSTOMER ?? "CUST04974"; // Aino
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  - ${detail}` : ""}`);
};

function visitor() {
  let session = null;
  const headers = (extra = {}) => ({ ...extra, ...(session ? { "X-Sisu-Session": session } : {}) });
  const remember = (response) => { session ??= response.headers.get("x-sisu-session"); return response; };
  return {
    get session() { return session; },
    get: (path) => fetch(`${BASE}${path}`, { headers: headers() }).then(remember),
    post: (path, body, signal) =>
      fetch(`${BASE}${path}`, { method: "POST", signal, headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) }).then(remember),
    postForm: (path, form) => fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: form }).then(remember),
  };
}

async function turn(v, text, history = []) {
  const started = performance.now();
  const response = await v.post("/api/agent/query", { customerId: CUSTOMER, text, mode: "text", history });
  const out = { status: response.status, types: [], text: "", action: null, research: null, calc: null, visual: null, grounding: null, provider: null, firstDeltaMs: null, ms: 0, error: null };
  if (!response.ok) return { ...out, error: `HTTP ${response.status}` };
  for await (const event of readEvents(response)) {
    out.types.push(event.type);
    if (event.type === "start") out.provider = event.provider;
    if (event.type === "delta") out.firstDeltaMs ??= Math.round(performance.now() - started);
    if (event.type === "action") out.action = event.action;
    if (event.type === "research") out.research = event.result;
    if (event.type === "calc") out.calc = event;
    if (event.type === "visual") out.visual = event.visual;
    if (event.type === "grounding") out.grounding = event.grounding;
    if (event.type === "done") out.text = event.text ?? out.text;
    if (event.type === "error") out.error = event.message;
  }
  out.ms = Math.round(performance.now() - started);
  return out;
}

const brief = (t) => `${t.ms} ms, first words ${t.firstDeltaMs ?? "-"} ms, ${t.provider ?? "?"}, events ${[...new Set(t.types)].join(",")}`;

async function main() {
  console.log(`Sisu hosted end-to-end against ${BASE}, customer ${CUSTOMER}\n`);
  const a = visitor();

  const demo = await a.get("/api/customers/demo");
  record("demo customers load", demo.ok, `HTTP ${demo.status}`);
  const reset = await a.post("/api/demo/reset", {}); // a stateful route: issues the visitor's session
  record("reset own state, session issued", reset.ok && Boolean(a.session), `HTTP ${reset.status}, session ${a.session ? a.session.slice(0, 6) + "…" : "none"}`);

  const why = await turn(a, "Why do I run out of money before payday?");
  record("financial question answered", !why.error && why.text.length > 20 && why.types.includes("done"), `${brief(why)} | "${why.text.slice(0, 140)}"`);
  record("streamed (first words before done)", why.firstDeltaMs !== null && why.firstDeltaMs < why.ms, `first words ${why.firstDeltaMs} ms of ${why.ms} ms`);
  record("served by our Verda GPU", why.provider === "verda", `provider ${why.provider}`);

  const calc = await turn(a, "What if I spent a third less on eating out?");
  record("verified calculation", !calc.error && (calc.types.includes("calc") || calc.types.includes("grounding")), `${brief(calc)} | "${calc.text.slice(0, 140)}"`);

  const research = await turn(a, "Is there a cheaper electricity contract for me?");
  const sources = research.research ? JSON.stringify(research.research).match(/https?:\/\/[^"]+/g) ?? [] : [];
  record("live research with sources", !research.error && Boolean(research.research) && sources.length > 0, `${brief(research)} | ${sources.length} links, e.g. ${sources[0] ?? "-"}`);

  const draft = await turn(a, "Set up a standing order of 91 euros a month into my savings.");
  record("action drafted, waiting for approval", Boolean(draft.action) && draft.action.status === "awaiting_approval", `${brief(draft)} | ${draft.action ? `${draft.action.kind} ${draft.action.status} ${draft.action.title ?? ""}` : "no action"}`);

  if (draft.action) {
    const before = await (await a.get(`/api/accounts?customerId=${CUSTOMER}`)).json();
    const approve = await a.post(`/api/actions/${draft.action.id}/approve`, { customerId: CUSTOMER, confirm: true });
    const approved = await approve.json();
    record("approved by the button, executed in demo bank", approve.ok && ["approved", "executed_simulated"].includes(approved.action?.status), `HTTP ${approve.status} ${approved.action?.status ?? approved.error} execution ${JSON.stringify(approved.action?.execution ?? null).slice(0, 160)}`);
    const after = await (await a.get(`/api/accounts?customerId=${CUSTOMER}`)).json();
    record("accounts readable after approval", Boolean(after) && JSON.stringify(after) !== "null", `before ${JSON.stringify(before).length}B, after ${JSON.stringify(after).length}B, changed ${JSON.stringify(before) !== JSON.stringify(after)}`);
    const again = await a.post(`/api/actions/${draft.action.id}/approve`, { customerId: CUSTOMER, confirm: true });
    record("second approval refused (no double transfer)", !again.ok, `HTTP ${again.status}`);
  }

  const audit = await (await a.get(`/api/audit?customerId=${CUSTOMER}`)).json().catch(() => null);
  record("audit log present", Boolean(audit), JSON.stringify(audit).slice(0, 160));

  const b = visitor();
  await b.post("/api/demo/reset", {});
  const bActions = await (await b.get(`/api/actions?customerId=${CUSTOMER}`)).json().catch(() => null);
  const aActions = await (await a.get(`/api/actions?customerId=${CUSTOMER}`)).json().catch(() => null);
  const count = (x) => (Array.isArray(x) ? x.length : Array.isArray(x?.actions) ? x.actions.length : -1);
  record("second visitor isolated", b.session !== a.session && count(bActions) === 0 && count(aActions) > 0, `A ${count(aActions)} actions, B ${count(bActions)}`);

  if (process.argv.includes("--abort")) {
    const controller = new AbortController();
    const cut = a.post("/api/agent/query", { customerId: CUSTOMER, text: "What kind of spender am I?", mode: "text" }, controller.signal);
    setTimeout(() => controller.abort(), 700);
    await cut.then((r) => r.body?.cancel()).catch(() => {});
    const next = await turn(a, "How much did I spend on groceries last month?");
    record("next turn fine after an interrupted one", !next.error && next.text.length > 10, `${brief(next)} | "${next.text.slice(0, 100)}"`);
  }

  if (process.argv.includes("--voice")) {
    const tts = await a.post("/api/voice/tts", { text: "Hei, I am Sisu." });
    const bytes = tts.ok ? (await tts.arrayBuffer()).byteLength : 0;
    record("voice: text to speech", tts.ok && bytes > 1000, `HTTP ${tts.status} ${bytes} bytes ${tts.headers.get("content-type")}`);
    // The question is spoken by Sisu's own voice (raw 24 kHz PCM), wrapped as WAV with ffmpeg: no macOS `say` needed.
    const question = await a.post("/api/voice/tts", { text: "How much can I safely spend this week?" });
    const dir = mkdtempSync(join(tmpdir(), "sisu-voice-"));
    writeFileSync(join(dir, "q.pcm"), Buffer.from(await question.arrayBuffer()));
    execFileSync("ffmpeg", ["-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", join(dir, "q.pcm"), join(dir, "q.wav")], { timeout: 20_000 });
    const form = new FormData();
    form.append("audio", new Blob([readFileSync(join(dir, "q.wav"))], { type: "audio/wav" }), "q.wav");
    form.append("customerId", CUSTOMER);
    const started = performance.now();
    const spoken = await a.postForm("/api/voice/turn", form);
    let transcript = "", text = "", audioEvents = 0;
    if (spoken.ok) for await (const event of readEvents(spoken)) {
      if (event.type === "transcript") transcript = event.text;
      if (event.type === "done") text = event.text;
      if (event.type === "audio" || event.type === "sentence") audioEvents++;
    }
    record("voice: spoken question answered", spoken.ok && /spend/i.test(transcript) && text.length > 10, `HTTP ${spoken.status} ${Math.round(performance.now() - started)} ms | heard "${transcript}" | "${text.slice(0, 100)}" | ${audioEvents} speakable`);
  }

  await a.post("/api/demo/reset", {}); // leave nothing running for this visitor
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
