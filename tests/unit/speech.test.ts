import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { stubFetch } from "./helpers";
import { synthesize } from "@/lib/agent/speech";

const read = async (body: ReadableStream<Uint8Array> | Uint8Array) => (body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer()));

// A streamed audio response that takes a little while, like a real synthesis.
function slowAudio(onDone: () => void): Response {
  let sent = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise((resolve) => setTimeout(resolve, 15));
        if (sent++ < 3) return controller.enqueue(new Uint8Array(64));
        onDone();
        controller.close();
      },
    }),
  );
}

describe("text to speech: never more requests open than the plan allows", () => {
  let restore = () => {};
  const saved = { ...process.env };
  beforeEach(() => Object.assign(process.env, { MODEL_PROVIDER: "nvidia", ELEVENLABS_API_KEY: "test", ELEVENLABS_VOICE_ID: "voice0123456789", ELEVENLABS_MAX_CONCURRENT: "2" }));
  afterEach(() => {
    restore();
    for (const key of ["MODEL_PROVIDER", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MAX_CONCURRENT"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  // Regression: live browser check. A six-sentence answer opened six requests and ElevenLabs rejected them
  // ("maximum of 2 concurrent requests"), so the voice fell silent.
  it("a six-sentence answer is spoken in full, two requests at a time", async () => {
    let open = 0;
    let peak = 0;
    restore = stubFetch(() => {
      open += 1;
      peak = Math.max(peak, open);
      if (open > 2) return new Response('{"detail":{"code":"concurrent_limit_exceeded"}}', { status: 429 });
      return slowAudio(() => void (open -= 1));
    });
    const sentences = Array.from({ length: 6 }, (_, i) => `Sentence number ${i} of a long answer, run ${Math.random()}.`);
    const clips = await Promise.all(sentences.map(async (text) => read((await synthesize(text)).body)));
    assert.equal(peak, 2);
    assert.ok(clips.every((clip) => clip.length === 192));
  });

  it("frees its place when a request fails, so later sentences are not stuck", async () => {
    let calls = 0;
    restore = stubFetch(() => (++calls <= 2 ? new Response("boom", { status: 500 }) : slowAudio(() => undefined)));
    await assert.rejects(synthesize(`Fails ${Math.random()}`));
    await assert.rejects(synthesize(`Fails ${Math.random()}`));
    const ok = await Promise.all([1, 2, 3].map(async () => read((await synthesize(`Works ${Math.random()}`)).body)));
    assert.equal(ok.length, 3);
  });

  it("tries once more when another app on the account holds the slot", async () => {
    let calls = 0;
    restore = stubFetch(() => (++calls === 1 ? new Response('{"detail":{"code":"concurrent_limit_exceeded"}}', { status: 429 }) : slowAudio(() => undefined)));
    const clip = await read((await synthesize(`Busy then fine ${Math.random()}`)).body);
    assert.deepEqual([calls, clip.length], [2, 192]);
  });

  it("frees its place when the listener interrupts mid-sentence", async () => {
    restore = stubFetch(() => slowAudio(() => undefined));
    const long = "x".repeat(300); // long clips are streamed without caching
    for (let i = 0; i < 4; i++) {
      const speech = await synthesize(`${long} ${Math.random()}`);
      await (speech.body as ReadableStream<Uint8Array>).cancel();
    }
    assert.equal((await read((await synthesize(`After interruptions ${Math.random()}`)).body)).length, 192);
  });

  it("says so plainly when the credit has run out", async () => {
    restore = stubFetch(() => new Response('{"detail":{"status":"quota_exceeded"}}', { status: 401 }));
    await assert.rejects(synthesize(`No credit ${Math.random()}`), /used up its ElevenLabs credit/);
  });
});
