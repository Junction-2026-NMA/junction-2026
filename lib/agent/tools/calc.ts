// A calculator for the model. The model is not allowed to do arithmetic itself, but some questions need an
// estimate from figures no bank tool has (how much water a shorter shower saves, a price times a quantity).
// It writes the sum; this code works it out. Only numbers, + - * / and brackets are understood, so there is
// nothing here that could run code.
import { fact } from "@/lib/finance/facts";
import { round2 } from "@/lib/finance/math";
import type { FactUnit } from "@/lib/types";
import { type ToolContext, type ToolOutcome, failure, outcome } from "./types";

const MAX_LENGTH = 160;
export const CALC_UNITS: FactUnit[] = ["EUR", "EUR/month", "EUR/year", "kWh/year", "percent", "count", "days", "months"];

// Evaluates + - * / and brackets, left to right with the usual precedence. Throws on anything else.
export function evaluate(expression: string): number {
  const text = expression.replace(/\s+/g, "").replace(/,/g, ".").replace(/[x×]/gi, "*").replace(/÷/g, "/");
  if (!text || text.length > MAX_LENGTH || !/^[\d.+\-*/()]+$/.test(text)) throw new Error("Only numbers, + - * / and brackets can be used.");
  let position = 0;

  const number = (): number => {
    if (text[position] === "(") {
      position += 1;
      const inner = sum();
      if (text[position] !== ")") throw new Error("A bracket is not closed.");
      position += 1;
      return inner;
    }
    if (text[position] === "-") {
      position += 1;
      return -number();
    }
    const match = /^\d+(\.\d+)?/.exec(text.slice(position));
    if (!match) throw new Error("A number is missing.");
    position += match[0].length;
    return Number(match[0]);
  };
  const product = (): number => {
    let value = number();
    while (text[position] === "*" || text[position] === "/") {
      const operator = text[position++];
      const next = number();
      if (operator === "/" && next === 0) throw new Error("Dividing by zero.");
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (text[position] === "+" || text[position] === "-") {
      const operator = text[position++];
      const next = product();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  };

  const result = sum();
  if (position !== text.length || !Number.isFinite(result)) throw new Error("That sum could not be read.");
  return result;
}

export function calculate(args: Record<string, unknown>, _ctx: ToolContext, callId: string): ToolOutcome {
  const expression = typeof args.expression === "string" ? args.expression : "";
  const what = typeof args.what === "string" && args.what.trim() ? args.what.trim().slice(0, 80) : "the result";
  const unit = CALC_UNITS.includes(args.unit as FactUnit) ? (args.unit as FactUnit) : "EUR";
  // The model names each figure with its unit when it builds the sum, which is when it knows them. It then repeats
  // these words in its answer, and the screen shows them, so a wrong unit is visible instead of hidden.
  const figures = typeof args.figures === "string" ? args.figures.split(";").map((part) => part.trim().slice(0, 140)).filter(Boolean).slice(0, 8) : [];
  let result: number;
  try {
    result = round2(evaluate(expression));
  } catch (error) {
    return failure("finance", `calculate could not work that out: ${(error as Error).message}`);
  }
  const shown = expression.replace(/\s+/g, " ").trim();
  return outcome({
    content: JSON.stringify({ what, expression: shown, result, unit, figuresUsed: figures, remember: "Say this is an estimate. When you name a figure you used, give it with the same unit as in figuresUsed, and say where it came from." }),
    summary: `${what}: ${shown} = ${result}${figures.length ? `. Using: ${figures.join("; ")}` : ""}`,
    facts: [fact(`calc:${callId}`, what, result, unit, shown, { source: "calculation" })],
    stages: [{ kind: "calculation", title: `Worked out: ${what}`, summary: `${shown} = ${result}`, source: "calculation", data: { kind: "calculation", steps: [{ label: what, amount: result, basis: shown }], resultLabel: what, resultValue: result, unit, assumptions: figures.length ? figures : ["The figures in the sum come from the customer's data, a web search or a stated assumption."] } }],
  });
}
