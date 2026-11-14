// Launch options of the coach screen: port of ios/Sisu/Coach/CoachLaunch.swift, read from the URL query (the
// iOS argument names minus `-sisu.`). Each one drives the Ask screen once its session is ready.
//
//   coachAsk=<question>                 ask this question
//   coachInvestigate=1                  start "Look into my finances"
//   coachQuiz=<index>                   when the answer is done, pick this option of its quiz
//   coachDecide=approve|decline         when the answer is done, decide on its action
//   coachScroll=offers|quiz|action|impact|research|evidence|end   scroll the newest answer to that card
import { launchQuery, launchValue } from "./LaunchOptions";

export interface CoachLaunch {
  readonly ask: string | null;
  readonly investigate: boolean;
  readonly quiz: number | null;
  readonly decide: string | null;
  readonly scroll: string | null;
}

let cached: CoachLaunch | null = null;

export const CoachLaunch = {
  isEmpty(launch: CoachLaunch): boolean {
    return launch.ask === null && !launch.investigate && launch.quiz === null && launch.decide === null && launch.scroll === null;
  },

  parse(query: URLSearchParams): CoachLaunch {
    const value = (name: string) => launchValue(query, name);
    const quiz = value("coachQuiz");
    return {
      ask: value("coachAsk"),
      investigate: value("coachInvestigate") === "1",
      quiz: quiz !== null && /^[+-]?\d+$/.test(quiz) ? Number(quiz) : null,
      decide: value("coachDecide"),
      scroll: value("coachScroll"),
    };
  },

  /** Swift `CoachLaunch.current`. */
  current(): CoachLaunch {
    cached ??= CoachLaunch.parse(launchQuery());
    return cached;
  },
} as const;
