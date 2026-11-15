/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Evidence of understanding for a lesson. A right first answer completes it. A wrong one gets a kind explanation
// (the backend's `whyWrong[i]` when it sends one, else the card's reveal) and one short follow-up question (the
// backend's `followUp` when it sends a valid one, else the local question below); only a right answer to that
// completes the lesson. Each lesson ends with one principle to keep. Figures come from the card's own facts
// (computed by the backend's lib/finance), never invented here; without a fact the sentence leaves the figure out.
// The local follow-ups' options are shuffled with a seed from the concept, so the right one is not always first,
// and the order stays the same across reloads and kept attempts (which store option indexes).
import type { ConceptId, Fact, TeachingCard } from "@/web/core/CoachModels";
import { rawOf } from "@/web/core/Presentation";

/** A multiple-choice check with its explanation. `whyWrong[i]` explains option i when it is wrong (or null). */
export interface LessonQuestion {
  readonly question: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly explanation: string;
  readonly whyWrong: readonly (string | null)[];
}

const euros = (value: number): string => `€${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
const months = (value: number): string => `${Math.round(value * 10) / 10}`;
const fact = (card: TeachingCard, id: string): number | null => {
  const found = (card.facts ?? []).find((f: Fact) => f.id === id);
  return found && Number.isFinite(found.value) ? found.value : null;
};
const raw = (card: TeachingCard): Record<string, unknown> => card as unknown as Record<string, unknown>;
const strings = (value: unknown): (string | null)[] =>
  Array.isArray(value) ? value.map((v) => (typeof v === "string" && v.trim() !== "" ? v : null)) : [];

/** FNV-1a: a small, stable 32-bit hash of the seed text. */
const hash = (text: string): number =>
  [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** The order to show `count` options in, the same every time for the same seed (Fisher-Yates on mulberry32). */
export function stableOrder(count: number, seed: string): number[] {
  let state = hash(seed);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => i).reduceRight((order, _, i) => {
    const j = Math.floor(random() * (i + 1));
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }, Array.from({ length: count }, (_, i) => i));
}

/** The question with its options in a stable shuffled order; the right answer and each whyWrong move with theirs. */
function shuffled(question: LessonQuestion, seed: string): LessonQuestion {
  const order = stableOrder(question.options.length, seed);
  return {
    ...question,
    options: order.map((from) => question.options[from]),
    correctIndex: order.indexOf(question.correctIndex),
    whyWrong: order.map((from) => question.whyWrong[from] ?? null),
  };
}

export namespace LessonFollowUps {
  /** Why the picked first option is wrong, from the backend (`whyWrong`), or null when it sent none. */
  export function whyWrong(card: TeachingCard, index: number): string | null {
    return strings(raw(card).whyWrong)[index] ?? null;
  }

  /** The backend's follow-up when it is complete and consistent; null otherwise. */
  export function fromBackend(card: TeachingCard): LessonQuestion | null {
    const value = raw(card).followUp;
    if (!value || typeof value !== "object") return null;
    const f = value as Record<string, unknown>;
    const options = Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === "string" && o.trim() !== "") : [];
    const correctIndex = typeof f.correctIndex === "number" ? f.correctIndex : -1;
    if (typeof f.question !== "string" || f.question.trim() === "" || options.length < 2 || options.length !== (f.options as unknown[]).length) return null;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
    const explanation = typeof f.explanation === "string" ? f.explanation : typeof f.reveal === "string" ? f.reveal : card.reveal;
    return { question: f.question, options, correctIndex, explanation, whyWrong: strings(f.whyWrong) };
  }

  /** The follow-up to ask after a wrong first answer. */
  export function question(card: TeachingCard): LessonQuestion {
    return fromBackend(card) ?? local(card);
  }

  /** One principle to apply later, shown when the lesson is complete. */
  export function principle(concept: ConceptId): string {
    switch (rawOf(concept)) {
      case "three-baskets": return "Sort a cost before you judge it. Essentials come first; everyday spending is where a small change shows soonest.";
      case "safe-to-spend": return "An estimate from past averages is a guide, not a promise. Check this week’s bills and your next payday before you spend the room.";
      case "fixed-vs-spot": return "Before you switch electricity, compare the price per kWh and the monthly fee, and know roughly how much you use in a year.";
      case "buffer-first": return "Keep a cash buffer of a few months of essentials before you invest.";
      case "compound-growth": return "Time does much of the work. Invest only money your buffer does not need, and expect ups and downs.";
      case "switching-bills": return "Put one date in your calendar each year to compare your regular bills.";
      case "pay-yourself-first": return "Decide the amount once and move it on payday, before you spend.";
      default: return "Use your own numbers before you decide.";
    }
  }

  /** The question "Ask Sisu" sends from inside a lesson. */
  export function askQuestion(card: TeachingCard): string {
    switch (rawOf(card.concept)) {
      case "three-baskets": return "Which of my costs are regular essentials, occasional essentials and everyday spending?";
      case "safe-to-spend": return "What can I spend this week without missing my bills?";
      case "fixed-vs-spot": return "Is my electricity bill on a fixed or a spot price, and what would that mean for me?";
      case "buffer-first": return "How big a buffer should I keep, with my own numbers?";
      case "compound-growth": return "Explain growth on growth with a small monthly amount, using my numbers.";
      case "switching-bills": return "Which of my regular bills is worth comparing first?";
      case "pay-yourself-first": return "How much could I move to savings on payday without running short?";
      default: return `Explain “${card.title}” with my own numbers.`;
    }
  }

  /** The local follow-up for each concept, its options in a stable shuffled order (the card's own question as is). */
  export function local(card: TeachingCard): LessonQuestion {
    const question = written(card);
    return question ? shuffled(question, `follow-up/${rawOf(card.concept)}`) : {
      question: card.question,
      options: card.options,
      correctIndex: card.correctIndex,
      explanation: card.reveal,
      whyWrong: [],
    };
  }

  /** The local follow-up as written, right answer first where the order does not matter; null for an unknown concept. */
  function written(card: TeachingCard): LessonQuestion | null {
    switch (rawOf(card.concept)) {
      case "three-baskets": {
        const everyday = fact(card, "teach:baskets:everyday");
        return {
          question: "Which basket can you change fastest, starting this week?",
          options: ["Regular essentials, like rent", "Occasional essentials, like a repair", "Everyday spending, like food and outings"],
          correctIndex: 2,
          explanation: `Everyday spending: it is decided day by day${everyday !== null ? `, and for you it is about ${euros(everyday)} a month` : ""}. That does not make it wasted: food is in it too. It is simply where a small change shows soonest.`,
          whyWrong: ["Rent and contracts are fixed for months at a time, so they change slowly.", "Occasional essentials arrive when they arrive. You can plan for them, but rarely change them this week.", null],
        };
      }
      case "safe-to-spend": {
        const budget = fact(card, "teach:safe:month");
        const actual = fact(card, "teach:safe:actual");
        const gap = fact(card, "teach:safe:gap");
        if (budget !== null && actual !== null && gap !== null) {
          const correctIndex = gap < -0.5 ? 0 : gap > 0.5 ? 1 : 2;
          const explanation = correctIndex === 0
            ? `You spend about ${euros(gap)} a month more than that room, so the money has to come from somewhere else: savings, credit or next month.`
            : correctIndex === 1
              ? `You spend about ${euros(gap)} a month less than that room. What is left could go to a buffer or to saving.`
              : "The two are about the same, so there is little room either way.";
          return {
            question: `In an average month you have about ${euros(budget)} of room for everyday spending, and you spend about ${euros(actual)} on everyday things. What does that tell you?`,
            options: ["You spend more than that room", "You spend less than that room", "The two are about the same"],
            correctIndex, explanation, whyWrong: [null, null, null],
          };
        }
        return {
          question: "Your weekly room in an average month comes from past averages. What can it miss?",
          options: ["A bill that lands this week", "Your usual monthly income", "Your usual essentials"],
          correctIndex: 0,
          explanation: "Averages smooth out timing. A bill due this week or a late payday is not in them, so check those first.",
          whyWrong: [null, "Your usual income is exactly what the average is built from.", "Your usual essentials are in the average already."],
        };
      }
      case "fixed-vs-spot": {
        const low = fact(card, "teach:fixed:min");
        const high = fact(card, "teach:fixed:max");
        return {
          question: "On a fixed-price contract, what can still make your electricity bill go up?",
          options: ["Using more electricity", "The hourly market price", "Nothing can change it"],
          correctIndex: 0,
          explanation: `The price per kWh stays the same for the whole term, so only how much you use moves the bill${low !== null && high !== null ? `. Yours moved between ${euros(low)} and ${euros(high)} a month` : ""}.`,
          whyWrong: [null, "The hourly market price moves a spot contract, not a fixed one.", "A fixed price fixes the price per kWh, not how much you use."],
        };
      }
      case "buffer-first": {
        const runway = fact(card, "teach:buffer:runway");
        const target = fact(card, "teach:buffer:target");
        const yours = runway === null ? "" : runway < 3
          ? ` Yours covers about ${months(runway)} months of essentials${target !== null ? `; three months would be about ${euros(target)}` : ""}.`
          : ` Yours covers about ${months(runway)} months of essentials, above the usual three.`;
        return {
          question: "A surprise €400 repair lands this month. With a buffer, where does the money come from?",
          options: ["The buffer, then you top it back up", "A credit card", "Skipping an essential bill"],
          correctIndex: 0,
          explanation: `That is what the buffer is for: a surprise cost does not have to go on credit.${yours}`,
          whyWrong: [null, "Credit for a surprise bill usually costs more than most savings or investments earn.", "A missed essential bill can bring fees and reminders on top."],
        };
      }
      case "compound-growth": {
        const paid = fact(card, "teach:compound:paid-in");
        const grown = fact(card, "teach:compound:grown");
        return {
          question: "If the money stays invested for longer, what happens to the yearly growth in that scenario?",
          options: ["It gets bigger each year", "It gets smaller each year", "It stays the same each year"],
          correctIndex: 0,
          explanation: `Each year’s growth is earned on a larger amount, earlier growth included${paid !== null && grown !== null ? `: in the scenario, ${euros(paid)} paid in became about ${euros(grown)}` : ""}. It is an illustration, not a promise. Investments can also lose value.`,
          whyWrong: [null, "The growth is earned on a growing amount, so in a steady scenario it grows rather than shrinks.", "That would be growth on the money paid in only. Here the growth itself grows too."],
        };
      }
      case "switching-bills": {
        const yearly = fact(card, "teach:switch:yearly");
        return {
          question: "How often is it worth checking the price of a regular bill like electricity or a phone plan?",
          options: ["About once a year", "Never: loyal customers get the best price", "Only when the service breaks"],
          correctIndex: 0,
          explanation: `New customers usually get better prices than loyal ones.${yearly !== null ? ` Your monthly bills add up to about ${euros(yearly)} a year, so a yearly check is worth a few minutes.` : ""}`,
          whyWrong: [null, "Providers usually keep their best prices for new customers.", "By then you may have paid the higher price for a long time, and a switch does not cut the service."],
        };
      }
      case "pay-yourself-first": {
        const income = fact(card, "teach:pyf:income");
        return {
          question: "When does pay yourself first move the money to savings?",
          options: ["On payday, before spending", "At the end of the month, from what is left", "Only when there is a bonus"],
          correctIndex: 0,
          explanation: `On payday, so saving is one decision instead of thirty${income !== null ? `. It works with any amount, even a small share of your ${euros(income)} a month` : ""}.`,
          whyWrong: [null, "Little is usually left at the end of the month, so saving what is left rarely works.", "Waiting for a bonus makes saving rare. A small fixed amount every payday adds up."],
        };
      }
      default:
        return null;
    }
  }
}

/** Where a person is in one lesson. Stored while a lesson is open, so "Ask Sisu" keeps the place. */
export interface LessonAttempt {
  readonly concept: string;
  /** The option picked on the card's question; null before. */
  readonly first: number | null;
  /** Follow-up options picked, in order. */
  readonly followUpPicks: readonly number[];
}

export namespace LessonAttempt {
  export type Phase = "question" | "followUp" | "complete";

  export function make(concept: ConceptId): LessonAttempt { return { concept: rawOf(concept), first: null, followUpPicks: [] }; }

  export function phase(attempt: LessonAttempt, card: TeachingCard, followUp: LessonQuestion): Phase {
    if (attempt.first === null) return "question";
    if (attempt.first === card.correctIndex) return "complete";
    return attempt.followUpPicks.includes(followUp.correctIndex) ? "complete" : "followUp";
  }

  /** The first pick. Only the first valid one counts. */
  export function chooseFirst(attempt: LessonAttempt, card: TeachingCard, index: number): LessonAttempt {
    if (attempt.first !== null || !Number.isInteger(index) || index < 0 || index >= card.options.length) return attempt;
    return { ...attempt, first: index };
  }

  /** A follow-up pick. A wrong one stays marked and the person can try another; a right one completes. */
  export function chooseFollowUp(attempt: LessonAttempt, card: TeachingCard, followUp: LessonQuestion, index: number): LessonAttempt {
    if (phase(attempt, card, followUp) !== "followUp") return attempt;
    if (!Number.isInteger(index) || index < 0 || index >= followUp.options.length || attempt.followUpPicks.includes(index)) return attempt;
    return { ...attempt, followUpPicks: [...attempt.followUpPicks, index] };
  }

  /** The follow-up choice states: a wrong pick `wrong`, the right one `correct` once picked, the rest `idle`. */
  export function followUpState(attempt: LessonAttempt, followUp: LessonQuestion, index: number): "idle" | "correct" | "wrong" {
    if (!attempt.followUpPicks.includes(index)) return "idle";
    return index === followUp.correctIndex ? "correct" : "wrong";
  }

  /** The kind line after the last wrong follow-up pick, or null. */
  export function followUpHint(attempt: LessonAttempt, followUp: LessonQuestion): string | null {
    const last = attempt.followUpPicks[attempt.followUpPicks.length - 1];
    if (last === undefined || last === followUp.correctIndex) return null;
    return `${followUp.whyWrong[last] ?? "Not quite."} Try another one.`;
  }

  export function decode(value: unknown): LessonAttempt | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.concept !== "string") return null;
    const first = typeof v.first === "number" && Number.isInteger(v.first) && v.first >= 0 ? v.first : null;
    const picks = Array.isArray(v.followUpPicks) ? v.followUpPicks.filter((p): p is number => typeof p === "number" && Number.isInteger(p) && p >= 0) : [];
    return { concept: v.concept, first, followUpPicks: first === null ? [] : [...new Set(picks)] };
  }
}
