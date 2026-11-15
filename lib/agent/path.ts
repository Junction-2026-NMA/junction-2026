// Which Path lesson (the app's Path tab) a question is about, decided in code from the question's words.
// The model only judges whether the question is about understanding money; which lesson fits, or that none does,
// is never its call: left to it, "what is inflation?" was pointed at "Buffer before investing".
import { CONCEPTS, teachingCard } from "@/lib/finance/teaching";
import type { ConceptId, Overview } from "@/lib/types";

// First match wins, so the narrower ideas come before the broad ones (a buffer before saving, spot before bills).
const LESSON_WORDS: [ConceptId, RegExp][] = [
  ["fixed-vs-spot", /\bspot\b|fixed[- ]?(price|rate|term)?\s*(or|vs|versus)|pörssisähkö|kiinteä(hintai)?/i],
  ["buffer-first", /buffer|emergency (fund|money|savings)|rainy[- ]day|(invest|save|saving|savings)\b.*\b(or|before|first)\b.*\b(invest|save|saving|savings)|ready to invest|start investing|quick loan|payday loan|hätärahasto|puskuri|pikavippi|sijoit/i],
  ["compound-growth", /compound|interest on (the )?interest|grows? over (time|the years)|start(ing)? early|korkoa korolle|korko/i],
  ["switching-bills", /loyal|switch(ing)? (provider|operator|compan|supplier|contract|bill)|stay(ing)? with (the same|my)|compare (provider|contract|deal)|kilpailut|vaihta(a|minen) (sopimus|liittymä|sähkö)/i],
  ["pay-yourself-first", /pay(ing)? yourself first|habit of saving|saving habit|(how|where) (do|can|should) i (start|begin) saving|start saving|save automatically|automatic saving|säästämi|säästötottum/i],
  ["three-baskets", /basket|needs (and|or|vs|versus) wants|essentials?\b.*\b(everyday|wants)|where (does )?(my )?money go(es)?|kori|välttämättöm/i],
  ["safe-to-spend", /budget(ing)?|overspend|spend(ing)? less|how much (should|can) i spend|budjet/i],
];

export function pathLessonFor(question: string): ConceptId | null {
  return LESSON_WORDS.find(([, words]) => words.test(question))?.[0] ?? null;
}

// The fixed part: when a learning question gets a pointer to Path. It comes right after the rules, so the
// cached start of the prompt stays the same for every question.
export const PATH_RULES = [
  "THE PATH TAB: the app has a Path tab with short lessons built from the customer's own numbers.",
  "First: a request to explain, teach or describe one of the explain_concept ideas ('explain compound growth', 'explain the three baskets', 'teach me about a buffer', 'what is pay yourself first') is ALWAYS an explain_concept call, which puts the lesson card on screen. Answering it in your own words instead is wrong.",
  "Otherwise, if PATH LESSON FOR THIS QUESTION (further down) names a lesson AND the question is about understanding money rather than about one of their figures or getting something done (what something means, how or why it works, a rule of thumb, whether to save or invest first, how to budget or start saving), first answer it fully as usual, then add one short last sentence that points to that lesson by its title in quotes, for example: The \"Buffer before investing\" lesson in Path walks through this with your own numbers. The pointer is an extra, never the answer itself, and it is allowed even though answers do not end with offers.",
  "If it says no lesson fits, say nothing about Path or lessons. Never point to Path for a plain figure, a lookup, a calculation, a chart, a search, a transfer, a watch or a contract, nor to a lesson an earlier answer in this conversation already pointed to. Use no lesson numbers or counts.",
  "Write the pointer in the customer's language, keeping the word Path and the lesson title in quotes exactly as given, since that is what the screen shows (Finnish: Pathin \"Buffer before investing\" -oppitunti käy tämän läpi sinun omilla luvuillasi).",
  "When explain_concept ran, its lesson question stays the very last sentence: mention Path before the question, never after it.",
].join("\n");

// The changing part, for the end of the prompt: the lesson this question is about, or that none fits.
export function pathLine(question: string | undefined, overview: Overview): string {
  const concept = question ? pathLessonFor(question) : null;
  if (!concept || !CONCEPTS.includes(concept)) return "PATH LESSON FOR THIS QUESTION: none fits. Say nothing about Path.";
  return `PATH LESSON FOR THIS QUESTION: "${teachingCard(concept, overview).title}" (only if the question is about understanding money; see THE PATH TAB).`;
}

// The check behind the instructions: a sentence that points to Path but names none of the lessons allowed this turn
// (the one code picked, or one explain_concept just taught) is dropped before it is shown or spoken, like meta talk.
const MENTIONS_PATH = /\bPath(in|issa|-välilehd\w*)?\b/;
export function isStrayPathPointer(sentence: string, allowedTitles: readonly string[]): boolean {
  return MENTIONS_PATH.test(sentence) && !allowedTitles.some((title) => sentence.includes(title));
}

export function withoutStrayPathPointers(text: string, allowedTitles: readonly string[]): string {
  if (!MENTIONS_PATH.test(text)) return text;
  return text
    .split(/(?<=[.!?])(\s+)/)
    .reduce<string[]>((kept, part, index, parts) => {
      if (index % 2 === 1) return kept; // a separator: kept with the sentence after it
      if (isStrayPathPointer(part, allowedTitles)) return kept;
      return [...kept, ...(kept.length ? [parts[index - 1] ?? " "] : []), part];
    }, [])
    .join("")
    .trim();
}

// The titles a pointer may name this turn.
export function allowedPathTitles(question: string, overview: Overview, taughtTitles: readonly string[]): string[] {
  const concept = pathLessonFor(question);
  return [...(concept ? [teachingCard(concept, overview).title] : []), ...taughtTitles];
}
