import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AINO } from "./helpers";
import { checkGrounding, correctNumbers, matches, numbersIn, overviewFacts } from "@/lib/agent/grounding";
import { fact } from "@/lib/finance/facts";
import { buildOverview } from "@/lib/finance/overview";

describe("number verifier", () => {
  it("reads numbers the way people write them, and skips dates and times", () => {
    assert.deepEqual(numbersIn("You spent €1,932.43 and 40 euros, about 1 200 in total."), [1932.43, 40, 1200]);
    assert.deepEqual(numbersIn("Payday is 2026-10-15 at 09:30, in 15 days."), [15]);
    assert.deepEqual(numbersIn("No figures here."), []);
    assert.deepEqual(numbersIn("I cannot show customer CUST04414's data, only your 40 euros."), [40]); // an ID is not an amount
  });

  it("accepts exact, rounded and honest 'about' figures, and rejects different ones", () => {
    assert.ok(matches(139.56, 139.56));
    assert.ok(matches(140, 139.56)); // rounded to whole euros
    assert.ok(matches(1900, 1932.43)); // "about 1,900"
    assert.ok(matches(122.88, -122.88)); // "minus 122.88"
    assert.ok(!matches(150, 139.56));
    assert.ok(!matches(1536, 1514));
    assert.ok(!matches(139, 149.56));
  });

  const facts = [fact("a", "Restaurants per month", 277.4, "EUR/month", "test"), fact("b", "Gap to peers", 64, "EUR/month", "test"), fact("c", "Extra per year", 746.16, "EUR/year", "test")];

  it("passes an answer whose numbers all have receipts", () => {
    const result = checkGrounding("You spend about 277 euros a month on restaurants, 64 above your peers.", facts, [], []);
    assert.equal(result.ok, true);
    assert.deepEqual(result.numbers.map((n) => n.status), ["receipt", "receipt"]);
    assert.equal(result.numbers[0].factId, "a");
  });

  it("flags a number the model made up by adding two findings together", () => {
    const result = checkGrounding("Together that is about €1,536 a year.", facts, [], []);
    assert.equal(result.ok, false);
    assert.deepEqual(result.unverified, [1536]);
  });

  it("flags an invented provider price even when other numbers are fine", () => {
    const result = checkGrounding("Restaurants cost you 277 euros a month; Fortum would charge 8.49 cents.", facts, [], []);
    assert.deepEqual(result.unverified, [8.49]);
  });

  it("accepts numbers the user said, numbers in tool output, and monthly/yearly versions of a receipt", () => {
    const result = checkGrounding("Saving 50 euros a month for 5 years; the offer is 34.27 a month, and the extra is about 62 a month.", facts, ['{"estimatedMonthlyCostEur":34.27}'], ["What if I save 50 euros a month for 5 years?"]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.numbers.map((n) => n.status), ["context", "trivial", "context", "context"].map((s, i) => (i === 1 ? "context" : s)));
  });

  // Regression: live evaluation round 1. Nemotron said "April, with 1059.49 euros" when the tool returned 1059.47.
  it("replaces a slipped digit with the receipt's value, and leaves a genuinely different number alone", () => {
    const groceries = [fact("g:apr", "Groceries, 2026-04", 1059.47, "EUR", "test"), fact("g:feb", "Groceries, 2026-02", 1008.49, "EUR", "test")];
    const sources = { facts: groceries, contextTexts: [], userTexts: [] };
    const fixed = correctNumbers("April was highest at 1059.49 euros; February came close at 1008.49 euros.", sources);
    assert.equal(fixed.text, "April was highest at 1059.47 euros; February came close at 1008.49 euros.");
    assert.deepEqual(fixed.corrections, [{ said: 1059.49, corrected: 1059.47, factId: "g:apr" }]);
    assert.equal(checkGrounding(fixed.text, groceries, [], [], fixed.corrections).ok, true);

    const invented = correctNumbers("Over five years that adds up to about €333.60.", sources);
    assert.deepEqual([invented.text, invented.corrections.length], ["Over five years that adds up to about €333.60.", 0]);
    assert.deepEqual(checkGrounding(invented.text, groceries, [], []).unverified, [333.6]);
  });

  it("keeps the model's own formatting when it corrects a figure", () => {
    const sources = { facts: [fact("x", "Bill", 1932.43, "EUR", "test")], contextTexts: [], userTexts: [] };
    assert.equal(correctNumbers("That is 1,932.45 in all.", sources).text, "That is 1932.43 in all.");
    assert.equal(correctNumbers("Nothing to fix: 1,932.43.", sources).text, "Nothing to fix: 1,932.43.");
  });

  // Regression: live evaluation round 1. "September 2026" was reported as an unverified number.
  it("does not mistake a year from the data for an amount", () => {
    const result = checkGrounding("In September 2026 you spent 277 euros, averaged from October 2025.", facts, ['{"averagesCover":"2025-10-01 to 2026-09-30"}'], []);
    assert.equal(result.ok, true);
    assert.deepEqual(result.unverified, []);
    // Regression: round 4. "I don't have a forecast for 2027" is a year the data never mentions.
    assert.equal(checkGrounding("I don't have a forecast for 2027.", facts, [], []).ok, true);
    // But a year-shaped amount is still an amount.
    assert.deepEqual(checkGrounding("You would save 2027 euros, or €2031, or 2,035.", facts, [], []).unverified, [2027, 2031, 2035]);
  });

  it("treats small counts as trivial, not as financial claims", () => {
    const result = checkGrounding("I found 3 offers from 2 pages.", [], [], []);
    assert.equal(result.ok, true);
    assert.ok(result.numbers.every((n) => n.status === "trivial"));
  });

  it("every figure in the customer summary has a receipt with a way to open the rows", () => {
    const overview = buildOverview(AINO)!;
    const receipts = overviewFacts(overview);
    assert.ok(receipts.length > 30);
    assert.equal(new Set(receipts.map((f) => f.id)).size, receipts.length, "receipt ids are unique");
    const answer = `Your balance is ${overview.balance} and you can safely spend ${Math.round(overview.safeToSpend.perWeek)} euros a week.`;
    assert.equal(checkGrounding(answer, receipts, [], []).ok, true);
    // Peer averages come from a benchmark table, so there are no rows of this customer's to open for them.
    assert.ok(receipts.filter((f) => f.source === "bank-data" && f.unit === "EUR/month" && !f.id.endsWith(":peers")).every((f) => f.evidence), "the customer's own monthly figures open their transactions");
  });
});
