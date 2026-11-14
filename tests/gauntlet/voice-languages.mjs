// Voice in other languages, live: for each language a spoken question is made with text to speech, sent as a
// recording with the language left on "auto", and the reply is checked: was the language heard, did Sisu answer
// in it, are its numbers sourced, and how long until its first audio.
// Cost of one run: about 900 characters of speech and 7 transcriptions.
// Usage: node tests/gauntlet/voice-languages.mjs [--json path]
import { writeFileSync } from "node:fs";
import { BASE, CUSTOMERS, nextVisitor, readEvents, table } from "./lib.mjs";

const jsonPath = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

// `inLanguage` is a rough check that the answer is in the right language: its script, or a few of its common words.
const CASES = [
  { code: "fi", name: "Finnish", question: "Paljonko voin käyttää rahaa tällä viikolla?", inLanguage: /\b(voit|euroa|viikossa|viikolla|tällä)\b/i },
  { code: "sv", name: "Swedish", question: "Hur mycket kan jag spendera den här veckan?", inLanguage: /\b(du kan|veckan|den här|ungefär|euro)\b/i },
  { code: "de", name: "German", question: "Wie viel kann ich diese Woche sicher ausgeben?", inLanguage: /\b(du kannst|sie können|diese woche|etwa|ungefähr|ausgeben)\b/i },
  { code: "hi", name: "Hindi", question: "मैं इस हफ्ते कितना पैसा खर्च कर सकता हूँ?", inLanguage: /[ऀ-ॿ]{3,}/ },
  { code: "ta", name: "Tamil", question: "இந்த வாரம் நான் எவ்வளவு பணம் செலவு செய்யலாம்?", inLanguage: /[஀-௿]{3,}/ },
  { code: "ar", name: "Arabic", question: "كم يمكنني أن أنفق هذا الأسبوع؟", inLanguage: /[؀-ۿ]{3,}/ },
  { code: "fi", name: "Finnish, with live research", question: "Löydätkö minulle halvemman sähkösopimuksen?", inLanguage: /\b(sähkö|euroa|vuodessa|kuukaudessa|sopimus)/i, expectTool: "search_offers" },
];

async function speak(text, language, format) {
  const started = performance.now();
  const response = await fetch(`${BASE}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": nextVisitor() }, body: JSON.stringify({ text, format, language }) });
  if (!response.ok) return { ok: false, error: (await response.json().catch(() => ({}))).error ?? `HTTP ${response.status}` };
  const reader = response.body.getReader();
  const first = await reader.read();
  const firstAudioMs = Math.round(performance.now() - started);
  const chunks = first.value ? [first.value] : [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return { ok: true, firstAudioMs, chunks, type: response.headers.get("content-type") };
}

const rows = [];
for (const c of CASES) {
  const row = { ...c, inLanguage: undefined, heard: null, heardLanguage: null, probability: null, sttMs: null, answer: null, answeredInLanguage: false, grounded: null, tools: [], filler: null, firstSentenceMs: null, firstAudioMs: null, error: null };
  const clip = await speak(c.question, c.code, "mp3");
  if (!clip.ok) {
    rows.push({ ...row, error: clip.error });
    continue;
  }
  const form = new FormData();
  form.set("audio", new Blob(clip.chunks, { type: clip.type ?? "audio/mpeg" }), "question.mp3");
  form.set("customerId", CUSTOMERS.aino);
  form.set("language", "auto");
  const started = performance.now();
  const response = await fetch(`${BASE}/api/voice/turn`, { method: "POST", body: form, headers: { "x-forwarded-for": nextVisitor() } });
  let firstSentence = null;
  for await (const event of readEvents(response)) {
    if (event.type === "transcript") Object.assign(row, { heard: event.text, heardLanguage: event.language ?? null, probability: event.languageProbability ?? null, sttMs: event.tookMs });
    if (event.type === "filler") row.filler = event.text;
    if (event.type === "tool_end") row.tools.push(event.trace.name);
    if (event.type === "sentence" && firstSentence === null) {
      firstSentence = event.text;
      row.firstSentenceMs = Math.round(performance.now() - started);
    }
    if (event.type === "grounding") row.grounded = event.grounding.ok;
    if (event.type === "done") row.answer = event.text;
    if (event.type === "error") row.error = event.message;
  }
  row.answeredInLanguage = !!row.answer && c.inLanguage.test(row.answer);
  if (firstSentence) {
    const audio = await speak(firstSentence, row.heardLanguage ?? c.code, "pcm");
    row.firstAudioMs = audio.ok ? row.firstSentenceMs + audio.firstAudioMs : null;
  }
  row.pass = !row.error && row.heardLanguage === c.code && row.answeredInLanguage && row.grounded === true && (!c.expectTool || row.tools.includes(c.expectTool));
  rows.push(row);
  console.log(`\n[${c.name}] asked: ${c.question}\n  heard (${row.heardLanguage}, ${row.probability}): ${row.heard}\n  ${row.filler ? `filler: ${row.filler}\n  ` : ""}answer: ${row.answer}\n  tools: ${row.tools.join(", ") || "none"} · numbers sourced: ${row.grounded} · first audio ${row.firstAudioMs} ms${row.error ? ` · ERROR ${row.error}` : ""}`);
}

console.log(`\n${table([["Language", "Heard as", "Answered in it", "Numbers sourced", "Speech to text ms", "First audio ms", "Pass"], ["---", "---", "---", "---", "---", "---", "---"], ...rows.map((r) => [r.name, r.heardLanguage ?? "–", r.answeredInLanguage ? "yes" : "NO", String(r.grounded), r.sttMs ?? "–", r.firstAudioMs ?? "–", r.pass ? "yes" : "NO"])])}`);
console.log(`\n${rows.filter((r) => r.pass).length} of ${rows.length} passed.`);
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ base: BASE, at: new Date().toISOString(), rows: rows.map((r) => ({ ...r, inLanguage: undefined })) }, null, 2));
process.exitCode = rows.every((r) => r.pass) ? 0 : 1;
