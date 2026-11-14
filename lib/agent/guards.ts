// Checks that run on each sentence the model writes, BEFORE it is shown as a sentence or spoken. If one trips,
// the step is stopped, the sentence is thrown away and the model is sent back to do the work properly.
// They exist because, in a longer conversation, the model sometimes describes an action instead of taking it
// ("I've set up the transfer" with no tool call), announces what it will do and stops, or works a figure out
// in its head. Telling it not to in the instructions is not enough; this makes it impossible to get through.

export type Trip = {
  kind: "broken-tool-call" | "claimed-without-doing" | "announced-without-doing" | "offered-instead-of-doing" | "unsourced-number";
  nudge: string; // what the model is told before it tries again
  forceTool: boolean | string; // whether the retry must be a tool call, or the name of the tool it must call
};

export type GuardState = {
  toolsCalledThisTurn: number;
  actionPreparedThisTurn: boolean;
  earlierActions: { switches: boolean; transfers: boolean }; // what was set up in earlier turns and still stands
  unsourced: number[]; // numbers in this sentence that the verifier could not source
  saidSoFar: string; // what has already been accepted in this reply
};

// Raw tool-call markup leaking into the text means the model's tool call was malformed.
export const BROKEN_TOOL_CALL = /<\|/;
// "I've set up the switch": true only if prepare_action ran in this reply, or the sentence is plainly about an
// earlier turn ("I already set that up") and such an action exists. "It is waiting for your approval" is true
// whenever a matching action exists.
const I_DID = /\b(i['’]ve|i have|i)\s+(just\s+|now\s+|already\s+)?(set (it |that |this |the \w+ )?up|prepared|created|arranged|scheduled|moved|transferred|switched|booked|cancell?ed|approved)\b/i;
const IS_WAITING = /\b(is|it['’]s|are) (now )?(set up|waiting for (you|your))\b/i;
const ABOUT_EARLIER = /\b(already|earlier|before|previously|last time)\b/i;
const ABOUT_A_SWITCH = /\b(switch|contract|deal|provider|electricity|mobile|internet)\b/i;
const ABOUT_A_TRANSFER = /\b(transfer|savings?|invest\w*|payday)\b/i;
function earlierCovers(sentence: string, earlier: GuardState["earlierActions"]): boolean {
  if (ABOUT_A_SWITCH.test(sentence)) return earlier.switches;
  if (ABOUT_A_TRANSFER.test(sentence)) return earlier.transfers;
  return earlier.switches || earlier.transfers;
}
function claimsWithoutDoing(sentence: string, state: GuardState): boolean {
  if (state.actionPreparedThisTurn) return false;
  const earlier = earlierCovers(sentence, state.earlierActions);
  if (I_DID.test(sentence)) return !(earlier && ABOUT_EARLIER.test(sentence));
  return IS_WAITING.test(sentence) && !earlier;
}
// "I searched for average rents" when no search was made in this reply.
const CLAIMS_LOOKED = /\bi(?:['’]ve| have)?\s+(?:just\s+)?(searched|looked (it |that |this )?up|checked|scanned|went through|compared|calculated|worked (it |that |this )?out)\b/i;
const ANNOUNCES = /\b(let me(?! know)|i['’]ll|i will|i am going to|i['’]m going to)\b[^.?!]*\b(run|check|look|find|search|scan|calculate|work out|pull|prepare|compare|go through|set)\b/i;

// "I can't see that, but would you like me to look it up?" The customer already asked. Look it up.
const DECLINES = /\b(can['’]?t|cannot|can not|don['’]t have|do not have|unable to|no way to)\b/i;
const OFFERS_TO_LOOK = /\b(would you like me to|do you want me to|shall i|should i|i can|i could)\b[^.!]*\b(look|search|check|find|compare|scan|work (it|that) out|estimate)\b/i;
const ASKS_FOR_INPUTS = /\bif you (tell|give|share|let) me\b[^.!]*\b(i can|i could|i['’]ll|i will)\b/i;

// Did the customer ask, in so many words, for money to be moved, and say how much? "Transfer 500 euros to my
// savings", "can you invest my 1,000". Not a what-if ("what if I invest 100 a month?").
const MOVE = /\binvest\b|\b(transfer|move|put|send|set aside)\b[^.?!]*\b(savings?|investments?|invest|funds?|stocks?|shares)\b/i;
const WHAT_IF = /\b(what if|how much|what would|what happens|should i|is it|would it|if i (had|were|invest(ed)?|sav(e|ed)|put))\b/i;
export function asksToMoveMoney(text: string): boolean {
  const hasAmount = /\d[\d ,.]*\d|\d/.test(text) && [...text.replace(/(\d)[ ,](\d{3})\b/g, "$1$2").matchAll(/\d+(?:\.\d+)?/g)].some((match) => Number(match[0]) >= 5);
  return hasAmount && MOVE.test(text) && !WHAT_IF.test(text);
}

// An open request for guidance: "give me advice on what to do with my money", "where does my money go?".
const ADVICE = /\b(advice|advise|recommend(ation)?s?|what (should|do|can) i do|what should i change|where (is|does) (all )?my money|how (can|could|do) i save( more)?|help me (save|budget))\b/i;
export const asksForAdvice = (text: string): boolean => ADVICE.test(text) && !/\b(invest(ing|ment)? advice|which (stock|fund|share))\b/i.test(text);

// A note sent back to the model is a message from the app. Without this frame the model sometimes answers the note
// out loud ("There is no 1.87 in that data, and I have not said it"), which the customer would then hear.
export const APP_NOTE = "[Note from the Sisu app, not from the customer. Never reply to this note, mention it or argue with it. Just carry on with your answer to the customer, in the customer's language.]";

// A sentence addressed to the app instead of the customer: talk about "the customer" or about what was "already said".
const META = /\b(the customer (asked|has|had|said|already|wants|is asking)|note from the (sisu )?app|i have not said|i did not say|i already (answered|said|told)|as (the note|instructed))\b/i;
export const isMetaTalk = (sentence: string): boolean => META.test(sentence);
// The same, for a finished answer: drops any sentence that was meant for the app.
export const withoutMetaTalk = (text: string): string =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !isMetaTalk(sentence))
    .join(" ");

export const BROKEN_TRIP: Trip = { kind: "broken-tool-call", nudge: "Your last reply broke off in the middle of a tool call. Call the tool you meant to call now, with no text before it.", forceTool: true };

export function checkSentence(sentence: string, state: GuardState): Trip | null {
  if (claimsWithoutDoing(sentence, state)) {
    return {
      kind: "claimed-without-doing",
      nudge: "You told the customer something was set up, but you did not call prepare_action in this reply, so nothing exists. Call prepare_action now (one_off_transfer, standing_transfer or switch_contract) with what they asked for, and write nothing before the call.",
      forceTool: "prepare_action",
    };
  }
  if (CLAIMS_LOOKED.test(sentence) && state.toolsCalledThisTurn === 0) {
    return { kind: "claimed-without-doing", nudge: "You said you searched or checked something, but you called no tool in this reply, so you did not. Call the tool now (web_search for the outside world, the bank-data tools for the customer's money), with no text before it.", forceTool: true };
  }
  if (ANNOUNCES.test(sentence) && !sentence.trim().endsWith("?") && state.toolsCalledThisTurn === 0) {
    return { kind: "announced-without-doing", nudge: "Do not announce it. Call the tool now, with no text before it, then answer with the result.", forceTool: true };
  }
  const declinedAlready = DECLINES.test(state.saidSoFar) || DECLINES.test(sentence);
  if (state.toolsCalledThisTurn === 0 && declinedAlready && (OFFERS_TO_LOOK.test(sentence) || ASKS_FOR_INPUTS.test(sentence))) {
    return {
      kind: "offered-instead-of-doing",
      nudge: "Do not ask permission and do not ask the customer for figures first. They already asked. Do it now: web_search for the outside figure (typical or average values are fine), use calculate for any sum, then give the answer with the assumptions you made.",
      forceTool: true,
    };
  }
  if (state.unsourced.length) {
    const list = state.unsourced.join(", ");
    return {
      kind: "unsourced-number",
      nudge: `You said ${list}, but no tool result and no figure from the customer supports ${state.unsourced.length > 1 ? "them" : "it"}. Do not work figures out yourself. Call calculate for arithmetic, run_scenario for projections, or web_search for outside figures now, then answer using only numbers from the results. If no tool can give the figure, answer without it.`,
      forceTool: false,
    };
  }
  return null;
}
