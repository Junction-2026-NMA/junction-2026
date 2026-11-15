/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// The requirement a question states, read on the client when the backend sent none (web addition, QA of 15 Nov).
// The hosted backend before the rework sends no requirements, so after "electricity contracts of 12 months or
// less" a 24-month contract still came back as "Best match". Only the contract length is read. Each offer is judged
// the way lib/agent/research/requirements.ts judges it (a length the page does not state is a miss, never a match),
// and the best offer is chosen the way lib/agent/research/compare.ts chooses it. Nothing here computes a figure.
import type { Offer, ResearchResult } from "./CoachModels";
import { OfferPresenter } from "./CoachPresentation";

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", six: "6", nine: "9", twelve: "12", eighteen: "18",
  "twenty-four": "24", "twenty four": "24", "thirty-six": "36", "thirty six": "36",
};
const WORD = /\b(one|two|three|four|six|nine|twelve|eighteen|twenty[- ]four|thirty[- ]six)\b/g;
const N = "(\\d{1,2})";
const MONTHS = "(?:-| )?(?:months?|mos?|kk|kuukau\\w*)";
const YEARS = "(?:-| )?(?:years?|yrs?|vuo\\w*)";
const THING = "(?: (?:contracts?|deals?|plans?|offers?|subscriptions?|terms?))?";
const OR_LESS = " or (?:less|shorter|fewer)";
const AT_MOST = "(?:at most|up to|max(?:imum)?|no (?:more|longer) than|not (?:more|longer) than|within|enintään|korkeintaan)(?: of)?";

const PATTERNS: readonly (readonly [RegExp, number])[] = [
  [new RegExp(`${N}${MONTHS}${THING}${OR_LESS}`), 1],
  [new RegExp(`${AT_MOST} ${N}${MONTHS}`), 1],
  [new RegExp(`${N}${MONTHS}${THING} (?:max(?:imum)?|at most|tops)\\b`), 1],
  [new RegExp(`${N}${YEARS}${THING}${OR_LESS}`), 12],
  [new RegExp(`${AT_MOST} ${N}${YEARS}`), 12],
];

export namespace AskedRequirements {
  /** The longest contract the question allows: `12` for "12 months or less", "at most 12 months", "up to 12
   *  months", "max 12 months", "a year or less". Null when it names no such limit. */
  export function maxContractMonths(question: string): number | null {
    const text = ` ${question.toLowerCase().replace(/[’]/g, "'")} `
      .replace(/\b(a|an) (year|month)\b/g, "1 $2")
      .replace(WORD, (word) => NUMBER_WORDS[word] ?? word);
    for (const [pattern, scale] of PATTERNS) {
      const match = pattern.exec(text);
      const amount = match ? Number(match[1]) * scale : NaN;
      if (Number.isFinite(amount) && amount >= 1 && amount <= 60) return amount;
    }
    return null;
  }

  /** True when the backend stated the requirements itself: then its judgement stands. */
  export function stated(research: ResearchResult): boolean {
    const req = research.requirements;
    const hasReq = req != null && typeof req === "object" && Object.keys(req).length > 0;
    return hasReq || (typeof research.requirementsText === "string" && research.requirementsText.trim() !== "");
  }

  /** Each offer judged against the contract limit, with the backend's words for a miss. */
  export function judge(offers: readonly Offer[], max: number): Offer[] {
    return offers.map((offer) => {
      const months = offer.contractMonths;
      const misses = months == null || !Number.isFinite(months)
        ? ["contract length not stated"]
        : months > max ? [`${months}-month contract (you asked for ${max} months or less)`] : [];
      return { ...offer, meetsRequirements: misses.length === 0, misses };
    });
  }

  /** Like compare.ts: among comparable offers that meet the requirements and save money, the cheapest, preferring
   *  one whose fees are all stated. Null when none qualifies. */
  export function best(offers: readonly Offer[]): Offer | null {
    const qualifying = offers
      .filter((offer) => offer.comparable && OfferPresenter.qualifies(offer) === true && (offer.estimatedYearlySavingEur ?? 0) > 0)
      .sort((a, b) => (a.estimatedMonthlyCostEur ?? Infinity) - (b.estimatedMonthlyCostEur ?? Infinity));
    return qualifying.find((offer) => !OfferPresenter.feesUnknown(offer)) ?? qualifying[0] ?? null;
  }

  /** The research as if the backend had sent the requirement the question states. Unchanged when the backend
   *  stated requirements itself or the question names none. */
  export function apply(research: ResearchResult, question: string): ResearchResult {
    if (stated(research)) return research;
    const max = maxContractMonths(question);
    if (max == null) return research;
    const offers = judge(research.offers, max);
    const matchingCount = offers.filter((offer) => offer.comparable && offer.meetsRequirements === true).length;
    return {
      ...research, offers, best: best(offers), requirements: { maxContractMonths: max },
      requirementsText: `contract of ${max} months or less`, matchingCount, noMatch: matchingCount === 0,
    };
  }

  /** Offers read from the pages without a research result (another bill of the same turn): judged against the
   *  question's limit unless the backend already marked one as missing a requirement. Null when nothing changes. */
  export function judgeOffers(offers: readonly Offer[], question: string): Offer[] | null {
    if (offers.some((offer) => OfferPresenter.qualifies(offer) === false)) return null;
    const max = maxContractMonths(question);
    return max == null ? null : judge(offers, max);
  }
}
