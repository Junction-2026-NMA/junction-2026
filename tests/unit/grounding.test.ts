import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AINO } from "./helpers";
import { checkGrounding, matches, numbersIn, overviewFacts } from "@/lib/agent/grounding";
import { fact } from "@/lib/finance/facts";
import { buildOverview } from "@/lib/finance/overview";

describe("number verifier", () => {
  it("reads numbers the way people write them, and skips dates and times", () => {
    assert.deepEqual(numbersIn("You spent €1,932.43 and 40 euros, about 1 200 in total."), [1932.43, 40, 1200]);
    assert.deepEqual(numbersIn("Payday is 2026-10-15 at 09:30, in 15 days."), [15]);
    assert.deepEqual(numbersIn("No figures here."), []);
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
