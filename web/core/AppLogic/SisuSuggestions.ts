/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// The suggested questions of an empty Sisu conversation. Four that the backend answers today (cash flow to payday,
// a spending scenario, a move and its rent, a cheaper contract with live offers), worded for this customer only where
// the data supports it, plus up to two from what the overview noticed (its insights; this is where Today's longer
// "What Sisu noticed" list went). Pure: nothing here invents a number, every figure comes from the overview.
import type { Insight, Overview } from "@/web/core/Models";

export interface SisuSuggestion {
  readonly id: string;
  /** What is asked when tapped (also the button's text). */
  readonly question: string;
  /** For a suggestion from the overview: what Sisu noticed, in one line. Null for the four standard ones. */
  readonly noticed: string | null;
  /** The noticed line compares with other customers of the synthetic dataset (say so). */
  readonly synthetic: boolean;
}

export namespace SisuSuggestions {
  export const payday = "Will my money last until payday?";
  export const cheaperPlan = "Find a cheaper plan that meets my needs.";
  /** An everyday category is worth a "20 % less" question from this many euros a month. */
  const worthCutting = 30;
  /** Everyday categories that are essentials: never suggested as something to cut. */
  const essentials = new Set(["groceries", "health", "housing", "utilities"]);

  /** The empty conversation's suggestions, standard ones first.
   * @param billName the confirmed name of the bill Today flags (null when not confirmed: names are guesses). */
  export function make(overview: Overview | null, billName: string | null): SisuSuggestion[] {
    const standard: SisuSuggestion[] = [
      plain("payday", payday),
      plain("spending", spendingQuestion(overview)),
      plain("move", moveQuestion(overview)),
      plain("plan", planQuestion(billName)),
    ];
    const asked = new Set(standard.map((s) => s.question));
    const noticed = (overview?.insights ?? []).flatMap((insight) => {
      const suggestion = fromInsight(insight, overview);
      if (!suggestion || asked.has(suggestion.question)) return [];
      asked.add(suggestion.question);
      return [suggestion];
    });
    return [...standard, ...noticed.slice(0, 2)];
  }

  /** "What would spending 20% less at restaurants save?", or the customer's biggest everyday choice instead. */
  export function spendingQuestion(overview: Overview | null): string {
    return `What would spending 20% less ${phrase(spendingCategory(overview))} save?`;
  }

  /** The category the standard "20% less" question is about: the biggest everyday choice, else restaurants. */
  function spendingCategory(overview: Overview | null): string {
    return biggestChoice(overview) ?? "Restaurants";
  }

  /** Espoo, or Helsinki for someone who already lives in Espoo (postal codes 02xxx). */
  export function moveQuestion(overview: Overview | null): string {
    const inEspoo = overview?.postalCode.startsWith("02") ?? false;
    return `Could I afford to move to ${inEspoo ? "Helsinki" : "Espoo"}?`;
  }

  export function planQuestion(billName: string | null): string {
    const name = billName?.trim().toLowerCase() ?? "";
    if (name === "" || name.includes("rent") || name.includes("housing")) return cheaperPlan;
    return /plan|contract|deal|subscription/.test(name) ? `Find a cheaper ${name} that meets my needs.` : `Find a cheaper ${name} plan that meets my needs.`;
  }

  /** The biggest everyday category that is a choice (not groceries), when it is big enough to be worth a question. */
  function biggestChoice(overview: Overview | null): string | null {
    const everyday = overview?.baskets.find((b) => b.id === "everyday");
    const choices = (everyday?.categories ?? []).filter((c) => !essentials.has(c.category.toLowerCase()) && c.monthlyAvg >= worthCutting);
    if (choices.length === 0) return null;
    return choices.reduce((best, c) => (c.monthlyAvg > best.monthlyAvg ? c : best)).category;
  }

  function phrase(category: string): string {
    const lower = category.toLowerCase();
    return lower === "restaurants" ? "at restaurants" : `on ${lower}`;
  }

  function fromInsight(insight: Insight, overview: Overview | null): SisuSuggestion | null {
    const category = insight.evidence.category ?? null;
    const id = `noticed-${insight.id}`;
    if (insight.evidence.negativeBalance) {
      return { id, question: "Why does my balance go below zero, and how do I stop it?", noticed: insight.title, synthetic: false };
    }
    if (category === null) return { id, question: `Tell me more: ${lowerFirst(insight.title)}`, noticed: insight.title, synthetic: false };
    // Bills are the cheaper-plan question already.
    if (category.toLowerCase() === "utilities" || category.toLowerCase() === "housing") return null;
    const synthetic = /dataset|people your age|others your age/i.test(`${insight.title} ${insight.body}`);
    if (synthetic) {
      // The standard "20% less" question already covers this category: one suggestion about it is enough.
      if (category.toLowerCase() === spendingCategory(overview).toLowerCase()) return null;
      // The comparison is with the other synthetic demo profiles, not with real people of this age: the question says so.
      const question = `Why is my ${noun(category)} spending higher than other profiles in the demo data?`;
      return { id, question, noticed: insight.title, synthetic: true };
    }
    if (essentials.has(category.toLowerCase()) || biggestChoice(overview) === category) return null;
    return { id, question: `What would spending 20% less ${phrase(category)} save?`, noticed: insight.title, synthetic: false };
  }

  /** "restaurant spending", "entertainment spending". */
  function noun(category: string): string {
    const lower = category.toLowerCase();
    return lower === "restaurants" ? "restaurant" : lower;
  }

  function plain(id: string, question: string): SisuSuggestion {
    return { id, question, noticed: null, synthetic: false };
  }

  function lowerFirst(text: string): string {
    return text === "" ? text : text[0].toLowerCase() + text.slice(1);
  }
}
