// Launch options of the voice lab and the teaching path: port of ios/Sisu/Voice/VoiceLaunch.swift, read from the
// URL query (the iOS argument names minus `-sisu.`).
//
//   voicelab=1          the Path tab shows the voice lab instead of the path
//   voicefixture=1      the talk button sends a bundled one-second clip instead of the microphone
//   voiceauto=1         run one push-to-talk turn by itself once the lab is on screen (fixture or microphone)
//   voicehold=<s>       how long that automatic press holds, in seconds (default 0.7)
//   lesson=<n>          open lesson n (1 to 7) when the path has loaded
//   lessonAnswer=<n>    and answer it with option n (1 to 3)
//   lessonsDone=<n>     start with the first n lessons done (screenshots only)
import { launchQuery, launchValue } from "@/web/app/LaunchOptions";

export interface VoiceLaunch {
  readonly voiceLab: boolean;
  readonly voiceFixture: boolean;
  readonly voiceAuto: boolean;
  readonly voiceHold: number | null;
  readonly lesson: number | null;
  readonly lessonAnswer: number | null;
  readonly lessonsDone: number | null;
}

const integer = (text: string | null): number | null => (text !== null && /^[+-]?\d+$/.test(text) ? Number(text) : null);
const decimal = (text: string | null): number | null => {
  const value = text === null ? NaN : Number(text);
  return Number.isFinite(value) ? value : null;
};

let cached: VoiceLaunch | null = null;

export const VoiceLaunch = {
  parse(query: URLSearchParams): VoiceLaunch {
    const value = (name: string) => launchValue(query, name);
    return {
      voiceLab: value("voicelab") === "1",
      voiceFixture: value("voicefixture") === "1",
      voiceAuto: value("voiceauto") === "1",
      voiceHold: decimal(value("voicehold")),
      lesson: integer(value("lesson")),
      lessonAnswer: integer(value("lessonAnswer")),
      lessonsDone: integer(value("lessonsDone")),
    };
  },

  /** Swift `VoiceLaunch.current`. */
  current(): VoiceLaunch {
    cached ??= VoiceLaunch.parse(launchQuery());
    return cached;
  },
} as const;
