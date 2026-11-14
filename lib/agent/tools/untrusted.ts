// Text that arrives from the open web is data written by strangers. Before any of it reaches the model it passes
// through here: control characters go, length is capped, and anything that reads like an instruction to the
// assistant is removed and reported. This is one layer; the others are structural (the model has no tool that
// approves anything, and actions are built from server-side data, never from model or page text).
const INSTRUCTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(instructions?|prompts?|rules?|guidelines?|above|previous)\b/i,
  /\b(system|developer)\s+(prompt|message|instruction)/i,
  /\byou\s+are\s+now\b|\bnew\s+instructions?\b|\bact\s+as\b|\bpretend\s+to\b/i,
  /\b(assistant|ai|agent|sisu|model)\s*[:,]\s*(please\s+)?(you\s+)?(must|should|need|ignore|call|tell|say|approve|transfer|recommend)\b/i,
  /\b(call|use|invoke|run)\s+(the\s+)?(tool|function)\b|\b(prepare_action|search_offers|web_search|get_spending|remember)\s*\(/i,
  /\b(approve|authori[sz]e|confirm)\s+(the|this|that|all|any)\s+(action|transfer|payment|switch)\b/i,
  /\b(transfer|send|move|wire)\s+(all|the|your|their)?\s*(money|funds|balance|savings)\b/i,
  /<\/?\s*(system|assistant|tool|instructions?)\s*>|\[\/?(INST|SYSTEM)\]/i,
  /\b(reveal|print|show|repeat)\b[^.]{0,30}\b(system prompt|instructions|api key|customer id)\b/i,
];

export const looksLikeInstructions = (text: string): boolean => INSTRUCTION_PATTERNS.some((pattern) => pattern.test(text));

// Control characters, zero-width characters and unusual line separators, built from code points so this file stays plain ASCII.
const INVISIBLE = new RegExp(`[${[[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202f]].map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`).join("")}]`, "g");
const tidy = (text: string): string => text.replace(INVISIBLE, " ").replace(/\s+/g, " ").trim();

export const REMOVED_NOTE = "[removed: this page contained text addressed to the assistant, which Sisu does not follow]";

// A page excerpt, safe to show the model. Suspicious sentences are dropped one at a time so the facts around them survive.
export function safeExcerpt(text: string, maxChars: number): { text: string; removed: number } {
  const sentences = tidy(text).split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !looksLikeInstructions(sentence));
  const removed = sentences.length - kept.length;
  const joined = kept.join(" ").slice(0, maxChars);
  return { text: removed ? `${joined} ${REMOVED_NOTE}`.trim() : joined, removed };
}

// A short name taken from a page (provider, plan). Returns null if it is not plausibly a name.
export function safeName(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const name = tidy(value);
  if (!name || name.length > maxChars || /https?:|www\.|[<>{}`$\\]/i.test(name) || looksLikeInstructions(name)) return null;
  return name;
}

// A page title for a citation: kept short and stripped of anything instruction-like.
export const safeTitle = (title: string, fallback: string): string => (looksLikeInstructions(title) ? fallback : tidy(title).slice(0, 140) || fallback);
