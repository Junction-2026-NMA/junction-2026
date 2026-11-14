"use client";
// The teaching path: a fixed header (title, streak and berries, progress), then a winding path of seven lessons
// built from the customer's own numbers. Every lesson opens in any order; the path only suggests the next one.
// With `?voicelab=1` this tab shows the voice lab instead. Port of ios/Sisu/Features/Path/PathScreen.swift.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FixtureAPI } from "@/web/core/API";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { CelebrationOverlay } from "@/web/features/Main/CelebrationOverlay";
import { Screen } from "@/web/shared/Screen";
import { VoiceLaunch } from "@/web/voice/VoiceLaunch";
import VoiceLabScreen from "@/web/voice/VoiceLabScreen";
import { LessonPathPresenter } from "@/web/core/AppLogic/LessonPath";
import { LessonSheet } from "./LessonSheet";
import { PathHeader } from "./PathHeader";
import { PathModel } from "./PathModel";
import { ErrorState, PathLoading } from "./PathStates";
import { PathTrail } from "./PathTrail";
import "./path.css";

export default function PathScreen() {
  return VoiceLaunch.current().voiceLab ? <VoiceLabScreen /> : <LessonPathScreen />;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function LessonPathScreen() {
  const model = useAppModel();
  const [path] = useState(() => new PathModel());
  const snapshot = useSyncExternalStore(path.subscribe, path.getSnapshot, path.getSnapshot);
  const didApplyLaunch = useRef(false);
  /** Screenshots: the option to pick in the lesson the launch options opened. */
  const [autoAnswer, setAutoAnswer] = useState<number | null>(null);

  const customer = useAppSelector((s) => s.customer);
  const isLive = useAppSelector((s) => s.isLive);
  const customersKind = useAppSelector((s) => s.customersState.kind);
  const sampleOnly = useAppSelector((s) => s.sampleOnly);
  const baseURL = useAppSelector((s) => s.baseURLString);
  const customerId = customer?.customerId ?? FixtureAPI.customerIds[0] ?? "CUST04974";
  const loadKey = `${customerId}|${isLive}|${customersKind === "loaded"}`;

  useEffect(() => {
    let cancelled = false;
    /** The screenshot harness: lessons already done, a lesson open. */
    async function applyLaunch(isCancelled: () => boolean) {
      if (didApplyLaunch.current || path.state.kind !== "loaded") return;
      didApplyLaunch.current = true;
      const launch = VoiceLaunch.current();
      if (launch.lessonsDone !== null && model.launch.screenshots) path.pretendDone(launch.lessonsDone);
      const lesson = launch.lesson;
      if (lesson !== null && lesson >= 1 && lesson <= path.cards.length) {
        await sleep(400);
        if (isCancelled()) return;
        setAutoAnswer(launch.lessonAnswer);
        path.open(path.cards[lesson - 1]);
      }
    }
    if (!(customersKind === "loaded" || customersKind === "idle" || sampleOnly)) return;
    const run = async () => {
      await path.load(customerId, isLive, baseURL, model.launch.defaults);
      if (cancelled) return;
      await applyLaunch(() => cancelled);
    };
    void run();
    return () => { cancelled = true; };
    // The Swift `.task(id: loadKey)`: runs again only when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  const reload = () => { void path.retry(customerId, isLive, baseURL, model.launch.defaults); };

  const { state } = snapshot;
  return (
    <>
      <Screen header={<PathHeader path={snapshot} />} className="sisu-path" testId="screen.path">
        {state.kind === "failed" ? (
          <ErrorState message={state.message} retry={reload} />
        ) : state.kind === "empty" ? (
          <ErrorState message={LessonPathPresenter.emptyText} retry={reload} />
        ) : state.kind === "loaded" ? (
          <PathTrail path={path} snapshot={snapshot} open={(card) => path.open(card)} />
        ) : (
          <PathLoading />
        )}
      </Screen>
      <CelebrationOverlay celebration={snapshot.celebration} onDismiss={() => path.clearCelebration()} />
      <LessonSheet
        lesson={snapshot.openLesson}
        path={path}
        autoAnswer={autoAnswer}
        onClose={() => path.closeLesson()}
        onClosed={() => setAutoAnswer(null)}
      />
    </>
  );
}
