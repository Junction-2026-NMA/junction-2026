import { test } from "node:test";
import assert from "node:assert/strict";
import { namedMonths, periodNote } from "@/lib/agent/periods";

test("named months in English, Finnish and Swedish become YYYY-MM", () => {
  assert.deepEqual(namedMonths("How much did I spend on restaurants in June 2026?", "2026-09-30"), ["2026-06"]);
  assert.deepEqual(namedMonths("Paljonko käytin ravintoloihin maaliskuussa 2026?", "2026-09-30"), ["2026-03"]);
  assert.deepEqual(namedMonths("Hur mycket spenderade jag i maj 2026?", "2026-09-30"), ["2026-05"]);
  assert.deepEqual(namedMonths("What about December?", "2026-09-30"), ["2025-12"]);
});

test("ambiguous words count only with a year", () => {
  assert.deepEqual(namedMonths("May I move money to savings?", "2026-09-30"), []);
  assert.deepEqual(namedMonths("How much in May 2026?", "2026-09-30"), ["2026-05"]);
});

test("no note for the last month or for no month at all", () => {
  assert.equal(periodNote("What did I spend in September 2026?", "2026-09-30"), null);
  assert.equal(periodNote("Can I afford a bike?", "2026-09-30"), null);
  assert.match(periodNote("kesäkuussa 2025", "2026-09-30") ?? "", /2025-06-01 to 2025-06-30/);
});
