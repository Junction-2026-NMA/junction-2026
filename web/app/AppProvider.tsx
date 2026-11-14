"use client";
// The React side of AppModel: the provider (SwiftUI `.environment(model)`) and the hooks screens use.
// Every store here is subscribe/getSnapshot with immutable snapshots, read through useSyncExternalStore.
//
//   const model = useAppModel();               // the AppModel: call its methods (model.setTab("ask"))
//   const app = useApp();                      // the whole AppState snapshot (re-renders on every change)
//   const tab = useAppSelector((s) => s.tab);  // one value (re-renders only when it changes)
//   const coach = useCoach();                  // CoachStoreState: session, voice, quizChoices, deciding…
//   const session = useCoachSession();         // the CoachSession or null; its state: useCoachSessionState()
//   const voice = useVoice();                  // VoiceControllerState or null; the controller: useVoiceController()
import { createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { CoachSession, CoachSessionState } from "@/web/core/CoachSession";
import { CoachText } from "@/web/core/CoachPresentation";
import type { RiveBindings } from "@/web/core/RiveContract";
import type { VoiceController, VoiceControllerState } from "@/web/voice/VoiceController";
import type { AppModel } from "./AppModel";
import type { AppState } from "./AppState";
import type { CoachStore, CoachStoreState } from "./CoachStore";

const AppModelContext = createContext<AppModel | null>(null);

export function AppProvider({ model, children }: { model: AppModel; children: ReactNode }) {
  return <AppModelContext.Provider value={model}>{children}</AppModelContext.Provider>;
}

/** The AppModel (Swift `@Environment(AppModel.self) private var model`). Throws outside <AppProvider>. */
export function useAppModel(): AppModel {
  const model = useContext(AppModelContext);
  if (!model) throw new Error("useAppModel() needs <AppProvider> (web/app/SisuApp.tsx)");
  return model;
}

/** The whole app snapshot. Re-renders on every change of the model. */
export function useApp(): AppState {
  const model = useAppModel();
  return useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
}

/** One value of the app snapshot. Re-renders only when `isEqual` (Object.is by default) says it changed.
 * A selector may build a new object or array: pass an `isEqual` that compares by content then. */
export function useAppSelector<T>(select: (state: AppState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const model = useAppModel();
  return useSelected(model.subscribe, model.getSnapshot, select, isEqual);
}

/** The CoachStore (methods: ask, investigate, decide, choose, quiz, voiceDown, voiceUp…). */
export function useCoachStore(): CoachStore {
  return useAppModel().coach;
}

/** The CoachStore snapshot: session, voice, fellBackToSample, quizChoices, deciding, decisionNotices, cheering. */
export function useCoach(): CoachStoreState {
  const coach = useCoachStore();
  return useSyncExternalStore(coach.subscribe, coach.getSnapshot, coach.getSnapshot);
}

/** The current CoachSession (Swift `model.coach.session`), null before a customer is chosen. */
export function useCoachSession(): CoachSession | null {
  return useCoach().session;
}

const noSubscribe = () => () => undefined;
const nothing = () => null;

/** The current session's state (Swift `@ObservedObject var session`), null without a session.
 * Pass a session to watch that one instead of the store's. */
export function useCoachSessionState(session?: CoachSession | null): CoachSessionState | null {
  const current = useCoachSession();
  const watched = session === undefined ? current : session;
  return useSyncExternalStore(watched?.subscribe ?? noSubscribe, watched?.getSnapshot ?? nothing, watched?.getSnapshot ?? nothing);
}

/** Swift `model.coach.dataTag`: "Mock data" / "Sample data", null when live. Follows the session. */
export function useCoachDataTag(): string | null {
  const session = useCoachSession();
  useCoachSessionState(session);
  return session ? CoachText.dataTag(session.dataLabel) : null;
}

/** The push-to-talk controller of the current session (Swift `store.voice`), or null. */
export function useVoiceController(): VoiceController | null {
  return useCoach().voice;
}

/** The voice controller's state (state, notice, clipsPlayed, isMuted…), null without a session. */
export function useVoice(controller?: VoiceController | null): VoiceControllerState | null {
  const current = useVoiceController();
  const watched = controller === undefined ? current : controller;
  return useSyncExternalStore(watched?.subscribe ?? noSubscribe, watched?.getSnapshot ?? nothing, watched?.getSnapshot ?? nothing);
}

/** Swift `store.voiceState`: what the Rive VoiceButton shows ("idle" without a session). */
export function useVoiceState(): RiveBindings.VoiceState {
  return useVoice()?.state ?? "idle";
}

/** useSyncExternalStore with a selector: keeps the previous result while `isEqual` holds. */
function useSelected<S, T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => S,
  select: (state: S) => T, isEqual: (a: T, b: T) => boolean): T {
  const cache = useRef<{ snapshot: S; select: (state: S) => T; value: T } | null>(null);
  const read = (): T => {
    const snapshot = getSnapshot();
    const last = cache.current;
    if (last && last.snapshot === snapshot && last.select === select) return last.value;
    const value = select(snapshot);
    if (last && isEqual(last.value, value)) {
      cache.current = { snapshot, select, value: last.value };
      return last.value;
    }
    cache.current = { snapshot, select, value };
    return value;
  };
  return useSyncExternalStore(subscribe, read, read);
}
