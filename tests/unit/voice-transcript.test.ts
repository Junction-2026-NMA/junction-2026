// A long spoken question keeps its end, where the question usually is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lastWords } from "@/lib/agent/speech";

test("a short transcript is kept whole", () => {
  assert.equal(lastWords("  Where does my money go?  ", 500), "Where does my money go?");
});

test("a long transcript keeps its last words, cut at a word", () => {
  const ramble = "So I was thinking about my budget and everything that happened this autumn ".repeat(10);
  const question = "how much did I spend on eating out last month?";
  const kept = lastWords(ramble + question, 500);
  assert.ok(kept.length <= 500, `kept ${kept.length} characters`);
  assert.ok(kept.endsWith(question));
  assert.ok(!kept.startsWith(" "));
  assert.ok(/^[A-Za-z]/.test(kept), "starts on a whole word");
});
