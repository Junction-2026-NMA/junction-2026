// Shared helpers for the gauntlet scripts: talk to a running Sisu server, collect a turn, and do the statistics.
export const BASE = process.env.SISU_BASE ?? "http://localhost:3310";
export const CUSTOMERS = { aino: "CUST04974", eetu: "CUST04414", sanna: "CUST02003" };

let visitor = 0;
// Every simulated visitor gets its own address, so the per-visitor rate limit behaves as it would for real users.
export const nextVisitor = () => `10.0.${Math.floor(visitor / 250)}.${(visitor++ % 250) + 1}`;

export async function* readEvents(response) {
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

// Runs one turn and returns everything that happened, with client-side timings.
export async function runTurn(body, { path = "/api/agent/query", base = BASE, visitorId = nextVisitor(), signal } = {}) {
  const started = performance.now();
  const turn = {
    status: 0,
    events: [],
    types: [],
    text: "",
    sentences: [],
    tools: [],
    stages: [],
    research: null,
    action: null,
    citations: [],
    timings: null,
    error: null,
    provider: null,
    usedBackup: false,
    clientMs: { firstEvent: null, firstDelta: null, firstSpeakable: null, done: null },
  };
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-forwarded-for": visitorId },
    body: JSON.stringify(body),
  });
  turn.status = response.status;
  if (!response.ok) {
    turn.error = (await response.json().catch(() => ({}))).error ?? `HTTP ${response.status}`;
    return turn;
  }
  for await (const event of readEvents(response)) {
    const at = Math.round(performance.now() - started);
    turn.events.push(event);
    turn.types.push(event.type);
    turn.clientMs.firstEvent ??= at;
    if (event.type === "start") turn.provider = event.provider;
    if (event.type === "delta") turn.clientMs.firstDelta ??= at;
    if (event.type === "filler" || event.type === "sentence") turn.clientMs.firstSpeakable ??= at;
    if (event.type === "sentence") turn.sentences.push(event.text);
    if (event.type === "tool_end") turn.tools.push(event.trace);
    if (event.type === "stage") turn.stages.push(event.stage);
    if (event.type === "research") turn.research = event.result;
    if (event.type === "action") turn.action = event.action;
    if (event.type === "error") turn.error = event.message;
    if (event.type === "done") {
      turn.text = event.text;
      turn.citations = event.citations;
      turn.timings = event.timings;
      turn.usedBackup = event.timings.modelSteps.some((step) => step.usedBackup);
      turn.clientMs.done = at;
    }
  }
  return turn;
}

export function percentile(values, p) {
  const sorted = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  if (!sorted.length) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * (rank - low));
}

export const summarise = (values) => ({ n: values.filter((v) => typeof v === "number").length, p50: percentile(values, 50), p95: percentile(values, 95), min: percentile(values, 0), max: percentile(values, 100) });

// Every number in a piece of text, as plain numbers ("1,234.50" and "€40" both work).
export function numbersIn(text) {
  return [...String(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((match) => Number(match[0].replace(/,/g, ""))).filter((n) => Number.isFinite(n));
}

export async function getJson(path, { base = BASE, method = "GET", body, visitorId = nextVisitor() } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-forwarded-for": visitorId },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

export const table = (rows) => rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
