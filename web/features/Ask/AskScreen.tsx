"use client";
// The coach screen: ask Sisu by text (or voice, through the store's seam), watch the answer and its stage cards
// arrive, answer the teaching question, approve or decline the simulated switch. Port of AskScreen in
// ios/Sisu/Features/Ask/AskScreen.swift. All logic is in web/core (CoachSession and the presenters) and in
// web/app/CoachStore; the files of this folder lay it out.
import { useCoachSession, useCoachStore } from "@/web/app/AppProvider";
import type { CoachSession } from "@/web/core/CoachSession";
import { CoachConversation } from "./CoachConversation";
import { PlaceholderScreen } from "./PlaceholderScreen";

/** One key per session object (Swift `.id(ObjectIdentifier(session))`): a new session starts a fresh screen. */
const sessionKeys = new WeakMap<CoachSession, number>();
let nextKey = 0;
function keyOf(session: CoachSession): number {
  const known = sessionKeys.get(session);
  if (known !== undefined) return known;
  nextKey += 1;
  sessionKeys.set(session, nextKey);
  return nextKey;
}

export default function AskScreen() {
  const store = useCoachStore();
  const session = useCoachSession();
  if (!session) {
    return <PlaceholderScreen title="Ask Sisu" mood="idle" line="Pick a profile and Sisu is ready for your questions." testId="screen.ask" />;
  }
  return <CoachConversation key={keyOf(session)} session={session} store={store} />;
}
