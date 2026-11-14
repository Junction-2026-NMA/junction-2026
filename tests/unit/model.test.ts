import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { sse, stubFetch } from "./helpers";
import { type ModelChunk, streamChat } from "@/lib/agent/model";

const VERDA = "http://verda.test/v1";
const NVIDIA = "http://nvidia.test/v1";
const text = (content: string) => ({ choices: [{ delta: { content } }] });
const toolPart = (index: number, part: { id?: string; name?: string; arguments?: string }) => ({ choices: [{ delta: { tool_calls: [{ index, id: part.id, function: { name: part.name, arguments: part.arguments } }] } }] });

async function run(): Promise<{ text: string; end: Extract<ModelChunk, { type: "end" }> }> {
  let said = "";
  let end: Extract<ModelChunk, { type: "end" }> | null = null;
  for await (const chunk of streamChat({ messages: [{ role: "user", content: "Hi" }], tools: [], maxTokens: 50 })) {
    if (chunk.type === "delta") said += chunk.text;
    else end = chunk;
  }
  assert.ok(end, "the stream ended with a summary chunk");
  return { text: said, end };
}

// A response whose body sends some lines and then breaks, as a dropped connection does.
function breaksAfter(lines: unknown[]): Response {
  const encoder = new TextEncoder();
  let sent = false;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent) return controller.error(new Error("connection reset"));
        sent = true;
        controller.enqueue(encoder.encode(lines.map((line) => `data: ${JSON.stringify(line)}\n\n`).join("")));
      },
    }),
  );
}

describe("model client: failover between our GPU and the backup", () => {
  let restore = () => {};
  const saved = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, { MODEL_PROVIDER: "verda", MODEL_FALLBACK: "nvidia", VERDA_BASE_URL: VERDA, VERDA_API_KEY: "test", NEMOTRON_BASE_URL: NVIDIA, NEMOTRON_API_KEY: "test", MODEL_FIRST_TOKEN_LIMIT_MS: "120" });
  });
  afterEach(() => {
    restore();
    for (const key of ["MODEL_PROVIDER", "MODEL_FALLBACK", "VERDA_BASE_URL", "VERDA_API_KEY", "NEMOTRON_BASE_URL", "NEMOTRON_API_KEY", "MODEL_FIRST_TOKEN_LIMIT_MS"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("uses our own GPU when it answers, with thinking switched off", async () => {
    const calls: string[] = [];
    let body: Record<string, unknown> = {};
    restore = stubFetch((url, init) => {
      calls.push(url);
      body = JSON.parse(String(init?.body));
      return sse([text("Hello "), text("there."), "[DONE]"]);
    });
    const { text: said, end } = await run();
    assert.equal(said, "Hello there.");
    assert.deepEqual([end.provider, end.usedBackup], ["verda", false]);
    assert.deepEqual(calls, [`${VERDA}/chat/completions`]);
    assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
    assert.equal(body.stream, true);
  });

  it("switches to the backup when our GPU returns an error", async () => {
    restore = stubFetch((url) => (url.startsWith(VERDA) ? new Response("overloaded", { status: 503 }) : sse([text("Backup here."), "[DONE]"])));
    const { text: said, end } = await run();
    assert.equal(said, "Backup here.");
    assert.deepEqual([end.provider, end.usedBackup], ["nvidia", true]);
  });

  it("switches to the backup when our GPU cannot be reached at all", async () => {
    restore = stubFetch((url) => {
      if (url.startsWith(VERDA)) throw new TypeError("fetch failed");
      return sse([text("Backup here."), "[DONE]"]);
    });
    assert.equal((await run()).end.usedBackup, true);
  });

  it("switches to the backup when our GPU accepts the request and then says nothing", async () => {
    let verdaAborted = false;
    restore = stubFetch(
      (url, init) =>
        url.startsWith(VERDA)
          ? new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => ((verdaAborted = true), reject(new DOMException("aborted", "AbortError")))))
          : sse([text("Backup here."), "[DONE]"]),
    );
    const started = Date.now();
    const { end } = await run();
    assert.equal(end.usedBackup, true);
    assert.ok(Date.now() - started < 1_000, "the switch happens at the stall limit, not at the long timeout");
    assert.equal(verdaAborted, true, "the stalled request is cancelled, not left running");
  });

  it("does NOT switch while our GPU is busy writing a long tool call", async () => {
    const encoder = new TextEncoder();
    const calls: string[] = [];
    restore = stubFetch((url) => {
      calls.push(url);
      const parts = [toolPart(0, { id: "c1", name: "search_offers", arguments: '{"bill' }), toolPart(0, { arguments: 'Type":"elec' }), toolPart(0, { arguments: 'tricity"}' })];
      let index = 0;
      return new Response(
        new ReadableStream<Uint8Array>({
          async pull(controller) {
            if (index >= parts.length) return controller.close();
            if (index > 0) await new Promise((resolve) => setTimeout(resolve, 150)); // slower than the stall limit, but alive
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(parts[index++])}\n\n`));
          },
        }),
      );
    });
    const { end } = await run();
    assert.deepEqual(calls, [`${VERDA}/chat/completions`]);
    assert.equal(end.usedBackup, false);
    assert.deepEqual(end.toolCalls, [{ id: "c1", type: "function", function: { name: "search_offers", arguments: '{"billType":"electricity"}' } }]);
  });

  it("hands a step to the backup if our GPU's connection breaks before it has said anything", async () => {
    restore = stubFetch((url) => (url.startsWith(VERDA) ? breaksAfter([toolPart(0, { id: "c1", name: "get_spending", arguments: '{"from":' })]) : sse([toolPart(0, { id: "b1", name: "get_spending", arguments: '{"from":"2026-09-01","to":"2026-09-30"}' }), "[DONE]"])));
    const { end } = await run();
    assert.equal(end.usedBackup, true);
    assert.equal(end.toolCalls[0].id, "b1");
    assert.doesNotThrow(() => JSON.parse(end.toolCalls[0].function.arguments));
  });

  it("does not replay an answer the user has already started hearing", async () => {
    restore = stubFetch((url) => (url.startsWith(VERDA) ? breaksAfter([text("You can spend ")]) : sse([text("Backup."), "[DONE]"])));
    await assert.rejects(run());
  });

  it("fails clearly when both hosts are down", async () => {
    restore = stubFetch(() => new Response("down", { status: 500 }));
    await assert.rejects(run(), /reasoning model returned an error/);
  });

  it("puts several tool calls back together and ignores malformed stream lines", async () => {
    restore = stubFetch(() => sse([": keep-alive", "{not json", toolPart(1, { id: "b", name: "list_bills", arguments: "{}" }), toolPart(0, { id: "a", name: "get_cash_flow" }), toolPart(0, { arguments: "{}" }), { choices: [] }, "[DONE]"]));
    const { end } = await run();
    assert.deepEqual(end.toolCalls.map((c) => [c.id, c.function.name, c.function.arguments]), [["a", "get_cash_flow", "{}"], ["b", "list_bills", "{}"]]);
  });

  it("without a backup configured, an error is reported instead of hidden", async () => {
    delete process.env.MODEL_FALLBACK;
    restore = stubFetch(() => new Response("down", { status: 500 }));
    await assert.rejects(run());
  });

  it("names the missing setting, never a key value, when a host is not configured", async () => {
    delete process.env.MODEL_FALLBACK;
    process.env.VERDA_API_KEY = "";
    restore = stubFetch(() => sse(["[DONE]"]));
    await assert.rejects(run(), /VERDA_API_KEY is empty/);
  });
});
