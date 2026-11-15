// Launch options of the Talk screen: port of ios/Sisu/Features/Talk/TalkLaunch.swift, read from the URL query (the
// iOS argument names minus `-sisu.`).
//
//   tab=sisu (talk, ask)     open the Sisu tab (AppTab.fromArgument); typing and voice are one screen now
//   talkStart=1              start a conversation once Talk is first on screen (once per page load). With
//                            voicefixture=1 the conversation "hears" the bundled clip once instead of the microphone.
//   talkFixtureDelay=<s>     seconds of quiet before that clip is "spoken" (default 1, at most 30)
import { launchQuery, launchValue } from "@/web/app/LaunchOptions";

export interface TalkLaunch {
  readonly startsConversation: boolean;
  readonly fixtureDelay: number;
}

let cached: TalkLaunch | null = null;
let startHandled = false;

export const TalkLaunch = {
  parse(query: URLSearchParams): TalkLaunch {
    const value = (name: string) => launchValue(query, name);
    const delay = Number(value("talkFixtureDelay"));
    return {
      startsConversation: value("talkStart") === "1",
      fixtureDelay: value("talkFixtureDelay") !== null && Number.isFinite(delay) && delay >= 0 ? Math.min(delay, 30) : 1,
    };
  },

  /** Swift `TalkLaunch.current`. */
  current(): TalkLaunch {
    cached ??= TalkLaunch.parse(launchQuery());
    return cached;
  },

  /** `talkStart=1` has been carried out (it must not run again when Talk comes back on screen). */
  get startHandled(): boolean { return startHandled; },
  markStartHandled(): void { startHandled = true; },
} as const;
