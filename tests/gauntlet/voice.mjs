// The voice path, live, with a hard cap on what it spends: at most about 300 characters of text to speech and one
// transcription. ElevenLabs credit is scarce, so this runs once per night, not in a loop.
// Usage: node tests/gauntlet/voice.mjs [--json path]
import { writeFileSync } from "node:fs";
import { BASE, CUSTOMERS, nextVisitor, readEvents, summarise, table } from "./lib.mjs";

const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
let charsSpent = 0;

async function speak(text, format = "pcm") {
  charsSpent += text.length;
  const started = performance.now();
  const response = await fetch(`${BASE}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": nextVisitor() }, body: JSON.stringify({ text, format }) });
  if (!response.ok) return { ok: false, error: (await response.json().catch(() => ({}))).error ?? `HTTP ${response.status}` };
  const reader = response.body.getReader();
  const chunks = [];
  const first = await reader.read();
  const firstAudioMs = Math.round(performance.now() - started);
  if (first.value) chunks.push(first.value);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return { ok: true, firstAudioMs, totalMs: Math.round(performance.now() - started), bytes: chunks.reduce((n, c) => n + c.length, 0), cache: response.headers.get("x-sisu-tts-cache"), type: response.headers.get("content-type"), chunks };
}

// 1. Time to first audio for three fresh sentences, then one repeat to show the server cache.
const SENTENCES = ["You can safely spend about 164 euros this week.", "Your balance should be about 177 euros just before payday.", "Restaurants cost you about 277 euros in an average month."];
const fresh = [];
for (const sentence of SENTENCES) fresh.push(await speak(sentence));
const repeat = await speak(SENTENCES[0]);

// 2. One whole voice turn: a spoken question in, the agent's answer out, then the audio for its first sentence.
const question = await speak("How much can I safely spend this week?", "mp3");
let turn = null;
if (question.ok) {
  const form = new FormData();
  form.set("audio", new Blob(question.chunks, { type: question.type ?? "audio/mpeg" }), "question.mp3");
  form.set("customerId", CUSTOMERS.aino);
  const started = performance.now();
  const response = await fetch(`${BASE}/api/voice/turn`, { method: "POST", body: form, headers: { "x-forwarded-for": nextVisitor() } });
  turn = { status: response.status, transcript: null, sttMs: null, firstSentence: null, firstSentenceAtMs: null, answer: null, grounded: null, provider: null, error: null };
  if (response.ok) {
    for await (const event of readEvents(response)) {
      if (event.type === "start") turn.provider = event.provider;
      if (event.type === "transcript") Object.assign(turn, { transcript: event.text, sttMs: event.tookMs });
      if (event.type === "sentence" && turn.firstSentence === null) Object.assign(turn, { firstSentence: event.text, firstSentenceAtMs: Math.round(performance.now() - started) });
      if (event.type === "grounding") turn.grounded = event.grounding.ok;
      if (event.type === "done") turn.answer = event.text;
      if (event.type === "error") turn.error = event.message;
    }
    if (turn.firstSentence) {
      const audio = await speak(turn.firstSentence);
      turn.firstAudioAfterSentenceMs = audio.ok ? audio.firstAudioMs : null;
      turn.heardAtMs = audio.ok ? turn.firstSentenceAtMs + audio.firstAudioMs : null;
    }
  } else turn.error = (await response.json().catch(() => ({}))).error ?? `HTTP ${response.status}`;
}

const okFresh = fresh.filter((f) => f.ok);
console.log(`Server ${BASE} · ${charsSpent} characters of speech requested\n`);
console.log(
  table([
    ["Voice stage", "Measured"],
    ["---", "---"],
    ["Text to speech, time to first audio, fresh sentence (p50 / max, ms)", okFresh.length ? `${summarise(okFresh.map((f) => f.firstAudioMs)).p50} / ${summarise(okFresh.map((f) => f.firstAudioMs)).max} (n=${okFresh.length})` : `failed: ${fresh[0]?.error}`],
    ["Text to speech, whole sentence delivered (p50, ms)", okFresh.length ? String(summarise(okFresh.map((f) => f.totalMs)).p50) : "–"],
    ["Text to speech, repeated sentence from the server cache (ms)", repeat.ok ? `${repeat.firstAudioMs} (cache ${repeat.cache})` : `failed: ${repeat.error}`],
    ["Speech to text of a 3-second question (ms)", turn?.sttMs ?? `failed: ${turn?.error ?? question.error}`],
    ["Heard correctly", turn?.transcript ? `"${turn.transcript}"` : "–"],
    ["Voice turn: first sentence ready, from audio upload (ms)", turn?.firstSentenceAtMs ?? "–"],
    ["Voice turn: first audio of the answer, from audio upload (ms)", turn?.heardAtMs ?? "–"],
    ["Answer", turn?.answer ? `"${turn.answer}" (numbers sourced: ${turn.grounded})` : "–"],
  ]),
);
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ base: BASE, at: new Date().toISOString(), charsSpent, fresh: fresh.map((sample) => ({ ...sample, chunks: undefined })), repeat: { ...repeat, chunks: undefined }, turn }, null, 2));
