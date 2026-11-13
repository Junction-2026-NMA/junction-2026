// Drives the agent endpoints on a running dev server and prints what happened and how long each part took.
// Usage: node tests/agent-latency.mjs [baseUrl] [customerId]
const BASE = process.argv[2] ?? "http://localhost:3000";
const CUSTOMER = process.argv[3] ?? "CUST04974";

async function* readEvents(response) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const bytes of response.body) {
    buffer += decoder.decode(bytes, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";
    for (const message of messages) {
      if (message.startsWith("data: ")) yield JSON.parse(message.slice(6));
    }
  }
}

async function firstAudioMs(text) {
  const started = Date.now();
  const response = await fetch(`${BASE}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!response.ok) return { error: (await response.json()).error };
  const reader = response.body.getReader();
  await reader.read();
  const first = Date.now() - started;
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
  }
  return { first, total: Date.now() - started, cache: response.headers.get("x-sisu-tts-cache"), bytes };
}

async function runTurn(label, response, speak = true) {
  const started = Date.now();
  const at = () => `${((Date.now() - started) / 1000).toFixed(2)}s`;
  console.log(`\n=== ${label}`);
  if (!response.ok) {
    console.log(`  HTTP ${response.status}: ${JSON.stringify(await response.json())}`);
    return;
  }
  let firstSpeakable = null;
  for await (const event of readEvents(response)) {
    if (event.type === "start") console.log(`  ${at()} start · ${event.provider} · ${event.model}${event.mock ? " · MOCK" : ""}`);
    if (event.type === "transcript") console.log(`  ${at()} heard: "${event.text}" (speech to text ${event.tookMs} ms)`);
    if (event.type === "speculation") console.log(`  ${at()} speculation: started ${event.billType} research early`);
    if (event.type === "tool_start") console.log(`  ${at()} tool start: ${event.name} ${JSON.stringify(event.args)}`);
    if (event.type === "filler") {
      console.log(`  ${at()} FILLER: "${event.text}"`);
      firstSpeakable ??= { text: event.text, at: Date.now() - started };
    }
    if (event.type === "tool_end") console.log(`  ${at()} tool end: ${event.trace.name} ${event.trace.ok ? "ok" : "FAILED"} in ${event.trace.tookMs} ms${event.trace.joinedPrefetch ? " (joined a run already in flight)" : ""} · ${event.trace.summary}`);
    if (event.type === "research") console.log(`  ${at()} research: ${event.result.status}, ${event.result.offers.length} offers, pages ${event.result.pagesDone}/${event.result.pagesTotal}, best: ${event.result.best ? `${event.result.best.provider} ${event.result.best.plan ?? ""} (€${event.result.best.estimatedMonthlyCostEur}/mo, saves €${event.result.best.estimatedYearlySavingEur}/yr)` : "none"}${event.result.errors.length ? ` · problems: ${event.result.errors.join("; ")}` : ""}`);
    if (event.type === "sentence") {
      console.log(`  ${at()} sentence ${event.index}: "${event.text}"`);
      firstSpeakable ??= { text: event.text, at: Date.now() - started };
    }
    if (event.type === "error") console.log(`  ${at()} ERROR: ${event.message}`);
    if (event.type === "done") {
      const t = event.timings;
      console.log(`  ${at()} done · first token ${t.firstTokenMs} ms · first sentence ${t.firstSentenceMs} ms · total ${t.totalMs} ms · model steps ${t.modelSteps.map((s) => `${s.firstTokenMs ?? "-"}/${s.totalMs}`).join(", ")} · sources ${event.citations.length}`);
    }
  }
  if (speak && firstSpeakable) {
    const audio = await firstAudioMs(firstSpeakable.text);
    console.log(audio.error ? `  voice: ${audio.error}` : `  voice: first thing to say was ready at ${(firstSpeakable.at / 1000).toFixed(2)}s; its audio started ${audio.first} ms later (cache ${audio.cache}) → user hears Sisu at about ${((firstSpeakable.at + audio.first) / 1000).toFixed(2)}s`);
  }
}

const ask = (text, extra = {}) =>
  fetch(`${BASE}/api/agent/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: CUSTOMER, text, mode: "voice", ...extra }) });

await runTurn("1. Answerable from the summary (no tools expected)", await ask("How much can I safely spend this week?"));
await runTurn("2. Needs a finance tool", await ask("How much did I spend on restaurants last month?"));
await runTurn("3. Offer research, cold (speculation + filler expected)", await ask("Can you find me a cheaper electricity deal?"));
await runTurn("4. Same question again (should reuse the finished research)", await ask("Is there a cheaper electricity deal for me?"));
await runTurn("5. Mentions electricity but needs no research", await ask("How much do I pay for electricity each month?"));
await runTurn("6. Outside fact (web search)", await ask("What is the general housing allowance from Kela?"));

// A full voice turn: make a spoken question with text to speech, then send it as if it were recorded.
const clip = await fetch(`${BASE}/api/voice/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "What happens if I save fifty euros a month for five years?" }) });
if (clip.ok) {
  const form = new FormData();
  form.set("audio", new Blob([await clip.arrayBuffer()], { type: clip.headers.get("content-type") ?? "audio/mpeg" }), "question.mp3");
  form.set("customerId", CUSTOMER);
  await runTurn("7. Full voice turn (audio in)", await fetch(`${BASE}/api/voice/turn`, { method: "POST", body: form }));
}

const bad = await fetch(`${BASE}/api/agent/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: "nope", text: "hi" }) });
console.log(`\n=== 8. Bad input → HTTP ${bad.status} ${JSON.stringify(await bad.json())}`);
