import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL, AINO, EETU, SANNA } from "./helpers";
import { checkAffordability } from "@/lib/finance/affordability";
import { basketOf } from "@/lib/finance/baskets";
import { buildCashFlow, nextDayOfMonth } from "@/lib/finance/cashflow";
import { transactionsFor } from "@/lib/finance/data";
import { buildOverview } from "@/lib/finance/overview";
import { mortgageFor, parseStamp } from "@/lib/finance/mortgage";
import { findPatterns } from "@/lib/finance/patterns";
import { cleanInput, runScenario } from "@/lib/finance/scenario";
import { CONCEPTS, teachingCard } from "@/lib/finance/teaching";
import { filterTransactions, listTransactions } from "@/lib/finance/transactions";

const overviewOf = (id: string) => {
  const overview = buildOverview(id);
  assert.ok(overview, `overview for ${id}`);
  return overview;
};
const close = (a: number, b: number, tolerance = 0.06) => assert.ok(Math.abs(a - b) <= tolerance, `${a} should be within ${tolerance} of ${b}`);

describe("finance engine: the numbers reconcile", () => {
  for (const id of ALL) {
    it(`${id}: the three baskets add up to all spending, recomputed from raw rows`, () => {
      const o = overviewOf(id);
      const rows = transactionsFor(id).filter((t) => t.date >= o.windowFrom && t.date <= o.windowTo && t.amount < 0 && basketOf(t.category));
      const fromRows = -rows.reduce((total, t) => total + t.amount, 0) / 12;
      close(o.monthlySpending, o.baskets.reduce((total, b) => total + b.monthlyAvg, 0));
      close(o.monthlySpending, fromRows, 0.1);
      close(o.baskets.reduce((total, b) => total + b.share, 0), 1, 0.02);
    });

    it(`${id}: safe to spend is income minus must-pays, now-and-then costs and savings`, () => {
      const o = overviewOf(id);
      const [income, regular, irregular, saved] = o.safeToSpend.steps.map((s) => s.amount);
      close(o.safeToSpend.perMonth, income + regular + irregular + saved);
      close(o.safeToSpend.perWeek, o.safeToSpend.perMonth / (52 / 12));
      close(o.safeToSpend.gapPerMonth, o.safeToSpend.perMonth - o.safeToSpend.actualEverydayPerMonth);
    });

    it(`${id}: the payday projection is balance minus bills due minus usual spending`, () => {
      const o = overviewOf(id);
      const flow = buildCashFlow(o);
      assert.ok(flow.nextPayday && flow.nextPayday > o.dataTimestamp);
      const bills = flow.billsDueBeforePayday.reduce((total, b) => total + b.amount, 0);
      close(flow.projectedLowPointEur ?? NaN, o.balance - bills - flow.averageDailyEverydayEur * (flow.daysToNextPayday ?? 0), 0.05);
      assert.ok(flow.billsDueBeforePayday.every((b) => b.expectedOn > o.dataTimestamp && b.expectedOn < (flow.nextPayday as string)));
    });

    it(`${id}: every pattern carries receipts and a filter that opens real rows`, () => {
      const o = overviewOf(id);
      const patterns = findPatterns(o, buildCashFlow(o));
      assert.ok(patterns.length >= 3);
      for (const pattern of patterns) {
        assert.ok(pattern.facts.length > 0, `${pattern.id} has facts`);
        assert.ok(pattern.facts.every((f) => Number.isFinite(f.value) && f.basis.length > 0));
        assert.ok(filterTransactions(id, pattern.evidence).length > 0, `${pattern.id} evidence opens rows`);
        assert.ok(pattern.yearlyImpactEur === null || pattern.yearlyImpactEur > 0);
      }
    });

    it(`${id}: every teaching card has one right answer among distinct options and never names the customer ID`, () => {
      const o = overviewOf(id);
      for (const concept of CONCEPTS) {
        const card = teachingCard(concept, o);
        assert.equal(new Set(card.options).size, card.options.length, `${concept} options are distinct`);
        assert.ok(card.correctIndex >= 0 && card.correctIndex < card.options.length);
        assert.ok(!JSON.stringify(card).includes(id), `${concept} card must not contain the customer ID`);
        assert.deepEqual(teachingCard(concept, o), card, "cards are deterministic");
      }
    });
  }
});

describe("finance engine: customer isolation", () => {
  it("a customer's rows never include another customer's", () => {
    for (const id of ALL) {
      const list = listTransactions(id, { from: "2024-01-01", to: "2027-01-01" });
      assert.ok(list && list.count > 0);
      assert.ok(list.transactions.every((t) => t.customerId === id));
      assert.ok(filterTransactions(id, { from: "2024-01-01", to: "2027-01-01" }).every((t) => t.customerId === id));
    }
  });

  it("an unknown or malformed customer gets nothing, not someone else's data", () => {
    for (const id of ["CUST00001", "", "cust04974", "CUST04974 OR 1=1", "../CUST04974"]) {
      assert.equal(buildOverview(id), null);
      assert.equal(listTransactions(id, { from: "2024-01-01", to: "2027-01-01" }), null);
      assert.equal(transactionsFor(id).length, 0);
    }
  });

  it("the three demo customers have different numbers", () => {
    const balances = ALL.map((id) => overviewOf(id).balance);
    assert.equal(new Set(balances).size, 3);
  });
});

describe("finance engine: scenarios and affordability", () => {
  it("rejects values that are not numbers and clamps the rest", () => {
    assert.equal(typeof cleanInput({ billSavingPerMonth: Number.NaN, everydayCutPct: 0, years: 5 }), "string");
    assert.deepEqual(cleanInput({ billSavingPerMonth: 99_999, everydayCutPct: -5, years: 80 }), { billSavingPerMonth: 500, everydayCutPct: 0, years: 10 });
  });

  it("freeing money never makes the future worse, and the invested range brackets its middle", () => {
    const o = overviewOf(EETU);
    const result = runScenario(o, { billSavingPerMonth: 20, everydayCutPct: 10, years: 5 });
    const end = (id: string) => result.branches.find((b) => b.id === id)!;
    close(result.freedPerMonth, 20 + o.monthlyEveryday * 0.1, 0.01);
    close(end("save").endTotal - end("nothing").endTotal, result.freedPerMonth * 60, 0.5);
    assert.ok(end("invest").endLow <= end("invest").endTotal && end("invest").endTotal <= end("invest").endHigh);
    assert.ok(end("invest").endTotal > end("save").endTotal);
  });

  it("a zero scenario changes nothing", () => {
    const result = runScenario(overviewOf(AINO), { billSavingPerMonth: 0, everydayCutPct: 0, years: 3 });
    assert.equal(result.branches[0].endTotal, result.branches[1].endTotal);
  });

  it("a bigger cost is never easier to afford than a smaller one", () => {
    const order = { comfortable: 0, tight: 1, "not-yet": 2 };
    for (const id of ALL) {
      const o = overviewOf(id);
      const flow = buildCashFlow(o);
      const verdicts = [10, 100, 500, 2_000, 10_000, 90_000].map((amount) => {
        const result = checkAffordability(o, flow, amount);
        assert.ok(typeof result !== "string");
        return order[result.verdict];
      });
      assert.deepEqual(verdicts, [...verdicts].sort((a, b) => a - b));
    }
  });

  it("Sanna, with a large balance, can absorb €600; Aino cannot before payday", () => {
    const sanna = checkAffordability(overviewOf(SANNA), buildCashFlow(overviewOf(SANNA)), 600);
    const aino = checkAffordability(overviewOf(AINO), buildCashFlow(overviewOf(AINO)), 600);
    assert.ok(typeof sanna !== "string" && sanna.verdict === "comfortable");
    assert.ok(typeof aino !== "string" && aino.verdict === "not-yet" && (aino.projectedLowPointEur ?? 0) < 0);
  });

  it("refuses nonsense amounts", () => {
    const o = overviewOf(AINO);
    for (const amount of [0, -50, Number.NaN, Number.POSITIVE_INFINITY, 1e9]) assert.equal(typeof checkAffordability(o, buildCashFlow(o), amount), "string");
  });

  it("finds the next given day of the month, including short months", () => {
    assert.equal(nextDayOfMonth("2026-09-30", 15), "2026-10-15");
    assert.equal(nextDayOfMonth("2026-09-30", 30), "2026-10-30");
    assert.equal(nextDayOfMonth("2026-01-31", 31), "2026-02-28");
    assert.equal(nextDayOfMonth("2026-09-10", 15), "2026-09-15");
  });
});

describe("finance engine: the mortgage application", () => {
  it("reads the bank's date stamps", () => {
    assert.equal(parseStamp("01JUN26:21:52:39"), "2026-06-01");
    assert.equal(parseStamp("12MAY26:00:00:00"), "2026-05-12");
  });

  it("only the customer who applied has one", () => {
    assert.equal(mortgageFor(overviewOf(AINO)), null);
    assert.equal(mortgageFor(overviewOf(EETU)), null);
    assert.ok(mortgageFor(overviewOf(SANNA)));
  });

  it("copies the application and sets it beside the customer's own figures", () => {
    const o = overviewOf(SANNA);
    const m = mortgageFor(o)!;
    assert.deepEqual([m.decision, m.propertyPriceEur, m.loanEur, m.ownMoneyEur, m.decidedOn, m.startedOn], ["approved", 178000, 144500, 33500, "2026-06-01", "2026-05-12"]);
    assert.equal(m.propertyPriceEur - m.loanEur, m.ownMoneyEur);
    close(m.loanToValuePct, (m.loanEur / m.propertyPriceEur) * 100, 0.01);
    close(m.incomeMarginEur, o.monthlyIncome - m.requiredMonthlyIncomeEur, 0.01);
    close(m.ownMoneyStillNeededEur, Math.max(m.ownMoneyEur - o.balance, 0), 0.01);
    assert.deepEqual(m.fees.map((fee) => fee.amountEur), [300, 480]);
    assert.equal(m.timeline.length, 15);
    assert.ok(!JSON.stringify(m.steps).includes(SANNA));
  });
});

describe("finance engine: edge cases found in review", () => {
  it("teaching options stay distinct even when a wrong option would equal the right one", async () => {
    const o = overviewOf(AINO);
    // A customer whose everyday share is so low that "share minus 25, floored at 5" would repeat the answer.
    const skewed = { ...o, baskets: o.baskets.map((b) => (b.id === "everyday" ? { ...b, share: 0.05 } : b)), safeToSpend: { ...o.safeToSpend, perWeek: 0 }, runwayMonths: 0, monthlySaved: 0 };
    for (const concept of CONCEPTS) {
      const card = teachingCard(concept, skewed);
      assert.equal(new Set(card.options).size, card.options.length, `${concept}: ${card.options.join(" | ")}`);
      assert.ok(card.correctIndex < card.options.length);
    }
  });
});

describe("finance engine: receipts open exactly the rows they describe", () => {
  it("a 'year earlier' receipt never includes a day from the current year's window", () => {
    for (const id of ALL) {
      const o = overviewOf(id);
      const priorFacts = findPatterns(o, buildCashFlow(o)).flatMap((p) => p.facts).filter((f) => /year earlier/.test(f.label) && f.evidence);
      for (const f of priorFacts) {
        assert.ok(f.evidence!.to < o.windowFrom, `${f.id} ends before the current window starts`);
        const rows = filterTransactions(id, f.evidence!).filter((t) => t.amount < 0);
        const months = new Set(rows.map((t) => t.date.slice(0, 7))).size;
        if (f.id.startsWith("drift:")) close(f.value, -rows.reduce((total, t) => total + t.amount, 0) / 12, 0.01);
        assert.ok(months <= 12);
      }
    }
  });
});
