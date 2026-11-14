"use client";
// The first run: Welcome, the three baskets, choosing a demo profile (with the demo disclosure), and a sorting
// moment that lasts exactly as long as the profile's overview takes to load. Then RootView shows Today.
// The state is web/core's OnboardingFlow on AppModel; this file only lays it out and passes on taps.
// Port of ios/Sisu/Features/Onboarding/OnboardingView.swift.
//
// Screens slide in from the right and out to the left going forward (the other way going back), with
// OnboardingMotion.page (spring 0.5 x motionScale / 0.86), as SwiftUI's .move(edge:) + .opacity. Only taps that go
// through `move` animate, like Swift's withAnimation; every other change is instant, and so is everything with
// Reduce Motion. `motionDelay` applies each tap that many seconds later.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { DemoCustomer } from "@/web/core/Models";
import { OnboardingFlow, OnboardingStep } from "@/web/core/AppLogic/Onboarding";
import { useApp, useAppModel } from "@/web/app/AppProvider";
import { useReducedMotion } from "@/web/theme/motion";
import { OnboardingMotion } from "./OnboardingMotion";
import { OnboardingTopBar } from "./OnboardingTopBar";
import { PromiseStep, ReadingStep, WelcomeStep } from "./OnboardingSteps";
import { ProfileStep } from "./ProfileStep";
import "./onboarding.css";

interface PageLayer {
  readonly id: number;
  readonly step: OnboardingStep;
  /** "shown" sits still; "entering" and "leaving" play their slide. */
  readonly phase: "shown" | "entering" | "leaving";
  readonly forward: boolean;
}

/** A move asked for by a tap: consumed by the next screen change, forgotten if none follows straight away. */
interface PendingMove {
  readonly forward: boolean;
  readonly at: number;
}

const PENDING_WINDOW_MS = 250;

export default function OnboardingView() {
  const model = useAppModel();
  const app = useApp();
  const reduceMotion = useReducedMotion();
  const flow = app.onboarding;
  const scale = model.launch.motionScale;
  const page = OnboardingMotion.page(reduceMotion, scale);

  /** The sorting moment shows only when the load takes longer than a blink; until then the chosen profile card
   *  stays on screen. Nothing waits for this: Today opens the moment the overview is loaded. */
  const [showReading, setShowReading] = useState(false);
  /** The screen on show: the profile choice stays up for the first moments of a load. */
  const shownStep: OnboardingStep = flow.step === "reading" && !showReading ? "profile" : flow.step;

  // Leaving the sorting moment forgets it (adjusting state while rendering, as React recommends over an effect).
  if (flow.step !== "reading" && showReading) setShowReading(false);

  const latest = useRef({ app, reduceMotion });
  useLayoutEffect(() => {
    latest.current = { app, reduceMotion };
  });
  const pendingRef = useRef<PendingMove | null>(null);

  /** Swift `move(forward:_:)`: remembers the direction, then applies the change (after `motionDelay`). */
  const move = (forward: boolean, change: () => void) => {
    const apply = () => {
      pendingRef.current = { forward, at: performance.now() };
      change();
    };
    const delay = model.launch.motionDelay;
    if (delay > 0) window.setTimeout(apply, Math.round(delay * 1000));
    else apply();
  };

  // .task(id: flow.step): the sorting moment comes in after 400 ms if the overview is still loading.
  useEffect(() => {
    if (flow.step !== "reading") return;
    const timer = window.setTimeout(() => {
      const current = latest.current.app.onboarding;
      if (current.step !== "reading" || !OnboardingFlow.isActive(current)) return;
      move(true, () => setShowReading(true));
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.step]);

  // .task(id: model.overviewState): finish the moment this customer's overview is loaded; show the failure.
  const overviewKey = app.overviewState.kind === "failed" ? `failed|${app.overviewState.message}` : app.overviewState.kind;
  useEffect(() => {
    const current = latest.current.app;
    if (current.onboarding.step !== "reading") return;
    if (current.overviewState.kind === "loaded" && current.overview?.customerId === current.customer?.customerId) {
      model.finishOnboarding();
    } else if (current.overviewState.kind === "failed") {
      move(true, () => setShowReading(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewKey]);

  const layers = usePageLayers(shownStep, pendingRef, reduceMotion, (page?.durationMs ?? 0) + 300);

  const screen = (step: OnboardingStep): ReactNode => {
    switch (step) {
      case "welcome": return <WelcomeStep next={() => move(true, () => model.onboardingContinue())} />;
      case "promise": return <PromiseStep next={() => move(true, () => model.onboardingContinue())} />;
      case "profile":
        return <ProfileStep mode="onboarding" choose={(customer: DemoCustomer) => move(true, () => model.chooseInOnboarding(customer))} />;
      case "reading": return <ReadingStep />;
    }
  };

  return (
    <div className="sisu-onboarding" data-testid="screen.onboarding" data-step={shownStep}>
      <OnboardingTopBar
        flow={flow}
        shownStep={shownStep}
        page={page}
        onBack={() => move(false, () => model.onboardingBack())}
        onSkip={() => move(true, () => model.onboardingSkip())}
      />
      <div className="sisu-onb-pages">
        {layers.list.map((layer) => (
          <div
            key={layer.id}
            className="sisu-onb-page"
            data-phase={layer.phase}
            aria-hidden={layer.phase === "leaving" || undefined}
            inert={layer.phase === "leaving" || undefined}
            style={layer.phase === "shown" || !page ? undefined : {
              animationDuration: `${page.durationMs}ms`,
              animationTimingFunction: page.easing,
              ["--sisu-onb-shift" as string]: shift(layer),
            }}
            onAnimationEnd={(event) => { if (event.target === event.currentTarget) layers.settle(layer.id); }}
          >
            {screen(layer.step)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where a layer slides from (entering) or to (leaving): the trailing edge going forward, the leading edge back. */
function shift(layer: PageLayer): string {
  const fromTrailing = layer.phase === "entering" ? layer.forward : !layer.forward;
  return fromTrailing ? "100%" : "-100%";
}

/** The ZStack with `.id(shownStep).transition(...)`: the screen on show, plus the one sliding out. */
function usePageLayers(shownStep: OnboardingStep, pendingRef: { current: PendingMove | null }, reduceMotion: boolean, fallbackMs: number) {
  const [list, setList] = useState<readonly PageLayer[]>(() => [{ id: 0, step: shownStep, phase: "shown", forward: true }]);
  const nextId = useRef(1);

  useLayoutEffect(() => {
    const move = pendingRef.current;
    const top = list[list.length - 1];
    if (top && top.step === shownStep && top.phase !== "leaving") return;
    pendingRef.current = null;
    const id = nextId.current;
    nextId.current += 1;
    const animated = move !== null && performance.now() - move.at < PENDING_WINDOW_MS && !reduceMotion;
    if (!animated) {
      setList([{ id, step: shownStep, phase: "shown", forward: true }]);
      return;
    }
    const kept = list.filter((layer) => layer.phase !== "leaving" || layer.step !== shownStep);
    setList([
      ...kept.map((layer): PageLayer => ({ ...layer, phase: "leaving", forward: move.forward })),
      { id, step: shownStep, phase: "entering", forward: move.forward },
    ]);
    // `list` is read as of this render on purpose: only a new shown step starts a move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownStep]);

  // A leaving layer is removed by the end of its slide even if no animationend arrives.
  const leavingIds = list.filter((l) => l.phase === "leaving").map((l) => l.id).join(",");
  useEffect(() => {
    if (leavingIds === "") return;
    const timer = window.setTimeout(() => setList((current) => current.filter((l) => l.phase !== "leaving")), fallbackMs);
    return () => window.clearTimeout(timer);
  }, [leavingIds, fallbackMs]);

  const settle = (id: number) => {
    setList((current) => {
      const layer = current.find((l) => l.id === id);
      if (!layer) return current;
      if (layer.phase === "leaving") return current.filter((l) => l.id !== id);
      return current.map((l) => (l.id === id && l.phase === "entering" ? { ...l, phase: "shown" } : l));
    });
  };

  return { list, settle };
}
