import type { BillType } from "@/lib/types";

// A keyword guess, made before the model has answered, at whether live offer research will be needed.
// It only decides whether to START research early. The model alone decides whether to USE it.
const BILL_WORDS: [BillType, RegExp][] = [
  ["electricity", /\b(electric|electricity|power bill|energy|kwh)\b|sähkö/i],
  ["mobile", /\b(mobile|phone plan|phone bill|sim|data plan)\b|liittymä|puhelin/i],
  ["internet", /\b(internet|broadband|wi-?fi|fib(er|re))\b|laajakaista|netti/i],
];

const INTENT_WORDS = /\b(cheap|cheaper|cheapest|deal|deals|offer|offers|switch|compare|alternative|alternatives|save|saving|better price|too much|overpay\w*)\b|halv|vertaa|tarjou|kilpailu/i;

const POINTING_WORDS = /\b(this|that|it|my) (bill|contract|plan|one)\b|\bthis\b|\bit\b/i;

export type Speculation = { billType: BillType; reason: string };

export function speculate(text: string, focusBill?: BillType): Speculation | null {
  if (!INTENT_WORDS.test(text)) return null;
  const named = BILL_WORDS.find(([, pattern]) => pattern.test(text));
  if (named) return { billType: named[0], reason: `The question mentions ${named[0]} and asks about a better deal.` };
  if (focusBill && POINTING_WORDS.test(text)) {
    return { billType: focusBill, reason: `The question asks about a better deal while the ${focusBill} bill is open.` };
  }
  return null;
}
